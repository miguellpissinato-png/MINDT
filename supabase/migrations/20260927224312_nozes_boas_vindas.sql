-- Aplicada no projeto em 27/09/2026 (versao 20260927224312).

-- NOZES, boas-vindas: cada conta ganha 10 nozes (decisao do fundador,
-- 27/09/2026). As contas que ja existem ganham agora; as novas, ao nascer.
-- O saldo mora em carteira_nozes, fora do blob que o app edita.

create or replace function public.dar_nozes_boas_vindas()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.carteira_nozes(user_id, saldo) values (new.id, 10)
  on conflict (user_id) do nothing;
  if found then
    insert into public.movimentos_nozes(user_id, delta, motivo) values (new.id, 10, 'boas_vindas');
  end if;
  return new;
exception when others then
  -- Um erro aqui cancelaria o CADASTRO inteiro. Melhor entrar sem as nozes.
  raise warning 'dar_nozes_boas_vindas falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke execute on function public.dar_nozes_boas_vindas() from public, anon, authenticated;

drop trigger if exists nozes_ao_criar_conta on auth.users;
create trigger nozes_ao_criar_conta
  after insert on auth.users
  for each row execute function public.dar_nozes_boas_vindas();

-- Contas que ja existiam.
with novas as (
  insert into public.carteira_nozes(user_id, saldo)
  select id, 10 from auth.users
  on conflict (user_id) do nothing
  returning user_id
)
insert into public.movimentos_nozes(user_id, delta, motivo)
select user_id, 10, 'boas_vindas' from novas;
