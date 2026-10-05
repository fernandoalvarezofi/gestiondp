
-- 1) Helper: bloqueo entre dos usuarios (cualquier dirección)
CREATE OR REPLACE FUNCTION public.hay_bloqueo(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.bloqueos
    WHERE (perfil_id=_a AND bloqueado_id=_b) OR (perfil_id=_b AND bloqueado_id=_a)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.hay_bloqueo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hay_bloqueo(uuid, uuid) TO authenticated;

-- 2) Ids ocultos para un usuario (bloqueos ambas direcciones + silenciados)
CREATE OR REPLACE FUNCTION public.ids_ocultos_para(_perfil uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bloqueado_id FROM public.bloqueos WHERE perfil_id = _perfil
  UNION SELECT perfil_id FROM public.bloqueos WHERE bloqueado_id = _perfil
  UNION SELECT silenciado_id FROM public.silenciados WHERE perfil_id = _perfil
$$;
REVOKE EXECUTE ON FUNCTION public.ids_ocultos_para(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ids_ocultos_para(uuid) TO authenticated;

-- 3) Al bloquear: limpiar follows y solicitudes en ambas direcciones
CREATE OR REPLACE FUNCTION public.al_bloquear_limpiar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.seguidos
    WHERE (seguidor_id = NEW.perfil_id AND seguido_id = NEW.bloqueado_id)
       OR (seguidor_id = NEW.bloqueado_id AND seguido_id = NEW.perfil_id);
  DELETE FROM public.match_acciones
    WHERE (perfil_id = NEW.perfil_id AND objetivo_id = NEW.bloqueado_id)
       OR (perfil_id = NEW.bloqueado_id AND objetivo_id = NEW.perfil_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_al_bloquear ON public.bloqueos;
CREATE TRIGGER trg_al_bloquear AFTER INSERT ON public.bloqueos
  FOR EACH ROW EXECUTE FUNCTION public.al_bloquear_limpiar();

-- 4) Tabla de solicitudes de seguimiento (para perfiles privados)
CREATE TABLE IF NOT EXISTS public.seguidos_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitante_id, destinatario_id)
);
GRANT SELECT, INSERT, DELETE ON public.seguidos_solicitudes TO authenticated;
GRANT ALL ON public.seguidos_solicitudes TO service_role;
ALTER TABLE public.seguidos_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ss_select ON public.seguidos_solicitudes;
CREATE POLICY ss_select ON public.seguidos_solicitudes FOR SELECT TO authenticated
  USING (auth.uid() = solicitante_id OR auth.uid() = destinatario_id);
DROP POLICY IF EXISTS ss_insert ON public.seguidos_solicitudes;
CREATE POLICY ss_insert ON public.seguidos_solicitudes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = solicitante_id);
DROP POLICY IF EXISTS ss_delete ON public.seguidos_solicitudes;
CREATE POLICY ss_delete ON public.seguidos_solicitudes FOR DELETE TO authenticated
  USING (auth.uid() = solicitante_id OR auth.uid() = destinatario_id);

