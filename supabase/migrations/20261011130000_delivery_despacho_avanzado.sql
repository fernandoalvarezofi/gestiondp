-- Despacho avanzado: puntaje por cercanía + carga de trabajo + velocidad histórica + tasa de rechazo, capacidad por vehículo y agrupación (batching).

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('capacidad_mochila_items', 8, 'Capacidad de mochila', 'Cantidad máxima de productos que lleva una moto en mochila (la bici lleva la mitad). Pedidos más grandes se ofrecen solo a repartidores con auto.', 'productos', 2, 40),
  ('batch_max_pedidos', 2, 'Pedidos por repartidor (agrupación)', 'Cuántos pedidos puede llevar a la vez un repartidor si son del mismo lugar y van a zonas cercanas. 1 = sin agrupación.', 'pedidos', 1, 3),
  ('batch_radio_retiro_km', 0.6, 'Agrupación: distancia entre comercios', 'Dos pedidos se pueden agrupar si los comercios están a menos de esta distancia.', 'km', 0, 3),
  ('batch_radio_entrega_km', 2, 'Agrupación: distancia entre entregas', 'Dos pedidos se pueden agrupar si las direcciones de entrega están a menos de esta distancia.', 'km', 0, 8)
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.delivery_pedido_volumen(p_pedido uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(sum(cantidad), 0)::integer FROM public.delivery_pedido_items WHERE pedido_id = p_pedido
$$;

-- ¿El vehículo del repartidor (más lo que ya lleva) alcanza para este pedido?
CREATE OR REPLACE FUNCTION public.delivery_capacidad_ok(p_rep uuid, p_pedido uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_veh text; v_cap numeric := public.delivery_ajuste('capacidad_mochila_items', 8); v_load integer;
BEGIN
  SELECT vehiculo INTO v_veh FROM public.delivery_repartidores WHERE perfil_id = p_rep;
  IF v_veh IS NULL THEN RETURN false; END IF;
  IF v_veh = 'auto' THEN RETURN true; END IF;
  IF v_veh = 'bici' THEN v_cap := greatest(floor(v_cap / 2), 2); END IF;
  SELECT coalesce(sum(public.delivery_pedido_volumen(x.id)), 0) INTO v_load FROM public.delivery_pedidos x
    WHERE x.repartidor_id = p_rep AND x.estado IN ('confirmado', 'preparando', 'en_camino');
  RETURN v_load + public.delivery_pedido_volumen(p_pedido) <= v_cap;
END $$;

-- ¿Puede este repartidor sumar el pedido a lo que ya lleva? (mismo lugar de retiro, entregas cercanas, todavía no salió)
CREATE OR REPLACE FUNCTION public.delivery_batch_ok(p_rep uuid, p_pedido uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max integer := public.delivery_ajuste('batch_max_pedidos', 2)::integer; n integer; v_new record; r record;
BEGIN
  IF v_max < 2 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_envios e WHERE e.repartidor_id = p_rep AND e.estado IN ('asignado', 'retirado')) THEN RETURN false; END IF;
  SELECT p.latitud AS dlat, p.longitud AS dlng, c.latitud AS olat, c.longitud AS olng INTO v_new
    FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id WHERE p.id = p_pedido;
  IF NOT FOUND OR v_new.dlat IS NULL OR v_new.olat IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO n FROM public.delivery_pedidos x WHERE x.repartidor_id = p_rep AND x.estado IN ('confirmado', 'preparando', 'en_camino');
  IF n = 0 OR n >= v_max THEN RETURN false; END IF;
  FOR r IN SELECT x.estado, x.en_camino_at, x.tipo_entrega, x.latitud AS dlat, x.longitud AS dlng, c.latitud AS olat, c.longitud AS olng
      FROM public.delivery_pedidos x JOIN public.delivery_comercios c ON c.id = x.comercio_id
      WHERE x.repartidor_id = p_rep AND x.estado IN ('confirmado', 'preparando', 'en_camino') LOOP
    IF r.estado = 'en_camino' OR r.en_camino_at IS NOT NULL OR r.tipo_entrega <> 'delivery' OR r.dlat IS NULL OR r.olat IS NULL THEN RETURN false; END IF;
    IF public.delivery_distancia_km(r.olat, r.olng, v_new.olat, v_new.olng) > public.delivery_ajuste('batch_radio_retiro_km', 0.6) THEN RETURN false; END IF;
    IF public.delivery_distancia_km(r.dlat, r.dlng, v_new.dlat, v_new.dlng) > public.delivery_ajuste('batch_radio_entrega_km', 2) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

-- Puntaje de despacho (menor es mejor): km hasta el local + carga reciente + rechazos − velocidad histórica − bonus por agrupar.
CREATE OR REPLACE FUNCTION public.delivery_puntaje_despacho(p_rep uuid, p_pedido uuid) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_dist numeric := 9999; r public.delivery_repartidores; v_loc public.delivery_ubicaciones; c public.delivery_comercios;
  v_recent integer; v_speed numeric; v_base numeric := public.delivery_ajuste('velocidad_base_kmh', 18); v_score numeric;
BEGIN
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = p_rep;
  SELECT cc.* INTO c FROM public.delivery_pedidos p JOIN public.delivery_comercios cc ON cc.id = p.comercio_id WHERE p.id = p_pedido;
  SELECT * INTO v_loc FROM public.delivery_ubicaciones WHERE repartidor_id = p_rep AND updated_at > now() - interval '15 minutes';
  IF FOUND AND c.latitud IS NOT NULL THEN v_dist := public.delivery_distancia_km(v_loc.latitud, v_loc.longitud, c.latitud, c.longitud); END IF;
  SELECT count(*) INTO v_recent FROM public.delivery_pedidos x WHERE x.repartidor_id = p_rep AND x.asignado_at > now() - interval '3 hours';
  v_speed := public.delivery_velocidad_repartidor(p_rep);
  v_score := v_dist + v_recent * 0.25
    + coalesce(r.rechazadas, 0)::numeric / greatest(coalesce(r.aceptadas, 0) + coalesce(r.rechazadas, 0), 1) * 1.5
    - least(1, greatest(-1, (v_speed - v_base) / v_base)) * 0.5
    - CASE WHEN public.delivery_repartidor_ocupado(p_rep) THEN 1 ELSE 0 END;
  RETURN round(v_score, 3);
END $$;

REVOKE ALL ON FUNCTION public.delivery_pedido_volumen(uuid), public.delivery_capacidad_ok(uuid, uuid), public.delivery_batch_ok(uuid, uuid), public.delivery_puntaje_despacho(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_candidato_oferta(p_pedido uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.perfil_id FROM public.delivery_repartidores l
  WHERE l.activo AND l.verificado AND l.disponible
    AND (NOT public.delivery_repartidor_ocupado(l.perfil_id) OR public.delivery_batch_ok(l.perfil_id, p_pedido))
    AND public.delivery_capacidad_ok(l.perfil_id, p_pedido)
    AND NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_rechazos j WHERE j.pedido_id = p_pedido AND j.repartidor_id = l.perfil_id)
  ORDER BY public.delivery_puntaje_despacho(l.perfil_id, p_pedido), l.perfil_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.delivery_ofertas_visibles(p_repartidor uuid)
RETURNS TABLE(pedido_id uuid, exclusivo boolean, vence_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH libres AS (
    SELECT r.perfil_id, public.delivery_repartidor_ocupado(r.perfil_id) AS ocupado
    FROM public.delivery_repartidores r WHERE r.activo AND r.verificado AND r.disponible
  ), ordenes AS (
    SELECT p.id, coalesce(p.confirmado_at, p.created_at) AS base
    FROM public.delivery_pedidos p
    WHERE p.repartidor_id IS NULL AND p.estado IN ('confirmado', 'preparando') AND p.tipo_entrega = 'delivery'
      AND (p.programado_para IS NULL OR p.programado_para <= now() + public.delivery_margen_programado())
      AND p.pago_estado NOT IN ('pendiente', 'rechazado')
  ), ranking AS (
    SELECT o.id, o.base, l.perfil_id,
      (row_number() OVER (PARTITION BY o.id ORDER BY public.delivery_puntaje_despacho(l.perfil_id, o.id), l.perfil_id) - 1)::integer AS rk,
      (count(*) OVER (PARTITION BY o.id))::integer AS n
    FROM ordenes o CROSS JOIN libres l
    WHERE (NOT l.ocupado OR public.delivery_batch_ok(l.perfil_id, o.id))
      AND public.delivery_capacidad_ok(l.perfil_id, o.id)
      AND NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_rechazos j WHERE j.pedido_id = o.id AND j.repartidor_id = l.perfil_id)
  ), turnos AS (
    SELECT r.*, floor(extract(epoch FROM now() - r.base) / public.delivery_ajuste('segundos_oferta', 45))::integer AS slot FROM ranking r WHERE r.perfil_id = p_repartidor
  )
  SELECT t.id, (t.slot < least(3, t.n)),
         CASE WHEN t.slot < least(3, t.n) THEN t.base + make_interval(secs => (t.slot + 1) * public.delivery_ajuste('segundos_oferta', 45)) END
  FROM turnos t
  WHERE t.rk = t.slot OR t.slot >= least(3, t.n)
$$;

-- Tomar un pedido: permite sumar un segundo pedido compatible; valida capacidad del vehículo.
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.delivery_tomar_pedido'::regproc) INTO d;
  IF position('delivery_batch_ok' IN d) = 0 THEN
    d := replace(d, E'IF public.delivery_repartidor_ocupado(v_uid) THEN\n    RAISE EXCEPTION ''Ya tenés un pedido en curso'';\n  END IF;',
      E'IF public.delivery_repartidor_ocupado(v_uid) AND NOT public.delivery_batch_ok(v_uid, p_pedido) THEN\n    RAISE EXCEPTION ''Ya tenés un pedido en curso'';\n  END IF;\n  IF NOT public.delivery_capacidad_ok(v_uid, p_pedido) THEN\n    RAISE EXCEPTION ''Este pedido es demasiado grande para tu vehículo'';\n  END IF;');
    IF position('delivery_batch_ok' IN d) = 0 THEN RAISE EXCEPTION 'patch tomar'; END IF;
    EXECUTE d;
  END IF;
  -- ETA: si el repartidor ya lleva otro pedido, suma el tiempo de atenderlo primero.
  SELECT pg_get_functiondef('public.delivery_eta_calc'::regproc) INTO d;
  IF position('v_batch' IN d) = 0 THEN
    d := replace(d, 'v_elapsed numeric;', 'v_elapsed numeric; v_batch numeric := 0;');
    d := replace(d, 'v_total := v_accept + v_ready + 3 + v_transit;',
      E'IF p.repartidor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.delivery_pedidos o WHERE o.repartidor_id = p.repartidor_id AND o.id <> p.id AND o.estado IN (''confirmado'', ''preparando'', ''en_camino'') AND o.asignado_at < coalesce(p.asignado_at, now())) THEN v_batch := 6; END IF;\n    v_total := v_accept + v_ready + 3 + v_transit + v_batch;');
    IF position('v_batch := 6' IN d) = 0 OR position('v_batch numeric' IN d) = 0 THEN RAISE EXCEPTION 'patch eta'; END IF;
    EXECUTE d;
  END IF;
END $mig$;
