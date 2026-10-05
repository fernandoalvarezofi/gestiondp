
CREATE TABLE IF NOT EXISTS public.proyecto_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  respuesta_a uuid REFERENCES public.proyecto_comentarios(id) ON DELETE CASCADE,
  contenido text NOT NULL CHECK (length(contenido) BETWEEN 1 AND 4000),
  total_likes integer NOT NULL DEFAULT 0,
  editado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proy_coment_proy ON public.proyecto_comentarios(proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proy_coment_perfil ON public.proyecto_comentarios(perfil_id);

ALTER TABLE public.proyecto_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proy_coment_select" ON public.proyecto_comentarios;
CREATE POLICY "proy_coment_select" ON public.proyecto_comentarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "proy_coment_insert" ON public.proyecto_comentarios;
CREATE POLICY "proy_coment_insert" ON public.proyecto_comentarios FOR INSERT WITH CHECK (auth.uid() = perfil_id);

DROP POLICY IF EXISTS "proy_coment_update" ON public.proyecto_comentarios;
CREATE POLICY "proy_coment_update" ON public.proyecto_comentarios FOR UPDATE USING (auth.uid() = perfil_id);

DROP POLICY IF EXISTS "proy_coment_delete" ON public.proyecto_comentarios;
CREATE POLICY "proy_coment_delete" ON public.proyecto_comentarios FOR DELETE USING (auth.uid() = perfil_id);

ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS total_comentarios integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_proyecto_coment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.proyectos SET total_comentarios = total_comentarios + 1 WHERE id = NEW.proyecto_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.proyectos SET total_comentarios = GREATEST(0, total_comentarios - 1) WHERE id = OLD.proyecto_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_proy_coment_ins ON public.proyecto_comentarios;
CREATE TRIGGER trg_proy_coment_ins AFTER INSERT ON public.proyecto_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_proyecto_coment_count();

DROP TRIGGER IF EXISTS trg_proy_coment_del ON public.proyecto_comentarios;
CREATE TRIGGER trg_proy_coment_del AFTER DELETE ON public.proyecto_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_proyecto_coment_count();

ALTER PUBLICATION supabase_realtime ADD TABLE public.proyecto_comentarios;
