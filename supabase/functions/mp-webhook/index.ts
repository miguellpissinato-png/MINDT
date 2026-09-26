// MP-WEBHOOK — o Mercado Pago avisa aqui quando uma assinatura muda.
//
// O aviso traz so o id da assinatura (preapproval). O estado de verdade e
// buscado na API do Mercado Pago com o nosso token — entao um aviso forjado
// nao consegue inventar um pagamento: no maximo pede para reler um que existe.
//
// DUAS REGRAS QUE O TESTE GRATIS EXIGIU
//
// 1. Pagamento autorizado grava origem 'mercadopago' e APAGA expira_em.
//    A versao anterior mesclava a linha sem mexer nessas colunas. Com o teste
//    gratis, quem assinasse durante o teste ficaria com a data de fim do
//    teste — e perderia o plano pago no setimo dia.
//
// 2. Um aviso que NAO e de pagamento autorizado (pendente, em analise,
//    cancelado antes de pagar) nao derruba um plano que a pessoa ja tem de
//    outra forma: teste ainda valendo ou cortesia. Antes, abrir a tela de
//    pagamento e deixar um Pix pendente gravava 'inativo' por cima de tudo.
//    Assinatura paga que e cancelada continua virando 'inativo', como sempre.

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://miguellpissinato-png.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rest = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio: nada a fazer */ }
  const preapprovalId = body?.data?.id;
  if (!preapprovalId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const detalhes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` },
  }).then((r) => r.json());

  const userId = detalhes?.external_reference;
  if (!userId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  const autorizado = detalhes.status === "authorized";
  const plano = detalhes.reason?.includes("Max") ? "max" : "pro";

  if (!autorizado) {
    // Le o que a pessoa tem hoje antes de escrever.
    const atual = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=origem,status,expira_em`,
      { headers: rest },
    ).then((r) => r.json()).then((l) => (Array.isArray(l) ? l[0] : null)).catch(() => null);

    const testeValendo = atual?.origem === "teste" && atual?.status === "ativo" &&
      (!atual.expira_em || new Date(atual.expira_em).getTime() > Date.now());
    const cortesia = atual?.origem === "cortesia" && atual?.status === "ativo";
    if (testeValendo || cortesia) {
      console.log("mp-webhook: aviso nao autorizado ignorado para nao derrubar", atual.origem);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...rest, "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      status: autorizado ? "ativo" : "inativo",
      plano,
      origem: "mercadopago",
      expira_em: null,
    }),
  });

  return new Response("ok", { status: 200, headers: corsHeaders });
});
