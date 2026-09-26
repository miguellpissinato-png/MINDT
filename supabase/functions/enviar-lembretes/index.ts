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
// POR ONDE O AVISO SAI: QUEM DECIDE E A PESSOA
// A coluna lembretes.canal vale 'tela', 'email' ou 'ambos'.
//
// Esta escolha existe por causa de um defeito que este arquivo teve, e que
// vale registrar para nao voltar. A versao anterior mandava o push e, SO SE
// ele falhasse, mandava o e-mail. O problema e que o push "funcionar" nao
// quer dizer que alguem viu: webpush.sendNotification responde bem quando o
// SERVICO DE PUSH aceita a mensagem, e um celular desligado nao e uma falha
// para ele — a mensagem fica guardada esperando o aparelho voltar. O
// fundador ficou com o celular desligado, o Google aceitou, a funcao contou
// como entregue e o e-mail nunca saiu.
//
// O Web Push nao devolve confirmacao de entrega: nao existe como o servidor
// descobrir sozinho se a notificacao apareceu na tela. Entao a decisao volta
// para quem sabe do proprio aparelho.
//
//   tela   → so notificacao. Se a pessoa nao tem aparelho cadastrado
//            (negou a permissao, ou esta num iPhone sem instalar o app),
//            o e-mail entra assim mesmo: sem ele ela nao receberia NADA,
//            que e pior do que receber por um canal que nao escolheu.
//   email  → so e-mail. Nem tenta push.
//   ambos  → os dois, todo dia. E a unica opcao com garantia.
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
    const recado = await montarRecado(db, pessoa.user_id, String(pessoa.hoje_local));
    // Dia sem nada a cobrar nao vira notificacao. Um aviso que chega todo dia
    // sem ter o que dizer e o caminho mais curto para a pessoa desligar tudo.
    if (!recado) {
      await marcarEnviado(db, pessoa.user_id, pessoa.hoje_local);
      relatorio.semNada++;
      continue;
    }

    const canal = pessoa.canal || "tela";

    // O prazo de validade da mensagem de push e o que falta para acabar o
    // DIA da pessoa. Antes era fixo em 6h: passado esse tempo o servico de
    // push descartava a mensagem sem avisar ninguem. Contando ate a meia
    // noite dela, o aviso espera o aparelho voltar enquanto ainda faz
    // sentido — e nao aparece amanha de manha falando do dia de ontem.
    const validade = Math.max(60, Number(pessoa.segundos_ate_meia_noite) || 6 * 3600);

    let temAparelho = false;
    if (chaves && canal !== "email") {
      temAparelho = await mandarPush(db, pessoa.user_id, recado, validade);
      if (temAparelho) relatorio.push++;
    }
    // 'tela' so cai para o e-mail quando nao ha aparelho nenhum para avisar.
    const mandaEmail = canal === "email" || canal === "ambos" ||
                       (canal === "tela" && !temAparelho);
    if (mandaEmail && pessoa.email) {
      if (await mandarEmail(pessoa.email, recado)) relatorio.email++;
    }
    await marcarEnviado(db, pessoa.user_id, pessoa.hoje_local);
  }

  // ── Tarefas recorrentes com horario ──────────────────────────────────
  // Independente do lembrete diario: e a pessoa que marcou uma hora numa
  // tarefa. Quem entra e quando, decide tarefas_da_hora() (plano, fuso, dia,
  // hora e se ja foi avisada hoje).
  const tr = await avisarTarefasDaHora(db, !!chaves);
  (relatorio as any).tarefas = tr;

  // ── Fim do teste gratis ───────────────────────────────────────────────
  // 2 dias antes, 1 dia antes e no ultimo dia, as 10h locais. Quem entra,
  // decide testes_a_avisar() (so quem ainda esta no teste, no marco certo,
  // e que ainda nao recebeu aquele marco).
  (relatorio as any).teste = await avisarFimDoTeste(db, !!chaves);

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

