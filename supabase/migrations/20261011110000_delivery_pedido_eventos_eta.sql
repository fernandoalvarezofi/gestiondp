-- Ciclo de vida del pedido: registro de eventos, guarda de transiciones y motor de ETA (preparación + espera/retiro + tránsito).

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('velocidad_base_kmh', 18, 'Velocidad de reparto de referencia', 'Velocidad promedio en la ciudad que usa el cálculo del tiempo de llegada cuando un repartidor todavía no tiene historial propio.', 'km/h', 8, 40)
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.delivery_pedido_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  estado_anterior text,
  estado_nuevo text,
  actor_id uuid,
  actor_rol text,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_pedido_eventos_pedido_idx ON public.delivery_pedido_eventos (pedido_id, created_at);
ALTER TABLE public.delivery_pedido_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eventos: administración" ON public.delivery_pedido_eventos;
CREATE POLICY "Eventos: administración" ON public.delivery_pedido_eventos FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));
REVOKE ALL ON public.delivery_pedido_eventos FROM anon, authenticated;
GRANT SELECT ON public.delivery_pedido_eventos TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_actor_rol(p_comercio uuid, p_cliente uuid, p_repartidor uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN 'sistema'; END IF;
  IF public.has_role(v_uid, 'admin'::app_role) THEN RETURN 'admin'; END IF;
  IF v_uid = p_cliente THEN RETURN 'cliente'; END IF;
  IF v_uid = p_repartidor THEN RETURN 'repartidor'; END IF;
  IF public.delivery_permiso(p_comercio, 'pedidos') THEN RETURN 'comercio'; END IF;
  RETURN 'sistema';
END $$;
REVOKE ALL ON FUNCTION public.delivery_actor_rol(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Bitácora de eventos del pedido (broker de eventos interno: todo cambio relevante queda con quién y cuándo)
CREATE OR REPLACE FUNCTION public.delivery_pedido_log() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol text; v_uid uuid := auth.uid();
BEGIN
  v_rol := public.delivery_actor_rol(NEW.comercio_id, NEW.cliente_id, coalesce(NEW.repartidor_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.repartidor_id END));
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, estado_nuevo, actor_id, actor_rol, detalle)
      VALUES (NEW.id, 'creado', NEW.estado::text, v_uid, v_rol, jsonb_build_object('total', NEW.total, 'tipo_entrega', NEW.tipo_entrega, 'metodo_pago', NEW.metodo_pago, 'programado_para', NEW.programado_para));
    RETURN NEW;
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, estado_anterior, estado_nuevo, actor_id, actor_rol, detalle)
      VALUES (NEW.id, 'estado', OLD.estado::text, NEW.estado::text, v_uid, v_rol,
        CASE WHEN NEW.estado = 'cancelado' THEN jsonb_build_object('motivo', NEW.motivo_cancelacion) WHEN NEW.estado = 'confirmado' THEN jsonb_build_object('preparacion_min', NEW.preparacion_min) ELSE NULL END);
  END IF;
  IF NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol, detalle)
      VALUES (NEW.id, CASE WHEN NEW.repartidor_id IS NULL THEN 'liberado' ELSE 'asignado' END, v_uid, v_rol,
        jsonb_build_object('repartidor', (SELECT split_part(nombre, ' ', 1) FROM public.perfiles WHERE id = coalesce(NEW.repartidor_id, OLD.repartidor_id)), 'asignado_por', NEW.asignado_por IS NOT NULL));
  END IF;
  IF NEW.llegada_comercio_at IS NOT NULL AND OLD.llegada_comercio_at IS NULL THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol) VALUES (NEW.id, 'llegada_comercio', v_uid, v_rol);
  END IF;
  IF NEW.llegada_cliente_at IS NOT NULL AND OLD.llegada_cliente_at IS NULL THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol) VALUES (NEW.id, 'llegada_cliente', v_uid, v_rol);
  END IF;
  IF coalesce(NEW.demora_extra_min, 0) <> coalesce(OLD.demora_extra_min, 0) THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol, detalle)
      VALUES (NEW.id, 'demora', v_uid, v_rol, jsonb_build_object('minutos', coalesce(NEW.demora_extra_min, 0) - coalesce(OLD.demora_extra_min, 0)));
  END IF;
  IF NEW.pago_estado IS DISTINCT FROM OLD.pago_estado THEN
    INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol, detalle)
      VALUES (NEW.id, 'pago', v_uid, v_rol, jsonb_build_object('de', OLD.pago_estado, 'a', NEW.pago_estado));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_log ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_log AFTER INSERT OR UPDATE ON public.delivery_pedidos FOR EACH ROW EXECUTE FUNCTION public.delivery_pedido_log();

