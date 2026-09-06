
-- Limpa rubricas existentes para evitar duplicidade no código
DELETE FROM public.payroll_rubrics;

-- Script de Geração de Rubricas (Amostra técnica expandida para 920 registros)
-- EARNING (001-499), DEDUCTION (500-799, 900-959), INFO (800-899)

INSERT INTO public.payroll_rubrics (code, name, type)
SELECT 
    LPAD(s.id::text, 3, '0'),
    CASE 
        WHEN s.id = 1 THEN 'SALÁRIO BASE'
        WHEN s.id = 10 THEN 'HORAS EXTRAS 50%'
        WHEN s.id = 11 THEN 'HORAS EXTRAS 100%'
        WHEN s.id = 13 THEN 'HORA DE ESPERA (MOTORISTA)'
        WHEN s.id = 35 THEN 'ADICIONAL DE PERICULOSIDADE'
        WHEN s.id = 36 THEN 'ADICIONAL DE INSALUBRIDADE'
        WHEN s.id = 40 THEN 'ADICIONAL DE ARTICULAÇÃO'
        WHEN s.id = 50 THEN 'GRATIFICAÇÃO DE LINHA'
        WHEN s.id = 60 THEN 'ADICIONAL NOTURNO'
        WHEN s.id = 80 THEN 'PRÊMIO KM RODADO'
        WHEN s.id = 100 THEN 'ADICIONAL DE DUPLA FUNÇÃO'
        WHEN s.id = 150 THEN 'QUEBRA DE CAIXA (COBRADOR)'
        WHEN s.id = 200 THEN 'DIÁRIAS DE VIAGEM'
        WHEN s.id = 250 THEN 'SALÁRIO FAMÍLIA'
        WHEN s.id = 300 THEN 'REEMBOLSO DE PEDÁGIO'
        WHEN s.id = 310 THEN 'REEMBOLSO DE COMBUSTÍVEL'
        WHEN s.id = 450 THEN 'PARTICIPAÇÃO NOS LUCROS (PLR)'
        ELSE 'PROVENTO TÉCNICO COD ' || s.id
    END,
    'EARNING'
FROM generate_series(1, 499) AS s(id);

INSERT INTO public.payroll_rubrics (code, name, type)
SELECT 
    LPAD(s.id::text, 3, '0'),
    CASE 
        WHEN s.id = 501 THEN 'INSS FOLHA'
        WHEN s.id = 505 THEN 'IRRF FOLHA'
        WHEN s.id = 550 THEN 'VALE TRANSPORTE (DESCONTO)'
        WHEN s.id = 560 THEN 'VALE REFEIÇÃO (DESCONTO)'
        WHEN s.id = 570 THEN 'CONVÊNIO MÉDICO'
        WHEN s.id = 580 THEN 'CONVÊNIO ODONTOLÓGICO'
        WHEN s.id = 600 THEN 'EMPRÉSTIMO CONSIGNADO'
        WHEN s.id = 640 THEN 'AVARIAS EM VEÍCULO (MULTA/SINISTRO)'
        WHEN s.id = 700 THEN 'PENSÃO ALIMENTÍCIA'
        WHEN s.id = 710 THEN 'MENSALIDADE SINDICAL'
        ELSE 'DESCONTO ADMINISTRATIVO COD ' || s.id
    END,
    'DEDUCTION'
FROM generate_series(500, 799) AS s(id);

INSERT INTO public.payroll_rubrics (code, name, type)
SELECT 
    LPAD(s.id::text, 3, '0'),
    CASE 
        WHEN s.id = 801 THEN 'BASE FGTS'
        WHEN s.id = 804 THEN 'BASE INSS'
        WHEN s.id = 807 THEN 'BASE IRRF'
        WHEN s.id = 830 THEN 'SALÁRIO CONTRATUAL'
        WHEN s.id = 850 THEN 'ACUMULADO FÉRIAS'
        ELSE 'INFORMATIVA/BASE COD ' || s.id
    END,
    'INFO'
FROM generate_series(800, 899) AS s(id);

INSERT INTO public.payroll_rubrics (code, name, type)
SELECT 
    LPAD(s.id::text, 3, '0'),
    CASE 
        WHEN s.id = 900 THEN 'FALTAS'
        WHEN s.id = 901 THEN 'ATRASOS'
        WHEN s.id = 910 THEN 'DSR SOBRE FALTAS'
        ELSE 'OUTROS DESCONTOS COD ' || s.id
    END,
    'DEDUCTION'
FROM generate_series(900, 959) AS s(id);


-- Módulo Skins Repository
CREATE TABLE IF NOT EXISTS public.skins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    skin_name TEXT NOT NULL,
    bus_model TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Guichês de Venda
CREATE TABLE IF NOT EXISTS public.ticket_booths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    ie TEXT,
    address_street TEXT NOT NULL,
    address_number TEXT NOT NULL,
    address_neighborhood TEXT NOT NULL,
    address_city TEXT NOT NULL,
    address_state TEXT NOT NULL,
    address_complement TEXT,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    booth_manager TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar system_id em todas as tabelas para isolamento de dados
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS system_id UUID', t);
    END LOOP;
END $$;

-- Enable RLS for skins
ALTER TABLE public.skins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Skins" ON public.skins;
CREATE POLICY "Public Access Skins" ON public.skins FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public Insert Skins" ON public.skins;
CREATE POLICY "Public Insert Skins" ON public.skins FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Skins" ON public.skins;
CREATE POLICY "Public Update Skins" ON public.skins FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Public Delete Skins" ON public.skins;
CREATE POLICY "Public Delete Skins" ON public.skins FOR DELETE TO public USING (true);

-- Create time_tracking table
CREATE TABLE IF NOT EXISTS public.time_tracking (
    id TEXT PRIMARY KEY,
    system_id TEXT,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in TEXT,
    break_start TEXT,
    break_end TEXT,
    clock_out TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Time Tracking" ON public.time_tracking;
CREATE POLICY "Public Access Time Tracking" ON public.time_tracking FOR ALL TO public USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

