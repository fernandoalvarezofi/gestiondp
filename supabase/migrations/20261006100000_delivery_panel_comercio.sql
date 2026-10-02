-- Etapa 8: panel del comercio profesional.
-- Tiempo de preparación pactado con el cliente, demoras avisadas, rechazo automático si nadie responde,
-- pausa temporal, y estadísticas calculadas en el servidor.

ALTER TABLE public.delivery_comercios
  ADD COLUMN IF NOT EXISTS pausado_hasta timestamptz,
  ADD COLUMN IF NOT EXISTS tiempo_preparacion_min integer NOT NULL DEFAULT 20 CHECK (tiempo_preparacion_min BETWEEN 5 AND 120),
  ADD COLUMN IF NOT EXISTS comision_pct numeric(5,2) NOT NULL DEFAULT 10 CHECK (comision_pct BETWEEN 0 AND 40);

ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS preparacion_min integer,
  ADD COLUMN IF NOT EXISTS visible_at timestamptz,
  ADD COLUMN IF NOT EXISTS responder_antes_de timestamptz,
  ADD COLUMN IF NOT EXISTS aceptado_en_seg integer,
  ADD COLUMN IF NOT EXISTS demora_extra_min integer NOT NULL DEFAULT 0 CHECK (demora_extra_min BETWEEN 0 AND 60);

-- Un comercio no puede cambiarse la comisión ni saltear la pausa: eso lo maneja el servidor / administración.
CREATE OR REPLACE FUNCTION public.delivery_proteger_comercio()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating := 0;
      NEW.total_resenas := 0;
      NEW.destacado := false;
      NEW.activo := true;
      NEW.aprobado := false;
      NEW.motivo_rechazo := NULL;
      NEW.comision_pct := 10;
      NEW.pausado_hasta := NULL;
    ELSE
      NEW.rating := OLD.rating;
      NEW.total_resenas := OLD.total_resenas;
      NEW.destacado := OLD.destacado;
      NEW.activo := OLD.activo;
      NEW.aprobado := OLD.aprobado;
      NEW.motivo_rechazo := OLD.motivo_rechazo;
      NEW.propietario_id := OLD.propietario_id;
      NEW.comision_pct := OLD.comision_pct;
      NEW.pausado_hasta := OLD.pausado_hasta;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ============================================================
-- Cuándo el pedido "llega" al comercio y hasta cuándo tiene para responder
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_marcar_visible()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_visible boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_visible := NEW.pago_estado NOT IN ('pendiente', 'rechazado');
  ELSE
    v_visible := NEW.visible_at IS NULL AND NEW.pago_estado = 'aprobado' AND OLD.pago_estado IS DISTINCT FROM 'aprobado';
  END IF;
  IF v_visible THEN
    NEW.visible_at := now();
    -- Inmediato: 10 minutos. Programado: hasta 2 horas, pero siempre antes de que llegue la hora pactada.
    NEW.responder_antes_de := CASE
      WHEN NEW.programado_para IS NULL THEN now() + interval '10 minutes'
      ELSE greatest(now() + interval '10 minutes', least(now() + interval '2 hours', NEW.programado_para - interval '40 minutes'))
    END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_visible ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_visible BEFORE INSERT OR UPDATE OF pago_estado ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_marcar_visible();

UPDATE public.delivery_pedidos SET visible_at = created_at, responder_antes_de = created_at + interval '10 minutes'
  WHERE visible_at IS NULL AND pago_estado NOT IN ('pendiente', 'rechazado');

-- Pausa temporal: no se aceptan pedidos nuevos hasta la hora indicada.
CREATE OR REPLACE FUNCTION public.delivery_validar_pausa()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_hasta timestamptz;
BEGIN
  SELECT pausado_hasta INTO v_hasta FROM public.delivery_comercios WHERE id = NEW.comercio_id;
  IF v_hasta IS NOT NULL AND v_hasta > now() AND (NEW.programado_para IS NULL OR NEW.programado_para < v_hasta) THEN
    RAISE EXCEPTION 'El comercio pausó los pedidos por un rato. Probá en unos minutos.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_pausa ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_pausa BEFORE INSERT ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_validar_pausa();

