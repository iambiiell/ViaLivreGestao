
-- Set up RLS policies for Job Vacancies (Public Read)
ALTER TABLE public.job_vacancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Job Vacancies" ON public.job_vacancies;
CREATE POLICY "Public Read Job Vacancies"
ON public.job_vacancies FOR SELECT
TO public
USING ( is_active = true );

-- Set up RLS policies for Job Applications (Public Insert, Admin Read)
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Insert Job Applications" ON public.job_applications;
CREATE POLICY "Public Insert Job Applications"
ON public.job_applications FOR INSERT
TO public
WITH CHECK ( true );

DROP POLICY IF EXISTS "Admin Read Job Applications" ON public.job_applications;
CREATE POLICY "Admin Read Job Applications"
ON public.job_applications FOR SELECT
TO authenticated
USING ( true );

DROP POLICY IF EXISTS "Admin Update Job Applications" ON public.job_applications;
CREATE POLICY "Admin Update Job Applications"
ON public.job_applications FOR UPDATE
TO authenticated
USING ( true );