async function montarRecado(db: any, userId: string, hojeLocal: string) {
  const { data } = await db.from("user_data").select("data").eq("user_id", userId).maybeSingle();
  const estado = data?.data;
  if (!estado) return null;

  // O dia da PESSOA, calculado no Postgres com o fuso dela. Antes era
  // new Date().toISOString(), que e UTC: para quem marcou o lembrete as 21h
  // ou mais tarde no Brasil, o "hoje" ja era amanha — o aviso dizia "vence
  // hoje" sobre as tarefas do dia seguinte e chamava as de hoje de atrasadas.
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(hojeLocal) ? hojeLocal : new Date().toISOString().slice(0, 10);

  const todas = estado.tasks ?? [];
  // Tarefa recorrente NAO e julgada pelo prazo: nela a data guardada e a
  // "primeira vez", e uma tarefa comecada em julho viraria "atrasada" todo
  // dia, para sempre. Ela conta pela propria data do ciclo (proxima).
  const comuns = todas.filter((t: any) => !t.recorrencia && !t.done);
  const recorrentes = todas.filter((t: any) => t.recorrencia && t.proxima);
  const vencemHoje = [
    ...comuns.filter((t: any) => dataISO(t.deadline) === hoje),
    // Ciclo de hoje, esteja ou nao reaberta no app ainda.
    ...recorrentes.filter((t: any) => t.proxima === hoje),
  ];
  const atrasadas = comuns.filter((t: any) => {
    const d = dataISO(t.deadline);
    return d && d < hoje;
  });
  // Recorrente aberta de um ciclo que ja passou: esta em aberto. Se ja e
  // "atrasada" depende da regra (o proximo ciclo chegou?), e essa conta vive
  // no app. Aqui ela so aparece como em aberto — nunca como um atraso que o
  // servidor nao tem como confirmar.
  const emAberto = recorrentes.filter((t: any) => !t.done && t.proxima < hoje);

  // Os itens do dia so contam se o `diario` for de hoje; senao ele e a sobra
  // de ontem e ja nao diz nada.
  const diario = estado.diario && estado.diario.data === hoje ? estado.diario : null;
  const faltam = diario
    ? ["leitura", "estudo", "grana", "exercicio"].filter((k) => !diario[k]).length
    : 4;

  if (!vencemHoje.length && !atrasadas.length && !emAberto.length && faltam === 0) return null;

  const partes: string[] = [];
  if (vencemHoje.length) {
    partes.push(vencemHoje.length === 1
      ? `1 tarefa vence hoje: ${vencemHoje[0].name}`
      : `${vencemHoje.length} tarefas vencem hoje`);
  }
  if (atrasadas.length) {
    partes.push(atrasadas.length === 1 ? "1 tarefa está atrasada" : `${atrasadas.length} tarefas atrasadas`);
  }
  if (emAberto.length) {
    partes.push(emAberto.length === 1 ? "1 tarefa que se repete está em aberto"
                                      : `${emAberto.length} tarefas que se repetem estão em aberto`);
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
      ...emAberto.slice(0, 5).map((t: any) => ({ nome: t.name, quando: "em aberto" })),
    ],
  };
}

// ─── Aviso das tarefas recorrentes ─────────────────────────────────────
// Uma pessoa pode ter varias tarefas marcadas para a mesma hora: vira UM
// aviso com todas, nao uma rajada de notificacoes.

