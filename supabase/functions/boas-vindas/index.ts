// BOAS-VINDAS — o motor da pagina de convite (/conheca).
//
// A pagina de convite e estatica: ela sabe desenhar o formulario, mas nao
// sabe guardar nem enviar nada. Quem faz isso e esta funcao, que roda no
// servidor do Supabase e tem duas tarefas:
//
//   POST /boas-vindas          grava o e-mail na tabela `leads` e dispara o
//                              e-mail de apresentacao do Ticolino.
//   GET  /boas-vindas?sair=..  tira a pessoa da lista (link do rodape do
//                              e-mail). Nao pede login nem confirmacao: o
//                              token no link ja e a prova de que e ela.
//
// A funcao e publica (verify_jwt desligado) porque quem a chama e um
// visitante anonimo. Por isso ela nao confia em nada que vem de fora:
// valida o endereco, limita quantos cadastros saem do mesmo IP por hora e
// nunca devolve o conteudo da tabela.
//
// SEGREDOS (Supabase > Edge Functions > Secrets). Sem eles a funcao ainda
// GRAVA o e-mail — nenhum interessado se perde — mas responde
// {enviado:false} e a pagina avisa a pessoa que o e-mail vem depois.
//
//   REMETENTE_EMAIL   de qual endereco o e-mail sai (precisa estar
//                     verificado no provedor)
//   REMETENTE_NOME    o nome que aparece na caixa de entrada  (opcional,
//                     padrao "Ticolino do Mindt")
//   BREVO_API_KEY     chave do Brevo   — use uma OU outra
//   RESEND_API_KEY    chave do Resend  — o Resend exige dominio proprio

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://miguellpissinato-png.github.io/MINDT/";

// O corpo do e-mail vive em email/boas-vindas.html, no repositorio, e nao
// aqui dentro: assim da para abrir o arquivo no navegador para conferir e
// mudar o texto direto pelo GitHub, sem reinstalar esta funcao. Se a busca
// falhar, o e-mail nao sai — mas o endereco ja foi guardado e a proxima
// tentativa reenvia.
const MOLDE_EMAIL = SITE + "email/boas-vindas.html";
const ASSUNTO = "Prazer, eu sou o Ticolino 🐹";

// Quantos cadastros um mesmo IP pode fazer por hora. Uma pessoa de verdade
// se cadastra uma vez; o limite so existe para quem tentar usar a pagina
// para mandar e-mail em nome do Mindt para terceiros.
const LIMITE_POR_HORA = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Validacao de e-mail e sempre aproximada. O que ela pega e o erro de
// digitacao; quem decide se o endereco existe mesmo e a entrega.
function pareceEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

