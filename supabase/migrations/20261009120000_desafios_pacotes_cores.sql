-- DESAFIOS, PACOTES DE NOZES E LOJA DE CORES (09/10/2026)
--
-- Aplicada no projeto em partes (o envio inteiro estourava o tempo da
-- ferramenta): versoes 20261009221114 desafios_1_ajudantes,
-- 20261009221332 desafios_2a_tabela, 20261009221356 desafios_2b_criar_responder,
-- 20261009221420 desafios_2c_encerrar_listar, 20261009221854 desafios_2d_gatilho_amizade,
-- 20261009221912 pacotes_de_nozes, 20261009221933 loja_de_cores,
-- 20261009222048 perfil_publico_so_cor_comprada, 20261009222140 quem_sem_perfil.
-- A troca de desfazer_amizade e o cron 'desafios-do-dia' foram aplicados
-- direto (execute_sql). Este arquivo junta tudo, na ordem.
--
-- Decisoes do fundador:
-- * Desafios entre amigos: treino, estudo ou leitura, 1 semana ou 1 mes.
--   Quem desafia aposta X nozes; o amigo aceita apostando X ou mais.
--   Cada um arrisca a propria aposta e quem vence leva as duas.
--   Empate devolve cada aposta ao dono.
-- * Os marcos de XP deixam de liberar cores e passam a dar PACOTES de nozes.
--   O 1o pacote pede 50 XP; cada pacote seguinte pede o dobro do anterior
--   (50, 100, 200, 400...) e paga 50 nozes a mais (50, 100, 150...).
--   Conta a partir de agora: o XP de antes nao vira pacote.
-- * As cores do Ticolino passam a ser compradas com nozes. Quem ja tinha
--   liberado uma cor pelo XP continua com ela.
--
-- Tudo que mexe em nozes acontece AQUI, no servidor. O app so pede.
-- As pontuacoes dos desafios e o XP dos pacotes saem do blob user_data,
-- que o proprio app grava; por isso cada conta tem teto por dia (um blob
-- editado a mao nao rende mais que um dia muito bom de verdade).

-- ── Novos motivos de movimento e novo tipo de aviso ─────────────────────
alter table public.movimentos_nozes drop constraint movimentos_nozes_motivo_check;
alter table public.movimentos_nozes add constraint movimentos_nozes_motivo_check
  check (motivo in ('boas_vindas','presente_enviado','presente_recebido',
                    'aposta','aposta_devolvida','premio_desafio','pacote','compra_cor'));

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('pedido','aceito','cutucada','presente','lembrete','tarefa','teste','aviso','desafio'));

-- ── Ajudantes ───────────────────────────────────────────────────────────
-- Leitura segura do blob: um valor estranho vira 0/null em vez de derrubar
-- a funcao inteira (e travar o desafio dos dois).
create or replace function public._num(p text)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when p ~ '^-?[0-9]+(\.[0-9]+)?$' and length(p) < 16 then p::numeric else 0 end;
$$;

create or replace function public._dia_txt(p text)
returns date language plpgsql stable set search_path to 'public' as $$
begin
  if p is null then return null; end if;
  if p ~ '^\d{4}-\d{2}-\d{2}$' then return p::date; end if;
  -- logLeitura guarda o instante em UTC; o dia que conta e o de Brasilia.
  if p ~ '^\d{4}-\d{2}-\d{2}T' then return (p::timestamptz at time zone 'America/Sao_Paulo')::date; end if;
  return null;
exception when others then return null;
end;
$$;

