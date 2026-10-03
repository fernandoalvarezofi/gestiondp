-- Remises: conductores habilitados (repartidores con auto), viajes con tarifa cerrada, código para subir, asientos contables y avisos.
-- (Aplicada en la base en varias partes: conductores, tablas, funciones, libro/billetera, conductor del viaje y aviso por push.)

-- 1) Tarifas y conductores
INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('remis_base', 1800, 'Remís: bajada de bandera', 'Monto fijo que se cobra al empezar el viaje.', '$', 0, 20000),
  ('remis_por_km', 700, 'Remís: precio por km', 'Se suma por cada kilómetro de la ruta por calles.', '$', 0, 5000),
  ('remis_minima', 2800, 'Remís: tarifa mínima', 'Ningún viaje cuesta menos que esto.', '$', 0, 30000),
  ('remis_nocturno_pct', 20, 'Remís: recargo nocturno', 'Porcentaje extra entre las 22:00 y las 06:00.', '%', 0, 100),
  ('remis_comision_pct', 15, 'Remís: comisión de Woref', 'Porcentaje de la tarifa que se queda Woref; el resto es del conductor.', '%', 0, 40),
  ('remis_max_km', 40, 'Remís: distancia máxima', 'Kilómetros máximos por viaje.', 'km', 1, 200),
  ('remis_radio_km', 25, 'Remís: radio de cobertura', 'Distancia máxima desde el centro de Lincoln para el origen y el destino.', 'km', 1, 200)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.delivery_repartidores
  ADD COLUMN IF NOT EXISTS remis_estado text CHECK (remis_estado IN ('solicitado', 'aprobado', 'rechazado')),
  ADD COLUMN IF NOT EXISTS remis_motivo text CHECK (remis_motivo IS NULL OR char_length(remis_motivo) <= 300),
  ADD COLUMN IF NOT EXISTS acepta_remis boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.delivery_proteger_repartidor()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.activo := true; NEW.verificado := false; NEW.motivo_rechazo := NULL; NEW.verificado_at := NULL;
      NEW.disponible := false; NEW.aceptadas := 0; NEW.rechazadas := 0; NEW.soltados := 0;
      NEW.control_estado := NULL; NEW.control_requerido_at := NULL; NEW.control_motivo := NULL; NEW.control_desafio := NULL; NEW.ultimo_control_at := NULL;
      NEW.remis_estado := NULL; NEW.remis_motivo := NULL; NEW.acepta_remis := false;
    ELSE
      NEW.activo := OLD.activo; NEW.verificado := OLD.verificado; NEW.motivo_rechazo := OLD.motivo_rechazo; NEW.verificado_at := OLD.verificado_at;
      NEW.aceptadas := OLD.aceptadas; NEW.rechazadas := OLD.rechazadas; NEW.soltados := OLD.soltados;
      NEW.control_estado := OLD.control_estado; NEW.control_requerido_at := OLD.control_requerido_at; NEW.control_motivo := OLD.control_motivo;
      NEW.control_desafio := OLD.control_desafio; NEW.ultimo_control_at := OLD.ultimo_control_at;
      NEW.remis_estado := OLD.remis_estado; NEW.remis_motivo := OLD.remis_motivo;
      IF OLD.verificado AND (NEW.dni IS DISTINCT FROM OLD.dni OR NEW.patente IS DISTINCT FROM OLD.patente OR NEW.vehiculo IS DISTINCT FROM OLD.vehiculo) THEN
        NEW.verificado := false; NEW.verificado_at := NULL; NEW.disponible := false;
      END IF;
      IF NEW.disponible AND NOT (NEW.verificado AND NEW.activo) THEN NEW.disponible := false; END IF;
      IF NEW.disponible AND NEW.control_estado IS NOT NULL THEN NEW.disponible := false; END IF;
      IF NEW.acepta_remis AND (OLD.remis_estado IS DISTINCT FROM 'aprobado' OR NEW.vehiculo <> 'auto') THEN NEW.acepta_remis := false; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_remis_solicitar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r public.delivery_repartidores;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = v_uid;
  IF NOT FOUND OR NOT r.verificado OR NOT r.activo THEN RAISE EXCEPTION 'Primero tenés que estar verificado como repartidor'; END IF;
  IF r.vehiculo <> 'auto' THEN RAISE EXCEPTION 'Para manejar un remís tu vehículo tiene que ser un auto'; END IF;
  IF r.remis_estado IN ('solicitado', 'aprobado') THEN RAISE EXCEPTION 'Tu solicitud ya está %', CASE r.remis_estado WHEN 'aprobado' THEN 'aprobada' ELSE 'en revisión' END; END IF;
  IF (SELECT count(DISTINCT tipo) FROM public.delivery_documentos WHERE entidad = 'repartidor' AND entidad_id = v_uid AND tipo IN ('licencia', 'cedula_vehiculo')) < 2 THEN
    RAISE EXCEPTION 'Subí tu licencia de conducir y la cédula del vehículo antes de pedir el alta como remís';
  END IF;
  UPDATE public.delivery_repartidores SET remis_estado = 'solicitado', remis_motivo = NULL WHERE perfil_id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_admin_remis_revisar(p_perfil uuid, p_ok boolean, p_motivo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.delivery_repartidores; v_motivo text := left(trim(coalesce(p_motivo, '')), 300);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = p_perfil FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Repartidor no encontrado'; END IF;
  IF p_ok THEN
    IF r.remis_estado IS DISTINCT FROM 'solicitado' THEN RAISE EXCEPTION 'Esta solicitud no está pendiente'; END IF;
    UPDATE public.delivery_repartidores SET remis_estado = 'aprobado', remis_motivo = NULL WHERE perfil_id = p_perfil;
  ELSE
    IF r.remis_estado NOT IN ('solicitado', 'aprobado') THEN RAISE EXCEPTION 'No hay nada para rechazar'; END IF;
    IF char_length(v_motivo) < 5 THEN RAISE EXCEPTION 'Indicá el motivo'; END IF;
    UPDATE public.delivery_repartidores SET remis_estado = 'rechazado', remis_motivo = v_motivo, acepta_remis = false WHERE perfil_id = p_perfil;
  END IF;
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle) VALUES (auth.uid(), CASE WHEN p_ok THEN 'remis_aprobado' ELSE 'remis_rechazado' END, 'repartidor', p_perfil::text, jsonb_build_object('motivo', nullif(v_motivo, '')));
END $$;
REVOKE ALL ON FUNCTION public.delivery_remis_solicitar(), public.delivery_admin_remis_revisar(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_remis_solicitar(), public.delivery_admin_remis_revisar(uuid, boolean, text) TO authenticated;

-- 2) Viajes
CREATE TABLE IF NOT EXISTS public.delivery_viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  estado text NOT NULL DEFAULT 'buscando' CHECK (estado IN ('buscando', 'asignado', 'en_origen', 'a_bordo', 'completado', 'cancelado')),
  origen_direccion text NOT NULL CHECK (char_length(origen_direccion) BETWEEN 3 AND 200),
  origen_lat numeric NOT NULL, origen_lng numeric NOT NULL,
  destino_direccion text NOT NULL CHECK (char_length(destino_direccion) BETWEEN 3 AND 200),
  destino_lat numeric NOT NULL, destino_lng numeric NOT NULL,
  pasajeros integer NOT NULL CHECK (pasajeros BETWEEN 1 AND 6),
  notas text CHECK (notas IS NULL OR char_length(notas) <= 200),
  telefono text NOT NULL,
  programado_para timestamptz,
  metodo_pago text NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago = 'efectivo'),
  distancia_km numeric NOT NULL, minutos_estimados integer NOT NULL DEFAULT 0,
  tarifa numeric NOT NULL, propina numeric NOT NULL DEFAULT 0 CHECK (propina >= 0), total numeric NOT NULL,
  comision_pct numeric NOT NULL, ganancia_conductor numeric NOT NULL,
  conductor_id uuid REFERENCES auth.users(id),
  asignado_at timestamptz, llego_at timestamptz, abordo_at timestamptz, completado_at timestamptz, cancelado_at timestamptz,
  motivo_cancelacion text,
  calificacion integer CHECK (calificacion BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_viajes_estado_idx ON public.delivery_viajes (estado, created_at);
CREATE INDEX IF NOT EXISTS delivery_viajes_cliente_idx ON public.delivery_viajes (cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_viajes_conductor_idx ON public.delivery_viajes (conductor_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.delivery_viaje_codigos (viaje_id uuid PRIMARY KEY REFERENCES public.delivery_viajes(id) ON DELETE CASCADE, codigo text NOT NULL);
ALTER TABLE public.delivery_viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_viaje_codigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_viajes, public.delivery_viaje_codigos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_viajes, public.delivery_viaje_codigos TO authenticated;
CREATE POLICY "Viajes: pasajero, conductor y administración" ON public.delivery_viajes FOR SELECT TO authenticated USING (cliente_id = (SELECT auth.uid()) OR conductor_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Código de viaje: solo el pasajero" ON public.delivery_viaje_codigos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_viajes v WHERE v.id = delivery_viaje_codigos.viaje_id AND v.cliente_id = (SELECT auth.uid())));
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_viajes;

DROP POLICY IF EXISTS "Ubicación visible para el pedido en curso" ON public.delivery_ubicaciones;
CREATE POLICY "Ubicación visible para el pedido en curso" ON public.delivery_ubicaciones FOR SELECT TO authenticated USING (
  repartidor_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.repartidor_id = delivery_ubicaciones.repartidor_id AND p.estado = ANY (ARRAY['confirmado'::delivery_estado_pedido, 'preparando'::delivery_estado_pedido, 'en_camino'::delivery_estado_pedido]) AND (p.cliente_id = (SELECT auth.uid()) OR public.delivery_permiso(p.comercio_id, 'pedidos'::text)))
  OR EXISTS (SELECT 1 FROM public.delivery_envios e WHERE e.repartidor_id = delivery_ubicaciones.repartidor_id AND e.estado = ANY (ARRAY['asignado'::text, 'retirado'::text]) AND e.cliente_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.delivery_viajes v WHERE v.conductor_id = delivery_ubicaciones.repartidor_id AND v.estado = ANY (ARRAY['asignado'::text, 'en_origen'::text, 'a_bordo'::text]) AND v.cliente_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.delivery_repartidor_ocupado(p_repartidor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_pedidos x WHERE x.repartidor_id = p_repartidor AND x.estado IN ('confirmado', 'preparando', 'en_camino'))
      OR EXISTS (SELECT 1 FROM public.delivery_envios e WHERE e.repartidor_id = p_repartidor AND e.estado IN ('asignado', 'retirado'))
      OR EXISTS (SELECT 1 FROM public.delivery_viajes v WHERE v.conductor_id = p_repartidor AND v.estado IN ('asignado', 'en_origen', 'a_bordo'))
$$;

-- Avisos: el disparador llama a la función push-viaje (ver supabase/functions/push-viaje).
CREATE OR REPLACE FUNCTION public.delivery_notificar_viaje() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_url text; v_secret text; v_evento text;
BEGIN
  SELECT valor INTO v_url FROM public.app_config WHERE clave = 'push_function_url';
  SELECT valor INTO v_secret FROM public.app_config WHERE clave = 'push_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN NEW; END IF;
  v_url := regexp_replace(v_url, '/[^/]+$', '/push-viaje');
  IF TG_OP = 'INSERT' THEN
    IF NEW.programado_para IS NOT NULL THEN RETURN NEW; END IF;
    v_evento := 'viaje_nuevo';
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_evento := CASE WHEN NEW.estado = 'buscando' THEN 'viaje_nuevo' ELSE 'viaje_estado' END;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM net.http_post(url := v_url, body := jsonb_build_object('viaje_id', NEW.id, 'evento', v_evento, 'estado_anterior', CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-secret', v_secret));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
CREATE TRIGGER delivery_viajes_notificar AFTER INSERT OR UPDATE ON public.delivery_viajes FOR EACH ROW EXECUTE FUNCTION public.delivery_notificar_viaje();
CREATE TRIGGER delivery_aud_viajes AFTER UPDATE ON public.delivery_viajes FOR EACH ROW EXECUTE FUNCTION public.delivery_auditar_cambio('id', 'estado', 'conductor_id', 'motivo_cancelacion');

-- 3) Cotizar, pedir, ofertas, tomar, avanzar, cancelar, soltar y calificar
CREATE OR REPLACE FUNCTION public.delivery_cotizar_viaje(p_olat numeric, p_olng numeric, p_dlat numeric, p_dlng numeric, p_programado timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_km numeric; v_base numeric; v_costo numeric; v_comision numeric := public.delivery_ajuste('remis_comision_pct', 15);
  c_lat constant numeric := -34.8667; c_lng constant numeric := -61.5333;
  v_to jsonb; v_td jsonb; v_t jsonb; v_hora integer; v_noct boolean; v_min integer;
BEGIN
  IF p_olat IS NULL OR p_olng IS NULL OR p_dlat IS NULL OR p_dlng IS NULL
     OR p_olat NOT BETWEEN -90 AND 90 OR p_dlat NOT BETWEEN -90 AND 90 OR p_olng NOT BETWEEN -180 AND 180 OR p_dlng NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Marcá el origen y el destino en el mapa');
  END IF;
  IF public.delivery_distancia_km(p_olat, p_olng, c_lat, c_lng) > public.delivery_ajuste('remis_radio_km', 25)
     OR public.delivery_distancia_km(p_dlat, p_dlng, c_lat, c_lng) > public.delivery_ajuste('remis_radio_km', 25) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Por ahora los viajes son dentro de Lincoln y alrededores');
  END IF;
  v_km := public.delivery_ruta_km(p_olat, p_olng, p_dlat, p_dlng);
  IF v_km < 0.2 THEN RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'El origen y el destino son el mismo lugar'); END IF;
  IF v_km > public.delivery_ajuste('remis_max_km', 40) THEN
    RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'La distancia máxima por viaje es de ' || public.delivery_ajuste('remis_max_km', 40) || ' km');
  END IF;
  v_to := public.delivery_tarifa_zona(p_olat, p_olng); v_td := public.delivery_tarifa_zona(p_dlat, p_dlng);
  IF (v_to->>'cerrada')::boolean THEN RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no buscamos pasajeros en ' || (v_to->>'zona')); END IF;
  IF (v_td->>'cerrada')::boolean THEN RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no llevamos pasajeros a ' || (v_td->>'zona')); END IF;
  v_t := CASE WHEN (v_to->>'multiplicador')::numeric >= (v_td->>'multiplicador')::numeric THEN v_to ELSE v_td END;
  v_t := jsonb_set(v_t, '{recargo}', to_jsonb(greatest((v_to->>'recargo')::numeric, (v_td->>'recargo')::numeric)));
  v_base := greatest(public.delivery_ajuste('remis_minima', 2800), public.delivery_ajuste('remis_base', 1800) + public.delivery_ajuste('remis_por_km', 700) * v_km);
  v_costo := public.delivery_aplicar_tarifa(v_base, v_t);
  v_hora := extract(hour FROM coalesce(p_programado, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::int;
  v_noct := v_hora >= 22 OR v_hora < 6;
  IF v_noct THEN v_costo := v_costo * (1 + public.delivery_ajuste('remis_nocturno_pct', 20) / 100); END IF;
  v_costo := round(v_costo / 50) * 50;
  v_min := ceil(v_km / 35 * 60)::int + 3;
  RETURN jsonb_build_object('ok', true, 'km', v_km, 'minutos', v_min, 'costo', v_costo, 'costo_base', v_base, 'tarifa', v_t, 'nocturno', v_noct, 'comision_pct', v_comision,
    'ganancia', round(v_costo * (1 - v_comision / 100) / 10) * 10);
END $$;

CREATE OR REPLACE FUNCTION public.delivery_crear_viaje(p_origen text, p_olat numeric, p_olng numeric, p_destino text, p_dlat numeric, p_dlng numeric, p_pasajeros integer, p_notas text, p_telefono text, p_programado timestamptz, p_propina numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_q jsonb; v_id uuid; v_propina numeric := coalesce(p_propina, 0); v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para pedir un remís'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_clientes_control WHERE perfil_id = auth.uid() AND bloqueado) THEN RAISE EXCEPTION 'Tu cuenta está bloqueada. Escribinos desde Ayuda'; END IF;
  IF p_pasajeros IS NULL OR p_pasajeros NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Los pasajeros van de 1 a 6'; END IF;
  IF char_length(regexp_replace(v_tel, '\D', '', 'g')) < 8 THEN RAISE EXCEPTION 'Dejanos un teléfono para que el conductor te contacte'; END IF;
  IF v_propina < 0 OR v_propina > 10000 OR v_propina <> floor(v_propina) THEN RAISE EXCEPTION 'La propina tiene que ser un monto entero hasta $10.000'; END IF;
  IF p_programado IS NOT NULL AND (p_programado < now() + interval '30 minutes' OR p_programado > now() + interval '7 days') THEN RAISE EXCEPTION 'Reservá con al menos 30 minutos de anticipación y hasta 7 días'; END IF;
  IF (SELECT count(*) FROM public.delivery_viajes WHERE cliente_id = auth.uid() AND estado IN ('buscando', 'asignado', 'en_origen', 'a_bordo')) >= 2 THEN RAISE EXCEPTION 'Ya tenés 2 viajes en curso. Esperá a que termine alguno.'; END IF;
  v_q := public.delivery_cotizar_viaje(p_olat, p_olng, p_dlat, p_dlng, p_programado);
  IF NOT (v_q->>'ok')::boolean THEN RAISE EXCEPTION '%', v_q->>'motivo'; END IF;
  INSERT INTO public.delivery_viajes (cliente_id, origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, pasajeros, notas, telefono, programado_para,
      distancia_km, minutos_estimados, tarifa, propina, total, comision_pct, ganancia_conductor)
    VALUES (auth.uid(), trim(p_origen), p_olat, p_olng, trim(p_destino), p_dlat, p_dlng, p_pasajeros, nullif(left(trim(coalesce(p_notas, '')), 200), ''), left(trim(v_tel), 30), p_programado,
      (v_q->>'km')::numeric, (v_q->>'minutos')::int, (v_q->>'costo')::numeric, v_propina, (v_q->>'costo')::numeric + v_propina, (v_q->>'comision_pct')::numeric, (v_q->>'ganancia')::numeric + v_propina)
    RETURNING id INTO v_id;
  INSERT INTO public.delivery_viaje_codigos (viaje_id, codigo) VALUES (v_id, lpad(floor(random() * 10000)::int::text, 4, '0'));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_viajes_disponibles()
RETURNS TABLE(id uuid, origen_zona text, destino_zona text, pasajeros integer, distancia_km numeric, dist_recogida_km numeric, ganancia numeric, programado_para timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_lat numeric; v_lng numeric;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = v_uid AND r.activo AND r.verificado AND r.disponible AND r.acepta_remis AND r.remis_estado = 'aprobado' AND r.control_estado IS NULL)
     OR public.delivery_repartidor_ocupado(v_uid) THEN RETURN; END IF;
  SELECT u.latitud, u.longitud INTO v_lat, v_lng FROM public.delivery_ubicaciones u WHERE u.repartidor_id = v_uid AND u.updated_at > now() - interval '15 minutes';
  RETURN QUERY
    SELECT v.id,
      coalesce(nullif(trim(split_part(v.origen_direccion, ',', 2)), ''), v.origen_direccion),
      coalesce(nullif(trim(split_part(v.destino_direccion, ',', 2)), ''), v.destino_direccion),
      v.pasajeros, v.distancia_km,
      CASE WHEN v_lat IS NOT NULL THEN public.delivery_distancia_km(v_lat, v_lng, v.origen_lat, v.origen_lng) END,
      v.ganancia_conductor, v.programado_para, v.created_at
    FROM public.delivery_viajes v
    WHERE v.estado = 'buscando' AND (v.programado_para IS NULL OR v.programado_para <= now() + interval '30 minutes')
      AND (v_lat IS NULL OR public.delivery_distancia_km(v_lat, v_lng, v.origen_lat, v.origen_lng) <= 10)
    ORDER BY coalesce(v.programado_para, v.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.delivery_tomar_viaje(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); r public.delivery_repartidores;
BEGIN
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = v_uid;
  IF NOT FOUND OR NOT r.activo THEN RAISE EXCEPTION 'Primero activá tu perfil de repartidor'; END IF;
  IF NOT r.verificado THEN RAISE EXCEPTION 'Tu perfil todavía está en revisión'; END IF;
  IF r.remis_estado IS DISTINCT FROM 'aprobado' OR NOT r.acepta_remis THEN RAISE EXCEPTION 'No tenés habilitados los viajes de remís'; END IF;
  IF NOT r.disponible THEN RAISE EXCEPTION 'Conectate para tomar viajes'; END IF;
  IF r.control_estado IS NOT NULL THEN RAISE EXCEPTION 'Primero completá la selfie de control'; END IF;
  IF public.delivery_repartidor_ocupado(v_uid) THEN RAISE EXCEPTION 'Ya tenés un pedido, envío o viaje en curso'; END IF;
  UPDATE public.delivery_viajes SET conductor_id = v_uid, estado = 'asignado', asignado_at = now(), updated_at = now() WHERE id = p_id AND estado = 'buscando' AND conductor_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Otro conductor ya tomó este viaje'; END IF;
  UPDATE public.delivery_repartidores SET aceptadas = aceptadas + 1 WHERE perfil_id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_viaje_avanzar(p_id uuid, p_estado text, p_codigo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.delivery_viajes;
BEGIN
  SELECT * INTO v FROM public.delivery_viajes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Viaje no encontrado'; END IF;
  IF v.conductor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Este viaje no es tuyo'; END IF;
  IF p_estado = 'en_origen' AND v.estado = 'asignado' THEN
    UPDATE public.delivery_viajes SET estado = 'en_origen', llego_at = now(), updated_at = now() WHERE id = p_id;
  ELSIF p_estado = 'a_bordo' AND v.estado = 'en_origen' THEN
    IF coalesce(p_codigo, '') <> (SELECT codigo FROM public.delivery_viaje_codigos WHERE viaje_id = p_id) THEN RAISE EXCEPTION 'El código del pasajero no coincide'; END IF;
    UPDATE public.delivery_viajes SET estado = 'a_bordo', abordo_at = now(), updated_at = now() WHERE id = p_id;
  ELSIF p_estado = 'completado' AND v.estado = 'a_bordo' THEN
    UPDATE public.delivery_viajes SET estado = 'completado', completado_at = now(), updated_at = now() WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'No se puede pasar el viaje de % a %', v.estado, p_estado;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_cancelar_viaje(p_id uuid, p_motivo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.delivery_viajes; v_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  SELECT * INTO v FROM public.delivery_viajes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Viaje no encontrado'; END IF;
  IF NOT (v_admin OR v.cliente_id = auth.uid()) THEN RAISE EXCEPTION 'No podés cancelar este viaje'; END IF;
  IF v.estado IN ('completado', 'cancelado') THEN RAISE EXCEPTION 'El viaje ya está cerrado'; END IF;
  IF v.estado = 'a_bordo' AND NOT v_admin THEN RAISE EXCEPTION 'El viaje ya empezó: hablá con el conductor o con soporte'; END IF;
  UPDATE public.delivery_viajes SET estado = 'cancelado', cancelado_at = now(), updated_at = now(),
    motivo_cancelacion = CASE WHEN v_admin AND v.cliente_id <> auth.uid() THEN coalesce(nullif(left(trim(coalesce(p_motivo, '')), 200), ''), 'Cancelado por soporte') ELSE 'Cancelado por el pasajero' END
    WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_soltar_viaje(p_id uuid, p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF char_length(trim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Contanos el motivo'; END IF;
  UPDATE public.delivery_viajes SET conductor_id = NULL, estado = 'buscando', asignado_at = NULL, llego_at = NULL, updated_at = now()
    WHERE id = p_id AND conductor_id = auth.uid() AND estado IN ('asignado', 'en_origen');
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo podés soltar un viaje que todavía no empezó'; END IF;
  UPDATE public.delivery_repartidores SET soltados = soltados + 1 WHERE perfil_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.delivery_calificar_viaje(p_id uuid, p_estrellas integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_estrellas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'La calificación va de 1 a 5'; END IF;
  UPDATE public.delivery_viajes SET calificacion = p_estrellas, updated_at = now() WHERE id = p_id AND cliente_id = auth.uid() AND estado = 'completado' AND calificacion IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés calificar este viaje'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_viaje_conductor(p_viaje uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.delivery_viajes; r jsonb;
BEGIN
  SELECT * INTO v FROM public.delivery_viajes WHERE id = p_viaje;
  IF NOT FOUND OR v.conductor_id IS NULL OR NOT (v.cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('nombre', p.nombre, 'patente', d.patente, 'telefono', d.telefono, 'viajes', (SELECT count(*) FROM public.delivery_viajes x WHERE x.conductor_id = v.conductor_id AND x.estado = 'completado'),
    'calificacion', (SELECT round(avg(x.calificacion)::numeric, 1) FROM public.delivery_viajes x WHERE x.conductor_id = v.conductor_id AND x.calificacion IS NOT NULL))
    INTO r FROM public.delivery_repartidores d LEFT JOIN public.perfiles p ON p.id = d.perfil_id WHERE d.perfil_id = v.conductor_id;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.delivery_cotizar_viaje(numeric, numeric, numeric, numeric, timestamptz), public.delivery_crear_viaje(text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric), public.delivery_viajes_disponibles(), public.delivery_tomar_viaje(uuid), public.delivery_viaje_avanzar(uuid, text, text), public.delivery_cancelar_viaje(uuid, text), public.delivery_soltar_viaje(uuid, text), public.delivery_calificar_viaje(uuid, integer), public.delivery_viaje_conductor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_cotizar_viaje(numeric, numeric, numeric, numeric, timestamptz), public.delivery_crear_viaje(text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric), public.delivery_viajes_disponibles(), public.delivery_tomar_viaje(uuid), public.delivery_viaje_avanzar(uuid, text, text), public.delivery_cancelar_viaje(uuid, text), public.delivery_soltar_viaje(uuid, text), public.delivery_calificar_viaje(uuid, integer), public.delivery_viaje_conductor(uuid) TO authenticated;

-- 4) Asientos contables de remises y envíos (reparto entre conductor/repartidor, Woref e IVA)
CREATE OR REPLACE FUNCTION public.delivery_libro_servicio(p_tipo text, p_id uuid, p_rep uuid, p_total numeric, p_ganancia numeric, p_efectivo boolean, p_fecha timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ing numeric := p_total - p_ganancia; v_pct numeric := public.delivery_ajuste('iva_pct', 21); v_iva numeric := 0; v_n integer;
BEGIN
  IF p_rep IS NULL OR EXISTS (SELECT 1 FROM public.delivery_libro WHERE referencia = p_id::text AND tipo IN ('servicio_ganancia')) THEN RETURN 0; END IF;
  IF v_ing > 0 AND v_pct > 0 THEN v_iva := round(v_ing * v_pct / (100 + v_pct)); END IF;
  INSERT INTO public.delivery_libro (fecha, pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle)
  SELECT coalesce(p_fecha, now()), NULL, x.tt, x.tid, x.cu, x.ti, x.m, p_id::text, jsonb_build_object('servicio', p_tipo) FROM (VALUES
    ('repartidor', p_rep, 'ganancias', 'servicio_ganancia', p_ganancia),
    ('repartidor', p_rep, 'efectivo', 'servicio_efectivo', CASE WHEN p_efectivo THEN -p_total ELSE 0 END),
    ('plataforma', NULL::uuid, 'ingresos', 'servicio_comision', v_ing),
    ('plataforma', NULL::uuid, 'ingresos', 'servicio_iva', -v_iva),
    ('impuestos', NULL::uuid, 'iva', 'servicio_iva', v_iva)
  ) AS x(tt, tid, cu, ti, m) WHERE x.m <> 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.delivery_libro_servicio(text, uuid, uuid, numeric, numeric, boolean, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_libro_viaje_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'delivery_viajes' THEN
      PERFORM public.delivery_libro_servicio('remis', NEW.id, NEW.conductor_id, NEW.total, NEW.ganancia_conductor, NEW.metodo_pago = 'efectivo', NEW.completado_at);
    ELSE
      PERFORM public.delivery_libro_servicio('envio', NEW.id, NEW.repartidor_id, NEW.total, NEW.ganancia_repartidor, NEW.metodo_pago = 'efectivo', NEW.entregado_at);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'delivery_libro_servicio % falló: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER delivery_viajes_libro AFTER UPDATE OF estado ON public.delivery_viajes FOR EACH ROW WHEN (NEW.estado = 'completado' AND OLD.estado IS DISTINCT FROM 'completado') EXECUTE FUNCTION public.delivery_libro_viaje_trg();
CREATE TRIGGER delivery_envios_libro AFTER UPDATE OF estado ON public.delivery_envios FOR EACH ROW WHEN (NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado') EXECUTE FUNCTION public.delivery_libro_viaje_trg();
SELECT count(public.delivery_libro_servicio('envio', e.id, e.repartidor_id, e.total, e.ganancia_repartidor, e.metodo_pago = 'efectivo', e.entregado_at)) FROM public.delivery_envios e WHERE e.estado = 'entregado';

-- 5) La billetera del repartidor suma viajes de remís y bonos de metas (función completa en la base: delivery_billetera_repartidor)
