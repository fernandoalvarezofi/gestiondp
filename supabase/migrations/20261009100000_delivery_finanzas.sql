-- Finanzas del comercio: comisión, liquidaciones y balance con Woref.
--
-- Por cada pedido ENTREGADO:
--   ventas             = subtotal (productos)
--   descuento_comercio = descuento solo si el cupón es del propio comercio (los cupones de Woref los paga Woref)
--   comisión           = comisión del comercio % × (ventas − descuento_comercio)
--   neto               = ventas − descuento_comercio − comisión   (lo que le corresponde al comercio)
--   cobrado_directo    = lo que el comercio cobró en mano: retiros pagados en el local (efectivo, tarjeta, transferencia)
--   balance            = neto − cobrado_directo
-- Balance positivo: Woref le paga al comercio. Negativo: el comercio le debe a Woref (tarifa de servicio y comisión
-- de lo que cobró en mano). Los pedidos pagados online y los de envío (el efectivo lo rinde el repartidor) cobran siempre vía Woref.

CREATE TABLE IF NOT EXISTS public.delivery_liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  desde timestamptz NOT NULL,
  hasta timestamptz NOT NULL,
  pedidos integer NOT NULL CHECK (pedidos > 0),
  ventas numeric(14,2) NOT NULL,
  descuentos_comercio numeric(14,2) NOT NULL DEFAULT 0,
  comision_pct numeric(5,2) NOT NULL,
  comision numeric(14,2) NOT NULL,
  neto numeric(14,2) NOT NULL,
  cobrado_directo numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  referencia text CHECK (referencia IS NULL OR char_length(referencia) <= 200),
  pagada_at timestamptz,
  creado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_liquidaciones_comercio_idx ON public.delivery_liquidaciones(comercio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_liquidaciones_estado_idx ON public.delivery_liquidaciones(estado, created_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_liquidacion_items (
  liquidacion_id uuid NOT NULL REFERENCES public.delivery_liquidaciones(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE RESTRICT,
  fecha timestamptz NOT NULL,
  tipo_entrega text NOT NULL,
  metodo_pago text NOT NULL,
  ventas numeric(14,2) NOT NULL,
  descuento_comercio numeric(14,2) NOT NULL,
  comision numeric(14,2) NOT NULL,
  neto numeric(14,2) NOT NULL,
  cobrado_directo numeric(14,2) NOT NULL,
  balance numeric(14,2) NOT NULL,
  PRIMARY KEY (liquidacion_id, pedido_id)
);

ALTER TABLE public.delivery_pedidos ADD COLUMN IF NOT EXISTS liquidacion_id uuid REFERENCES public.delivery_liquidaciones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS delivery_pedidos_liquidar_idx ON public.delivery_pedidos(comercio_id, entregado_at) WHERE estado = 'entregado' AND liquidacion_id IS NULL;

ALTER TABLE public.delivery_liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_liquidacion_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_liquidaciones, public.delivery_liquidacion_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_liquidaciones, public.delivery_liquidacion_items TO authenticated;
GRANT ALL ON public.delivery_liquidaciones, public.delivery_liquidacion_items TO service_role;
DROP POLICY IF EXISTS "Comercio y admin ven liquidaciones" ON public.delivery_liquidaciones;
CREATE POLICY "Comercio y admin ven liquidaciones" ON public.delivery_liquidaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
DROP POLICY IF EXISTS "Comercio y admin ven items de liquidaciones" ON public.delivery_liquidacion_items;
CREATE POLICY "Comercio y admin ven items de liquidaciones" ON public.delivery_liquidacion_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_liquidaciones l WHERE l.id = liquidacion_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = l.comercio_id AND c.propietario_id = auth.uid()))));

