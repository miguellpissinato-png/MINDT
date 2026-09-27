-- Aplicada no projeto em 27/09/2026 (versao 20260927224113).

-- AMIZADES, passo 1: as tabelas. Nenhuma funcao ainda.
--
-- Ate aqui todo dado de uma pessoa morava no blob de user_data, que so ela
-- le. Amizade exige que um veja algo do outro, entao as partes sociais
-- ganham tabelas proprias. O blob continua intocado.
--
-- Regra geral: RLS ligada em tudo, e o app so escreve direto na PROPRIA
-- linha de perfis_publicos (colunas escolhidas) e no "lida" das proprias
-- notificacoes. Todo o resto (pedidos, amizades, bloqueios, nozes) passa
-- por funcoes SECURITY DEFINER que conferem as regras no servidor.

-- ── Perfil publico ──────────────────────────────────────────────────────
-- O que os amigos podem ver. So existe para quem ativou as amizades.
-- Os numeros (xp, ofensiva, paginas) sao enviados pelo app: servem para
-- comparar, nao valem premio. nivel e derivado do xp aqui mesmo, igual a
-- regra do app (a cada 100 XP, um nivel).
create table public.perfis_publicos (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  nick            text not null unique check (nick ~ '^[a-z0-9._]{3,20}$'),
  nome            text not null default '' check (char_length(nome) <= 40),
  cor             text not null default 'padrao'
                  check (cor in ('padrao','cinza','castanho','marrom','preto','listrado')),
  xp              integer not null default 0 check (xp between 0 and 100000000),
  nivel           integer generated always as (xp / 100 + 1) stored,
  ofensiva        integer not null default 0 check (ofensiva between 0 and 100000),
  paginas         integer not null default 0 check (paginas between 0 and 100000000),
  -- Privacidade: por padrao tudo aparece (decisao do fundador).
  mostra_cor      boolean not null default true,
  mostra_nivel    boolean not null default true,
  mostra_ofensiva boolean not null default true,
  mostra_paginas  boolean not null default true,
  buscavel        boolean not null default true,   -- aparece na pesquisa por nick
  aceita_convites boolean not null default true,   -- QR code e link funcionam
  ativo           boolean not null default true,   -- aba Amizades ligada
  -- Codigo do QR: aleatorio e permanente. Nunca o id do usuario.
  qr_codigo       text not null unique
                  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.perfis_publicos is
  'Vitrine de quem ativou Amizades. O dono le e edita a propria linha (colunas limitadas); os outros so enxergam via funcoes, ja filtrado pela privacidade.';

alter table public.perfis_publicos enable row level security;
revoke all on public.perfis_publicos from anon, authenticated;
grant select on public.perfis_publicos to authenticated;
grant update (nome, cor, xp, ofensiva, paginas,
              mostra_cor, mostra_nivel, mostra_ofensiva, mostra_paginas,
              buscavel, aceita_convites)
  on public.perfis_publicos to authenticated;
create policy "dono le o proprio perfil" on public.perfis_publicos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dono edita o proprio perfil" on public.perfis_publicos
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.perfis_publicos_carimbo()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.atualizado_em := now(); return new; end;
$$;
create trigger perfis_publicos_carimbo before update on public.perfis_publicos
  for each row execute function public.perfis_publicos_carimbo();

-- ── Pedidos, amizades, bloqueios ────────────────────────────────────────
create table public.solicitacoes_amizade (
  id        uuid primary key default gen_random_uuid(),
  de        uuid not null references auth.users(id) on delete cascade,
  para      uuid not null references auth.users(id) on delete cascade,
  origem    text not null check (origem in ('pesquisa','link','qr')),
  criada_em timestamptz not null default now(),
  unique (de, para),
  check (de <> para)
);
create index solicitacoes_para on public.solicitacoes_amizade(para);

-- Um par so, sempre com a < b: impede a amizade duplicada A-B / B-A.
create table public.amizades (
  a     uuid not null references auth.users(id) on delete cascade,
  b     uuid not null references auth.users(id) on delete cascade,
  desde timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index amizades_b on public.amizades(b);

create table public.bloqueios (
  quem uuid not null references auth.users(id) on delete cascade,
  alvo uuid not null references auth.users(id) on delete cascade,
  em   timestamptz not null default now(),
  primary key (quem, alvo),
  check (quem <> alvo)
);
create index bloqueios_alvo on public.bloqueios(alvo);

-- Link de convite: vale 5 minutos, conferido AQUI no servidor.
create table public.convites_link (
  codigo    text primary key,
  dono      uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index convites_link_dono on public.convites_link(dono);

-- Um cutucao por amigo por dia (dia de Brasilia).
create table public.cutucadas (
  de   uuid not null references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  dia  date not null,
  primary key (de, para, dia)
);

-- ── Nozes ───────────────────────────────────────────────────────────────
-- Saldo fora do blob: o app nao consegue editar. So muda por funcao.
create table public.carteira_nozes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saldo   integer not null default 0 check (saldo >= 0)
);
create table public.movimentos_nozes (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta   integer not null,
  motivo  text not null check (motivo in ('boas_vindas','presente_enviado','presente_recebido')),
  outro   uuid references auth.users(id) on delete set null,
  em      timestamptz not null default now()
);
create index movimentos_nozes_user on public.movimentos_nozes(user_id);

-- ── Notificacoes (o sininho da Home) ────────────────────────────────────
-- Todas as notificacoes do app ficam aqui e somem depois de 1 dia.
create table public.notificacoes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  tipo      text not null check (tipo in ('pedido','aceito','cutucada','presente',
                                          'lembrete','tarefa','teste','aviso')),
  titulo    text not null check (char_length(titulo) <= 140),
  corpo     text not null default '' check (char_length(corpo) <= 400),
  dados     jsonb not null default '{}'::jsonb,
  lida      boolean not null default false,
  criada_em timestamptz not null default now()
);
create index notificacoes_user_criada on public.notificacoes(user_id, criada_em desc);

-- RLS em tudo. Sem politica = ninguem do app le ou escreve direto.
alter table public.solicitacoes_amizade enable row level security;
alter table public.amizades            enable row level security;
alter table public.bloqueios           enable row level security;
alter table public.convites_link       enable row level security;
alter table public.cutucadas           enable row level security;
alter table public.carteira_nozes      enable row level security;
alter table public.movimentos_nozes    enable row level security;
alter table public.notificacoes        enable row level security;
revoke all on public.solicitacoes_amizade, public.amizades, public.bloqueios,
              public.convites_link, public.cutucadas, public.carteira_nozes,
              public.movimentos_nozes, public.notificacoes
  from anon, authenticated;

-- O dono ve o proprio saldo.
grant select on public.carteira_nozes to authenticated;
create policy "dono ve o proprio saldo" on public.carteira_nozes
  for select to authenticated using (user_id = (select auth.uid()));

-- O dono le, marca como lida e apaga as proprias notificacoes. Criar, so o
-- servidor (funcoes e a edge function).
grant select, delete on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;
create policy "dono le as proprias notificacoes" on public.notificacoes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dono marca as proprias notificacoes" on public.notificacoes
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "dono apaga as proprias notificacoes" on public.notificacoes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Faxina diaria ───────────────────────────────────────────────────────
-- Notificacao some depois de 1 dia; link vencido e cutucao antigo nao
-- servem para nada. 3h15 UTC = 0h15 em Brasilia.
select cron.schedule('faxina-social', '15 3 * * *', $$
  delete from public.notificacoes  where criada_em < now() - interval '1 day';
  delete from public.convites_link where expira_em < now() - interval '1 hour';
  delete from public.cutucadas     where dia < (now() at time zone 'America/Sao_Paulo')::date - 2;
$$);