async function avisarTarefasDaHora(db: any, temChaves: boolean) {
  const rel = { pessoas: 0, tarefas: 0, push: 0, email: 0 };
  const { data: linhas, error } = await db.rpc("tarefas_da_hora");
  if (error) {
    console.error("tarefas_da_hora:", error);
    return rel;
  }

  const porPessoa = new Map<string, any[]>();
  for (const l of linhas ?? []) {
    if (!porPessoa.has(l.user_id)) porPessoa.set(l.user_id, []);
    porPessoa.get(l.user_id)!.push(l);
  }

  for (const [userId, lista] of porPessoa) {
    const hoje = lista[0].hoje_local;
    // Reserva ANTES de enviar. O upsert que ignora repetidos devolve so as
    // linhas que ele de fato criou: se outra execucao ja reservou uma
    // tarefa, ela nao volta aqui — e ninguem recebe o mesmo aviso duas vezes.
    const { data: reservadas, error: eRes } = await db.from("tarefas_avisadas")
      .upsert(lista.map((l) => ({ user_id: userId, tarefa_id: l.tarefa_id, data: hoje })),
              { onConflict: "user_id,tarefa_id,data", ignoreDuplicates: true })
      .select("tarefa_id");
    if (eRes) { console.error("tarefas_avisadas:", eRes); continue; }
    const ok = new Set((reservadas ?? []).map((r: any) => r.tarefa_id));
    const tarefas = lista.filter((l) => ok.has(l.tarefa_id));
    if (!tarefas.length) continue;

    rel.pessoas++;
    rel.tarefas += tarefas.length;
    const nomes = tarefas.map((t) => String(t.nome || "Tarefa"));
    const recado = {
      titulo: nomes.length === 1 ? `🔁 Hora de: ${nomes[0]}` : `🔁 ${nomes.length} tarefas para agora`,
      corpo: nomes.length === 1
        ? "Chegou o horário que você marcou para esta tarefa."
        : "Chegou o horário que você marcou para: " + juntar(nomes) + ".",
      itens: nomes.map((n) => ({ nome: n, quando: "agora" })),
      rodape: "Você recebe este aviso porque marcou um horário nesta tarefa. " +
              "Para parar, tire o horário dela em Tarefas › Recorrentes.",
    };

    const canal = tarefas[0].canal || "tela";
    const validade = Math.max(60, Number(tarefas[0].segundos_ate_meia_noite) || 6 * 3600);
    let temAparelho = false;
    if (temChaves && canal !== "email") {
      temAparelho = await mandarPush(db, userId, recado, validade);
      if (temAparelho) rel.push++;
    }
    const mandaEmail = canal === "email" || canal === "ambos" || (canal === "tela" && !temAparelho);
    if (mandaEmail && tarefas[0].email) {
      if (await mandarEmail(tarefas[0].email, recado)) rel.email++;
    }
  }
  return rel;
}

// ─── Fim do teste gratis ───────────────────────────────────────────────
// Os textos usam o que a pessoa FEZ no teste — os numeros dela, nunca
// inventados — e dizem com clareza o que tranca e o que fica. A urgencia e
// so a data real. O rodape promete o limite de avisos, e o laco cumpre.

async function avisarFimDoTeste(db: any, temChaves: boolean) {
  const rel = { pessoas: 0, push: 0, email: 0 };
  const { data: linhas, error } = await db.rpc("testes_a_avisar");
  if (error) {
    console.error("testes_a_avisar:", error);
    return rel;
  }

  for (const l of linhas ?? []) {
    // Reserva antes de enviar: o mesmo marco nunca sai duas vezes.
    const { data: reservou, error: eRes } = await db.from("avisos_teste")
      .upsert({ user_id: l.user_id, marco: l.marco },
              { onConflict: "user_id,marco", ignoreDuplicates: true })
      .select("marco");
    if (eRes) { console.error("avisos_teste:", eRes); continue; }
    if (!reservou?.length) continue;

    const { data } = await db.from("user_data").select("data").eq("user_id", l.user_id).maybeSingle();
    const recado = recadoFimDoTeste(l.marco, data?.data ?? {}, l.expira_em);

    rel.pessoas++;
    const canal = l.canal || "email";
    const validade = Math.max(60, Number(l.segundos_ate_meia_noite) || 6 * 3600);
    let temAparelho = false;
    if (temChaves && canal !== "email") {
      temAparelho = await mandarPush(db, l.user_id, recado, validade);
      if (temAparelho) rel.push++;
    }
    const mandaEmail = canal === "email" || canal === "ambos" || (canal === "tela" && !temAparelho);
    if (mandaEmail && l.email) {
      if (await mandarEmail(l.email, recado)) rel.email++;
    }
  }
  return rel;
}

// O que a pessoa fez desde o comeco do teste (fim - 8 dias).
function feitoNoTeste(estado: any, expiraEm: string) {
  const inicio = new Date(new Date(expiraEm).getTime() - 8 * 86400000).toISOString();
  const gastos = (estado.gastos ?? []).filter((g: any) => String(g.createdAt ?? "") >= inicio).length;
  let feitas = 0;
  for (const t of estado.tasks ?? []) {
    const lista = Array.isArray(t.conclusoes) ? t.conclusoes
                : (t.done && t.completedAt ? [t.completedAt] : []);
    for (const iso of lista) if (String(iso) >= inicio) feitas++;
  }
  const partes: string[] = [];
  if (gastos) partes.push(`lançou ${gastos} ${gastos === 1 ? "gasto" : "gastos"}`);
  if (feitas) partes.push(`concluiu ${feitas} ${feitas === 1 ? "tarefa" : "tarefas"}`);
  return partes.join(" e ");
}