create or replace function public._hoje_sp()
returns date language sql stable set search_path to 'public' as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public._blob(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select data from public.user_data where user_id = p_user
  order by updated_at desc nulls last limit 1;
$$;

-- Move nozes e registra o movimento. Quem chama ja travou a carteira.
create or replace function public._mover_nozes(p_user uuid, p_delta integer, p_motivo text, p_outro uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_delta = 0 then return; end if;
  insert into public.carteira_nozes(user_id, saldo) values (p_user, 0) on conflict do nothing;
  update public.carteira_nozes set saldo = saldo + p_delta where user_id = p_user;
  insert into public.movimentos_nozes(user_id, delta, motivo, outro) values (p_user, p_delta, p_motivo, p_outro);
end;
$$;

create or replace function public._saldo(p_user uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce((select saldo from public.carteira_nozes where user_id = p_user), 0);
$$;

-- ── Pontos de um desafio, lidos do blob de quem joga ────────────────────
-- estudo:  minutos de estudo do Historico (ate 600 por dia)
-- leitura: paginas registradas nos livros (ate 500 por dia)
-- treino:  treinos do dia (ate 2 por dia). O check "Exercicio" da Home
--          conta 1; treinos cronometrados e corridas contam cada um.
create or replace function public._pontos_desafio(p_user uuid, p_tipo text, p_ini date, p_fim date)
returns integer language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb := public._blob(p_user); v_total numeric := 0; v_ex jsonb;
begin
  if v is null or p_ini is null or p_fim is null or p_fim < p_ini then return 0; end if;

  if p_tipo = 'estudo' then
    select coalesce(sum(least(greatest(public._num(h.valor->>'e'), 0), 600)), 0) into v_total
    from jsonb_each(case when jsonb_typeof(v->'historico') = 'object' then v->'historico' else '{}'::jsonb end) h(dia, valor)
    where jsonb_typeof(h.valor) = 'object' and public._dia_txt(h.dia) between p_ini and p_fim;

  elsif p_tipo = 'leitura' then
    select coalesce(sum(p), 0) into v_total from (
      select least(sum(pag), 500) p from (
        select public._dia_txt(l->>'data') dia, greatest(public._num(l->>'paginas'), 0) pag
        from jsonb_array_elements(case when jsonb_typeof(v->'livros') = 'array' then v->'livros' else '[]'::jsonb end) b,
             jsonb_array_elements(case when jsonb_typeof(b->'logLeitura') = 'array' then b->'logLeitura' else '[]'::jsonb end) l
      ) x where dia between p_ini and p_fim group by dia
    ) y;

  elsif p_tipo = 'treino' then
    v_ex := case when jsonb_typeof(v->'exercicios') = 'object' then v->'exercicios' else '{}'::jsonb end;
    select coalesce(sum(least(2, greatest(1, reais))), 0) into v_total from (
      select dia, sum(real) reais from (
        select public._dia_txt(t->>'data') dia, case when public._num(t->>'dur') > 0 then 1 else 0 end real
        from jsonb_array_elements(case when jsonb_typeof(v_ex->'treinos') = 'array' then v_ex->'treinos' else '[]'::jsonb end) t
        union all
        select public._dia_txt(c->>'data'), 1
        from jsonb_array_elements(case when jsonb_typeof(v_ex->'corridas') = 'array' then v_ex->'corridas' else '[]'::jsonb end) c
      ) x where dia between p_ini and p_fim group by dia
    ) y;
  end if;

  return least(v_total, 1000000)::integer;
exception when others then
  raise warning '_pontos_desafio %: %', p_user, sqlerrm;
  return 0;
end;
$$;

-- ── DESAFIOS ────────────────────────────────────────────────────────────
create table public.desafios (
  id            uuid primary key default gen_random_uuid(),
  de            uuid not null references auth.users(id) on delete cascade,
  para          uuid not null references auth.users(id) on delete cascade,
  tipo          text not null check (tipo in ('treino','estudo','leitura')),
  dias          integer not null check (dias in (7, 30)),
  aposta_de     integer not null check (aposta_de between 1 and 10000),
  aposta_para   integer check (aposta_para between 1 and 10000),
  estado        text not null default 'pendente'
                check (estado in ('pendente','ativo','recusado','cancelado','expirado','encerrado')),
  criado_em     timestamptz not null default now(),
  respondido_em timestamptz,
  inicio        date,
  fim           date,
  pontos_de     integer,
  pontos_para   integer,
  vencedor      uuid references auth.users(id) on delete set null,
  encerrado_em  timestamptz,
  check (de <> para)
);
create index desafios_de   on public.desafios(de, estado);
create index desafios_para on public.desafios(para, estado);
-- Um desafio aberto (pendente ou valendo) por dupla de cada vez.
create unique index desafios_um_por_dupla on public.desafios(least(de, para), greatest(de, para))
  where estado in ('pendente','ativo');

alter table public.desafios enable row level security;
revoke all on public.desafios from anon, authenticated;
-- Leitura e escrita so pelas funcoes abaixo.

-- Se uma das contas for apagada com o desafio aberto, a outra recebe a
-- aposta de volta (senao as nozes sumiriam junto).
create or replace function public.desafio_apagado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.estado = 'pendente' then
    update public.carteira_nozes set saldo = saldo + old.aposta_de where user_id = old.de;
  elsif old.estado = 'ativo' then
    update public.carteira_nozes set saldo = saldo + old.aposta_de where user_id = old.de;
    update public.carteira_nozes set saldo = saldo + coalesce(old.aposta_para, 0) where user_id = old.para;
  end if;
  return old;
end;
$$;
create trigger desafio_apagado before delete on public.desafios
  for each row execute function public.desafio_apagado();

create or replace function public._nome_tipo(p_tipo text)
returns text language sql immutable set search_path to 'public' as $$
  select case p_tipo when 'treino' then 'quem treina mais'
                     when 'estudo' then 'quem estuda mais tempo'
                     when 'leitura' then 'quem lê mais páginas' end;
$$;

create or replace function public._qtd_nozes(p integer)
returns text language sql immutable set search_path to 'public' as $$
  select p || case when p = 1 then ' noz' else ' nozes' end;
$$;

-- Devolve a aposta de quem desafiou e fecha o pedido (recusado, cancelado
-- ou expirado). Quem chama ja travou a linha.
create or replace function public._devolver_pendente(p_id uuid, p_estado text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare d public.desafios;
begin
  select * into d from public.desafios where id = p_id and estado = 'pendente';
  if not found then return; end if;
  perform 1 from public.carteira_nozes where user_id = d.de for update;
  perform public._mover_nozes(d.de, d.aposta_de, 'aposta_devolvida', d.para);
  update public.desafios set estado = p_estado, respondido_em = now() where id = p_id;
end;
$$;

create or replace function public.criar_desafio(p_para uuid, p_tipo text, p_dias integer, p_aposta integer)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_id uuid;
begin
  if p_tipo is null or p_tipo not in ('treino','estudo','leitura') then return 'tipo_invalido'; end if;
  if p_dias is null or p_dias not in (7, 30) then return 'dias_invalidos'; end if;
  if p_aposta is null or p_aposta < 1 or p_aposta > 10000 then return 'aposta_invalida'; end if;
  if p_para is null or p_para = v_eu then return 'voce_mesmo'; end if;
  if not public._amigos(v_eu, p_para) then return 'nao_amigos'; end if;

  -- Trava as duas carteiras na mesma ordem (evita impasse entre dois pedidos cruzados).
  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0), (p_para, 0) on conflict do nothing;
  perform 1 from public.carteira_nozes where user_id in (v_eu, p_para) order by user_id for update;

  if exists (select 1 from public.desafios where least(de, para) = least(v_eu, p_para)
             and greatest(de, para) = greatest(v_eu, p_para) and estado in ('pendente','ativo')) then
    return 'ja_existe';
  end if;
  if (select count(*) from public.desafios where (de = v_eu or para = v_eu) and estado in ('pendente','ativo')) >= 10 then
    return 'limite';
  end if;
  if public._saldo(v_eu) < p_aposta then return 'sem_saldo'; end if;
  if public._saldo(p_para) < p_aposta then return 'saldo_amigo'; end if;

  insert into public.desafios(de, para, tipo, dias, aposta_de)
  values (v_eu, p_para, p_tipo, p_dias, p_aposta) returning id into v_id;
  perform public._mover_nozes(v_eu, -p_aposta, 'aposta', p_para);
  perform public._notificar(p_para, 'desafio',
    '⚔️ ' || public._quem(v_eu) || ' te desafiou',
    initcap(left(public._nome_tipo(p_tipo), 1)) || substr(public._nome_tipo(p_tipo), 2)
      || ' em ' || case when p_dias = 7 then '1 semana' else '1 mês' end
      || '. Aposta: ' || public._qtd_nozes(p_aposta) || '.',
    jsonb_build_object('desafio', v_id));
  return 'ok';
end;
$$;

create or replace function public.responder_desafio(p_id uuid, p_aceitar boolean, p_aposta integer default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); d public.desafios; v_aposta integer; v_ini date;
begin
  select * into d from public.desafios where id = p_id and para = v_eu for update;
  if not found or d.estado <> 'pendente' then return 'nao_encontrado'; end if;

  if d.criado_em < now() - interval '3 days' then
    perform public._devolver_pendente(d.id, 'expirado');
    return 'expirado';
  end if;

  if not coalesce(p_aceitar, false) then
    perform public._devolver_pendente(d.id, 'recusado');
    perform public._notificar(d.de, 'desafio', '🏳️ ' || public._quem(v_eu) || ' recusou o desafio',
      'Suas ' || public._qtd_nozes(d.aposta_de) || ' voltaram para a carteira.', jsonb_build_object('desafio', d.id));
    return 'ok';
  end if;

  if not public._amigos(v_eu, d.de) then return 'nao_amigos'; end if;
  v_aposta := coalesce(p_aposta, d.aposta_de);
  if v_aposta < d.aposta_de then return 'aposta_baixa'; end if;
  if v_aposta > 10000 then return 'aposta_invalida'; end if;

  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0) on conflict do nothing;
  perform 1 from public.carteira_nozes where user_id = v_eu for update;
  if public._saldo(v_eu) < v_aposta then return 'sem_saldo'; end if;

  -- Comeca no dia seguinte ao aceite: o que ja foi feito hoje nao entra.
  v_ini := public._hoje_sp() + 1;
  perform public._mover_nozes(v_eu, -v_aposta, 'aposta', d.de);
  update public.desafios set estado = 'ativo', aposta_para = v_aposta, respondido_em = now(),
         inicio = v_ini, fim = v_ini + d.dias - 1
   where id = d.id;
  perform public._notificar(d.de, 'desafio', '⚔️ ' || public._quem(v_eu) || ' aceitou o desafio',
    'Apostou ' || public._qtd_nozes(v_aposta) || '. Começa amanhã — boa sorte!', jsonb_build_object('desafio', d.id));
  return 'ok';
end;
$$;

create or replace function public.cancelar_desafio(p_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu();
begin
  perform 1 from public.desafios where id = p_id and de = v_eu and estado = 'pendente' for update;
  if not found then return 'nao_encontrado'; end if;
  perform public._devolver_pendente(p_id, 'cancelado');
  return 'ok';
end;
$$;

-- Fecha um desafio vencido. O resultado sai no dia seguinte ao ultimo dia,
-- a partir do meio-dia: da tempo de o aparelho de cada um sincronizar.
create or replace function public._encerrar_desafio(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare d public.desafios; v_pd integer; v_pp integer; v_venc uuid; v_pote integer;
begin
  select * into d from public.desafios where id = p_id for update;
  if not found or d.estado <> 'ativo' then return; end if;
  if (now() at time zone 'America/Sao_Paulo') < (d.fim + 1)::timestamp + interval '12 hours' then return; end if;

  v_pd := public._pontos_desafio(d.de, d.tipo, d.inicio, d.fim);
  v_pp := public._pontos_desafio(d.para, d.tipo, d.inicio, d.fim);
  v_pote := d.aposta_de + coalesce(d.aposta_para, 0);
  perform 1 from public.carteira_nozes where user_id in (d.de, d.para) order by user_id for update;

  if v_pd = v_pp then
    perform public._mover_nozes(d.de, d.aposta_de, 'aposta_devolvida', d.para);
    perform public._mover_nozes(d.para, coalesce(d.aposta_para, 0), 'aposta_devolvida', d.de);
  else
    v_venc := case when v_pd > v_pp then d.de else d.para end;
    perform public._mover_nozes(v_venc, v_pote, 'premio_desafio', case when v_venc = d.de then d.para else d.de end);
  end if;

  update public.desafios set estado = 'encerrado', pontos_de = v_pd, pontos_para = v_pp,
         vencedor = v_venc, encerrado_em = now() where id = d.id;

  if v_venc is null then
    perform public._notificar(u, 'desafio', '🤝 Desafio empatado', 'Cada um recebeu a própria aposta de volta.',
                              jsonb_build_object('desafio', d.id))
    from unnest(array[d.de, d.para]) u;
  else
    perform public._notificar(v_venc, 'desafio', '🏆 Você venceu o desafio!',
      'Contra ' || public._quem(case when v_venc = d.de then d.para else d.de end) || '. +' || public._qtd_nozes(v_pote) || '.',
      jsonb_build_object('desafio', d.id));
    perform public._notificar(case when v_venc = d.de then d.para else d.de end, 'desafio',
      '⚔️ ' || public._quem(v_venc) || ' venceu o desafio',
      'Fica para a próxima. Bora uma revanche?', jsonb_build_object('desafio', d.id));
  end if;
end;
$$;

-- Fecha o que venceu e o que expirou, so do proprio usuario (o app chama
-- ao abrir a aba). O cron faz o mesmo para todo mundo uma vez por dia.
create or replace function public._arrumar_desafios(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select id from public.desafios
           where (p_user is null or de = p_user or para = p_user)
             and estado = 'pendente' and criado_em < now() - interval '3 days' loop
    perform public._devolver_pendente(r.id, 'expirado');
  end loop;
  for r in select id from public.desafios
           where (p_user is null or de = p_user or para = p_user)
             and estado = 'ativo' and fim < public._hoje_sp() loop
    perform public._encerrar_desafio(r.id);
  end loop;
end;
$$;

-- Lista para a tela: abertos e os que fecharam nos ultimos 7 dias, ja com
-- o placar parcial (do inicio ate hoje) dos que estao valendo.
create or replace function public.meus_desafios()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v jsonb;
begin
  perform public._arrumar_desafios(v_eu);
  select coalesce(jsonb_agg(x order by x->>'ordem', x->>'criado_em' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', d.id, 'eu_criei', d.de = v_eu, 'outro', o.id,
      'nome', coalesce(nullif(p.nome, ''), '@' || p.nick, 'Amigo'), 'nick', p.nick, 'cor', coalesce(p.cor, 'padrao'),
      'tipo', d.tipo, 'dias', d.dias, 'estado', d.estado,
      'aposta_minha', case when d.de = v_eu then d.aposta_de else d.aposta_para end,
      'aposta_outro', case when d.de = v_eu then d.aposta_para else d.aposta_de end,
      'aposta_minima', d.aposta_de,
      'criado_em', d.criado_em, 'expira_em', d.criado_em + interval '3 days',
      'inicio', d.inicio, 'fim', d.fim, 'hoje', public._hoje_sp(),
      'pontos_eu', case when d.estado = 'ativo' then
          public._pontos_desafio(v_eu, d.tipo, d.inicio, least(d.fim, public._hoje_sp()))
          else case when d.de = v_eu then d.pontos_de else d.pontos_para end end,
      'pontos_outro', case when d.estado = 'ativo' then
          public._pontos_desafio(o.id, d.tipo, d.inicio, least(d.fim, public._hoje_sp()))
          else case when d.de = v_eu then d.pontos_para else d.pontos_de end end,
      'resultado', case when d.estado <> 'encerrado' then null
                        when d.vencedor is null then 'empate'
                        when d.vencedor = v_eu then 'venci' else 'perdi' end,
      'ordem', case d.estado when 'pendente' then '1' when 'ativo' then '2' else '3' end
    ) x
    from public.desafios d
    join auth.users o on o.id = case when d.de = v_eu then d.para else d.de end
    left join public.perfis_publicos p on p.user_id = o.id
    where (d.de = v_eu or d.para = v_eu)
      and (d.estado in ('pendente','ativo')
           or coalesce(d.encerrado_em, d.respondido_em, d.criado_em) > now() - interval '7 days')
    limit 40
  ) s;
  return v;
end;
$$;

-- Desfazer a amizade ou bloquear cancela os convites de desafio pendentes
-- (com devolucao; o gatilho amizade_desfeita faz o mesmo). Os que ja estao
-- valendo seguem ate o fim: sair da amizade nao pode ser um jeito de fugir
-- de um desafio perdido.
create or replace function public.desfazer_amizade(p_outro uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); r record;
begin
  delete from public.amizades where a = least(v_eu, p_outro) and b = greatest(v_eu, p_outro);
  for r in select id from public.desafios where estado = 'pendente'
           and ((de = v_eu and para = p_outro) or (de = p_outro and para = v_eu)) for update loop
    perform public._devolver_pendente(r.id, 'cancelado');
  end loop;
  return 'ok';
end;
$$;

-- bloquear() ja apaga a amizade; o gatilho abaixo cobre os dois caminhos
-- (desfazer e bloquear) sem precisar reescrever bloquear().
create or replace function public.amizade_desfeita()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select id from public.desafios where estado = 'pendente'
           and least(de, para) = old.a and greatest(de, para) = old.b loop
    perform public._devolver_pendente(r.id, 'cancelado');
  end loop;
  return old;
end;
$$;
revoke execute on function public.amizade_desfeita() from public, anon, authenticated;
create trigger amizade_desfeita after delete on public.amizades
  for each row execute function public.amizade_desfeita();

-- ── PACOTES DE NOZES ────────────────────────────────────────────────────
-- nivel = quantos pacotes a pessoa ja coletou. O pacote n (0, 1, 2...) fica
-- pronto quando o XP ganho desde xp_base chega a 50*(2^(n+1)-1) — ou seja,
-- 50 XP para o 1o, mais 100 para o 2o, mais 200 para o 3o... — e paga
-- 50*(n+1) nozes. O patamar da imagem e min(n, 6): punhado, pote, cesta,
-- amontoado, caminhao, navio e, dai em diante, a fabrica.
create table public.pacotes_nozes (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  nivel    integer not null default 0 check (nivel between 0 and 50),
  xp_base  integer not null default 0,
  base_em  timestamptz not null default now()
);
alter table public.pacotes_nozes enable row level security;
revoke all on public.pacotes_nozes from anon, authenticated;

create or replace function public._xp_do_blob(p_user uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select least(greatest(public._num(public._blob(p_user)->>'studyXP'), 0), 100000000)::integer;
$$;

-- "A partir de agora": quem ja tem conta comeca do XP que tem hoje.
insert into public.pacotes_nozes(user_id, xp_base)
select u.id, public._xp_do_blob(u.id) from auth.users u
on conflict do nothing;

create or replace function public._pacote_info(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.pacotes_nozes; v_xp integer; v_dias integer; v_ganho numeric; v_marco numeric; v_ant numeric;
begin
  insert into public.pacotes_nozes(user_id, xp_base) values (p_user, public._xp_do_blob(p_user))
  on conflict do nothing;
  select * into r from public.pacotes_nozes where user_id = p_user;
  v_xp := public._xp_do_blob(p_user);
  v_dias := greatest(1, ceil(extract(epoch from now() - r.base_em) / 86400.0))::integer;
  -- Teto: 200 XP por dia desde o inicio (o dia mais cheio de verdade,
  -- com XP em dobro, fica perto de 190).
  v_ganho := least(greatest(v_xp - r.xp_base, 0), 200::numeric * v_dias);
  v_marco := 50 * (power(2::numeric, r.nivel + 1) - 1);
  v_ant   := 50 * (power(2::numeric, r.nivel) - 1);
  return jsonb_build_object(
    'nivel', r.nivel, 'patamar', least(r.nivel, 6),
    'xp_base', r.xp_base, 'ganho', v_ganho::bigint,
    'marco_anterior', v_ant::bigint, 'marco', v_marco::bigint,
    'nozes', 50 * (r.nivel + 1), 'pronto', v_ganho >= v_marco,
    'saldo', public._saldo(p_user));
end;
$$;

create or replace function public.meus_pacotes()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  return public._pacote_info(public._eu());
end;
$$;

create or replace function public.coletar_pacote()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v jsonb; v_nozes integer; v_nivel integer;
begin
  perform public._pacote_info(v_eu);                       -- garante a linha
  perform 1 from public.pacotes_nozes where user_id = v_eu for update;
  v := public._pacote_info(v_eu);
  if not (v->>'pronto')::boolean then
    return v || jsonb_build_object('r', 'ainda_nao');
  end if;
  v_nivel := (v->>'nivel')::integer;
  v_nozes := (v->>'nozes')::integer;
  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0) on conflict do nothing;
  perform 1 from public.carteira_nozes where user_id = v_eu for update;
  perform public._mover_nozes(v_eu, v_nozes, 'pacote', null);
  update public.pacotes_nozes set nivel = nivel + 1 where user_id = v_eu;
  return public._pacote_info(v_eu) || jsonb_build_object(
    'r', 'ok', 'coletado_nozes', v_nozes, 'coletado_patamar', least(v_nivel, 6), 'coletado_nivel', v_nivel);
end;
$$;

-- ── LOJA DE CORES ───────────────────────────────────────────────────────
create table public.cores_compradas (
  user_id     uuid not null references auth.users(id) on delete cascade,
  cor         text not null check (cor in ('cinza','castanho','marrom','preto','listrado')),
  comprada_em timestamptz not null default now(),
  primary key (user_id, cor)
);
alter table public.cores_compradas enable row level security;
revoke all on public.cores_compradas from anon, authenticated;
grant select on public.cores_compradas to authenticated;
create policy "dono ve as proprias cores" on public.cores_compradas
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public._preco_cor(p_cor text)
returns integer language sql immutable set search_path to 'public' as $$
  select case p_cor when 'cinza' then 50 when 'castanho' then 100 when 'marrom' then 200
                    when 'preto' then 350 when 'listrado' then 500 end;
$$;

-- Quem ja tinha liberado a cor pelo XP de estudo continua com ela.
insert into public.cores_compradas(user_id, cor)
select u.user_id, c.cor
from (select distinct user_id from public.user_data) u
cross join (values ('cinza'), ('castanho'), ('marrom'), ('preto'), ('listrado')) c(cor)
where public._xp_do_blob(u.user_id) >= public._preco_cor(c.cor)
on conflict do nothing;

create or replace function public.comprar_cor(p_cor text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_preco integer := public._preco_cor(p_cor);
begin
  if v_preco is null then return 'cor_invalida'; end if;
  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0) on conflict do nothing;
  perform 1 from public.carteira_nozes where user_id = v_eu for update;
  if exists (select 1 from public.cores_compradas where user_id = v_eu and cor = p_cor) then return 'ja_tem'; end if;
  if public._saldo(v_eu) < v_preco then return 'sem_saldo'; end if;
  perform public._mover_nozes(v_eu, -v_preco, 'compra_cor', null);
  insert into public.cores_compradas(user_id, cor) values (v_eu, p_cor);
  return 'ok';
end;
$$;

-- A vitrine das Amizades so mostra cor que a pessoa tem.
create or replace function public.perfis_publicos_cor_valida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.cor is distinct from 'padrao' and not exists
     (select 1 from public.cores_compradas c where c.user_id = new.user_id and c.cor = new.cor) then
    new.cor := 'padrao';
  end if;
  return new;
end;
$$;
revoke execute on function public.perfis_publicos_cor_valida() from public, anon, authenticated;
create trigger perfis_publicos_cor_valida before insert or update on public.perfis_publicos
  for each row execute function public.perfis_publicos_cor_valida();

-- Quem ainda nao tem perfil publico aparecia como NULL e derrubava o aviso.
create or replace function public._quem(p uuid)
returns text language sql stable set search_path to 'public' as $$
  select coalesce((select coalesce(nullif(nome, ''), '@' || nick) from public.perfis_publicos where user_id = p),
                  'Um amigo');
$$;

-- ── Permissoes ──────────────────────────────────────────────────────────
-- Ajudantes internos: ninguem chama de fora.
revoke execute on function public._num(text), public._dia_txt(text), public._hoje_sp(), public._blob(uuid),
  public._mover_nozes(uuid, integer, text, uuid), public._saldo(uuid),
  public._pontos_desafio(uuid, text, date, date), public.desafio_apagado(),
  public._nome_tipo(text), public._qtd_nozes(integer), public._devolver_pendente(uuid, text),
  public._encerrar_desafio(uuid), public._arrumar_desafios(uuid),
  public._xp_do_blob(uuid), public._pacote_info(uuid), public._preco_cor(text)
  from public, anon, authenticated;

revoke execute on function public.criar_desafio(uuid, text, integer, integer),
  public.responder_desafio(uuid, boolean, integer), public.cancelar_desafio(uuid),
  public.meus_desafios(), public.meus_pacotes(), public.coletar_pacote(), public.comprar_cor(text),
  public.desfazer_amizade(uuid)
  from public, anon;
grant execute on function public.criar_desafio(uuid, text, integer, integer),
  public.responder_desafio(uuid, boolean, integer), public.cancelar_desafio(uuid),
  public.meus_desafios(), public.meus_pacotes(), public.coletar_pacote(), public.comprar_cor(text),
  public.desfazer_amizade(uuid)
  to authenticated;

-- ── Cron: uma vez por dia fecha desafios vencidos e convites expirados ──
select cron.schedule('desafios-do-dia', '20 15 * * *', $$ select public._arrumar_desafios(null); $$);
