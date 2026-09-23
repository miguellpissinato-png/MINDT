-- TAREFAS RECORRENTES: aviso no horario escolhido.
--
-- Aplicada no projeto em 23/09/2026 (versao 20260923154044). Este arquivo e
-- o registro dela no repositorio: as migracoes anteriores so existem no
-- Supabase.
--
-- As tarefas moram no blob JSON de user_data. O servidor NAO escreve nele:
-- o app reescreve o blob inteiro a cada salvamento e apagaria qualquer
-- marca posta aqui. Por isso "ja avisei esta tarefa hoje" fica numa tabela
-- propria, pequena, que o app nem enxerga.

create table if not exists public.tarefas_avisadas (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tarefa_id  text not null,
  data       date not null,
  avisado_em timestamptz not null default now(),
  primary key (user_id, tarefa_id, data)
);
comment on table public.tarefas_avisadas is
  'Uma linha por tarefa recorrente avisada num dia. Impede aviso duplicado. Escrita so pela funcao enviar-lembretes.';

-- RLS ligada e NENHUMA politica: nem anon nem usuario logado leem ou
-- escrevem. So a chave de servico (que ignora RLS) mexe aqui.
alter table public.tarefas_avisadas enable row level security;
revoke all on public.tarefas_avisadas from anon, authenticated;

-- Quem tem tarefa recorrente chegando AGORA, na hora local de cada pessoa.
--
-- Le direto do blob (fonte unica, sem copiar dado). Nao depende do app ter
-- "reaberto" a tarefa: basta a regra ter hora, a proxima data ser hoje e a
-- hora local bater — funciona com o celular desligado.
--
-- Fuso, canal e e-mail vem de `lembretes`: e ali que a pessoa configurou
-- como quer ser avisada. Nao exige o lembrete DIARIO ligado — sao coisas
-- diferentes. Exige plano com o recurso de lembretes (Pro ou Max) e
-- assinatura ativa, a mesma regra do app (temRecurso('lembretes')).
create or replace function public.tarefas_da_hora()
returns table(user_id uuid, email text, canal text, hoje_local date,
              tarefa_id text, nome text, segundos_ate_meia_noite integer)
language sql
security definer
set search_path to 'public'
as $$
  select l.user_id,
         l.email,
         l.canal,
         (now() at time zone l.fuso)::date,
         t->>'id',
         t->>'name',
         greatest(60, extract(epoch from (
           (((now() at time zone l.fuso)::date + 1)::timestamp - (now() at time zone l.fuso))
         ))::int)
  from public.lembretes l
  join public.subscriptions s on s.user_id = l.user_id
                             and s.status = 'ativo'
                             and s.plano in ('pro','max')
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
      where a.user_id = l.user_id
        and a.tarefa_id = t->>'id'
        and a.data = (now() at time zone l.fuso)::date
    );
$$;

-- Funcao SECURITY DEFINER nasce com EXECUTE para PUBLIC. Revogar so de
-- anon/authenticated NAO fecha — eles herdam de PUBLIC. Tira de todos e da
-- so para a chave de servico.
revoke execute on function public.tarefas_da_hora() from public, anon, authenticated;
grant  execute on function public.tarefas_da_hora() to service_role;
