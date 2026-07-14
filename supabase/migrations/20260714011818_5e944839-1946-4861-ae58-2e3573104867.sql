
-- Tabla de proyectos del editor
CREATE TABLE public.video_proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT 'Proyecto sin título',
  aspect_ratio text NOT NULL DEFAULT '16:9',
  fps integer NOT NULL DEFAULT 30,
  ancho integer NOT NULL DEFAULT 1920,
  alto integer NOT NULL DEFAULT 1080,
  duracion_s numeric NOT NULL DEFAULT 0,
  timeline jsonb NOT NULL DEFAULT '{"tracks":[]}'::jsonb,
  thumbnail_url text,
  eliminado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_proyectos TO authenticated;
GRANT ALL ON public.video_proyectos TO service_role;

ALTER TABLE public.video_proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vp_select_own" ON public.video_proyectos FOR SELECT
  TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "vp_insert_own" ON public.video_proyectos FOR INSERT
  TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "vp_update_own" ON public.video_proyectos FOR UPDATE
  TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "vp_delete_own" ON public.video_proyectos FOR DELETE
  TO authenticated USING (perfil_id = auth.uid());

CREATE TRIGGER video_proyectos_updated_at
  BEFORE UPDATE ON public.video_proyectos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de assets (media importada)
CREATE TABLE public.video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  proyecto_id uuid REFERENCES public.video_proyectos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('video','audio','imagen')),
  storage_path text NOT NULL,
  url text NOT NULL,
  duracion_s numeric,
  ancho integer,
  alto integer,
  tamano_bytes bigint,
  mime text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_assets TO authenticated;
GRANT ALL ON public.video_assets TO service_role;

ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "va_select_own" ON public.video_assets FOR SELECT
  TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "va_insert_own" ON public.video_assets FOR INSERT
  TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "va_update_own" ON public.video_assets FOR UPDATE
  TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "va_delete_own" ON public.video_assets FOR DELETE
  TO authenticated USING (perfil_id = auth.uid());

CREATE INDEX idx_video_assets_proyecto ON public.video_assets(proyecto_id);
CREATE INDEX idx_video_proyectos_perfil ON public.video_proyectos(perfil_id) WHERE eliminado = false;