function recadoFimDoTeste(marco: string, estado: any, expiraEm: string) {
  const nome = estado.perfil?.name ? String(estado.perfil.name).trim() : "";
  // Com nome: "Miguel, amanha termina...". Sem nome, a frase precisa
  // comecar em maiuscula por conta propria.
  const frase = (resto: string) => nome ? `${nome}, ${resto}` : resto.charAt(0).toUpperCase() + resto.slice(1);
  const feito = feitoNoTeste(estado, expiraEm);
  const tranca = [
    { nome: "Gráficos e médias do Dinheiro", quando: "no Pro" },
    { nome: "Lembretes diários e avisos das tarefas", quando: "no Pro" },
    { nome: "Relatórios e XP em dobro", quando: "no Max" },
  ];
  const rodape = "Você recebe este aviso porque está no teste grátis do Ticolino Max. " +
    "São só três avisos até o fim do teste, e nada é cobrado sem você assinar.";
  const botao = "Continuar com o Ticolino";

  if (marco === "faltam2") {
    return {
      titulo: "⏳ Seu Ticolino Max acaba em 2 dias",
      corpo: (feito ? frase(`nesses dias você ${feito}.`) + " Em 2 dias" : frase("em 2 dias")) +
        ", estes recursos voltam a ficar trancados. Seus dados continuam seus — " +
        "o que tranca é a visão completa deles. Dá para continuar a partir de R$ 2,50 por semana.",
      push: "Em 2 dias os gráficos, os relatórios e os lembretes voltam a ficar trancados. Toque para continuar.",
      itens: tranca, rodape, botao,
    };
  }
  if (marco === "faltam1") {
    return {
      titulo: "🐹 Amanhã eu volto pro plano Free",
      corpo: frase("amanhã termina seu teste do Ticolino Max. ") +
        (feito ? `Você ${feito} com ele — não precisa perder esse ritmo. ` : "") +
        "Assinar leva 1 minuto, e dá para cancelar quando quiser.",
      push: (feito ? `Você ${feito} no teste. ` : "") +
        "Amanhã seu Ticolino Max acaba — continue sem perder o ritmo.",
      itens: tranca, rodape, botao,
    };
  }
  return {
    titulo: "Hoje é o último dia do seu Ticolino Max",
    corpo: frase("à meia-noite o teste acaba. ") + "Se quiser continuar de onde parou, é só assinar. " +
      "Se não, tudo bem: seus dados ficam aqui, e o plano Free continua seu.",
    push: "Seu Ticolino Max acaba à meia-noite. Seus dados ficam — continue se quiser.",
    itens: [], rodape, botao,
  };
}

function juntar(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join("");
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}

// ─── Push ──────────────────────────────────────────────────────────────

async function mandarPush(db: any, userId: string, recado: any, validade: number) {
  const { data: aparelhos } = await db.from("lembrete_dispositivos")
    .select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!aparelhos?.length) return false;

  let algum = false;
  for (const ap of aparelhos) {
    try {
      await webpush.sendNotification(
        { endpoint: ap.endpoint, keys: { p256dh: ap.p256dh, auth: ap.auth } },
        JSON.stringify({ titulo: recado.titulo, corpo: recado.push || recado.corpo, url: SITE }),
        // Vale ate o fim do dia da pessoa. Ver a nota no laco principal:
        // um prazo fixo fazia o servico de push jogar fora o aviso em
        // silencio quando o aparelho passava muito tempo desligado.
        { TTL: validade },
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
         color:#211C08;text-decoration:none">${escapar(recado.botao || "Abrir o Mindt")}</a>
    </td></tr></table>
  <p style="margin:22px 0 0;font-size:12px;line-height:20px;color:#6F6C50">
    ${escapar(recado.rodape || "Você recebe este lembrete porque ligou os lembretes diários no Mindt. Para parar, é só desligar em Perfil › Conta.")}</p>
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
