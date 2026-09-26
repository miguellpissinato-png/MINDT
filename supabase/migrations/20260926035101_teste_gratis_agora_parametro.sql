-- Aplicada no projeto em 26/09/2026 (versao 20260926035101).

-- "Agora" vira parametro opcional (padrao now()). Uso normal nao muda nada;
-- o teste consegue simular "dia 2 de outubro, 10h" sem esperar o calendario.

drop function if exists public.plano_vale(text, timestamptz);
create or replace function public.plano_vale(p_status text, p_expira timestamptz,
                                             p_agora timestamptz default now())
returns boolean language sql stable as $$
  select p_status = 'ativo' and (p_expira is null or p_expira > p_agora);
$$;

create or replace function public.testes_a_avisar(p_agora timestamptz default now())
returns table(user_id uuid, email text, canal text, marco text,
              expira_em timestamptz, segundos_ate_meia_noite integer)
language sql security definer set search_path to 'public' as $$
  with base as (
    select s.user_id, s.expira_em,
           coalesce(l.email, u.email) as email,
           coalesce(l.canal, 'email') as canal,
           coalesce(l.fuso, 'America/Sao_Paulo') as fuso
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
    left join public.lembretes l on l.user_id = s.user_id
    where s.origem = 'teste'
      and public.plano_vale(s.status, s.expira_em, p_agora)
      and s.expira_em is not null
  ), dias as (
    select b.*,
           ((b.expira_em - interval '1 second') at time zone b.fuso)::date
             - (p_agora at time zone b.fuso)::date as faltam,
           extract(hour from (p_agora at time zone b.fuso))::int as hora_local,
           greatest(60, extract(epoch from (
             (((p_agora at time zone b.fuso)::date + 1)::timestamp - (p_agora at time zone b.fuso))
           ))::int) as ate_meia_noite
    from base b
  )
  select d.user_id, d.email, d.canal,
         case d.faltam when 2 then 'faltam2' when 1 then 'faltam1' else 'ultimo' end,
         d.expira_em, d.ate_meia_noite
  from dias d
  where d.faltam in (0, 1, 2)
    and d.hora_local = 10
    and not exists (
      select 1 from public.avisos_teste a
      where a.user_id = d.user_id
        and a.marco = case d.faltam when 2 then 'faltam2' when 1 then 'faltam1' else 'ultimo' end
    );
$$;
drop function if exists public.testes_a_avisar();
revoke execute on function public.testes_a_avisar(timestamptz) from public, anon, authenticated;
grant  execute on function public.testes_a_avisar(timestamptz) to service_role;
