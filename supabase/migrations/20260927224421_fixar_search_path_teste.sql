-- Aviso do Supabase Advisors: funcoes sem search_path fixo. Nao eram
-- SECURITY DEFINER (risco baixo), mas fixar custa nada.
alter function public.fim_do_teste(timestamptz) set search_path to 'public';
alter function public.plano_vale(text, timestamptz, timestamptz) set search_path to 'public';
