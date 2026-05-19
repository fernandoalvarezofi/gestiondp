
CREATE TABLE IF NOT EXISTS public.historias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  texto TEXT,
  color_fondo TEXT,
  stickers JSONB DEFAULT '[]'::jsonb,
  total_vistas INTEGER NOT NULL DEFAULT 0,
  destacada_id UUID,
  expira_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historias_perfil ON public.historias(perfil_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historias_expira ON public.historias(expira_at);
ALTER TABLE public.historias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historias_select" ON public.historias;
CREATE POLICY "historias_select" ON public.historias FOR SELECT
  USING (expira_at > now() OR auth.uid() = perfil_id);
DROP POLICY IF EXISTS "historias_insert" ON public.historias;
CREATE POLICY "historias_insert" ON public.historias FOR INSERT
  WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "historias_delete" ON public.historias;
CREATE POLICY "historias_delete" ON public.historias FOR DELETE
  USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "historias_update" ON public.historias;
CREATE POLICY "historias_update" ON public.historias FOR UPDATE
  USING (auth.uid() = perfil_id);

CREATE TABLE IF NOT EXISTS public.historia_vistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historia_id UUID NOT NULL REFERENCES public.historias(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (historia_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS idx_historia_vistas_h ON public.historia_vistas(historia_id);
ALTER TABLE public.historia_vistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historia_vistas_insert" ON public.historia_vistas;
CREATE POLICY "historia_vistas_insert" ON public.historia_vistas FOR INSERT
  WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "historia_vistas_select_dueno" ON public.historia_vistas;
CREATE POLICY "historia_vistas_select_dueno" ON public.historia_vistas FOR SELECT
  USING (auth.uid() = (SELECT perfil_id FROM public.historias WHERE id = historia_vistas.historia_id)
         OR auth.uid() = perfil_id);

CREATE OR REPLACE FUNCTION public.incrementar_vistas_historia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.historias SET total_vistas = total_vistas + 1 WHERE id = NEW.historia_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_hist_vistas ON public.historia_vistas;
CREATE TRIGGER trg_hist_vistas AFTER INSERT ON public.historia_vistas
  FOR EACH ROW EXECUTE FUNCTION public.incrementar_vistas_historia();

CREATE TABLE IF NOT EXISTS public.historia_respuestas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historia_id UUID NOT NULL REFERENCES public.historias(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL,
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.historia_respuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "historia_resp_insert" ON public.historia_respuestas;
CREATE POLICY "historia_resp_insert" ON public.historia_respuestas FOR INSERT
  WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "historia_resp_select" ON public.historia_respuestas;
CREATE POLICY "historia_resp_select" ON public.historia_respuestas FOR SELECT
  USING (auth.uid() = perfil_id
         OR auth.uid() = (SELECT perfil_id FROM public.historias WHERE id = historia_respuestas.historia_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('historias', 'historias', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "historias_storage_select" ON storage.objects;
CREATE POLICY "historias_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'historias');
DROP POLICY IF EXISTS "historias_storage_insert" ON storage.objects;
CREATE POLICY "historias_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'historias' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "historias_storage_delete" ON storage.objects;
CREATE POLICY "historias_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'historias' AND auth.uid()::text = (storage.foldername(name))[1]);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.historias;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.historias REPLICA IDENTITY FULL;
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;
ALTER TABLE public.conversaciones REPLICA IDENTITY FULL;