-- Máquina de estados: red de seguridad para cualquier camino (RPC, admin, tareas programadas).
CREATE OR REPLACE FUNCTION public.delivery_pedido_fsm() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE o int; n int;
  ord constant text[] := ARRAY['pendiente', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado'];
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado IN ('entregado', 'cancelado') THEN RAISE EXCEPTION 'El pedido ya está cerrado'; END IF;
  IF NEW.estado = 'cancelado' THEN RETURN NEW; END IF;
  IF OLD.estado = 'pendiente' THEN
    IF NEW.estado <> 'confirmado' THEN RAISE EXCEPTION 'El comercio tiene que aceptar el pedido primero'; END IF;
    IF NEW.pago_estado IN ('pendiente', 'rechazado') THEN RAISE EXCEPTION 'El pedido todavía no está pago'; END IF;
    RETURN NEW;
  END IF;
  o := array_position(ord, OLD.estado::text); n := array_position(ord, NEW.estado::text);
  IF n IS NULL OR o IS NULL OR n <= o THEN RAISE EXCEPTION 'Transición de estado no permitida (% a %)', OLD.estado, NEW.estado; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_fsm ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_fsm BEFORE UPDATE OF estado ON public.delivery_pedidos FOR EACH ROW EXECUTE FUNCTION public.delivery_pedido_fsm();

-- Velocidad real de un repartidor (km/h) según sus últimas entregas; si no tiene historial, la de referencia.
CREATE OR REPLACE FUNCTION public.delivery_velocidad_repartidor(p_rep uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT CASE WHEN count(*) >= 3 THEN round(avg(v), 1) END FROM (
      SELECT least(35, greatest(8, p.distancia_km / (extract(epoch FROM p.entregado_at - p.en_camino_at) / 3600))) AS v
      FROM public.delivery_pedidos p
      WHERE p_rep IS NOT NULL AND p.repartidor_id = p_rep AND p.estado = 'entregado' AND p.en_camino_at IS NOT NULL
        AND p.distancia_km > 0.3 AND p.entregado_at - p.en_camino_at > interval '2 minutes'
      ORDER BY p.entregado_at DESC LIMIT 20) t),
    public.delivery_ajuste('velocidad_base_kmh', 18))
$$;
REVOKE ALL ON FUNCTION public.delivery_velocidad_repartidor(uuid) FROM PUBLIC, anon, authenticated;