CREATE OR REPLACE FUNCTION public.delivery_pausar_comercio(p_comercio uuid, p_minutos integer DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hasta timestamptz;
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'No tenés permiso sobre este comercio';
  END IF;
  IF p_minutos IS NOT NULL AND (p_minutos < 0 OR p_minutos > 1440) THEN RAISE EXCEPTION 'La pausa puede ser de hasta 24 horas'; END IF;
  v_hasta := CASE WHEN coalesce(p_minutos, 0) = 0 THEN NULL ELSE now() + make_interval(mins => p_minutos) END;
  UPDATE public.delivery_comercios SET pausado_hasta = v_hasta WHERE id = p_comercio;
  RETURN v_hasta;
END $$;
REVOKE ALL ON FUNCTION public.delivery_pausar_comercio(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_pausar_comercio(uuid, integer) TO authenticated;

-- ============================================================
-- Aceptar un pedido pactando el tiempo de preparación
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_aceptar_pedido(p_pedido uuid, p_prep_min integer DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.delivery_pedidos;
  s public.delivery_comercios;
  v_prep integer;
  v_estimada timestamptz;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  SELECT * INTO s FROM public.delivery_comercios WHERE id = p.comercio_id;
  IF NOT (coalesce(s.propietario_id = auth.uid(), false) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RAISE EXCEPTION 'No tenés permiso sobre este pedido'; END IF;
  IF p.estado <> 'pendiente' THEN RAISE EXCEPTION 'Este pedido ya fue respondido'; END IF;
  IF p.pago_estado IN ('pendiente', 'rechazado') THEN RAISE EXCEPTION 'El pedido todavía no está pago'; END IF;

  v_prep := coalesce(p_prep_min, s.tiempo_preparacion_min);
  IF v_prep < 5 OR v_prep > 120 THEN RAISE EXCEPTION 'El tiempo de preparación tiene que estar entre 5 y 120 minutos'; END IF;

  v_estimada := CASE
    WHEN p.programado_para IS NOT NULL THEN p.programado_para
    WHEN p.tipo_entrega = 'retiro' THEN now() + make_interval(mins => v_prep)
    ELSE now() + make_interval(mins => v_prep + 5 + ceil(coalesce(p.distancia_km, 0) * 2)::integer)
  END;

  UPDATE public.delivery_pedidos SET
    estado = 'confirmado', confirmado_at = now(), preparacion_min = v_prep,
    aceptado_en_seg = greatest(0, extract(epoch FROM now() - coalesce(p.visible_at, p.created_at))::integer),
    entrega_estimada = v_estimada
  WHERE id = p_pedido;
  RETURN v_estimada;
END $$;
REVOKE ALL ON FUNCTION public.delivery_aceptar_pedido(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_aceptar_pedido(uuid, integer) TO authenticated;

-- Avisar una demora: corre la hora estimada y le llega un aviso al cliente.
CREATE OR REPLACE FUNCTION public.delivery_agregar_demora(p_pedido uuid, p_min integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.delivery_pedidos;
  v_owner uuid;
  v_nueva timestamptz;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  SELECT propietario_id INTO v_owner FROM public.delivery_comercios WHERE id = p.comercio_id;
  IF NOT (coalesce(v_owner = auth.uid(), false) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RAISE EXCEPTION 'No tenés permiso sobre este pedido'; END IF;
  IF p.estado NOT IN ('confirmado', 'preparando') THEN RAISE EXCEPTION 'Solo podés avisar una demora mientras preparás el pedido'; END IF;
  IF p.programado_para IS NOT NULL THEN RAISE EXCEPTION 'Este pedido tiene un horario pactado con el cliente'; END IF;
  IF p_min NOT IN (5, 10, 15, 20, 30) THEN RAISE EXCEPTION 'Elegí una demora de 5, 10, 15, 20 o 30 minutos'; END IF;
  IF p.demora_extra_min + p_min > 60 THEN RAISE EXCEPTION 'No se puede demorar más de 60 minutos en total. Si no llegás, cancelá el pedido.'; END IF;
  v_nueva := coalesce(p.entrega_estimada, now()) + make_interval(mins => p_min);
  UPDATE public.delivery_pedidos SET entrega_estimada = v_nueva, demora_extra_min = demora_extra_min + p_min WHERE id = p_pedido;
  RETURN v_nueva;
END $$;
REVOKE ALL ON FUNCTION public.delivery_agregar_demora(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_agregar_demora(uuid, integer) TO authenticated;

-- ============================================================
-- Rechazo automático: si el comercio no responde a tiempo, el pedido se cancela y se devuelve el stock y el cupón.
-- Si ya estaba pagado online, el trigger de reintegro lo marca "a reintegrar".
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_vencer_sin_respuesta()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido record; v_total integer := 0;
BEGIN
  FOR v_pedido IN SELECT id, cupon_codigo FROM public.delivery_pedidos
    WHERE estado = 'pendiente' AND visible_at IS NOT NULL AND responder_antes_de < now() AND pago_estado NOT IN ('pendiente', 'rechazado')
    FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.delivery_pedidos SET estado = 'cancelado', cancelado_at = now(),
      motivo_cancelacion = 'El comercio no respondió a tiempo. No se te cobró nada.' WHERE id = v_pedido.id;
    UPDATE public.delivery_productos dp SET stock = dp.stock + i.total
    FROM (SELECT producto_id, sum(cantidad) AS total FROM public.delivery_pedido_items WHERE pedido_id = v_pedido.id GROUP BY producto_id) i
    WHERE dp.id = i.producto_id AND dp.stock IS NOT NULL;
    IF v_pedido.cupon_codigo IS NOT NULL THEN
      UPDATE public.delivery_cupones SET usos = greatest(usos - 1, 0) WHERE codigo = v_pedido.cupon_codigo;
    END IF;
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.delivery_vencer_sin_respuesta() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'delivery-vencer-sin-respuesta';
SELECT cron.schedule('delivery-vencer-sin-respuesta', '* * * * *', 'SELECT public.delivery_vencer_sin_respuesta()');

-- Aviso al cliente cuando el comercio le suma demora.
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
-- Estadísticas del comercio (todo se calcula en el servidor, con la hora de Argentina)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_estadisticas_comercio(p_comercio uuid, p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde timestamptz;
  v_prev_desde timestamptz;
  v_out jsonb;
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'No tenés permiso sobre este comercio';
  END IF;
  v_desde := (date_trunc('day', now() AT TIME ZONE v_tz) - make_interval(days => v_dias - 1)) AT TIME ZONE v_tz;
  v_prev_desde := v_desde - make_interval(days => v_dias);

  WITH base AS (
    SELECT p.*, (p.created_at AT TIME ZONE v_tz)::date AS dia, extract(hour FROM p.created_at AT TIME ZONE v_tz)::integer AS hora
    FROM public.delivery_pedidos p
    WHERE p.comercio_id = p_comercio AND p.created_at >= v_prev_desde AND p.pago_estado NOT IN ('pendiente', 'rechazado')
  ), actual AS (SELECT * FROM base WHERE created_at >= v_desde),
  previo AS (SELECT * FROM base WHERE created_at < v_desde),
  ok AS (SELECT * FROM actual WHERE estado <> 'cancelado'),
  dias AS (SELECT d::date AS dia FROM generate_series((v_desde AT TIME ZONE v_tz)::date, (now() AT TIME ZONE v_tz)::date, interval '1 day') d)
  SELECT jsonb_build_object(
    'dias', v_dias,
    'desde', v_desde,
    'pedidos', (SELECT count(*) FROM ok),
    'ventas', (SELECT coalesce(sum(subtotal), 0) FROM ok),
    'descuentos', (SELECT coalesce(sum(descuento), 0) FROM ok),
    'ticket_promedio', (SELECT coalesce(round(avg(subtotal)), 0) FROM ok),
    'entregados', (SELECT count(*) FROM actual WHERE estado = 'entregado'),
    'cancelados_cliente', (SELECT count(*) FROM actual WHERE estado = 'cancelado' AND motivo_cancelacion = 'Cancelado por el cliente'),
    'rechazados', (SELECT count(*) FROM actual WHERE estado = 'cancelado' AND coalesce(motivo_cancelacion, '') NOT IN ('Cancelado por el cliente', 'No se completó el pago online') AND coalesce(motivo_cancelacion, '') NOT LIKE 'El comercio no respondió%'),
    'sin_respuesta', (SELECT count(*) FROM actual WHERE estado = 'cancelado' AND motivo_cancelacion LIKE 'El comercio no respondió%'),
    'respuesta_seg', (SELECT round(avg(aceptado_en_seg)) FROM actual WHERE aceptado_en_seg IS NOT NULL),
    'preparacion_min', (SELECT round((avg(extract(epoch FROM (coalesce(listo_at, en_camino_at) - confirmado_at)) / 60))::numeric, 1)
                        FROM actual WHERE confirmado_at IS NOT NULL AND coalesce(listo_at, en_camino_at) IS NOT NULL),
    'pedidos_previo', (SELECT count(*) FROM previo WHERE estado <> 'cancelado'),
    'ventas_previo', (SELECT coalesce(sum(subtotal), 0) FROM previo WHERE estado <> 'cancelado'),
    'por_dia', (SELECT coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'pedidos', coalesce(x.pedidos, 0), 'ventas', coalesce(x.ventas, 0)) ORDER BY d.dia), '[]'::jsonb)
                FROM dias d LEFT JOIN (SELECT dia, count(*) AS pedidos, sum(subtotal) AS ventas FROM ok GROUP BY dia) x ON x.dia = d.dia),
    'por_hora', (SELECT coalesce(jsonb_agg(jsonb_build_object('hora', h, 'pedidos', coalesce(x.pedidos, 0)) ORDER BY h), '[]'::jsonb)
                 FROM generate_series(0, 23) h LEFT JOIN (SELECT hora, count(*) AS pedidos FROM ok GROUP BY hora) x ON x.hora = h),
    'top_productos', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
                       SELECT i.nombre, sum(i.cantidad)::integer AS unidades, sum(i.cantidad * i.precio_unitario) AS ingresos
                       FROM public.delivery_pedido_items i JOIN ok ON ok.id = i.pedido_id GROUP BY i.nombre ORDER BY sum(i.cantidad) DESC LIMIT 8) t),
    'tipo_entrega', (SELECT coalesce(jsonb_object_agg(tipo_entrega, n), '{}'::jsonb) FROM (SELECT tipo_entrega, count(*) AS n FROM ok GROUP BY tipo_entrega) q),
    'metodo_pago', (SELECT coalesce(jsonb_object_agg(metodo_pago, n), '{}'::jsonb) FROM (SELECT metodo_pago, count(*) AS n FROM ok GROUP BY metodo_pago) q),
    'calificacion', (SELECT jsonb_build_object('promedio', coalesce(round(avg(puntaje)::numeric, 2), 0), 'total', count(*),
                       'distribucion', jsonb_build_object('1', count(*) FILTER (WHERE puntaje = 1), '2', count(*) FILTER (WHERE puntaje = 2), '3', count(*) FILTER (WHERE puntaje = 3), '4', count(*) FILTER (WHERE puntaje = 4), '5', count(*) FILTER (WHERE puntaje = 5)))
                     FROM public.delivery_resenas WHERE comercio_id = p_comercio AND created_at >= v_desde)
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_estadisticas_comercio(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_estadisticas_comercio(uuid, integer) TO authenticated;
