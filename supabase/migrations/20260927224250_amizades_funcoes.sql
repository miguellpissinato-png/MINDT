-- Aplicada no projeto em 27/09/2026 (versao 20260927224250).

-- AMIZADES, passo 2: as funcoes. Toda regra social mora aqui, no servidor.
--
-- Todas sao SECURITY DEFINER (passam por cima da RLS) e por isso conferem
-- quem esta chamando (auth.uid()) antes de qualquer coisa. EXECUTE sai de
-- PUBLIC/anon e entra so para authenticated; as internas (_*) nem isso.
-- Respostas em texto curto ('ok', 'ja_amigos'...) que o app traduz.

-- ── Internas ────────────────────────────────────────────────────────────
create or replace function public._eu()
returns uuid language plpgsql stable set search_path to 'public' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'sem_sessao'; end if;
  return v;
end;
$$;

create or replace function public._bloqueados(p1 uuid, p2 uuid)
returns boolean language sql stable set search_path to 'public' as $$
  select exists (select 1 from public.bloqueios
                 where (quem = p1 and alvo = p2) or (quem = p2 and alvo = p1));
$$;

create or replace function public._amigos(p1 uuid, p2 uuid)
returns boolean language sql stable set search_path to 'public' as $$
  select exists (select 1 from public.amizades
                 where a = least(p1, p2) and b = greatest(p1, p2));
$$;

create or replace function public._notificar(p_user uuid, p_tipo text, p_titulo text,
                                             p_corpo text, p_dados jsonb default '{}'::jsonb)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.notificacoes(user_id, tipo, titulo, corpo, dados)
  values (p_user, p_tipo, left(p_titulo, 140), left(coalesce(p_corpo, ''), 400), coalesce(p_dados, '{}'::jsonb));
$$;

-- Nome para mostrar nos avisos: o nome, ou o @nick se nao houver nome.
create or replace function public._quem(p uuid)
returns text language sql stable set search_path to 'public' as $$
  select coalesce(nullif(nome, ''), '@' || nick) from public.perfis_publicos where user_id = p;
$$;