-- Cuánto tarda de verdad un comercio en tener el pedido listo (promedio de los últimos 30 días; mínimo 5 pedidos).
CREATE OR REPLACE FUNCTION public.delivery_prep_real_min(p_comercio uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN count(*) >= 5 THEN round(avg(extract(epoch FROM coalesce(p.listo_at, p.en_camino_at, p.entregado_at) - p.confirmado_at) / 60), 1) END
  FROM public.delivery_pedidos p
  WHERE p.comercio_id = p_comercio AND p.estado = 'entregado' AND p.confirmado_at IS NOT NULL AND p.entregado_at > now() - interval '30 days'
    AND coalesce(p.listo_at, p.en_camino_at) IS NOT NULL AND coalesce(p.listo_at, p.en_camino_at) > p.confirmado_at
$$;
REVOKE ALL ON FUNCTION public.delivery_prep_real_min(uuid) FROM PUBLIC, anon, authenticated;

-- Motor de ETA: aceptación + preparación (declarada y real) + espera/retiro del repartidor + tránsito (velocidad del repartidor, hora pico y clima).
CREATE OR REPLACE FUNCTION public.delivery_eta_calc(p public.delivery_pedidos) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.delivery_comercios; v_accept numeric := 0; v_declared numeric; v_hist numeric; v_prep_total numeric; v_prep_rem numeric := 0;
  v_speed numeric; v_traffic numeric := 1; v_hour int; v_loc public.delivery_ubicaciones; v_fresh boolean := false;
  v_pickup numeric := 0; v_wait numeric; v_ready numeric; v_km numeric; v_transit numeric := 0; v_total numeric; v_source text := 'estimado';
  v_factor numeric := public.delivery_ajuste('factor_ruta', 1.35); v_elapsed numeric;
BEGIN
  IF p.estado IN ('entregado', 'cancelado') THEN RETURN jsonb_build_object('terminal', true, 'minutos', 0); END IF;
  IF p.programado_para IS NOT NULL THEN
    RETURN jsonb_build_object('programado', true, 'minutos', greatest(ceil(extract(epoch FROM p.programado_para - now()) / 60), 0), 'hora', p.programado_para);
  END IF;
  SELECT * INTO s FROM public.delivery_comercios WHERE id = p.comercio_id;
  v_hour := extract(hour FROM now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  IF v_hour IN (12, 13, 20, 21) THEN v_traffic := v_traffic + 0.15; END IF;
  IF public.delivery_ajuste('clima_activo', 0) >= 1 THEN v_traffic := v_traffic + 0.2; END IF;

  IF p.estado = 'pendiente' THEN
    v_accept := coalesce((SELECT avg(x.aceptado_en_seg) / 60.0 FROM public.delivery_pedidos x WHERE x.comercio_id = p.comercio_id AND x.aceptado_en_seg IS NOT NULL AND x.created_at > now() - interval '30 days'), 3);
    v_accept := least(v_accept, public.delivery_ajuste('minutos_responder', 10));
    v_accept := greatest(v_accept - extract(epoch FROM now() - coalesce(p.visible_at, p.created_at)) / 60, 1);
  END IF;

  v_declared := coalesce(p.preparacion_min, s.tiempo_preparacion_min, 20);
  v_hist := public.delivery_prep_real_min(p.comercio_id);
  v_prep_total := CASE WHEN v_hist IS NULL THEN v_declared ELSE round((v_declared + v_hist) / 2) END + coalesce(p.demora_extra_min, 0);
  IF p.estado IN ('listo', 'en_camino') THEN v_prep_rem := 0;
  ELSIF p.estado = 'pendiente' THEN v_prep_rem := v_prep_total;
  ELSE v_prep_rem := greatest(v_prep_total - extract(epoch FROM now() - coalesce(p.confirmado_at, now())) / 60, 0); END IF;

  IF p.tipo_entrega = 'retiro' THEN
    v_total := v_accept + v_prep_rem;
    RETURN jsonb_build_object('minutos', greatest(ceil(v_total), 1), 'hora', now() + make_interval(mins => greatest(ceil(v_total), 1)::int),
      'fases', jsonb_build_object('aceptacion', round(v_accept), 'preparacion', round(v_prep_rem)), 'fuente', CASE WHEN v_hist IS NULL THEN 'estimado' ELSE 'historial' END);
  END IF;

  v_speed := public.delivery_velocidad_repartidor(p.repartidor_id);
  IF p.repartidor_id IS NOT NULL THEN
    SELECT * INTO v_loc FROM public.delivery_ubicaciones WHERE repartidor_id = p.repartidor_id;
    v_fresh := FOUND AND v_loc.updated_at > now() - interval '3 minutes'
      AND public.delivery_distancia_km(v_loc.latitud, v_loc.longitud, -34.8667, -61.5333) < 80;
  END IF;
  v_km := coalesce(p.distancia_km, 2);

  IF p.estado = 'en_camino' THEN
    IF v_fresh AND p.latitud IS NOT NULL AND p.longitud IS NOT NULL THEN
      v_km := public.delivery_distancia_km(v_loc.latitud, v_loc.longitud, p.latitud, p.longitud) * v_factor; v_source := 'gps';
    ELSE
      v_elapsed := extract(epoch FROM now() - coalesce(p.en_camino_at, now())) / 3600;
      v_km := greatest(v_km - v_elapsed * v_speed, 0.2);
    END IF;
    v_transit := v_km / v_speed * 60 * v_traffic;
    v_total := v_transit + 1;
    v_ready := 0;
  ELSE
    IF p.repartidor_id IS NOT NULL THEN
      IF v_fresh AND s.latitud IS NOT NULL THEN
        v_pickup := public.delivery_distancia_km(v_loc.latitud, v_loc.longitud, s.latitud, s.longitud) * v_factor / v_speed * 60 * v_traffic; v_source := 'gps';
      ELSE v_pickup := 4; END IF;
      IF p.llegada_comercio_at IS NOT NULL THEN v_pickup := 0; END IF;
    ELSE
      v_wait := coalesce((SELECT avg(extract(epoch FROM x.asignado_at - x.confirmado_at) / 60) FROM public.delivery_pedidos x
        WHERE x.asignado_at IS NOT NULL AND x.confirmado_at IS NOT NULL AND x.asignado_at > x.confirmado_at AND x.created_at > now() - interval '14 days'), 5);
      v_pickup := least(v_wait, 20) + 4;
    END IF;
    v_ready := greatest(v_prep_rem, v_pickup);
    v_transit := v_km / v_speed * 60 * v_traffic;
    v_total := v_accept + v_ready + 3 + v_transit;
  END IF;
  v_total := greatest(ceil(v_total), 2);
  RETURN jsonb_build_object('minutos', v_total, 'hora', now() + make_interval(mins => v_total::int),
    'fases', jsonb_build_object('aceptacion', round(v_accept), 'preparacion', round(v_prep_rem), 'retiro', round(greatest(v_ready - v_prep_rem, 0)), 'transito', round(v_transit)),
    'velocidad_kmh', v_speed, 'trafico', v_traffic, 'fuente', CASE WHEN v_source = 'gps' THEN 'gps' WHEN v_hist IS NOT NULL THEN 'historial' ELSE 'estimado' END);
END $$;
REVOKE ALL ON FUNCTION public.delivery_eta_calc(public.delivery_pedidos) FROM PUBLIC, anon, authenticated;

-- Mantiene entrega_estimada al día cada vez que cambia algo relevante del pedido.
CREATE OR REPLACE FUNCTION public.delivery_pedido_eta_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_eta jsonb;
BEGIN
  IF NEW.estado IN ('entregado', 'cancelado') OR NEW.programado_para IS NOT NULL THEN RETURN NEW; END IF;
  v_eta := public.delivery_eta_calc(NEW);
  IF (v_eta->>'hora') IS NOT NULL THEN NEW.entrega_estimada := (v_eta->>'hora')::timestamptz; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_eta ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_eta BEFORE UPDATE OF estado, repartidor_id, preparacion_min, demora_extra_min, llegada_comercio_at ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_pedido_eta_trg();

CREATE OR REPLACE FUNCTION public.delivery_pedido_puede_ver(p public.delivery_pedidos) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(auth.uid() IS NOT NULL AND (auth.uid() = p.cliente_id OR coalesce(auth.uid() = p.repartidor_id, false) OR coalesce(public.delivery_permiso(p.comercio_id, 'pedidos'), false) OR coalesce(public.has_role(auth.uid(), 'admin'::app_role), false)), false)
$$;
REVOKE ALL ON FUNCTION public.delivery_pedido_puede_ver(public.delivery_pedidos) FROM PUBLIC, anon, authenticated;

-- ETA en vivo de un pedido (para cliente, comercio, repartidor y administración)
CREATE OR REPLACE FUNCTION public.delivery_eta_pedido(p_pedido uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.delivery_pedidos;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido;
  IF NOT FOUND OR NOT public.delivery_pedido_puede_ver(p) THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  RETURN public.delivery_eta_calc(p);
END $$;
REVOKE ALL ON FUNCTION public.delivery_eta_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_eta_pedido(uuid) TO authenticated;

-- Historial de eventos del pedido (sin datos internos de quién lo hizo, solo el rol)
CREATE OR REPLACE FUNCTION public.delivery_pedido_historial(p_pedido uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.delivery_pedidos;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido;
  IF NOT FOUND OR NOT public.delivery_pedido_puede_ver(p) THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('evento', e.evento, 'estado_anterior', e.estado_anterior, 'estado_nuevo', e.estado_nuevo, 'actor_rol', e.actor_rol, 'detalle', e.detalle, 'created_at', e.created_at) ORDER BY e.created_at, e.id)
    FROM public.delivery_pedido_eventos e WHERE e.pedido_id = p_pedido), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.delivery_pedido_historial(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_pedido_historial(uuid) TO authenticated;