async function hash(texto: string) {
  const bytes = new TextEncoder().encode("mindt:" + texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escaparHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paginaSaida(titulo: string, recado: string) {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(titulo)} — Mindt</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
   background:#12140E;color:#EBE3A7;
   font-family:'Poppins',system-ui,-apple-system,'Segoe UI',sans-serif}
 main{max-width:420px;text-align:center;background:#1B2118;
   border:1px solid rgba(235,227,167,.18);border-radius:14px;padding:32px 26px}
 h1{margin:0 0 10px;font-size:22px;font-weight:600;letter-spacing:-.02em}
 p{margin:0;font-size:14px;line-height:1.6;color:rgba(235,227,167,.68)}
 a{display:inline-block;margin-top:20px;color:#F5A03D;font-size:14px}
</style></head><body><main>
<h1>${escaparHtml(titulo)}</h1><p>${escaparHtml(recado)}</p>
<a href="${SITE}">Abrir o Mindt</a>
</main></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// O molde muda raramente; guardar por uma hora evita uma ida ao GitHub a
// cada cadastro. `molde` vive enquanto o container da funcao estiver de pe.
let molde: string | null = null;
let moldeAte = 0;

async function buscarMolde(): Promise<string | null> {
  if (molde && Date.now() < moldeAte) return molde;
  try {
    const r = await fetch(MOLDE_EMAIL, { headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) return molde;               // expirou, mas o velho serve
    molde = await r.text();
    moldeAte = Date.now() + 3600_000;
    return molde;
  } catch {
    return molde;
  }
}

// ── Envio ──────────────────────────────────────────────────────────────
// Dois provedores porque eles resolvem problemas diferentes: o Brevo aceita
// um Gmail verificado como remetente (da para comecar hoje, sem dominio); o
// Resend exige dominio proprio, mas entrega melhor. Vale o que estiver
// configurado, o Brevo primeiro.
async function enviar(para: string, html: string) {
  const deEmail = Deno.env.get("REMETENTE_EMAIL");
  const deNome = Deno.env.get("REMETENTE_NOME") || "Ticolino do Mindt";
  const brevo = Deno.env.get("BREVO_API_KEY");
  const resend = Deno.env.get("RESEND_API_KEY");

  if (!deEmail) return "REMETENTE_EMAIL nao configurado";
  if (!brevo && !resend) return "nenhuma chave de envio configurada";

  let destino: string;
  let cabecalhos: Record<string, string>;
  let carga: unknown;

  if (brevo) {
    destino = "https://api.brevo.com/v3/smtp/email";
    cabecalhos = { "api-key": brevo, "Content-Type": "application/json" };
    carga = {
      sender: { email: deEmail, name: deNome },
      to: [{ email: para }],
      subject: ASSUNTO,
      htmlContent: html,
    };
  } else {
    destino = "https://api.resend.com/emails";
    cabecalhos = { Authorization: "Bearer " + resend, "Content-Type": "application/json" };
    carga = { from: deNome + " <" + deEmail + ">", to: [para], subject: ASSUNTO, html };
  }

  try {
    const r = await fetch(destino, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(carga),
    });
    if (r.ok) return null;
    return `${r.status}: ${(await r.text()).slice(0, 300)}`;
  } catch (e) {
    return `falha de rede: ${String(e).slice(0, 200)}`;
  }
}

// ── Entrada ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // A chave de servico fica so aqui dentro. A tabela `leads` tem RLS ligada
  // e nenhuma policy: pelo navegador ela e invisivel.
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);

  // ── Sair da lista ────────────────────────────────────────────────────
  if (req.method === "GET") {
    const token = url.searchParams.get("sair");
    if (!token) return json({ erro: "nada a fazer" }, 400);

    const { error } = await db.from("leads")
      .update({ saiu_em: new Date().toISOString() })
      .eq("token_saida", token);

    // Mesmo se o token nao existir, a resposta e a mesma: dizer "esse token
    // nao esta na lista" contaria a um curioso quais tokens sao validos.
    if (error) return paginaSaida("Deu ruim aqui", "Não consegui completar agora. Tenta o link de novo mais tarde?");
    return paginaSaida("Pronto, você saiu", "Não te mando mais nada. Se mudar de ideia, é só deixar o e-mail de novo.");
  }

  if (req.method !== "POST") return json({ erro: "metodo nao suportado" }, 405);

  // ── Entrar na lista ──────────────────────────────────────────────────
  let corpo: { email?: string; origem?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "corpo invalido" }, 400);
  }

  const email = String(corpo.email || "").trim().toLowerCase();
  const origem = String(corpo.origem || "").slice(0, 40) || null;
  if (!pareceEmail(email)) return json({ erro: "e-mail invalido" }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ipHash = ip ? await hash(ip) : null;

  if (ipHash) {
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("criado_em", umaHoraAtras);
    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return json({ erro: "muitos cadastros seguidos, tenta mais tarde" }, 429);
    }
  }

  // Ja cadastrado: nao grava de novo e nao manda o e-mail outra vez. Se o
  // envio anterior tinha falhado, esta e a chance de tentar de novo.
  const { data: existente } = await db.from("leads")
    .select("id, token_saida, enviado_em")
    .eq("email", email).maybeSingle();

  let id: string, token: string;
  if (existente) {
    if (existente.enviado_em) return json({ ok: true, enviado: true, repetido: true });
    id = existente.id;
    token = existente.token_saida;
  } else {
    const { data, error } = await db.from("leads")
      .insert({ email, origem, ip_hash: ipHash })
      .select("id, token_saida").single();
    if (error || !data) return json({ erro: "nao consegui guardar" }, 500);
    id = data.id;
    token = data.token_saida;
  }

  const corpoHtml = await buscarMolde();
  if (!corpoHtml) {
    await db.from("leads").update({ erro_envio: "nao consegui buscar o molde do e-mail" }).eq("id", id);
    return json({ ok: true, enviado: false });
  }

  const html = corpoHtml
    .replaceAll("{{unsubscribe}}", `${url.origin}${url.pathname}?sair=${token}`)
    .replaceAll("{{contato}}", Deno.env.get("REMETENTE_EMAIL") || "");

  const erro = await enviar(email, html);

  await db.from("leads").update(
    erro ? { erro_envio: erro.slice(0, 400) }
         : { enviado_em: new Date().toISOString(), erro_envio: null },
  ).eq("id", id);

  // O endereco ficou guardado de qualquer jeito. Se o envio falhou, a pagina
  // troca o recado em vez de prometer uma caixa de entrada que nao vai
  // receber nada.
  return json({ ok: true, enviado: !erro });
});
