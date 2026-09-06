
-- Create the buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('resumes', 'resumes', true),
  ('photos', 'photos', true),
  ('skins', 'skins', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure the storage schema is accessible
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON TABLE storage.objects TO anon, authenticated;
GRANT ALL ON TABLE storage.buckets TO anon, authenticated;

-- Set up storage policies for buckets
DROP POLICY IF EXISTS "Public Select Buckets" ON storage.buckets;
CREATE POLICY "Public Select Buckets"
ON storage.buckets FOR SELECT
TO public
USING ( true );

-- Set up storage policies for 'resumes' bucket
DROP POLICY IF EXISTS "Public Access Resumes" ON storage.objects;
CREATE POLICY "Public Access Resumes"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'resumes' );

DROP POLICY IF EXISTS "Public Upload Resumes" ON storage.objects;
CREATE POLICY "Public Upload Resumes"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'resumes' );

DROP POLICY IF EXISTS "Public Update Resumes" ON storage.objects;
CREATE POLICY "Public Update Resumes"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'resumes' );

DROP POLICY IF EXISTS "Public Delete Resumes" ON storage.objects;
CREATE POLICY "Public Delete Resumes"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'resumes' );

-- Set up storage policies for 'photos' bucket
DROP POLICY IF EXISTS "Public Access Photos" ON storage.objects;
CREATE POLICY "Public Access Photos"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'photos' );

DROP POLICY IF EXISTS "Public Upload Photos" ON storage.objects;
CREATE POLICY "Public Upload Photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'photos' );

DROP POLICY IF EXISTS "Public Update Photos" ON storage.objects;
CREATE POLICY "Public Update Photos"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'photos' );

DROP POLICY IF EXISTS "Public Delete Photos" ON storage.objects;
CREATE POLICY "Public Delete Photos"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'photos' );

-- Set up storage policies for 'skins' bucket
DROP POLICY IF EXISTS "Public Access Skins" ON storage.objects;
CREATE POLICY "Public Access Skins"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'skins' );

DROP POLICY IF EXISTS "Public Upload Skins" ON storage.objects;
CREATE POLICY "Public Upload Skins"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'skins' );

DROP POLICY IF EXISTS "Public Update Skins" ON storage.objects;
CREATE POLICY "Public Update Skins"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'skins' );

DROP POLICY IF EXISTS "Public Delete Skins" ON storage.objects;
CREATE POLICY "Public Delete Skins"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'skins' );
