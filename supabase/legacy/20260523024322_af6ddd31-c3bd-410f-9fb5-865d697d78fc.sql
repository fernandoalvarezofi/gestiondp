-- Add total_upvotes column to proyectos
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS total_upvotes integer NOT NULL DEFAULT 0;

-- Upvotes table
CREATE TABLE IF NOT EXISTS public.proyecto_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_upvotes_proyecto ON public.proyecto_upvotes(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_upvotes_perfil ON public.proyecto_upvotes(perfil_id);

ALTER TABLE public.proyecto_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede ver upvotes"
  ON public.proyecto_upvotes FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden votar"
  ON public.proyecto_upvotes FOR INSERT
  WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "Usuarios pueden quitar su voto"
  ON public.proyecto_upvotes FOR DELETE
  USING (auth.uid() = perfil_id);

-- Trigger function to keep counter in sync
CREATE OR REPLACE FUNCTION public.actualizar_total_upvotes_proyecto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.proyectos SET total_upvotes = total_upvotes + 1 WHERE id = NEW.proyecto_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.proyectos SET total_upvotes = GREATEST(0, total_upvotes - 1) WHERE id = OLD.proyecto_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_upvotes_insert ON public.proyecto_upvotes;
CREATE TRIGGER trg_upvotes_insert AFTER INSERT ON public.proyecto_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_total_upvotes_proyecto();

DROP TRIGGER IF EXISTS trg_upvotes_delete ON public.proyecto_upvotes;
CREATE TRIGGER trg_upvotes_delete AFTER DELETE ON public.proyecto_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_total_upvotes_proyecto();