CREATE OR REPLACE FUNCTION public.update_publicaciones_count_on_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    IF NEW.estado='eliminada' AND OLD.estado<>'eliminada' THEN
      UPDATE public.perfiles SET total_publicaciones=greatest(total_publicaciones-1,0) WHERE id=NEW.perfil_id;
    ELSIF OLD.estado='eliminada' AND NEW.estado<>'eliminada' THEN
      UPDATE public.perfiles SET total_publicaciones=total_publicaciones+1 WHERE id=NEW.perfil_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS publicaciones_count_estado_trigger ON public.publicaciones;
CREATE TRIGGER publicaciones_count_estado_trigger
AFTER UPDATE OF estado ON public.publicaciones
FOR EACH ROW EXECUTE FUNCTION public.update_publicaciones_count_on_estado();

-- Sync existing counts
UPDATE public.perfiles p SET total_publicaciones = (
  SELECT count(*) FROM public.publicaciones pu
  WHERE pu.perfil_id = p.id AND pu.estado <> 'eliminada'
);