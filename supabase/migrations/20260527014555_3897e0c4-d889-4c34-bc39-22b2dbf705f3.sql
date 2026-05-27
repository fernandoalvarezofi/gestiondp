
-- 1. Add columns to proyectos
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS video_demo_url text,
  ADD COLUMN IF NOT EXISTS funding_etapa text;

-- 2. proyecto_media table
CREATE TABLE IF NOT EXISTS public.proyecto_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_path text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.proyecto_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyecto_media TO authenticated;
GRANT ALL ON public.proyecto_media TO service_role;

ALTER TABLE public.proyecto_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_media_pub" ON public.proyecto_media
  FOR SELECT USING (true);

CREATE POLICY "proyecto_media_owner_insert" ON public.proyecto_media
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_id));

CREATE POLICY "proyecto_media_owner_update" ON public.proyecto_media
  FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_id));

CREATE POLICY "proyecto_media_owner_delete" ON public.proyecto_media
  FOR DELETE TO authenticated
  USING (auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_id));

CREATE INDEX IF NOT EXISTS proyecto_media_proyecto_id_orden_idx
  ON public.proyecto_media (proyecto_id, orden);

-- 3. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('proyectos-logos', 'proyectos-logos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('proyectos-portadas', 'proyectos-portadas', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies (read public; write/update/delete by owner first folder = user id)
DO $$ BEGIN
  CREATE POLICY "proyectos_logos_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'proyectos-logos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_logos_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proyectos-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_logos_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'proyectos-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_logos_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'proyectos-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_portadas_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'proyectos-portadas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_portadas_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proyectos-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_portadas_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'proyectos-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "proyectos_portadas_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'proyectos-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Seed marketplace_categorias (skip duplicates by slug)
INSERT INTO public.marketplace_categorias (nombre, slug, color, orden) VALUES
  ('Servicios', 'servicios', '#6366f1', 1),
  ('Productos digitales', 'productos-digitales', '#f59e0b', 2),
  ('Cursos y mentorías', 'cursos', '#10b981', 3),
  ('Templates', 'templates', '#3b82f6', 4),
  ('Herramientas IA', 'herramientas-ia', '#8b5cf6', 5),
  ('Diseño', 'diseno', '#ec4899', 6),
  ('Desarrollo', 'desarrollo', '#06b6d4', 7),
  ('Marketing', 'marketing', '#f97316', 8)
ON CONFLICT (slug) DO NOTHING;