-- O coracao de todo pedido (pesquisa, link ou QR). Se o outro ja tinha me
-- pedido, vira amizade na hora — os dois quiseram.
create or replace function public._pedir(p_de uuid, p_para uuid, p_origem text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_de   public.perfis_publicos;
  v_para public.perfis_publicos;
begin
  if p_de = p_para then return 'voce_mesmo'; end if;
  select * into v_de   from public.perfis_publicos where user_id = p_de;
  select * into v_para from public.perfis_publicos where user_id = p_para;
  if v_de.user_id is null or not v_de.ativo then return 'ative_primeiro'; end if;
  if v_para.user_id is null or not v_para.ativo then return 'indisponivel'; end if;
  if public._bloqueados(p_de, p_para) then return 'indisponivel'; end if;
  if public._amigos(p_de, p_para) then return 'ja_amigos'; end if;
  if p_origem = 'pesquisa' and not v_para.buscavel then return 'indisponivel'; end if;
  if p_origem in ('link','qr') and not v_para.aceita_convites then return 'indisponivel'; end if;

  if exists (select 1 from public.solicitacoes_amizade where de = p_para and para = p_de) then
    delete from public.solicitacoes_amizade where de = p_para and para = p_de;
    insert into public.amizades(a, b) values (least(p_de, p_para), greatest(p_de, p_para))
      on conflict do nothing;
    perform public._notificar(p_para, 'aceito', '🤝 ' || public._quem(p_de) || ' agora é seu amigo',
      'Vocês dois se convidaram. Já dá pra comparar o progresso.', jsonb_build_object('de', p_de));
    return 'amigos';
  end if;

  insert into public.solicitacoes_amizade(de, para, origem) values (p_de, p_para, p_origem)
    on conflict (de, para) do nothing;
  if not found then return 'ja_pedido'; end if;
  perform public._notificar(p_para, 'pedido', '🐹 ' || public._quem(p_de) || ' quer ser seu amigo',
    '@' || v_de.nick || ' te mandou um pedido de amizade.', jsonb_build_object('de', p_de));
  return 'ok';
end;
$$;

-- ── Perfil ──────────────────────────────────────────────────────────────
create or replace function public.nick_disponivel(p_nick text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select lower(p_nick) ~ '^[a-z0-9._]{3,20}$'
     and not exists (select 1 from public.perfis_publicos
                      where nick = lower(p_nick) and user_id <> auth.uid());
$$;

-- Liga a aba (cria o perfil na primeira vez). Garante a carteira.
create or replace function public.ativar_amizades(p_nick text, p_nome text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_nick text := lower(trim(p_nick));
begin
  if v_nick !~ '^[a-z0-9._]{3,20}$' then return 'nick_invalido'; end if;
  if exists (select 1 from public.perfis_publicos where nick = v_nick and user_id <> v_eu) then
    return 'nick_em_uso';
  end if;
  insert into public.perfis_publicos(user_id, nick, nome)
  values (v_eu, v_nick, left(coalesce(trim(p_nome), ''), 40))
  on conflict (user_id) do update set nick = excluded.nick, ativo = true;
  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0) on conflict do nothing;
  return 'ok';
end;
$$;

create or replace function public.desativar_amizades()
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  update public.perfis_publicos set ativo = false where user_id = public._eu();
  return 'ok';
end;
$$;

-- Troca o codigo do QR (se a pessoa achar que ele vazou).
create or replace function public.novo_qr_codigo()
returns text language plpgsql security definer set search_path to 'public' as $$
declare v text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
begin
  update public.perfis_publicos set qr_codigo = v where user_id = public._eu();
  return v;
end;
$$;

-- ── Pesquisa ────────────────────────────────────────────────────────────
-- So quem esta ativo e deixou "aparecer na pesquisa". Bloqueio em qualquer
-- direcao some dos dois lados. Minimo de 2 letras, maximo de 20 resultados.
create or replace function public.buscar_ticolinos(p_q text)
returns table(user_id uuid, nick text, nome text, cor text, nivel integer, relacao text)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare v_eu uuid := public._eu(); v_q text := lower(trim(coalesce(p_q, '')));
begin
  v_q := ltrim(v_q, '@');
  if char_length(v_q) < 2 then return; end if;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.user_id, p.nick, p.nome,
           case when p.mostra_cor then p.cor else 'padrao' end,
           case when p.mostra_nivel then p.nivel end,
           case when public._amigos(v_eu, p.user_id) then 'amigo'
                when exists (select 1 from public.solicitacoes_amizade s where s.de = v_eu and s.para = p.user_id) then 'enviado'
                when exists (select 1 from public.solicitacoes_amizade s where s.de = p.user_id and s.para = v_eu) then 'recebido'
                else 'nenhum' end
    from public.perfis_publicos p
    where p.ativo and p.buscavel and p.user_id <> v_eu
      and not public._bloqueados(v_eu, p.user_id)
      and (p.nick like v_q || '%' or lower(p.nome) like '%' || v_q || '%')
    order by (p.nick = v_q) desc, (p.nick like v_q || '%') desc, p.nick
    limit 20;
end;
$$;

-- ── Pedidos ─────────────────────────────────────────────────────────────
create or replace function public.pedir_amizade(p_para uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  return public._pedir(public._eu(), p_para, 'pesquisa');
end;
$$;

create or replace function public.responder_solicitacao(p_id uuid, p_aceitar boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_s public.solicitacoes_amizade;
begin
  delete from public.solicitacoes_amizade where id = p_id and para = v_eu returning * into v_s;
  if v_s.id is null then return 'nao_encontrado'; end if;
  if not p_aceitar then return 'ok'; end if;
  if public._bloqueados(v_eu, v_s.de) then return 'indisponivel'; end if;
  insert into public.amizades(a, b) values (least(v_eu, v_s.de), greatest(v_eu, v_s.de))
    on conflict do nothing;
  perform public._notificar(v_s.de, 'aceito', '🤝 ' || public._quem(v_eu) || ' aceitou sua amizade',
    'Agora vocês podem comparar o progresso e trocar nozes.', jsonb_build_object('de', v_eu));
  return 'ok';
end;
$$;

-- Pedidos que chegaram para mim, com quem mandou.
create or replace function public.minhas_solicitacoes()
returns table(id uuid, de uuid, nick text, nome text, cor text, origem text, criada_em timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.de, p.nick, p.nome, case when p.mostra_cor then p.cor else 'padrao' end,
         s.origem, s.criada_em
  from public.solicitacoes_amizade s
  join public.perfis_publicos p on p.user_id = s.de and p.ativo
  where s.para = public._eu()
  order by s.criada_em desc;
$$;

-- ── Convites por link (5 min) e por QR (permanente) ─────────────────────
create or replace function public.gerar_link_convite()
returns table(codigo text, expira_em timestamptz)
language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare v_eu uuid := public._eu(); v_cod text; v_exp timestamptz := now() + interval '5 minutes';
begin
  if not exists (select 1 from public.perfis_publicos where user_id = v_eu and ativo) then
    raise exception 'ative_primeiro';
  end if;
  delete from public.convites_link where dono = v_eu and convites_link.expira_em < now();
  v_cod := 'l' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 19);
  insert into public.convites_link(codigo, dono, expira_em) values (v_cod, v_eu, v_exp);
  return query select v_cod, v_exp;
end;
$$;

-- Quem abre o link (ou le o QR) manda o pedido para o DONO do convite; o
-- dono aceita na aba. O vencimento de 5 min e conferido aqui.
create or replace function public.usar_convite(p_codigo text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_link public.convites_link; v_dono uuid;
begin
  select * into v_link from public.convites_link where codigo = p_codigo;
  if v_link.codigo is not null then
    if v_link.expira_em <= now() then return 'expirado'; end if;
    return public._pedir(v_eu, v_link.dono, 'link');
  end if;
  select user_id into v_dono from public.perfis_publicos where qr_codigo = p_codigo;
  if v_dono is null then return 'invalido'; end if;
  return public._pedir(v_eu, v_dono, 'qr');
end;
$$;

-- ── Amigos ──────────────────────────────────────────────────────────────
-- Os numeros de cada amigo ja vem filtrados pela privacidade DELE: o que
-- ele escondeu chega como null e o app mostra "—".
create or replace function public.meus_amigos()
returns table(user_id uuid, nick text, nome text, cor text, nivel integer, xp integer,
              ofensiva integer, paginas integer, desde timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with eu as (select public._eu() as id)
  select p.user_id, p.nick, p.nome,
         case when p.mostra_cor then p.cor else 'padrao' end,
         case when p.mostra_nivel then p.nivel end,
         case when p.mostra_nivel then p.xp end,
         case when p.mostra_ofensiva then p.ofensiva end,
         case when p.mostra_paginas then p.paginas end,
         a.desde
  from eu
  join public.amizades a on a.a = eu.id or a.b = eu.id
  join public.perfis_publicos p on p.user_id = case when a.a = eu.id then a.b else a.a end
  where p.ativo
  order by p.nome, p.nick;
$$;

create or replace function public.desfazer_amizade(p_outro uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu();
begin
  delete from public.amizades where a = least(v_eu, p_outro) and b = greatest(v_eu, p_outro);
  return 'ok';
end;
$$;

-- Bloquear desfaz a amizade e apaga os pedidos entre os dois. Ninguem e
-- avisado.
create or replace function public.bloquear(p_outro uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu();
begin
  if p_outro = v_eu then return 'voce_mesmo'; end if;
  insert into public.bloqueios(quem, alvo) values (v_eu, p_outro) on conflict do nothing;
  delete from public.amizades where a = least(v_eu, p_outro) and b = greatest(v_eu, p_outro);
  delete from public.solicitacoes_amizade
    where (de = v_eu and para = p_outro) or (de = p_outro and para = v_eu);
  return 'ok';
end;
$$;

create or replace function public.desbloquear(p_outro uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.bloqueios where quem = public._eu() and alvo = p_outro;
  return 'ok';
end;
$$;

create or replace function public.meus_bloqueados()
returns table(user_id uuid, nick text, nome text)
language sql stable security definer set search_path to 'public' as $$
  select b.alvo, p.nick, p.nome
  from public.bloqueios b
  left join public.perfis_publicos p on p.user_id = b.alvo
  where b.quem = public._eu()
  order by b.em desc;
$$;

-- ── Cutucar e presentear ────────────────────────────────────────────────
create or replace function public.cutucar(p_outro uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu();
begin
  if not public._amigos(v_eu, p_outro) then return 'nao_amigos'; end if;
  insert into public.cutucadas(de, para, dia)
  values (v_eu, p_outro, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;
  if not found then return 'ja_cutucou'; end if;
  perform public._notificar(p_outro, 'cutucada', '👉 ' || public._quem(v_eu) || ' te cutucou',
    'Bora fazer alguma coisa hoje?', jsonb_build_object('de', v_eu));
  return 'ok';
end;
$$;

-- Atomica: trava as duas carteiras na mesma ordem (sem deadlock), nunca
-- deixa saldo negativo, so entre amigos.
create or replace function public.dar_nozes(p_outro uuid, p_qtd integer)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_saldo integer;
begin
  if p_qtd is null or p_qtd < 1 or p_qtd > 100 then return 'qtd_invalida'; end if;
  if not public._amigos(v_eu, p_outro) then return 'nao_amigos'; end if;
  insert into public.carteira_nozes(user_id, saldo) values (p_outro, 0) on conflict do nothing;
  perform 1 from public.carteira_nozes where user_id in (v_eu, p_outro)
    order by user_id for update;
  select saldo into v_saldo from public.carteira_nozes where user_id = v_eu;
  if coalesce(v_saldo, 0) < p_qtd then return 'sem_saldo'; end if;
  update public.carteira_nozes set saldo = saldo - p_qtd where user_id = v_eu;
  update public.carteira_nozes set saldo = saldo + p_qtd where user_id = p_outro;
  insert into public.movimentos_nozes(user_id, delta, motivo, outro)
  values (v_eu, -p_qtd, 'presente_enviado', p_outro), (p_outro, p_qtd, 'presente_recebido', v_eu);
  perform public._notificar(p_outro, 'presente',
    '🌰 ' || public._quem(v_eu) || ' te deu ' || p_qtd || case when p_qtd = 1 then ' noz' else ' nozes' end,
    'Um presente pro seu Ticolino.', jsonb_build_object('de', v_eu, 'qtd', p_qtd));
  return 'ok';
end;
$$;

-- ── Permissoes ──────────────────────────────────────────────────────────
-- Funcao nasce com EXECUTE para PUBLIC; revogar so de anon nao fecha.
do $$
declare f text;
begin
  foreach f in array array[
    'public._eu()', 'public._bloqueados(uuid,uuid)', 'public._amigos(uuid,uuid)',
    'public._notificar(uuid,text,text,text,jsonb)', 'public._quem(uuid)',
    'public._pedir(uuid,uuid,text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array[
    'public.nick_disponivel(text)', 'public.ativar_amizades(text,text)',
    'public.desativar_amizades()', 'public.novo_qr_codigo()',
    'public.buscar_ticolinos(text)', 'public.pedir_amizade(uuid)',
    'public.responder_solicitacao(uuid,boolean)', 'public.minhas_solicitacoes()',
    'public.gerar_link_convite()', 'public.usar_convite(text)', 'public.meus_amigos()',
    'public.desfazer_amizade(uuid)', 'public.bloquear(uuid)', 'public.desbloquear(uuid)',
    'public.meus_bloqueados()', 'public.cutucar(uuid)', 'public.dar_nozes(uuid,integer)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
