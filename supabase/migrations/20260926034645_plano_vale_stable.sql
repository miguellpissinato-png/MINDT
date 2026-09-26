-- Aplicada no projeto em 26/09/2026 (versao 20260926034645).

-- plano_vale usa now(): nao pode ser IMMUTABLE (o Postgres poderia congelar
-- o resultado e um teste vencido continuaria valendo). STABLE e o correto.
create or replace function public.plano_vale(p_status text, p_expira timestamptz)
returns boolean language sql stable as $$
  select p_status = 'ativo' and (p_expira is null or p_expira > now());
$$;
