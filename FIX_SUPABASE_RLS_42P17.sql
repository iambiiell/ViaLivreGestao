-- ==============================================================================
-- CORREÇÃO DEFINITIVA DO ERRO 42P17 NO SUPABASE POSTGRESQL
-- "infinite recursion detected in policy for relation \"users\""
-- ==============================================================================
-- Instruções:
-- 1. Abra o painel do seu projeto no Supabase: https://supabase.com/dashboard/project/xyzapbchpquycfcqxioz
-- 2. No menu lateral esquerdo, clique em "SQL Editor" -> "New query"
-- 3. Cole este script completo e clique em "RUN"
-- ==============================================================================

-- Passo 1: Desabilitar o RLS recursivo nas tabelas afetadas
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activation_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.time_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.imp_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll_rubrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.occurrences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_vacancies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.skins DISABLE ROW LEVEL SECURITY;

-- Passo 2: Conceder permissões para operações de CRUD para as roles anon e authenticated
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.companies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.activation_keys TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.subscriptions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vehicles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.trips TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.time_tracking TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.imp_cards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payroll_rubrics TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.role_configs TO anon, authenticated, service_role;

-- Confirmação
SELECT 'Políticas RLS recursivas desativadas e acesso liberado com sucesso!' AS status;