-- 5) RPCs para seguir/solicitar/aceptar/rechazar
CREATE OR REPLACE FUNCTION public.solicitar_seguir(_destino uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE priv boolean; pref boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF auth.uid() = _destino THEN RAISE EXCEPTION 'No podés seguirte a vos mismo'; END IF;
  IF public.hay_bloqueo(auth.uid(), _destino) THEN
    RAISE EXCEPTION 'No podés seguir a este usuario';
  END IF;
  SELECT perfil_privado INTO priv FROM public.perfiles WHERE id = _destino;
  IF COALESCE(priv, false) THEN
    INSERT INTO public.seguidos_solicitudes (solicitante_id, destinatario_id)
      VALUES (auth.uid(), _destino) ON CONFLICT DO NOTHING;
    SELECT notif_seguidores INTO pref FROM public.perfiles WHERE id = _destino;
    IF COALESCE(pref, true) THEN
      INSERT INTO public.notificaciones (perfil_id, origen_id, tipo)
        VALUES (_destino, auth.uid(), 'nuevo_seguidor');
    END IF;
    RETURN 'solicitada';
  ELSE
    INSERT INTO public.seguidos (seguidor_id, seguido_id)
      VALUES (auth.uid(), _destino) ON CONFLICT DO NOTHING;
    RETURN 'seguido';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.solicitar_seguir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_seguir(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aceptar_seguir(_solicitante uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  DELETE FROM public.seguidos_solicitudes
    WHERE solicitante_id = _solicitante AND destinatario_id = auth.uid();
  INSERT INTO public.seguidos (seguidor_id, seguido_id)
    VALUES (_solicitante, auth.uid()) ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.aceptar_seguir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_seguir(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rechazar_seguir(_solicitante uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  DELETE FROM public.seguidos_solicitudes
    WHERE solicitante_id = _solicitante AND destinatario_id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.rechazar_seguir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechazar_seguir(uuid) TO authenticated;

-- 6) Triggers de notificaciones respetan bloqueos + preferencias del receptor
CREATE OR REPLACE FUNCTION public.notif_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE autor_id uuid; pref boolean;
BEGIN
  SELECT perfil_id INTO autor_id FROM public.publicaciones WHERE id = NEW.publicacion_id;
  IF autor_id IS NULL OR autor_id = NEW.perfil_id THEN RETURN NEW; END IF;
  IF public.hay_bloqueo(autor_id, NEW.perfil_id) THEN RETURN NEW; END IF;
  SELECT notif_likes INTO pref FROM public.perfiles WHERE id = autor_id;
  IF COALESCE(pref, true) IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    VALUES (autor_id, NEW.perfil_id, 'like', NEW.publicacion_id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_comentario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE autor_id uuid; pref boolean;
BEGIN
  SELECT perfil_id INTO autor_id FROM public.publicaciones WHERE id = NEW.publicacion_id;
  IF autor_id IS NULL OR autor_id = NEW.perfil_id THEN RETURN NEW; END IF;
  IF public.hay_bloqueo(autor_id, NEW.perfil_id) THEN RETURN NEW; END IF;
  SELECT notif_comentarios INTO pref FROM public.perfiles WHERE id = autor_id;
  IF COALESCE(pref, true) IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, publicacion_id, comentario_id)
    VALUES (autor_id, NEW.perfil_id, 'comentario', NEW.publicacion_id, NEW.id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_seguidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pref boolean;
BEGIN
  IF public.hay_bloqueo(NEW.seguido_id, NEW.seguidor_id) THEN RETURN NEW; END IF;
  SELECT notif_seguidores INTO pref FROM public.perfiles WHERE id = NEW.seguido_id;
  IF COALESCE(pref, true) IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo)
    VALUES (NEW.seguido_id, NEW.seguidor_id, 'nuevo_seguidor');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_reposteo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE autor_id uuid;
BEGIN
  SELECT perfil_id INTO autor_id FROM public.publicaciones WHERE id = NEW.publicacion_id;
  IF autor_id IS NULL OR autor_id = NEW.perfil_id THEN RETURN NEW; END IF;
  IF public.hay_bloqueo(autor_id, NEW.perfil_id) THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    VALUES (autor_id, NEW.perfil_id, 'reposteo', NEW.publicacion_id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_mensaje()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE destinatario_id uuid; pref boolean;
BEGIN
  SELECT CASE WHEN perfil_a_id = NEW.remitente_id THEN perfil_b_id ELSE perfil_a_id END
    INTO destinatario_id FROM public.conversaciones WHERE id = NEW.conversacion_id;
  IF destinatario_id IS NULL THEN RETURN NEW; END IF;
  IF public.hay_bloqueo(destinatario_id, NEW.remitente_id) THEN RETURN NEW; END IF;
  SELECT notif_mensajes INTO pref FROM public.perfiles WHERE id = destinatario_id;
  IF COALESCE(pref, true) IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo)
    VALUES (destinatario_id, NEW.remitente_id, 'nuevo_mensaje');
  RETURN NEW;
END $$;

-- 7) Conversación: chequea bloqueos + mensajes privados con seguimiento
CREATE OR REPLACE FUNCTION public.get_or_create_conversacion(user_a uuid, user_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id uuid; a_id uuid := least(user_a,user_b); b_id uuid := greatest(user_a,user_b);
  other uuid; other_allow boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() <> user_a AND auth.uid() <> user_b THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.hay_bloqueo(user_a, user_b) THEN
    RAISE EXCEPTION 'No podés escribir a este usuario';
  END IF;
  other := CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END;
  SELECT mensajes_privados INTO other_allow FROM public.perfiles WHERE id = other;
  IF COALESCE(other_allow, true) IS NOT TRUE THEN
    IF NOT EXISTS(SELECT 1 FROM public.seguidos WHERE seguidor_id = other AND seguido_id = auth.uid()) THEN
      RAISE EXCEPTION 'Este usuario solo acepta mensajes de personas que sigue';
    END IF;
  END IF;
  SELECT id INTO conv_id FROM public.conversaciones WHERE perfil_a_id = a_id AND perfil_b_id = b_id;
  IF conv_id IS NULL THEN
    INSERT INTO public.conversaciones (perfil_a_id, perfil_b_id) VALUES (a_id, b_id) RETURNING id INTO conv_id;
  END IF;
  RETURN conv_id;
END $$;
