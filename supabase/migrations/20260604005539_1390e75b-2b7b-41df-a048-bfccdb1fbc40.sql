-- Agregar campo nota a match_acciones
ALTER TABLE public.match_acciones 
  ADD COLUMN IF NOT EXISTS nota text;

-- RLS match_acciones
ALTER TABLE public.match_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_acc_select" ON public.match_acciones;
CREATE POLICY "match_acc_select" ON public.match_acciones FOR SELECT TO authenticated
  USING (perfil_id=auth.uid() OR objetivo_id=auth.uid());

DROP POLICY IF EXISTS "match_acc_insert" ON public.match_acciones;
CREATE POLICY "match_acc_insert" ON public.match_acciones FOR INSERT TO authenticated
  WITH CHECK (perfil_id=auth.uid());

DROP POLICY IF EXISTS "match_acc_update" ON public.match_acciones;
CREATE POLICY "match_acc_update" ON public.match_acciones FOR UPDATE TO authenticated
  USING (objetivo_id=auth.uid());

DROP POLICY IF EXISTS "match_acc_delete" ON public.match_acciones;
CREATE POLICY "match_acc_delete" ON public.match_acciones FOR DELETE TO authenticated
  USING (perfil_id=auth.uid());

-- RLS matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select" ON public.matches FOR SELECT TO authenticated
  USING (perfil_a_id=auth.uid() OR perfil_b_id=auth.uid());

DROP POLICY IF EXISTS "matches_insert" ON public.matches;
CREATE POLICY "matches_insert" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (perfil_a_id=auth.uid() OR perfil_b_id=auth.uid());

DROP POLICY IF EXISTS "matches_delete" ON public.matches;
CREATE POLICY "matches_delete" ON public.matches FOR DELETE TO authenticated
  USING (perfil_a_id=auth.uid() OR perfil_b_id=auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_acciones TO authenticated;
GRANT ALL ON public.match_acciones TO service_role;
GRANT SELECT, INSERT, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

-- Función aceptar conexión
CREATE OR REPLACE FUNCTION public.aceptar_conexion(_solicitante_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _yo uuid := auth.uid(); _a uuid; _b uuid;
BEGIN
  UPDATE public.match_acciones SET accion='aceptada'
    WHERE perfil_id=_solicitante_id AND objetivo_id=_yo AND accion='solicitud_enviada';
  IF _solicitante_id < _yo THEN _a:=_solicitante_id; _b:=_yo;
  ELSE _a:=_yo; _b:=_solicitante_id; END IF;
  INSERT INTO public.matches (perfil_a_id, perfil_b_id, score, motivo)
  VALUES (_a, _b, 1.0, ARRAY['conexion_directa'])
  ON CONFLICT (perfil_a_id, perfil_b_id) DO NOTHING;
  INSERT INTO public.notificaciones (perfil_id, tipo, origen_id, leida)
  VALUES (_solicitante_id, 'nuevo_seguidor', _yo, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_conexion(_solicitante_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.match_acciones SET accion='rechazada'
  WHERE perfil_id=_solicitante_id AND objetivo_id=auth.uid() AND accion='solicitud_enviada';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_conexion(_otro_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _yo uuid:=auth.uid(); _a uuid; _b uuid;
BEGIN
  IF _yo < _otro_id THEN _a:=_yo; _b:=_otro_id;
  ELSE _a:=_otro_id; _b:=_yo; END IF;
  DELETE FROM public.matches WHERE perfil_a_id=_a AND perfil_b_id=_b;
  DELETE FROM public.match_acciones
    WHERE (perfil_id=_yo AND objetivo_id=_otro_id)
       OR (perfil_id=_otro_id AND objetivo_id=_yo);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_peso_conexion()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  INSERT INTO public.feed_eventos (perfil_id, autor_id, peso)
  VALUES (NEW.perfil_a_id, NEW.perfil_b_id, 3.0),
         (NEW.perfil_b_id, NEW.perfil_a_id, 3.0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_peso_conexion ON public.matches;
CREATE TRIGGER trg_peso_conexion AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.registrar_peso_conexion();

GRANT EXECUTE ON FUNCTION public.aceptar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_conexion(uuid) TO authenticated;

ALTER TABLE public.match_acciones REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.match_acciones;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;