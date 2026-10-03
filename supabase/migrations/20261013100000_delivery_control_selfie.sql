-- Selfie de control del repartidor: cada tanto (o cuando administración lo pide) tiene que sacarse una selfie nueva con un gesto.
-- Mientras el control esté pendiente no puede conectarse. Administración compara con la selfie original y el DNI.

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('dias_control_selfie', 30, 'Cada cuánto se pide la selfie de control', 'Los repartidores verificados tienen que sacarse una selfie nueva con un gesto cada tantos días para seguir conectándose.', 'días', 7, 180)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.delivery_repartidores
  ADD COLUMN IF NOT EXISTS control_estado text CHECK (control_estado IN ('requerido', 'en_revision')),
  ADD COLUMN IF NOT EXISTS control_requerido_at timestamptz,
  ADD COLUMN IF NOT EXISTS control_motivo text CHECK (control_motivo IS NULL OR char_length(control_motivo) <= 300),
  ADD COLUMN IF NOT EXISTS control_desafio text,
  ADD COLUMN IF NOT EXISTS ultimo_control_at timestamptz;

ALTER TABLE public.delivery_documentos DROP CONSTRAINT IF EXISTS delivery_documentos_tipo_check;
ALTER TABLE public.delivery_documentos ADD CONSTRAINT delivery_documentos_tipo_check CHECK (tipo IN ('dni_frente', 'dni_dorso', 'selfie', 'licencia', 'cedula_vehiculo', 'habilitacion', 'constancia_afip', 'dni_titular', 'selfie_control'));

CREATE OR REPLACE FUNCTION public.delivery_desafio_aleatorio() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT (ARRAY['Mostrá la palma de la mano abierta', 'Levantá dos dedos (paz) al lado de tu cara', 'Tocate la oreja derecha con una mano', 'Hacé el gesto de "ok" con la mano', 'Girá la cabeza un poco a la izquierda', 'Sonreí y levantá el pulgar'])[1 + floor(random() * 6)::int]
$$;

-- Los datos del control los maneja solo el servidor; además, con un control pendiente no se puede estar conectado.
CREATE OR REPLACE FUNCTION public.delivery_proteger_repartidor()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.activo := true; NEW.verificado := false; NEW.motivo_rechazo := NULL; NEW.verificado_at := NULL;
      NEW.disponible := false; NEW.aceptadas := 0; NEW.rechazadas := 0; NEW.soltados := 0;
      NEW.control_estado := NULL; NEW.control_requerido_at := NULL; NEW.control_motivo := NULL; NEW.control_desafio := NULL; NEW.ultimo_control_at := NULL;
    ELSE
      NEW.activo := OLD.activo; NEW.verificado := OLD.verificado; NEW.motivo_rechazo := OLD.motivo_rechazo; NEW.verificado_at := OLD.verificado_at;
      NEW.aceptadas := OLD.aceptadas; NEW.rechazadas := OLD.rechazadas; NEW.soltados := OLD.soltados;
      NEW.control_estado := OLD.control_estado; NEW.control_requerido_at := OLD.control_requerido_at; NEW.control_motivo := OLD.control_motivo;
      NEW.control_desafio := OLD.control_desafio; NEW.ultimo_control_at := OLD.ultimo_control_at;
      IF OLD.verificado AND (NEW.dni IS DISTINCT FROM OLD.dni OR NEW.patente IS DISTINCT FROM OLD.patente OR NEW.vehiculo IS DISTINCT FROM OLD.vehiculo) THEN
        NEW.verificado := false; NEW.verificado_at := NULL; NEW.disponible := false;
      END IF;
      IF NEW.disponible AND NOT (NEW.verificado AND NEW.activo) THEN NEW.disponible := false; END IF;
      IF NEW.disponible AND NEW.control_estado IS NOT NULL THEN NEW.disponible := false; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Documentos: la selfie de control solo se sube cuando está pedida.
CREATE OR REPLACE FUNCTION public.delivery_documento_registrar(p_entidad text, p_entidad_id uuid, p_tipo text, p_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  IF p_path IS NULL OR p_path NOT LIKE auth.uid()::text || '/%' OR p_path LIKE '%..%' THEN RAISE EXCEPTION 'Archivo inválido'; END IF;
  IF p_entidad = 'repartidor' THEN
    IF p_entidad_id <> auth.uid() OR NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = auth.uid()) THEN RAISE EXCEPTION 'No podés cargar documentos de esta cuenta'; END IF;
    IF p_tipo NOT IN ('dni_frente', 'dni_dorso', 'selfie', 'licencia', 'cedula_vehiculo', 'selfie_control') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
    IF p_tipo = 'selfie_control' AND NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = auth.uid() AND control_estado = 'requerido') THEN
      RAISE EXCEPTION 'No tenés una selfie de control pendiente';
    END IF;
  ELSIF p_entidad = 'persona' THEN
    IF p_entidad_id <> auth.uid() THEN RAISE EXCEPTION 'No podés cargar documentos de otra persona'; END IF;
    IF p_tipo NOT IN ('dni_frente', 'dni_dorso', 'selfie') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
  ELSIF p_entidad = 'comercio' THEN
    IF NOT coalesce((SELECT propietario_id = auth.uid() FROM public.delivery_comercios WHERE id = p_entidad_id), false) THEN RAISE EXCEPTION 'Solo el dueño puede cargar documentos del comercio'; END IF;
    IF p_tipo NOT IN ('habilitacion', 'constancia_afip', 'dni_titular') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
  ELSE RAISE EXCEPTION 'Entidad inválida'; END IF;

  IF p_entidad IN ('repartidor', 'persona') AND p_tipo IN ('dni_frente', 'dni_dorso', 'selfie') THEN
    IF EXISTS (SELECT 1 FROM public.delivery_identidad WHERE perfil_id = auth.uid() AND estado = 'en_revision') THEN
      RAISE EXCEPTION 'Tu identidad está en revisión: esperá el resultado antes de cambiar los documentos';
    END IF;
  END IF;

  INSERT INTO public.delivery_documentos (entidad, entidad_id, tipo, path, subido_por) VALUES (p_entidad, p_entidad_id, p_tipo, p_path, auth.uid())
  ON CONFLICT (entidad, entidad_id, tipo) DO UPDATE SET path = EXCLUDED.path, subido_por = auth.uid(), created_at = now()
  RETURNING id INTO v_id;

  IF p_entidad IN ('repartidor', 'persona') AND p_tipo IN ('dni_frente', 'dni_dorso', 'selfie') THEN
    UPDATE public.delivery_identidad SET estado = 'pendiente', vence_at = NULL, controles = '{}'::jsonb, updated_at = now() WHERE perfil_id = auth.uid() AND estado = 'aprobada';
    IF p_entidad = 'repartidor' THEN
      UPDATE public.delivery_repartidores SET verificado = false, verificado_at = NULL, disponible = false WHERE perfil_id = auth.uid() AND verificado;
    END IF;
  END IF;
  RETURN v_id;
