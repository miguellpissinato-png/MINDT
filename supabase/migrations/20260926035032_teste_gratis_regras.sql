-- Aplicada no projeto em 26/09/2026 (versao 20260926035032).

-- TESTE GRATIS, passo 3: as regras. Nenhuma conta existente ganha o teste
-- aqui — isso vem numa migracao separada, depois de tudo testado.

-- Fim do teste: meia-noite (horario de Brasilia) depois do 7o dia.
-- Quem entra no dia 26 usa ate o fim do dia 03. Terminar a meia-noite, e nao
-- na hora exata do cadastro, e o que torna honesta a frase "acaba hoje a
-- meia-noite" do ultimo aviso, que chega as 10h.
create or replace function public.fim_do_teste(p_inicio timestamptz default now())
returns timestamptz language sql stable as $$
  select (date_trunc('day', p_inicio at time zone 'America/Sao_Paulo') + interval '8 days')
         at time zone 'America/Sao_Paulo';
$$;

-- Conta nova ganha 7 dias de Max.
create or replace function public.dar_teste_gratis()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.subscriptions(user_id, plano, status, origem, expira_em, nota)
  values (new.id, 'max', 'ativo', 'teste', public.fim_do_teste(now()), 'Teste gratis de 7 dias')
  on conflict (user_id) do nothing;
  return new;
exception when others then
  -- Um erro aqui cancelaria o CADASTRO inteiro. Melhor a pessoa entrar sem
  -- o teste do que nao conseguir criar a conta.
  raise warning 'dar_teste_gratis falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke execute on function public.dar_teste_gratis() from public, anon, authenticated;

drop trigger if exists teste_gratis_ao_criar_conta on auth.users;
create trigger teste_gratis_ao_criar_conta
  after insert on auth.users
  for each row execute function public.dar_teste_gratis();

-- ── Os lembretes passam a respeitar o plano ─────────────────────────────
-- lembretes_da_hora nao olhava plano nenhum: a trava existia so na tela.
-- Com o teste gratis isso vira um problema real — quem ligasse o lembrete
-- durante o teste continuaria recebendo depois que ele acabasse. Agora exige
-- plano Pro ou Max valendo (ativo e nao expirado).
create or replace function public.lembretes_da_hora()
returns table(user_id uuid, email text, hoje_local date, canal text, segundos_ate_meia_noite integer)
language sql security definer set search_path to 'public' as $$
  select l.user_id,
         l.email,
         (now() at time zone l.fuso)::date as hoje_local,
         l.canal,
         greatest(60, extract(epoch from (
           (((now() at time zone l.fuso)::date + 1)::timestamp - (now() at time zone l.fuso))
         ))::int) as segundos_ate_meia_noite
  from public.lembretes l
  join public.subscriptions s on s.user_id = l.user_id
                             and s.plano in ('pro','max')
                             and public.plano_vale(s.status, s.expira_em)
  where l.ativo
    and extract(hour from (now() at time zone l.fuso))::int = l.hora
    and (l.ultimo_envio is null or l.ultimo_envio < (now() at time zone l.fuso)::date);
$$;
revoke execute on function public.lembretes_da_hora() from public, anon, authenticated;
grant  execute on function public.lembretes_da_hora() to service_role;

-- tarefas_da_hora: mesma regra (antes olhava status, nao o prazo).
create or replace function public.tarefas_da_hora()
returns table(user_id uuid, email text, canal text, hoje_local date,
              tarefa_id text, nome text, segundos_ate_meia_noite integer)
language sql security definer set search_path to 'public' as $$
  select l.user_id, l.email, l.canal,
         (now() at time zone l.fuso)::date,
         t->>'id', t->>'name',
         greatest(60, extract(epoch from (
           (((now() at time zone l.fuso)::date + 1)::timestamp - (now() at time zone l.fuso))
         ))::int)
  from public.lembretes l
  join public.subscriptions s on s.user_id = l.user_id
                             and s.plano in ('pro','max')
                             and public.plano_vale(s.status, s.expira_em)
  join public.user_data u on u.user_id = l.user_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(u.data->'tasks') = 'array' then u.data->'tasks' else '[]'::jsonb end
  ) as t
  where l.fuso is not null
    and jsonb_typeof(t->'recorrencia') = 'object'
    and coalesce(t->'recorrencia'->>'hora', '') ~ '^[0-9]{1,2}$'
    and (t->'recorrencia'->>'hora')::int = extract(hour from (now() at time zone l.fuso))::int
    and t->>'proxima' = to_char((now() at time zone l.fuso)::date, 'YYYY-MM-DD')
    and coalesce(t->>'id', '') <> ''
    and not exists (
      select 1 from public.tarefas_avisadas a
      where a.user_id = l.user_id and a.tarefa_id = t->>'id'
        and a.data = (now() at time zone l.fuso)::date
    );
$$;
revoke execute on function public.tarefas_da_hora() from public, anon, authenticated;
grant  execute on function public.tarefas_da_hora() to service_role;

-- ── Avisos de fim do teste ─────────────────────────────────────────────
-- Uma linha por aviso enviado: 'faltam2', 'faltam1', 'ultimo'. Impede o
-- mesmo aviso duas vezes. Mesmo desenho de tarefas_avisadas: RLS ligada e
-- nenhuma politica — o app nao enxerga.
create table if not exists public.avisos_teste (
  user_id    uuid not null references auth.users(id) on delete cascade,
  marco      text not null check (marco in ('faltam2','faltam1','ultimo')),
  enviado_em timestamptz not null default now(),
  primary key (user_id, marco)
);
alter table public.avisos_teste enable row level security;
revoke all on public.avisos_teste from anon, authenticated;

-- Quem esta no teste e chegou num dos marcos, as 10h locais.
-- (Substituida na migracao seguinte pela versao com parametro p_agora.)
create or replace function public.testes_a_avisar()
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
      and public.plano_vale(s.status, s.expira_em)
      and s.expira_em is not null
  ), dias as (
    select b.*,
           ((b.expira_em - interval '1 second') at time zone b.fuso)::date
             - (now() at time zone b.fuso)::date as faltam,
           extract(hour from (now() at time zone b.fuso))::int as hora_local,
           greatest(60, extract(epoch from (
             (((now() at time zone b.fuso)::date + 1)::timestamp - (now() at time zone b.fuso))
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
revoke execute on function public.testes_a_avisar() from public, anon, authenticated;
grant  execute on function public.testes_a_avisar() to service_role;
