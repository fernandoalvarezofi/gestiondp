-- Default channel on new comunidad
CREATE OR REPLACE FUNCTION public.auto_canal_general()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.comunidad_canales (comunidad_id, nombre, tipo, orden)
  VALUES (NEW.id, 'general', 'general', 0);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_canal_general ON public.comunidades;
CREATE TRIGGER trg_auto_canal_general
AFTER INSERT ON public.comunidades
FOR EACH ROW EXECUTE FUNCTION public.auto_canal_general();

-- Backfill: create #general for existing comunidades without canales
INSERT INTO public.comunidad_canales (comunidad_id, nombre, tipo, orden)
SELECT c.id, 'general', 'general', 0
FROM public.comunidades c
WHERE NOT EXISTS (SELECT 1 FROM public.comunidad_canales cc WHERE cc.comunidad_id = c.id);

-- RLS: creators can manage canales
DROP POLICY IF EXISTS comunidad_canales_creador_all ON public.comunidad_canales;
CREATE POLICY comunidad_canales_creador_all ON public.comunidad_canales
FOR ALL TO public
USING (auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_canales.comunidad_id))
WITH CHECK (auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_canales.comunidad_id));