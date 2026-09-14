// ENVIAR-LEMBRETES — o relogio que acorda e avisa quem pediu.
//
// POR QUE ISTO E UMA FUNCAO NO SERVIDOR
// Uma pagina da web nao consegue agendar um aviso para depois: com o app
// fechado, nao ha codigo rodando. O unico caminho e o contrario — o servidor
// manda, e o navegador acorda o service worker para mostrar. Esta funcao e
// esse servidor.
//
// QUEM CHAMA
// O pg_cron, de hora em hora, no minuto 5 (ver a migracao agenda_lembretes).
// A funcao olha a hora local de cada pessoa e envia so para quem chegou na
// hora escolhida e ainda nao recebeu hoje.
//
// DOIS CAMINHOS DE ENTREGA
// Push para cada aparelho cadastrado. Se a pessoa nao tem aparelho nenhum
// (nao aceitou, ou esta num iPhone sem instalar o app) ou se todos falharam,
// cai para e-mail, pelo mesmo Brevo que manda as boas-vindas. A ideia e que
// ninguem que pediu lembrete fique sem aviso.
//
// COMO A FUNCAO SABE QUE QUEM CHAMOU FOI O RELOGIO
// verify_jwt fica DESLIGADO, e a prova vem de um segredo guardado no cofre
// (Vault) do proprio projeto: o pg_cron manda no cabecalho x-cron-segredo e
// a funcao compara com o que le do cofre. Assim o agendamento no banco nao
// precisa carregar a chave de servico, que e a chave mais poderosa que
// existe aqui — e o segredo nunca sai do projeto.
//
// AS CHAVES DE PUSH NASCEM AQUI DENTRO
// Na primeira execucao a funcao gera o par VAPID e o guarda no cofre do
// projeto. A metade privada, que assina cada envio, nunca existe fora do
// Supabase: nao foi digitada num painel, nao passou por e-mail, nao esta em
// arquivo nenhum. Nas execucoes seguintes ela so le o que ja existe.
//
// SEGREDOS QUE PRECISAM SER CONFIGURADOS A MAO: nenhum para o push.
// Para o e-mail: BREVO_API_KEY, REMETENTE_EMAIL, REMETENTE_NOME (ja existiam).

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SITE = "https://miguellpissinato-png.github.io/MINDT/";

Deno.serve(async (req) => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!(await chamadaLegitima(db, req))) {
    return new Response("nao autorizado", { status: 401 });
  }

  const chaves = await obterVapid(db);
  const contato = Deno.env.get("VAPID_CONTATO") || "mailto:mindt.contact@gmail.com";
  if (chaves) webpush.setVapidDetails(contato, chaves.publica, chaves.privada);

  // Quem esta na hora. A conta e feita no Postgres porque e ele que sabe
  // converter fuso horario ('America/Sao_Paulo') sem sofrer com horario de
  // verao — e porque assim uma consulta so resolve todas as pessoas.
  const { data: devidos, error } = await db.rpc("lembretes_da_hora");
  if (error) {
    console.error("lembretes_da_hora:", error);
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 });
  }

  const relatorio = { olhados: devidos?.length ?? 0, push: 0, email: 0, semNada: 0 };

  for (const pessoa of devidos ?? []) {
    const recado = await montarRecado(db, pessoa.user_id);
    // Dia sem nada a cobrar nao vira notificacao. Um aviso que chega todo dia
    // sem ter o que dizer e o caminho mais curto para a pessoa desligar tudo.
    if (!recado) {
      await marcarEnviado(db, pessoa.user_id, pessoa.hoje_local);
      relatorio.semNada++;
      continue;
    }

    let entregou = false;
    if (chaves) {
      entregou = await mandarPush(db, pessoa.user_id, recado);
      if (entregou) relatorio.push++;
    }
    if (!entregou && pessoa.email) {
      entregou = await mandarEmail(pessoa.email, recado);
      if (entregou) relatorio.email++;
    }
    await marcarEnviado(db, pessoa.user_id, pessoa.hoje_local);
  }

  console.log("lembretes:", JSON.stringify(relatorio));
  return new Response(JSON.stringify(relatorio), {
    headers: { "Content-Type": "application/json" },
  });
});

