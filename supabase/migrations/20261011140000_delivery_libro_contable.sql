-- Libro contable: reparto automático de cada pedido entregado (split de pagos), impuestos, pagos a comercios y repartidores,
-- conciliación diaria y liquidaciones automáticas.

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('iva_pct', 21, 'IVA incluido en los ingresos de Woref', 'Porcentaje de IVA que se considera incluido en las comisiones, tarifas de servicio y margen de envío. Se muestra como impuesto a pagar en Contabilidad.', '%', 0, 30)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.delivery_comercios ADD COLUMN IF NOT EXISTS liquidacion_frecuencia text NOT NULL DEFAULT 'manual' CHECK (liquidacion_frecuencia IN ('manual', 'diaria', 'semanal'));

CREATE TABLE IF NOT EXISTS public.delivery_libro (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  pedido_id uuid,
  titular_tipo text NOT NULL CHECK (titular_tipo IN ('comercio', 'repartidor', 'cliente', 'plataforma', 'impuestos')),
  titular_id uuid,
  cuenta text NOT NULL CHECK (cuenta IN ('ventas', 'ganancias', 'efectivo', 'billetera', 'ingresos', 'iva')),
  tipo text NOT NULL,
  monto numeric(14, 2) NOT NULL,
  referencia text,
  detalle jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_libro_pedido_uk ON public.delivery_libro (pedido_id, titular_tipo, coalesce(titular_id, '00000000-0000-0000-0000-000000000000'::uuid), cuenta, tipo) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_libro_titular_idx ON public.delivery_libro (titular_tipo, titular_id, cuenta, fecha);
CREATE INDEX IF NOT EXISTS delivery_libro_fecha_idx ON public.delivery_libro (fecha);

CREATE OR REPLACE FUNCTION public.delivery_libro_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('woref.libro_mantenimiento', true) = '1' THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'El libro contable no se puede modificar';
END $$;
DROP TRIGGER IF EXISTS delivery_libro_inmutable_trg ON public.delivery_libro;
CREATE TRIGGER delivery_libro_inmutable_trg BEFORE UPDATE OR DELETE ON public.delivery_libro FOR EACH ROW EXECUTE FUNCTION public.delivery_libro_inmutable();

ALTER TABLE public.delivery_libro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Libro: administración" ON public.delivery_libro;
CREATE POLICY "Libro: administración" ON public.delivery_libro FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Libro: comercio" ON public.delivery_libro;
CREATE POLICY "Libro: comercio" ON public.delivery_libro FOR SELECT TO authenticated USING (titular_tipo = 'comercio' AND public.delivery_puede_ver_finanzas(titular_id));
DROP POLICY IF EXISTS "Libro: titular" ON public.delivery_libro;
CREATE POLICY "Libro: titular" ON public.delivery_libro FOR SELECT TO authenticated USING (titular_tipo IN ('repartidor', 'cliente') AND titular_id = (SELECT auth.uid()));
REVOKE ALL ON public.delivery_libro FROM anon, authenticated;
GRANT SELECT ON public.delivery_libro TO authenticated;

-- Asientos de un pedido entregado. Idempotente: se puede ejecutar de nuevo sin duplicar.
CREATE OR REPLACE FUNCTION public.delivery_libro_pedido(p_pedido uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  p public.delivery_pedidos; c public.delivery_comercios; v_dcom numeric := 0; v_comision numeric; v_genv numeric := 0; v_margen numeric; v_ing numeric; v_iva numeric := 0;
  v_ivapct numeric := public.delivery_ajuste('iva_pct', 21); v_n integer;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido AND estado = 'entregado';
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO c FROM public.delivery_comercios WHERE id = p.comercio_id;
  IF p.cupon_codigo IS NOT NULL THEN
    SELECT least(p.descuento, p.subtotal) INTO v_dcom FROM public.delivery_cupones k WHERE k.codigo = p.cupon_codigo AND k.comercio_id = p.comercio_id LIMIT 1;
    v_dcom := coalesce(v_dcom, 0);
  END IF;
  v_comision := round((p.subtotal - v_dcom) * c.comision_pct / 100);
  IF p.repartidor_id IS NOT NULL THEN v_genv := greatest(coalesce(p.ganancia_repartidor, 0) - p.propina, 0); END IF;
  v_margen := p.costo_envio - v_genv;
  v_ing := v_comision + p.tarifa_servicio + v_margen - (p.descuento - v_dcom);
  IF v_ing > 0 AND v_ivapct > 0 THEN v_iva := round(v_ing * v_ivapct / (100 + v_ivapct)); END IF;

  INSERT INTO public.delivery_libro (fecha, pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, detalle)
  SELECT coalesce(p.entregado_at, now()), p_pedido, x.tt, x.tid, x.cu, x.ti, x.m, x.d FROM (VALUES
    ('comercio', p.comercio_id, 'ventas', 'venta', p.subtotal, NULL::jsonb),
    ('comercio', p.comercio_id, 'ventas', 'descuento', -v_dcom, NULL),
    ('comercio', p.comercio_id, 'ventas', 'comision', -v_comision, jsonb_build_object('pct', c.comision_pct)),
    ('comercio', p.comercio_id, 'ventas', 'propina', CASE WHEN p.repartidor_id IS NULL THEN p.propina ELSE 0 END, NULL),
    ('comercio', p.comercio_id, 'ventas', 'cobrado_directo', CASE WHEN p.tipo_entrega = 'retiro' AND p.metodo_pago <> 'mercadopago' THEN -p.total ELSE 0 END, NULL),
    ('repartidor', p.repartidor_id, 'ganancias', 'envio', v_genv, NULL),
    ('repartidor', p.repartidor_id, 'ganancias', 'propina', CASE WHEN p.repartidor_id IS NULL THEN 0 ELSE p.propina END, NULL),
    ('repartidor', p.repartidor_id, 'efectivo', 'efectivo_cobrado', CASE WHEN p.metodo_pago = 'efectivo' AND p.tipo_entrega = 'delivery' THEN -p.total ELSE 0 END, NULL),
    ('plataforma', NULL::uuid, 'ingresos', 'comision', v_comision, NULL),
    ('plataforma', NULL, 'ingresos', 'servicio', p.tarifa_servicio, NULL),
    ('plataforma', NULL, 'ingresos', 'margen_envio', v_margen, NULL),
    ('plataforma', NULL, 'ingresos', 'descuento_plataforma', -(p.descuento - v_dcom), NULL),
    ('plataforma', NULL, 'ingresos', 'iva', -v_iva, jsonb_build_object('pct', v_ivapct)),
    ('impuestos', NULL, 'iva', 'iva', v_iva, jsonb_build_object('pct', v_ivapct))
  ) AS x(tt, tid, cu, ti, m, d)
  WHERE x.m <> 0 AND (x.tt <> 'repartidor' OR x.tid IS NOT NULL)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.delivery_libro_pedido(uuid) FROM PUBLIC, anon, authenticated;

-- Al entregar un pedido se asienta el reparto. Si algo falla, el pedido igual se entrega y el faltante aparece en la conciliación.
CREATE OR REPLACE FUNCTION public.delivery_libro_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    PERFORM public.delivery_libro_pedido(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'delivery_libro_pedido % falló: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_libro ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_libro AFTER UPDATE OF estado ON public.delivery_pedidos FOR EACH ROW WHEN (NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado') EXECUTE FUNCTION public.delivery_libro_trg();

-- Pagos de liquidaciones a comercios y movimientos con repartidores
CREATE OR REPLACE FUNCTION public.delivery_libro_liquidacion_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.estado = 'pagada' AND OLD.estado IS DISTINCT FROM 'pagada' THEN
    INSERT INTO public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle)
      VALUES (NULL, 'comercio', NEW.comercio_id, 'ventas', 'liquidacion', -NEW.balance, NEW.id::text, jsonb_build_object('referencia', NEW.referencia, 'pedidos', NEW.pedidos));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_liquidaciones_libro ON public.delivery_liquidaciones;
CREATE TRIGGER delivery_liquidaciones_libro AFTER UPDATE OF estado ON public.delivery_liquidaciones FOR EACH ROW EXECUTE FUNCTION public.delivery_libro_liquidacion_trg();

CREATE OR REPLACE FUNCTION public.delivery_libro_movimiento_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo = 'pago' THEN
    INSERT INTO public.delivery_libro (titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle) VALUES ('repartidor', NEW.repartidor_id, 'ganancias', 'pago', -NEW.monto, NEW.id::text, jsonb_build_object('nota', NEW.nota));
  ELSE
    INSERT INTO public.delivery_libro (titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle) VALUES ('repartidor', NEW.repartidor_id, 'efectivo', 'rendicion', NEW.monto, NEW.id::text, jsonb_build_object('nota', NEW.nota));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_movimientos_libro ON public.delivery_movimientos_repartidor;
CREATE TRIGGER delivery_movimientos_libro AFTER INSERT ON public.delivery_movimientos_repartidor FOR EACH ROW EXECUTE FUNCTION public.delivery_libro_movimiento_trg();

-- Ganancia del repartidor: incluye el recargo de zona, demanda y clima del envío.
CREATE OR REPLACE FUNCTION public.delivery_tarifa_repartidor(p_pedido uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.delivery_aplicar_tarifa(public.delivery_costo_envio(c.costo_envio, c.costo_por_km, coalesce(p.distancia_km, 0)), p.tarifa_detalle) + p.propina
  FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
  WHERE p.id = p_pedido
$$;

-- Asientos de lo que ya existía
SELECT count(public.delivery_libro_pedido(id)) FROM public.delivery_pedidos WHERE estado = 'entregado';
INSERT INTO public.delivery_libro (fecha, titular_tipo, titular_id, cuenta, tipo, monto, referencia)
  SELECT coalesce(pagada_at, created_at), 'comercio', comercio_id, 'ventas', 'liquidacion', -balance, id::text FROM public.delivery_liquidaciones WHERE estado = 'pagada';
INSERT INTO public.delivery_libro (fecha, titular_tipo, titular_id, cuenta, tipo, monto, referencia)
  SELECT created_at, 'repartidor', repartidor_id, CASE tipo WHEN 'pago' THEN 'ganancias' ELSE 'efectivo' END, tipo, CASE tipo WHEN 'pago' THEN -monto ELSE monto END, id::text FROM public.delivery_movimientos_repartidor;

-- Conciliación y contabilidad para administración
CREATE OR REPLACE FUNCTION public.delivery_admin_contabilidad(p_desde date, p_hasta date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tz constant text := 'America/Argentina/Buenos_Aires'; v_d timestamptz; v_h timestamptz; v_out jsonb;
  c_dist constant text[] := ARRAY['venta', 'descuento', 'comision', 'propina', 'envio', 'servicio', 'margen_envio', 'descuento_plataforma', 'iva'];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde OR p_hasta - p_desde > 366 THEN RAISE EXCEPTION 'Elegí un período válido (hasta 1 año)'; END IF;
  v_d := p_desde::timestamp AT TIME ZONE v_tz; v_h := (p_hasta + 1)::timestamp AT TIME ZONE v_tz;
  WITH ped AS (
    SELECT p.id, (p.entregado_at AT TIME ZONE v_tz)::date AS dia, p.total, p.metodo_pago FROM public.delivery_pedidos p WHERE p.estado = 'entregado' AND p.entregado_at >= v_d AND p.entregado_at < v_h
  ), asi AS (
    SELECT l.pedido_id, l.titular_tipo, l.titular_id, l.cuenta, l.tipo, l.monto FROM public.delivery_libro l WHERE l.pedido_id IN (SELECT id FROM ped)
  ), por_pedido AS (
    SELECT ped.id, ped.dia, ped.total, coalesce((SELECT sum(a.monto) FROM asi a WHERE a.pedido_id = ped.id AND a.tipo = ANY (c_dist)), 0) AS distribuido,
      EXISTS (SELECT 1 FROM asi a WHERE a.pedido_id = ped.id) AS asentado FROM ped
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object(
      'pedidos', (SELECT count(*) FROM ped), 'cobrado', (SELECT coalesce(sum(total), 0) FROM ped), 'distribuido', (SELECT coalesce(sum(distribuido), 0) FROM por_pedido),
      'diferencia', (SELECT coalesce(sum(total - distribuido), 0) FROM por_pedido WHERE asentado),
      'ventas_comercios', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'comercio' AND tipo IN ('venta', 'descuento', 'comision', 'propina')),
      'comisiones', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'plataforma' AND tipo = 'comision'),
      'servicio', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'plataforma' AND tipo = 'servicio'),
      'margen_envio', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'plataforma' AND tipo = 'margen_envio'),
      'descuentos_plataforma', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'plataforma' AND tipo = 'descuento_plataforma'),
      'ingresos_netos', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'plataforma'),
      'iva', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'impuestos'),
      'repartidores', (SELECT coalesce(sum(monto), 0) FROM asi WHERE titular_tipo = 'repartidor' AND cuenta = 'ganancias')
    ),
    'por_dia', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', d.dia, 'pedidos', d.n, 'cobrado', d.cobrado, 'distribuido', d.dist, 'diferencia', d.cobrado - d.dist) ORDER BY d.dia)
      FROM (SELECT dia, count(*) AS n, sum(total) AS cobrado, sum(distribuido) AS dist FROM por_pedido WHERE asentado GROUP BY dia) d), '[]'::jsonb),
    'por_metodo', coalesce((SELECT jsonb_agg(jsonb_build_object('metodo', m.metodo_pago, 'pedidos', m.n, 'total', m.t)) FROM (SELECT metodo_pago, count(*) AS n, sum(total) AS t FROM ped GROUP BY metodo_pago) m), '[]'::jsonb),
    'saldos', jsonb_build_object(
      'a_pagar_comercios', (SELECT coalesce(sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'comercio'),
      'a_pagar_repartidores', (SELECT coalesce(sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'repartidor' AND cuenta = 'ganancias'),
      'efectivo_en_repartidores', (SELECT coalesce(-sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'repartidor' AND cuenta = 'efectivo'),
      'iva_a_pagar', (SELECT coalesce(sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'impuestos'),
      'billeteras_clientes', (SELECT coalesce(sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'cliente' AND cuenta = 'billetera')),
    'sin_asiento', jsonb_build_object('cantidad', (SELECT count(*) FROM por_pedido WHERE NOT asentado), 'pedidos', coalesce((SELECT jsonb_agg(id) FROM (SELECT id FROM por_pedido WHERE NOT asentado LIMIT 20) z), '[]'::jsonb)),
    'comercios', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'frecuencia', c.liquidacion_frecuencia,
        'periodo', (SELECT coalesce(sum(a.monto), 0) FROM asi a WHERE a.titular_tipo = 'comercio' AND a.titular_id = c.id AND a.tipo IN ('venta', 'descuento', 'comision', 'propina')),
        'saldo', (SELECT coalesce(sum(l.monto), 0) FROM public.delivery_libro l WHERE l.titular_tipo = 'comercio' AND l.titular_id = c.id)) ORDER BY c.nombre)
      FROM public.delivery_comercios c WHERE c.aprobado), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_contabilidad(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_contabilidad(date, date) TO authenticated;

-- Pedidos entregados sin asiento (por una falla puntual): se reconstruyen.
CREATE OR REPLACE FUNCTION public.delivery_admin_rehacer_libro() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n integer := 0; r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  FOR r IN SELECT p.id FROM public.delivery_pedidos p WHERE p.estado = 'entregado' AND NOT EXISTS (SELECT 1 FROM public.delivery_libro l WHERE l.pedido_id = p.id) LOOP
    IF public.delivery_libro_pedido(r.id) > 0 THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_rehacer_libro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_rehacer_libro() TO authenticated;

-- Liquidaciones automáticas: diarias todos los días y semanales los lunes (hora de Argentina), con las entregas hasta las 00:00 de hoy.
CREATE OR REPLACE FUNCTION public.delivery_admin_liquidacion_frecuencia(p_comercio uuid, p_frecuencia text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_frecuencia NOT IN ('manual', 'diaria', 'semanal') THEN RAISE EXCEPTION 'Frecuencia inválida'; END IF;
  UPDATE public.delivery_comercios SET liquidacion_frecuencia = p_frecuencia WHERE id = p_comercio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comercio no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_liquidacion_frecuencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_liquidacion_frecuencia(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_liquidar_automatico() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tz constant text := 'America/Argentina/Buenos_Aires'; v_hasta timestamptz := date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_dow integer := extract(isodow FROM now() AT TIME ZONE v_tz); v_n integer := 0; r record;
BEGIN
  FOR r IN SELECT id FROM public.delivery_comercios WHERE liquidacion_frecuencia = 'diaria' OR (liquidacion_frecuencia = 'semanal' AND v_dow = 1) LOOP
    BEGIN
      IF public.delivery_generar_liquidacion_interna(r.id, v_hasta, NULL) IS NOT NULL THEN v_n := v_n + 1; END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'liquidación automática % falló: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.delivery_liquidar_automatico() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('delivery-liquidar-automatico', '0 9 * * *', 'SELECT public.delivery_liquidar_automatico()');
