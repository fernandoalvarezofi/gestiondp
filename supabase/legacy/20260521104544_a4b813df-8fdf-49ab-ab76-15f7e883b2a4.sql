
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS autoplay_videos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_saver boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idioma_contenido text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS palabras_filtradas text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sensible_blur boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sonido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_resumen_semanal boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.bloqueos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  bloqueado_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, bloqueado_id),
  CHECK (perfil_id <> bloqueado_id)
);
ALTER TABLE public.bloqueos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver mis bloqueos" ON public.bloqueos FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crear bloqueo" ON public.bloqueos FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "borrar bloqueo" ON public.bloqueos FOR DELETE USING (auth.uid() = perfil_id);

CREATE TABLE IF NOT EXISTS public.silenciados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  silenciado_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, silenciado_id),
  CHECK (perfil_id <> silenciado_id)
);
ALTER TABLE public.silenciados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver mis silenciados" ON public.silenciados FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crear silenciado" ON public.silenciados FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "borrar silenciado" ON public.silenciados FOR DELETE USING (auth.uid() = perfil_id);