// Compara o cabecalho com o segredo do cofre, em tempo constante para nao
// entregar o valor letra a letra a quem ficar medindo o tempo da resposta.
async function chamadaLegitima(db: any, req: Request) {
  const veio = req.headers.get("x-cron-segredo") || "";
  // O schema `vault` nao e exposto pela API, e nem deve ser. A funcao SQL
  // segredo_do_cron() e a unica porta, e so a chave de servico a executa.
  const { data, error } = await db.rpc("segredo_do_cron");
  if (error || !data) {
    console.error("cofre:", error);
    return false;
  }
  return iguais(veio, String(data));
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── As chaves de push ─────────────────────────────────────────────────
// O par VAPID prova ao servico de push (Google, Apple, Mozilla) que quem
// mandou a mensagem foi mesmo este servidor. A metade publica vai no
// navegador; a privada assina. Trocar o par depois invalidaria todos os
// aparelhos ja inscritos, por isso guardar_vapid() nunca sobrescreve.

async function obterVapid(db: any) {
  const { data } = await db.rpc("vapid_do_cofre");
  const linha = Array.isArray(data) ? data[0] : data;
  if (linha?.publica && linha?.privada) {
    return { publica: linha.publica, privada: linha.privada };
  }

  const par = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  );
  // A publica vai como o ponto cru de 65 bytes, que e o formato que o
  // navegador espera em applicationServerKey.
  const cru = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  const publica = base64url(cru);
  const privada = jwk.d!;   // o escalar de 32 bytes, ja em base64url

  const { data: guardou, error } = await db.rpc("guardar_vapid", {
    p_publica: publica, p_privada: privada,
  });
  if (error) { console.error("guardar_vapid:", error); return null; }
  // false = alguem gerou um par entre a leitura e a gravacao. Le de novo,
  // para os dois lados ficarem com o mesmo par.
  if (guardou === false) return await obterVapid(db);

  console.log("par VAPID criado. Chave publica:", publica);
  return { publica, privada };
}

function base64url(bytes: Uint8Array) {
  let txt = "";
  for (const b of bytes) txt += String.fromCharCode(b);
  return btoa(txt).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── O que dizer ───────────────────────────────────────────────────────
// Le o mesmo blob JSON que o app grava. As datas vem em dois formatos —
// createdAt em ISO e o prazo como dd/mm/aaaa, do calendario — entao tudo
// passa por dataISO antes de comparar.

function dataISO(v: unknown): string {
  if (!v) return "";
  const t = String(v).trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : t.slice(0, 10);
}

async function montarRecado(db: any, userId: string) {
  const { data } = await db.from("user_data").select("data").eq("user_id", userId).maybeSingle();
  const estado = data?.data;
  if (!estado) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const tarefas = (estado.tasks ?? []).filter((t: any) => !t.done);
  const vencemHoje = tarefas.filter((t: any) => dataISO(t.deadline) === hoje);
  const atrasadas  = tarefas.filter((t: any) => {
    const d = dataISO(t.deadline);
    return d && d < hoje;
  });

  // Os itens do dia so contam se o `diario` for de hoje; senao ele e a sobra
  // de ontem e ja nao diz nada.
  const diario = estado.diario && estado.diario.data === hoje ? estado.diario : null;
  const faltam = diario
    ? ["leitura", "estudo", "grana", "exercicio"].filter((k) => !diario[k]).length
    : 4;

  if (!vencemHoje.length && !atrasadas.length && faltam === 0) return null;

  const partes: string[] = [];
  if (vencemHoje.length) {
    partes.push(vencemHoje.length === 1
      ? `1 tarefa vence hoje: ${vencemHoje[0].name}`
      : `${vencemHoje.length} tarefas vencem hoje`);
  }
  if (atrasadas.length) {
    partes.push(atrasadas.length === 1 ? "1 tarefa está atrasada" : `${atrasadas.length} tarefas atrasadas`);
  }
  if (faltam) {
    partes.push(faltam === 4 ? "e os 4 itens do dia estão em aberto"
                             : `e ${faltam} ${faltam === 1 ? "item do dia" : "itens do dia"} em aberto`);
  }

  const nome = estado.perfil?.name ? `${estado.perfil.name}, ` : "";
  return {
    titulo: "O Ticolino passou pra lembrar 🐹",
    corpo: nome + partes.join(", ").replace(/, e /, " e ") + ".",
    itens: [
      ...vencemHoje.map((t: any) => ({ nome: t.name, quando: "vence hoje" })),
      ...atrasadas.slice(0, 5).map((t: any) => ({ nome: t.name, quando: "atrasada" })),
    ],
  };
}

// ─── Push ──────────────────────────────────────────────────────────────

async function mandarPush(db: any, userId: string, recado: any) {
  const { data: aparelhos } = await db.from("lembrete_dispositivos")
    .select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!aparelhos?.length) return false;

  let algum = false;
  for (const ap of aparelhos) {
    try {
      await webpush.sendNotification(
        { endpoint: ap.endpoint, keys: { p256dh: ap.p256dh, auth: ap.auth } },
        JSON.stringify({ titulo: recado.titulo, corpo: recado.corpo, url: SITE }),
        { TTL: 6 * 60 * 60 },   // depois de 6h o lembrete de hoje ja nao serve
      );
      algum = true;
    } catch (e: any) {
      const status = e?.statusCode;
      // 404 e 410 sao o servico de push dizendo que esse endereco morreu:
      // navegador desinstalado, permissao revogada. Guardar a linha so faria
      // a funcao tentar de novo todo dia, para sempre.
      if (status === 404 || status === 410) {
        await db.from("lembrete_dispositivos").delete().eq("id", ap.id);
      } else {
        await db.from("lembrete_dispositivos")
          .update({ ultima_falha: String(status ?? e).slice(0, 200) }).eq("id", ap.id);
      }
    }
  }
  return algum;
}

