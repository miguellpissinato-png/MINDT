-- Aplicada no projeto em 26/09/2026 (versao 20260926034546). Registro no
-- repositorio. Criada IMMUTABLE por engano; corrigida na migracao seguinte.

-- TESTE GRATIS, passo 1: so a estrutura. Nenhuma linha muda aqui.
--
-- expira_em: quando o plano deixa de valer sozinho. NULL = nao expira
-- (assinatura paga e cortesia). So o teste gratis usa.
alter table public.subscriptions add column if not exists expira_em timestamptz;
comment on column public.subscriptions.expira_em is
  'Fim automatico do plano. NULL = nao expira. Preenchido so no teste gratis (origem teste).';

-- 'teste' passa a ser uma origem valida, ao lado de mercadopago e cortesia.
alter table public.subscriptions drop constraint if exists subscriptions_origem_valida;
alter table public.subscriptions add constraint subscriptions_origem_valida
  check (origem = any (array['mercadopago'::text, 'cortesia'::text, 'teste'::text]));

-- Um plano "vale" quando esta ativo e ainda nao expirou. Uma funcao so,
-- usada por todo lugar do servidor que precisa decidir isso — para a regra
-- nao ficar escrita de tres jeitos diferentes.
create or replace function public.plano_vale(p_status text, p_expira timestamptz)
returns boolean language sql immutable as $$
  select p_status = 'ativo' and (p_expira is null or p_expira > now());
$$;
