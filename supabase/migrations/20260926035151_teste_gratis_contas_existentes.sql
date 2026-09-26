-- Aplicada no projeto em 26/09/2026 (versao 20260926035151).
-- Resultado: 13 contas ganharam Max ate 04/10/2026 00:00 (Brasilia).

-- TESTE GRATIS, passo 4: quem ja tinha conta ganha os mesmos 7 dias,
-- contados a partir de hoje (decisao do fundador, 26/09/2026). So entra
-- quem nao tem linha nenhuma em subscriptions: assinante e cortesia ficam
-- exatamente como estao.
insert into public.subscriptions(user_id, plano, status, origem, expira_em, nota)
select u.id, 'max', 'ativo', 'teste', public.fim_do_teste(now()), 'Teste gratis de 7 dias (conta que ja existia)'
from auth.users u
where not exists (select 1 from public.subscriptions s where s.user_id = u.id)
on conflict (user_id) do nothing;