-- Líneas calculadas de los pedidos entregados y todavía sin liquidar (uso interno).
CREATE OR REPLACE FUNCTION public.delivery_finanzas_lineas(p_comercio uuid, p_hasta timestamptz)
RETURNS TABLE (pedido_id uuid, fecha timestamptz, tipo_entrega text, metodo_pago text, ventas numeric, descuento_comercio numeric, comision numeric, neto numeric, cobrado_directo numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.id, x.entregado_at, x.tipo_entrega, x.metodo_pago, x.subtotal, x.dcom,
         round((x.subtotal - x.dcom) * x.pct / 100), (x.subtotal - x.dcom) - round((x.subtotal - x.dcom) * x.pct / 100),
         x.directo, (x.subtotal - x.dcom) - round((x.subtotal - x.dcom) * x.pct / 100) - x.directo
  FROM (
    SELECT p.id, p.entregado_at, p.tipo_entrega, p.metodo_pago, p.subtotal,
           CASE WHEN cu.comercio_id IS NOT NULL THEN least(p.descuento, p.subtotal) ELSE 0 END AS dcom,
           c.comision_pct AS pct,
           CASE WHEN p.tipo_entrega = 'retiro' AND p.metodo_pago <> 'mercadopago' THEN p.total ELSE 0 END AS directo
    FROM public.delivery_pedidos p
    JOIN public.delivery_comercios c ON c.id = p.comercio_id
    LEFT JOIN LATERAL (
      SELECT k.comercio_id FROM public.delivery_cupones k
      WHERE p.cupon_codigo IS NOT NULL AND k.codigo = p.cupon_codigo AND (k.comercio_id = p.comercio_id OR k.comercio_id IS NULL)
      ORDER BY (k.comercio_id = p.comercio_id) DESC NULLS LAST LIMIT 1
    ) cu ON true
    WHERE p.comercio_id = p_comercio AND p.estado = 'entregado' AND p.liquidacion_id IS NULL
      AND p.entregado_at IS NOT NULL AND p.entregado_at < p_hasta
  ) x
$$;
REVOKE ALL ON FUNCTION public.delivery_finanzas_lineas(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_puede_ver_finanzas(p_comercio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = p_comercio AND c.propietario_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.delivery_puede_ver_finanzas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_puede_ver_finanzas(uuid) TO authenticated;

-- Resumen para el panel del comercio: lo acumulado sin liquidar y las últimas liquidaciones.
CREATE OR REPLACE FUNCTION public.delivery_finanzas_comercio(p_comercio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.delivery_puede_ver_finanzas(p_comercio) THEN RAISE EXCEPTION 'No tenés permiso sobre este comercio'; END IF;
  SELECT jsonb_build_object(
    'comision_pct', (SELECT comision_pct FROM public.delivery_comercios WHERE id = p_comercio),
    'pendiente', (SELECT jsonb_build_object(
        'pedidos', count(*), 'ventas', coalesce(sum(ventas), 0), 'descuentos', coalesce(sum(descuento_comercio), 0),
        'comision', coalesce(sum(comision), 0), 'neto', coalesce(sum(neto), 0), 'cobrado_directo', coalesce(sum(cobrado_directo), 0),
        'balance', coalesce(sum(balance), 0), 'desde', min(fecha))
      FROM public.delivery_finanzas_lineas(p_comercio, now())),
    'liquidaciones', (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
      FROM (SELECT id, desde, hasta, pedidos, ventas, descuentos_comercio, comision_pct, comision, neto, cobrado_directo, balance, estado, referencia, pagada_at, created_at
            FROM public.delivery_liquidaciones WHERE comercio_id = p_comercio ORDER BY created_at DESC LIMIT 36) l)
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_finanzas_comercio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_finanzas_comercio(uuid) TO authenticated;

-- Detalle de una liquidación, pedido por pedido.
CREATE OR REPLACE FUNCTION public.delivery_liquidacion_detalle(p_liquidacion uuid)
RETURNS TABLE (pedido_id uuid, fecha timestamptz, tipo_entrega text, metodo_pago text, ventas numeric, descuento_comercio numeric, comision numeric, neto numeric, cobrado_directo numeric, balance numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_comercio uuid;
BEGIN
  SELECT comercio_id INTO v_comercio FROM public.delivery_liquidaciones WHERE id = p_liquidacion;
  IF v_comercio IS NULL OR NOT public.delivery_puede_ver_finanzas(v_comercio) THEN RAISE EXCEPTION 'No tenés permiso sobre esta liquidación'; END IF;
  RETURN QUERY SELECT i.pedido_id, i.fecha, i.tipo_entrega, i.metodo_pago, i.ventas, i.descuento_comercio, i.comision, i.neto, i.cobrado_directo, i.balance
    FROM public.delivery_liquidacion_items i WHERE i.liquidacion_id = p_liquidacion ORDER BY i.fecha;
END $$;
REVOKE ALL ON FUNCTION public.delivery_liquidacion_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_liquidacion_detalle(uuid) TO authenticated;

-- Cierra el período de un comercio: congela las líneas pendientes en una liquidación.
CREATE OR REPLACE FUNCTION public.delivery_generar_liquidacion_interna(p_comercio uuid, p_hasta timestamptz, p_por uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_pct numeric;
  v_n integer; v_desde timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('liquidacion:' || p_comercio::text));
  SELECT comision_pct INTO v_pct FROM public.delivery_comercios WHERE id = p_comercio;
  CREATE TEMP TABLE IF NOT EXISTS tmp_lineas ON COMMIT DROP AS SELECT * FROM public.delivery_finanzas_lineas(p_comercio, p_hasta) WHERE false;
  TRUNCATE tmp_lineas;
  INSERT INTO tmp_lineas SELECT * FROM public.delivery_finanzas_lineas(p_comercio, p_hasta);
  SELECT count(*), min(fecha) INTO v_n, v_desde FROM tmp_lineas;
  IF v_n = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.delivery_liquidaciones (comercio_id, desde, hasta, pedidos, ventas, descuentos_comercio, comision_pct, comision, neto, cobrado_directo, balance, creado_por)
    SELECT p_comercio, v_desde, p_hasta, v_n, sum(ventas), sum(descuento_comercio), v_pct, sum(comision), sum(neto), sum(cobrado_directo), sum(balance), p_por FROM tmp_lineas
    RETURNING id INTO v_id;
  INSERT INTO public.delivery_liquidacion_items (liquidacion_id, pedido_id, fecha, tipo_entrega, metodo_pago, ventas, descuento_comercio, comision, neto, cobrado_directo, balance)
    SELECT v_id, pedido_id, fecha, tipo_entrega, metodo_pago, ventas, descuento_comercio, comision, neto, cobrado_directo, balance FROM tmp_lineas;
  UPDATE public.delivery_pedidos SET liquidacion_id = v_id WHERE id IN (SELECT pedido_id FROM tmp_lineas);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_generar_liquidacion_interna(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_generar_liquidacion(p_comercio uuid, p_hasta timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_hasta > now() THEN p_hasta := now(); END IF;
  RETURN public.delivery_generar_liquidacion_interna(p_comercio, p_hasta, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_generar_liquidacion(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_generar_liquidacion(uuid, timestamptz) TO authenticated;

-- Genera la liquidación de todos los comercios que tengan pedidos entregados sin liquidar.
CREATE OR REPLACE FUNCTION public.delivery_admin_generar_todas(p_hasta timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_total integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_hasta > now() THEN p_hasta := now(); END IF;
  FOR r IN SELECT DISTINCT comercio_id FROM public.delivery_pedidos WHERE estado = 'entregado' AND liquidacion_id IS NULL AND entregado_at < p_hasta LOOP
    IF public.delivery_generar_liquidacion_interna(r.comercio_id, p_hasta, auth.uid()) IS NOT NULL THEN v_total := v_total + 1; END IF;
  END LOOP;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_generar_todas(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_generar_todas(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_marcar_liquidacion(p_liquidacion uuid, p_referencia text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  UPDATE public.delivery_liquidaciones SET estado = 'pagada', pagada_at = now(), referencia = nullif(left(trim(coalesce(p_referencia, '')), 200), '')
    WHERE id = p_liquidacion AND estado = 'pendiente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa liquidación no existe o ya está saldada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_marcar_liquidacion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_marcar_liquidacion(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_comision(p_comercio uuid, p_pct numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 40 THEN RAISE EXCEPTION 'La comisión tiene que estar entre 0 y 40 %%'; END IF;
  UPDATE public.delivery_comercios SET comision_pct = p_pct WHERE id = p_comercio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comercio no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_comision(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_comision(uuid, numeric) TO authenticated;