// ─── E-mail, a rede de baixo ───────────────────────────────────────────

async function mandarEmail(para: string, recado: any) {
  const chave = Deno.env.get("BREVO_API_KEY");
  const de = Deno.env.get("REMETENTE_EMAIL");
  if (!chave || !de) return false;

  const lista = recado.itens.length
    ? "<ul style=\"margin:0 0 18px;padding-left:20px;color:#A6A176;font-size:15px;line-height:26px\">"
      + recado.itens.map((i: any) =>
          `<li><span style="color:#EBE3A7">${escapar(i.nome)}</span> — ${i.quando}</li>`).join("")
      + "</ul>"
    : "";

  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#0E1009">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0E1009">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
 style="width:600px;max-width:100%;background:#12140E;border:1px solid #2E3A2B;border-radius:16px">
<tr><td style="padding:26px 30px;font-family:'Poppins','Trebuchet MS',Helvetica,Arial,sans-serif">
  <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1.4px;color:#EB7D00">MINDT</p>
  <h1 style="margin:0 0 14px;font-size:24px;line-height:31px;color:#EBE3A7">${escapar(recado.titulo)}</h1>
  <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#A6A176">${escapar(recado.corpo)}</p>
  ${lista}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="center" bgcolor="#EB7D00" style="border-radius:12px">
      <a href="${SITE}" style="display:block;padding:15px 32px;font-size:16px;font-weight:bold;
         color:#211C08;text-decoration:none">Abrir o Mindt</a>
    </td></tr></table>
  <p style="margin:22px 0 0;font-size:12px;line-height:20px;color:#6F6C50">
    Você recebe este lembrete porque ligou os lembretes diários no Mindt.
    Para parar, é só desligar em Perfil &rsaquo; Conta.</p>
</td></tr></table>
</td></tr></table></body></html>`;

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": chave, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: de, name: Deno.env.get("REMETENTE_NOME") || "Ticolino do Mindt" },
        to: [{ email: para }],
        subject: recado.titulo,
        htmlContent: html,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error("brevo:", e);
    return false;
  }
}

function escapar(v: string) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function marcarEnviado(db: any, userId: string, hojeLocal: string) {
  await db.from("lembretes").update({ ultimo_envio: hojeLocal }).eq("user_id", userId);
}
