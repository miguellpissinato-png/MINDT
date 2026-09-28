-- Limites anti-abuso para o lancamento. O app roda no aparelho da pessoa e
-- pode ser mexido por quem sabe abrir o console, entao o que outros usuarios
-- enxergam (ou o que custa servidor) tem teto aqui, no banco.

-- ── 1. Vitrine das Amizades: numeros plausiveis ─────────────────────────
-- XP, ofensiva e paginas sao enviados pelo app. Ninguem ganha mais de
-- ~200 XP por dia usando o app de verdade (itens do dia + teto de pomodoro,
-- ja com o dobro do Max); o teto aqui e o dobro disso por dia de conta.
-- Paginas tem folga para quem cadastra os livros que ja leu antes de entrar.
-- A ofensiva nao pode passar dos dias de conta. Valor acima do teto e
-- cortado no teto (o salvamento nao falha); o nome perde caracteres
-- invisiveis e de controle, que serviam para disfarcar um nome de outro.
create or replace function public.perfis_publicos_carimbo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_dias integer;
begin
  select greatest(1, ceil(extract(epoch from now() - u.created_at) / 86400.0))::integer
    into v_dias from auth.users u where u.id = new.user_id;
  v_dias := coalesce(v_dias, 1);
  new.xp       := least(new.xp, 400 * v_dias);
  new.paginas  := least(new.paginas, 20000 + 3000 * v_dias);
  new.ofensiva := least(new.ofensiva, v_dias + 1);
  new.nome     := left(btrim(regexp_replace(coalesce(new.nome, ''),
                    '[\u0001-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]', '', 'g')), 40);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function public.perfis_publicos_carimbo() from public, anon, authenticated;

drop trigger if exists perfis_publicos_carimbo on public.perfis_publicos;
create trigger perfis_publicos_carimbo before insert or update on public.perfis_publicos
  for each row execute function public.perfis_publicos_carimbo();

-- ── 2. Links de convite: no maximo 10 vivos por pessoa ──────────────────
-- Cada toque em "Gerar outro" cria uma linha; um script em laco enchia a
-- tabela. 10 links de 5 minutos ao mesmo tempo e muito mais do que alguem
-- usa de verdade.
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
  if (select count(*) from public.convites_link where dono = v_eu) >= 10 then
    raise exception 'limite';
  end if;
  v_cod := 'l' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 19);
  insert into public.convites_link(codigo, dono, expira_em) values (v_cod, v_eu, v_exp);
  return query select v_cod, v_exp;
end;
$$;

-- ── 3. Pedidos de amizade: sem enxurrada ────────────────────────────────
-- (a) no maximo 30 pedidos novos por pessoa por dia;
-- (b) quem teve o pedido recusado e pede de novo nao gera outro aviso no
--     sininho do mesmo alvo antes de 24 h (o pedido aparece na aba, mas o
--     sininho nao vira ferramenta de assedio).
create index if not exists solicitacoes_de_criada on public.solicitacoes_amizade(de, criada_em);

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

  if exists (select 1 from public.solicitacoes_amizade where de = p_de and para = p_para) then
    return 'ja_pedido';
  end if;
  if (select count(*) from public.solicitacoes_amizade
       where de = p_de and criada_em > now() - interval '1 day') >= 30 then
    return 'limite';
  end if;

  insert into public.solicitacoes_amizade(de, para, origem) values (p_de, p_para, p_origem)
    on conflict (de, para) do nothing;
  if not found then return 'ja_pedido'; end if;
  if not exists (select 1 from public.notificacoes
                  where user_id = p_para and tipo = 'pedido'
                    and dados->>'de' = p_de::text and criada_em > now() - interval '1 day') then
    perform public._notificar(p_para, 'pedido', '🐹 ' || public._quem(p_de) || ' quer ser seu amigo',
      '@' || v_de.nick || ' te mandou um pedido de amizade.', jsonb_build_object('de', p_de));
  end if;
  return 'ok';
end;
$$;
revoke all on function public._pedir(uuid,uuid,text) from public, anon, authenticated;

-- Trocar de nick toda hora tambem vira ferramenta de disfarce: ativar de
-- novo mantem o nick, a nao ser que ele mude de verdade — e isso so a cada
-- 24 h.
alter table public.perfis_publicos add column if not exists nick_trocado_em timestamptz;

create or replace function public.ativar_amizades(p_nick text, p_nome text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_eu uuid := public._eu(); v_nick text := lower(trim(p_nick)); v_atual public.perfis_publicos;
begin
  if v_nick !~ '^[a-z0-9._]{3,20}$' then return 'nick_invalido'; end if;
  if exists (select 1 from public.perfis_publicos where nick = v_nick and user_id <> v_eu) then
    return 'nick_em_uso';
  end if;
  select * into v_atual from public.perfis_publicos where user_id = v_eu;
  if v_atual.user_id is not null and v_atual.nick <> v_nick
     and v_atual.nick_trocado_em > now() - interval '1 day' then
    return 'nick_recente';
  end if;
  insert into public.perfis_publicos(user_id, nick, nome)
  values (v_eu, v_nick, left(coalesce(trim(p_nome), ''), 40))
  on conflict (user_id) do update
    set nick = excluded.nick, ativo = true,
        nick_trocado_em = case when perfis_publicos.nick <> excluded.nick then now()
                               else perfis_publicos.nick_trocado_em end;
  insert into public.carteira_nozes(user_id, saldo) values (v_eu, 0) on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.ativar_amizades(text,text) from public, anon;
grant execute on function public.ativar_amizades(text,text) to authenticated;

-- ── 4. Aparelhos de lembrete: no maximo 10 por pessoa ───────────────────
-- Cada aparelho recebe push a cada lembrete; milhares de linhas falsas
-- fariam a funcao de envio trabalhar para nada.
create or replace function public.lembrete_dispositivos_limite()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- Recadastro do mesmo aparelho (upsert) nao conta como novo.
  if exists (select 1 from public.lembrete_dispositivos where endpoint = new.endpoint) then
    return new;
  end if;
  if (select count(*) from public.lembrete_dispositivos where user_id = new.user_id) >= 10 then
    -- Abre espaco apagando o mais antigo: quem troca de celular nao fica travado.
    delete from public.lembrete_dispositivos
      where id = (select id from public.lembrete_dispositivos where user_id = new.user_id
                  order by criado_em limit 1);
  end if;
  return new;
end;
$$;
revoke all on function public.lembrete_dispositivos_limite() from public, anon, authenticated;
drop trigger if exists lembrete_dispositivos_limite on public.lembrete_dispositivos;
create trigger lembrete_dispositivos_limite before insert on public.lembrete_dispositivos
  for each row execute function public.lembrete_dispositivos_limite();

alter table public.lembrete_dispositivos
  add constraint lembrete_dispositivos_endpoint_tamanho check (char_length(endpoint) <= 1000) not valid;

-- ── 5. Dados do usuario: no maximo 5 MB ─────────────────────────────────
-- Hoje o maior tem ~1 MB (quase tudo foto de perfil, que o app agora reduz
-- para ~30 KB). 5 MB de texto e muito mais do que alguem escreve; o teto
-- impede que alguem use o banco como deposito de arquivos.
alter table public.user_data
  add constraint user_data_tamanho check (pg_column_size(data) <= 5 * 1024 * 1024);

-- ── 6. Permissoes que o app nunca usa ───────────────────────────────────
-- TRUNCATE ignora a RLS. A API nao expoe TRUNCATE, mas nao ha motivo para
-- a permissao existir.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

