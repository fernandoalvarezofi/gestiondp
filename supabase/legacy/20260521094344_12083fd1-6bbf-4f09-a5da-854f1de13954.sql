ALTER TABLE public.publicaciones REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.publicaciones;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;