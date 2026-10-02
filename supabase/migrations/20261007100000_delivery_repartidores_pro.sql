-- Etapa 9: repartidores profesionales.
-- Verificación de identidad, ofertas con prioridad por cercanía y tiempo límite, rechazo/soltar pedido,
-- llegadas (comercio y cliente), ganancia por viaje, billetera y movimientos de dinero.

-- ============================================================
-- Perfil verificado
-- ============================================================
ALTER TABLE public.delivery_repartidores
  ADD COLUMN IF NOT EXISTS dni text CHECK (dni IS NULL OR dni ~ '^[0-9]{7,9}$'),
  ADD COLUMN IF NOT EXISTS patente text CHECK (patente IS NULL OR patente ~ '^[A-Za-z0-9]{6,7}$'),
  ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS verificado_at timestamptz,
  ADD COLUMN IF NOT EXISTS aceptadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rechazadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS soltados integer NOT NULL DEFAULT 0;

UPDATE public.delivery_repartidores SET verificado = true, verificado_at = now() WHERE NOT verificado;

CREATE OR REPLACE FUNCTION public.delivery_proteger_repartidor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.activo := true; NEW.verificado := false; NEW.motivo_rechazo := NULL; NEW.verificado_at := NULL;
      NEW.disponible := false; NEW.aceptadas := 0; NEW.rechazadas := 0; NEW.soltados := 0;
    ELSE
      NEW.activo := OLD.activo; NEW.verificado := OLD.verificado; NEW.motivo_rechazo := OLD.motivo_rechazo; NEW.verificado_at := OLD.verificado_at;
      NEW.aceptadas := OLD.aceptadas; NEW.rechazadas := OLD.rechazadas; NEW.soltados := OLD.soltados;
      -- Solo un perfil verificado y activo puede conectarse.
      IF NEW.disponible AND NOT (OLD.verificado AND OLD.activo) THEN NEW.disponible := false; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_admin_verificar_repartidor(p_repartidor uuid, p_aprobado boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF NOT p_aprobado AND char_length(trim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Indicá el motivo del rechazo'; END IF;
  UPDATE public.delivery_repartidores SET
    verificado = p_aprobado,
    verificado_at = CASE WHEN p_aprobado THEN now() ELSE NULL END,
    motivo_rechazo = CASE WHEN p_aprobado THEN NULL ELSE left(trim(p_motivo), 300) END,
    disponible = CASE WHEN p_aprobado THEN disponible ELSE false END
  WHERE perfil_id = p_repartidor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Repartidor no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_verificar_repartidor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_verificar_repartidor(uuid, boolean, text) TO authenticated;

-- ============================================================
-- Columnas del pedido
-- ============================================================
ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS asignado_at timestamptz,
  ADD COLUMN IF NOT EXISTS ganancia_repartidor numeric(12,2),
  ADD COLUMN IF NOT EXISTS llegada_comercio_at timestamptz,
  ADD COLUMN IF NOT EXISTS llegada_cliente_at timestamptz;

-- Rechazos de oferta (el pedido no se le vuelve a ofrecer a quien lo rechazó o soltó).
CREATE TABLE IF NOT EXISTS public.delivery_ofertas_rechazos (
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  repartidor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  motivo text,
  tipo text NOT NULL DEFAULT 'rechazo' CHECK (tipo IN ('rechazo', 'soltado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pedido_id, repartidor_id)
);
ALTER TABLE public.delivery_ofertas_rechazos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_ofertas_rechazos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.delivery_ofertas_rechazos TO service_role;

-- Dinero entre Woref y el repartidor: pagos de ganancias y rendiciones de efectivo cobrado.
CREATE TABLE IF NOT EXISTS public.delivery_movimientos_repartidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('pago', 'rendicion')),
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  nota text CHECK (nota IS NULL OR char_length(nota) <= 300),
  creado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_movimientos_rep_idx ON public.delivery_movimientos_repartidor(repartidor_id, created_at DESC);
ALTER TABLE public.delivery_movimientos_repartidor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_movimientos_repartidor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_movimientos_repartidor TO authenticated;
GRANT ALL ON public.delivery_movimientos_repartidor TO service_role;
DROP POLICY IF EXISTS "Repartidores ven sus movimientos" ON public.delivery_movimientos_repartidor;
CREATE POLICY "Repartidores ven sus movimientos" ON public.delivery_movimientos_repartidor FOR SELECT TO authenticated
  USING (repartidor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.delivery_admin_movimiento_repartidor(p_repartidor uuid, p_tipo text, p_monto numeric, p_nota text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_tipo NOT IN ('pago', 'rendicion') THEN RAISE EXCEPTION 'Tipo de movimiento inválido'; END IF;
  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > 10000000 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = p_repartidor) THEN RAISE EXCEPTION 'Repartidor no encontrado'; END IF;
  INSERT INTO public.delivery_movimientos_repartidor (repartidor_id, tipo, monto, nota, creado_por)
    VALUES (p_repartidor, p_tipo, p_monto, nullif(left(trim(coalesce(p_nota, '')), 300), ''), auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_movimiento_repartidor(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_movimiento_repartidor(uuid, text, numeric, text) TO authenticated;

-- ============================================================
-- Privacidad: el repartidor solo lee los pedidos que tiene asignados.
-- Las ofertas pendientes las ve a través de delivery_mis_ofertas() (sin datos personales del cliente).
-- ============================================================
DROP POLICY IF EXISTS "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos;
CREATE POLICY "Repartidores ven pedidos asignados" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (repartidor_id = auth.uid());

DROP POLICY IF EXISTS "Repartidores ven items de pedidos visibles" ON public.delivery_pedido_items;
CREATE POLICY "Repartidores ven items de sus pedidos" ON public.delivery_pedido_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.id = pedido_id AND p.repartidor_id = auth.uid()));

-- ============================================================
-- Tarifa del repartidor: el envío que corresponde por distancia (aunque el cliente tenga envío gratis) + propina.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_tarifa_repartidor(p_pedido uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.delivery_costo_envio(c.costo_envio, c.costo_por_km, coalesce(p.distancia_km, 0)) + p.propina
  FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
  WHERE p.id = p_pedido
$$;
REVOKE ALL ON FUNCTION public.delivery_tarifa_repartidor(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Ofertas: quién ve qué pedido y cuándo.
-- Cada pedido se ofrece primero al repartidor libre más cercano al comercio durante 45 s; si lo rechaza o no responde,
-- pasa al siguiente (hasta 3 ofertas exclusivas). Después queda abierto para todos los repartidores libres.
-- Todo se calcula al consultar (sin tareas programadas), así es consistente y sin demoras.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_ofertas_visibles(p_repartidor uuid)
RETURNS TABLE (pedido_id uuid, exclusivo boolean, vence_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH libres AS (
    SELECT r.perfil_id, u.latitud, u.longitud, coalesce(u.updated_at > now() - interval '15 minutes', false) AS ubicado
    FROM public.delivery_repartidores r
    LEFT JOIN public.delivery_ubicaciones u ON u.repartidor_id = r.perfil_id
    WHERE r.activo AND r.verificado AND r.disponible
      AND NOT EXISTS (SELECT 1 FROM public.delivery_pedidos x WHERE x.repartidor_id = r.perfil_id AND x.estado IN ('confirmado', 'preparando', 'en_camino'))
  ), ordenes AS (
    SELECT p.id, coalesce(p.confirmado_at, p.created_at) AS base, c.latitud AS clat, c.longitud AS clng
    FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE p.repartidor_id IS NULL AND p.estado IN ('confirmado', 'preparando') AND p.tipo_entrega = 'delivery'
      AND (p.programado_para IS NULL OR p.programado_para <= now() + public.delivery_margen_programado())
      AND p.pago_estado NOT IN ('pendiente', 'rechazado')
  ), ranking AS (
    SELECT o.id, o.base, l.perfil_id,
      (row_number() OVER (PARTITION BY o.id ORDER BY
        CASE WHEN l.ubicado AND o.clat IS NOT NULL THEN public.delivery_distancia_km(l.latitud, l.longitud, o.clat, o.clng) ELSE 9999 END, l.perfil_id) - 1)::integer AS rk,
      (count(*) OVER (PARTITION BY o.id))::integer AS n
    FROM ordenes o CROSS JOIN libres l
    WHERE NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_rechazos j WHERE j.pedido_id = o.id AND j.repartidor_id = l.perfil_id)
  ), turnos AS (
    SELECT r.*, floor(extract(epoch FROM now() - r.base) / 45)::integer AS slot FROM ranking r WHERE r.perfil_id = p_repartidor
  )
  SELECT t.id, (t.slot < least(3, t.n)),
         CASE WHEN t.slot < least(3, t.n) THEN t.base + make_interval(secs => (t.slot + 1) * 45) END
  FROM turnos t
  WHERE t.rk = t.slot OR t.slot >= least(3, t.n)
$$;
REVOKE ALL ON FUNCTION public.delivery_ofertas_visibles(uuid) FROM PUBLIC, anon, authenticated;

-- Detalle de las ofertas del repartidor que consulta (sin nombre ni dirección exacta del cliente).
CREATE OR REPLACE FUNCTION public.delivery_mis_ofertas()
RETURNS TABLE (
  pedido_id uuid, comercio_nombre text, comercio_direccion text, comercio_latitud numeric, comercio_longitud numeric,
  zona_entrega text, entrega_latitud numeric, entrega_longitud numeric, dist_retiro_km numeric, dist_entrega_km numeric,
  ganancia numeric, productos integer, metodo_pago text, cobrar numeric, listo_en_min integer, exclusivo boolean, vence_at timestamptz,
  programado_para timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lat numeric; v_lng numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT u.latitud, u.longitud INTO v_lat, v_lng FROM public.delivery_ubicaciones u WHERE u.repartidor_id = v_uid AND u.updated_at > now() - interval '15 minutes';
  RETURN QUERY
    SELECT p.id, c.nombre, c.direccion, c.latitud, c.longitud,
      coalesce(nullif(trim(split_part(p.direccion_entrega, ',', 2)), ''), 'Zona de entrega'),
      round(p.latitud, 3), round(p.longitud, 3),
      CASE WHEN v_lat IS NOT NULL AND c.latitud IS NOT NULL THEN public.delivery_distancia_km(v_lat, v_lng, c.latitud, c.longitud) END,
      p.distancia_km,
      public.delivery_tarifa_repartidor(p.id),
      (SELECT coalesce(sum(i.cantidad), 0)::integer FROM public.delivery_pedido_items i WHERE i.pedido_id = p.id),
      p.metodo_pago,
      CASE WHEN p.metodo_pago = 'efectivo' THEN p.total END,
      CASE WHEN p.preparacion_min IS NOT NULL AND p.confirmado_at IS NOT NULL
           THEN greatest(0, p.preparacion_min - floor(extract(epoch FROM now() - p.confirmado_at) / 60)::integer) END,
      o.exclusivo, o.vence_at, p.programado_para
    FROM public.delivery_ofertas_visibles(v_uid) o
    JOIN public.delivery_pedidos p ON p.id = o.pedido_id
    JOIN public.delivery_comercios c ON c.id = p.comercio_id
    ORDER BY o.exclusivo DESC, p.confirmado_at;
END $$;
REVOKE ALL ON FUNCTION public.delivery_mis_ofertas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mis_ofertas() TO authenticated;

-- Quién recibe primero la oferta de un pedido (lo usa la función de avisos push).
CREATE OR REPLACE FUNCTION public.delivery_candidato_oferta(p_pedido uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.perfil_id
  FROM public.delivery_repartidores l
  LEFT JOIN public.delivery_ubicaciones u ON u.repartidor_id = l.perfil_id
  CROSS JOIN LATERAL (SELECT c.latitud, c.longitud FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id WHERE p.id = p_pedido) o
  WHERE l.activo AND l.verificado AND l.disponible
    AND NOT EXISTS (SELECT 1 FROM public.delivery_pedidos x WHERE x.repartidor_id = l.perfil_id AND x.estado IN ('confirmado', 'preparando', 'en_camino'))
    AND NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_rechazos j WHERE j.pedido_id = p_pedido AND j.repartidor_id = l.perfil_id)
  ORDER BY CASE WHEN coalesce(u.updated_at > now() - interval '15 minutes', false) AND o.latitud IS NOT NULL
                THEN public.delivery_distancia_km(u.latitud, u.longitud, o.latitud, o.longitud) ELSE 9999 END, l.perfil_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.delivery_candidato_oferta(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_candidato_oferta(uuid) TO service_role;

-- ============================================================
-- Aceptar, rechazar y soltar
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_tomar_pedido(p_pedido uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.delivery_repartidores;
BEGIN
  SELECT * INTO r FROM public.delivery_repartidores WHERE perfil_id = v_uid;
  IF NOT FOUND OR NOT r.activo THEN RAISE EXCEPTION 'Primero activá tu perfil de repartidor'; END IF;
  IF NOT r.verificado THEN RAISE EXCEPTION 'Tu perfil todavía está en revisión'; END IF;
  IF NOT r.disponible THEN RAISE EXCEPTION 'Conectate para tomar pedidos'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_pedidos WHERE repartidor_id = v_uid AND estado IN ('confirmado', 'preparando', 'en_camino')) THEN
    RAISE EXCEPTION 'Ya tenés un pedido en curso';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_visibles(v_uid) WHERE pedido_id = p_pedido) THEN
    RAISE EXCEPTION 'Esta oferta ya no está disponible para vos';
  END IF;
  UPDATE public.delivery_pedidos SET repartidor_id = v_uid, asignado_at = now(), ganancia_repartidor = public.delivery_tarifa_repartidor(p_pedido)
    WHERE id = p_pedido AND repartidor_id IS NULL AND estado IN ('confirmado', 'preparando');
  IF NOT FOUND THEN RAISE EXCEPTION 'Otro repartidor ya tomó este pedido'; END IF;
  UPDATE public.delivery_repartidores SET aceptadas = aceptadas + 1 WHERE perfil_id = v_uid;
END $$;
REVOKE ALL ON FUNCTION public.delivery_tomar_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_tomar_pedido(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_rechazar_oferta(p_pedido uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.delivery_ofertas_visibles(v_uid) WHERE pedido_id = p_pedido) THEN RETURN; END IF;
  INSERT INTO public.delivery_ofertas_rechazos (pedido_id, repartidor_id, motivo, tipo)
    VALUES (p_pedido, v_uid, nullif(left(trim(coalesce(p_motivo, '')), 200), ''), 'rechazo') ON CONFLICT DO NOTHING;
  UPDATE public.delivery_repartidores SET rechazadas = rechazadas + 1 WHERE perfil_id = v_uid;
END $$;
REVOKE ALL ON FUNCTION public.delivery_rechazar_oferta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_rechazar_oferta(uuid, text) TO authenticated;

-- Soltar un pedido ya tomado (antes de retirarlo): vuelve a ofrecerse a otros repartidores.
CREATE OR REPLACE FUNCTION public.delivery_soltar_pedido(p_pedido uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_motivo text := nullif(left(trim(coalesce(p_motivo, '')), 200), '');
BEGIN
  IF v_motivo IS NULL OR char_length(v_motivo) < 5 THEN RAISE EXCEPTION 'Contanos por qué lo soltás'; END IF;
  UPDATE public.delivery_pedidos SET repartidor_id = NULL, asignado_at = NULL, ganancia_repartidor = NULL, llegada_comercio_at = NULL
    WHERE id = p_pedido AND repartidor_id = v_uid AND estado IN ('confirmado', 'preparando') AND en_camino_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés soltar este pedido (ya lo retiraste o no es tuyo)'; END IF;
  INSERT INTO public.delivery_ofertas_rechazos (pedido_id, repartidor_id, motivo, tipo) VALUES (p_pedido, v_uid, v_motivo, 'soltado')
    ON CONFLICT (pedido_id, repartidor_id) DO UPDATE SET motivo = excluded.motivo, tipo = 'soltado', created_at = now();
  UPDATE public.delivery_repartidores SET soltados = soltados + 1 WHERE perfil_id = v_uid;
END $$;
REVOKE ALL ON FUNCTION public.delivery_soltar_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_soltar_pedido(uuid, text) TO authenticated;

-- ============================================================
-- Llegadas: "Llegué al comercio" y "Llegué al cliente" (se validan contra la ubicación cuando está disponible)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_marcar_llegada(p_pedido uuid, p_donde text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  p public.delivery_pedidos;
  c public.delivery_comercios;
  u public.delivery_ubicaciones;
  v_lat numeric; v_lng numeric;
BEGIN
  IF p_donde NOT IN ('comercio', 'cliente') THEN RAISE EXCEPTION 'Lugar inválido'; END IF;
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido AND repartidor_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este pedido no es tuyo'; END IF;
  SELECT * INTO c FROM public.delivery_comercios WHERE id = p.comercio_id;
  SELECT * INTO u FROM public.delivery_ubicaciones WHERE repartidor_id = v_uid AND updated_at > now() - interval '3 minutes';

  IF p_donde = 'comercio' THEN
    IF p.estado NOT IN ('confirmado', 'preparando') THEN RAISE EXCEPTION 'Ya retiraste este pedido'; END IF;
    IF p.llegada_comercio_at IS NOT NULL THEN RETURN; END IF;
    v_lat := c.latitud; v_lng := c.longitud;
  ELSE
    IF p.estado <> 'en_camino' THEN RAISE EXCEPTION 'Primero retirá el pedido'; END IF;
    IF p.llegada_cliente_at IS NOT NULL THEN RETURN; END IF;
    v_lat := p.latitud; v_lng := p.longitud;
  END IF;

  -- Con ubicación reciente y destino conocido, hay que estar cerca (600 m). Sin ubicación no se bloquea a nadie.
  IF u.latitud IS NOT NULL AND v_lat IS NOT NULL AND public.delivery_distancia_km(u.latitud, u.longitud, v_lat, v_lng) > 0.6 THEN
    RAISE EXCEPTION 'Todavía no estás cerca del destino (estás a % km)', round(public.delivery_distancia_km(u.latitud, u.longitud, v_lat, v_lng), 1);
  END IF;

  IF p_donde = 'comercio' THEN UPDATE public.delivery_pedidos SET llegada_comercio_at = now() WHERE id = p_pedido;
  ELSE UPDATE public.delivery_pedidos SET llegada_cliente_at = now() WHERE id = p_pedido; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_marcar_llegada(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_marcar_llegada(uuid, text) TO authenticated;

-- Aviso al cliente cuando el repartidor llega.
CREATE OR REPLACE FUNCTION public.delivery_notificar_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url text;
  v_secret text;
  v_evento text;
BEGIN
  SELECT valor INTO v_url FROM public.app_config WHERE clave = 'push_function_url';
  SELECT valor INTO v_secret FROM public.app_config WHERE clave = 'push_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.pago_estado = 'pendiente' THEN RETURN NEW; END IF;
    v_evento := 'nuevo';
  ELSIF NEW.pago_estado = 'aprobado' AND OLD.pago_estado IS DISTINCT FROM 'aprobado' THEN
    v_evento := 'nuevo';
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_evento := 'estado';
  ELSIF NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id AND NEW.repartidor_id IS NOT NULL THEN
    v_evento := 'asignado';
  ELSIF NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id AND NEW.repartidor_id IS NULL AND NEW.estado IN ('confirmado', 'preparando') THEN
    v_evento := 'liberado';
  ELSIF NEW.llegada_cliente_at IS NOT NULL AND OLD.llegada_cliente_at IS NULL THEN
    v_evento := 'llegada';
  ELSIF NEW.demora_extra_min > OLD.demora_extra_min THEN
    v_evento := 'demora';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id, 'evento', v_evento, 'estado_anterior', CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado::text END),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-secret', v_secret)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.delivery_notificar_pedido() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Billetera (propia o, para administración, de cualquier repartidor)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_billetera_repartidor(p_repartidor uuid DEFAULT NULL, p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_uid uuid := coalesce(p_repartidor, auth.uid());
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde timestamptz;
  v_hoy timestamptz;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (v_uid = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RAISE EXCEPTION 'No tenés permiso'; END IF;
  v_desde := (date_trunc('day', now() AT TIME ZONE v_tz) - make_interval(days => v_dias - 1)) AT TIME ZONE v_tz;
  v_hoy := date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  WITH viajes AS (
    SELECT p.*, (p.entregado_at AT TIME ZONE v_tz)::date AS dia
    FROM public.delivery_pedidos p WHERE p.repartidor_id = v_uid AND p.estado = 'entregado' AND p.entregado_at IS NOT NULL
  ), periodo AS (SELECT * FROM viajes WHERE entregado_at >= v_desde),
  dias AS (SELECT d::date AS dia FROM generate_series((v_desde AT TIME ZONE v_tz)::date, (now() AT TIME ZONE v_tz)::date, interval '1 day') d),
  mov AS (SELECT tipo, sum(monto) AS total FROM public.delivery_movimientos_repartidor WHERE repartidor_id = v_uid GROUP BY tipo)
  SELECT jsonb_build_object(
    'dias', v_dias,
    'hoy', jsonb_build_object('viajes', (SELECT count(*) FROM viajes WHERE entregado_at >= v_hoy), 'ganancia', (SELECT coalesce(sum(ganancia_repartidor), 0) FROM viajes WHERE entregado_at >= v_hoy)),
    'periodo', jsonb_build_object(
      'viajes', (SELECT count(*) FROM periodo),
      'ganancia', (SELECT coalesce(sum(ganancia_repartidor), 0) FROM periodo),
      'propinas', (SELECT coalesce(sum(propina), 0) FROM periodo),
      'km', (SELECT coalesce(round(sum(distancia_km), 1), 0) FROM periodo),
      'minutos_promedio', (SELECT round((avg(extract(epoch FROM (entregado_at - en_camino_at)) / 60))::numeric, 1) FROM periodo WHERE en_camino_at IS NOT NULL),
      'por_dia', (SELECT coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'viajes', coalesce(x.viajes, 0), 'ganancia', coalesce(x.ganancia, 0)) ORDER BY d.dia), '[]'::jsonb)
                  FROM dias d LEFT JOIN (SELECT dia, count(*) AS viajes, sum(ganancia_repartidor) AS ganancia FROM periodo GROUP BY dia) x ON x.dia = d.dia)
    ),
    'cuenta', jsonb_build_object(
      'ganancias_total', (SELECT coalesce(sum(ganancia_repartidor), 0) FROM viajes),
      'pagos', coalesce((SELECT total FROM mov WHERE tipo = 'pago'), 0),
      'efectivo_cobrado', (SELECT coalesce(sum(total), 0) FROM viajes WHERE metodo_pago = 'efectivo'),
      'rendiciones', coalesce((SELECT total FROM mov WHERE tipo = 'rendicion'), 0)
    ),
    'desempeno', (SELECT jsonb_build_object('aceptadas', aceptadas, 'rechazadas', rechazadas, 'soltados', soltados) FROM public.delivery_repartidores WHERE perfil_id = v_uid),
    'movimientos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'monto', m.monto, 'nota', m.nota, 'fecha', m.created_at) ORDER BY m.created_at DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.delivery_movimientos_repartidor WHERE repartidor_id = v_uid ORDER BY created_at DESC LIMIT 30) m)
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_billetera_repartidor(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_billetera_repartidor(uuid, integer) TO authenticated;