END $$;

-- El repartidor envía su selfie de control a revisión.
CREATE OR REPLACE FUNCTION public.delivery_control_enviar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r public.delivery_repartidores;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = v_uid FOR UPDATE;
  IF NOT FOUND OR r.control_estado IS DISTINCT FROM 'requerido' THEN RAISE EXCEPTION 'No tenés una selfie de control pendiente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_documentos WHERE entidad = 'repartidor' AND entidad_id = v_uid AND tipo = 'selfie_control' AND created_at >= r.control_requerido_at) THEN
    RAISE EXCEPTION 'Sacate la selfie de control antes de enviarla';
  END IF;
  UPDATE public.delivery_repartidores SET control_estado = 'en_revision', control_motivo = NULL WHERE perfil_id = v_uid;
END $$;

-- Administración pide un control puntual.
CREATE OR REPLACE FUNCTION public.delivery_admin_pedir_control(p_perfil uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  UPDATE public.delivery_repartidores SET control_estado = 'requerido', control_requerido_at = now(), control_motivo = NULL, control_desafio = public.delivery_desafio_aleatorio(), disponible = false
  WHERE perfil_id = p_perfil AND verificado;
  IF NOT FOUND THEN RAISE EXCEPTION 'El repartidor no está verificado'; END IF;
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle) VALUES (auth.uid(), 'control_selfie_pedido', 'repartidor', p_perfil::text, '{}'::jsonb);
END $$;

-- Administración resuelve el control: ok lo libera; si no coincide, se vuelve a pedir con el motivo.
CREATE OR REPLACE FUNCTION public.delivery_admin_revisar_control(p_perfil uuid, p_ok boolean, p_motivo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_motivo text := left(trim(coalesce(p_motivo, '')), 300);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_perfil = auth.uid() THEN RAISE EXCEPTION 'No podés revisar tu propio control'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = p_perfil AND control_estado = 'en_revision') THEN RAISE EXCEPTION 'Este control no está en revisión'; END IF;
  IF p_ok THEN
    UPDATE public.delivery_repartidores SET control_estado = NULL, control_requerido_at = NULL, control_motivo = NULL, control_desafio = NULL, ultimo_control_at = now() WHERE perfil_id = p_perfil;
  ELSE
    IF char_length(v_motivo) < 5 THEN RAISE EXCEPTION 'Indicá el motivo'; END IF;
    UPDATE public.delivery_repartidores SET control_estado = 'requerido', control_requerido_at = now(), control_motivo = v_motivo, control_desafio = public.delivery_desafio_aleatorio() WHERE perfil_id = p_perfil;
  END IF;
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
  VALUES (auth.uid(), CASE WHEN p_ok THEN 'control_selfie_aprobado' ELSE 'control_selfie_rechazado' END, 'repartidor', p_perfil::text, jsonb_build_object('motivo', nullif(v_motivo, '')));
END $$;

-- Cada día se pide el control a quienes llevan más de N días sin hacerlo.
CREATE OR REPLACE FUNCTION public.delivery_controles_vencidos() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.delivery_repartidores SET control_estado = 'requerido', control_requerido_at = now(), control_motivo = NULL, control_desafio = public.delivery_desafio_aleatorio(), disponible = false
  WHERE verificado AND activo AND control_estado IS NULL
    AND coalesce(ultimo_control_at, verificado_at, created_at) < now() - make_interval(days => public.delivery_ajuste('dias_control_selfie', 30)::integer);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.delivery_control_enviar(), public.delivery_admin_pedir_control(uuid), public.delivery_admin_revisar_control(uuid, boolean, text), public.delivery_documento_registrar(text, uuid, text, text), public.delivery_controles_vencidos(), public.delivery_desafio_aleatorio() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delivery_controles_vencidos(), public.delivery_desafio_aleatorio() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_control_enviar(), public.delivery_admin_pedir_control(uuid), public.delivery_admin_revisar_control(uuid, boolean, text), public.delivery_documento_registrar(text, uuid, text, text) TO authenticated;
SELECT cron.schedule('delivery-controles-selfie', '0 10 * * *', 'SELECT public.delivery_controles_vencidos()');
