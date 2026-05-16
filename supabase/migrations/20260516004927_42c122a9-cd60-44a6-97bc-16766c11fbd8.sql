
ALTER TABLE public.foro_posts ADD COLUMN IF NOT EXISTS imagen_url text;

DO $$
DECLARE
  b text;
  pname text;
BEGIN
  FOREACH b IN ARRAY ARRAY['publicaciones','videos','comunidades-media','proyectos-media'] LOOP
    pname := b || '_read';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname=pname) THEN
      EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L);', pname, b);
    END IF;
    pname := b || '_insert';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname=pname) THEN
      EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND auth.uid()::text = (storage.foldername(name))[1]);', pname, b);
    END IF;
    pname := b || '_update';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname=pname) THEN
      EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND auth.uid()::text = (storage.foldername(name))[1]);', pname, b);
    END IF;
    pname := b || '_delete';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname=pname) THEN
      EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND auth.uid()::text = (storage.foldername(name))[1]);', pname, b);
    END IF;
  END LOOP;
END $$;
