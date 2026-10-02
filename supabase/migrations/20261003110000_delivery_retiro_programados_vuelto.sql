-- Etapa 6 (parte 2): retiro en el local, pedidos programados y efectivo con vuelto.
-- Todo se valida en el servidor: el cliente nunca decide precios, horarios ni permisos.

ALTER TABLE public.delivery_comercios
  ADD COLUMN IF NOT EXISTS acepta_retiro boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acepta_programados boolean NOT NULL DEFAULT true;

ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS programado_para timestamptz,
  ADD COLUMN IF NOT EXISTS efectivo_paga_con numeric(12,2),
  ADD COLUMN IF NOT EXISTS listo_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.delivery_pedidos ADD CONSTRAINT delivery_pedidos_tipo_entrega_check CHECK (tipo_entrega IN ('delivery', 'retiro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.delivery_pedidos ADD CONSTRAINT delivery_pedidos_paga_con_check CHECK (efectivo_paga_con IS NULL OR efectivo_paga_con >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS delivery_pedidos_programado_idx ON public.delivery_pedidos(programado_para) WHERE programado_para IS NOT NULL;

-- Margen antes de la hora programada desde el que el pedido le aparece a los repartidores.
CREATE OR REPLACE FUNCTION public.delivery_margen_programado() RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '50 minutes' $$;

-- ============================================================
-- Horarios disponibles para programar (franjas de 30 min, hasta 3 días)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_franjas(p_comercio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store public.delivery_comercios;
  v_slot timestamptz;
  v_out jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_store FROM public.delivery_comercios WHERE id = p_comercio AND activo AND aprobado;
  IF NOT FOUND OR NOT v_store.acepta_programados OR NOT v_store.esta_abierto THEN RETURN v_out; END IF;
  -- Argentina no usa horario de verano (UTC-3 fijo): redondear al múltiplo de 30 min del reloj UTC es correcto.
  v_slot := to_timestamp(ceil(extract(epoch FROM now() + interval '60 minutes') / 1800) * 1800);
  WHILE v_slot <= now() + interval '72 hours' LOOP
    IF public.delivery_abierto_ahora(v_store.horarios, v_slot) THEN
      v_out := v_out || to_jsonb(v_slot);
    END IF;
    v_slot := v_slot + interval '30 minutes';
  END LOOP;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_franjas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_franjas(uuid) TO anon, authenticated;

-- ============================================================
-- Crear pedido: tipo de entrega, programación y vuelto
-- ============================================================
DROP FUNCTION IF EXISTS public.delivery_crear_pedido_online(uuid, jsonb, text, uuid, numeric, text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.delivery_crear_pedido(
  p_comercio uuid,
  p_items jsonb,
  p_direccion text,
  p_direccion_id uuid DEFAULT NULL,
  p_metodo_pago text DEFAULT 'efectivo',
  p_propina numeric DEFAULT 0,
  p_cupon text DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_latitud numeric DEFAULT NULL,
  p_longitud numeric DEFAULT NULL,
  p_tipo_entrega text DEFAULT 'delivery',
  p_programado_para timestamptz DEFAULT NULL,
  p_paga_con numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_store public.delivery_comercios;
  v_item jsonb;
  v_prod public.delivery_productos;
  v_opciones jsonb;
  v_cantidad integer;
  v_subtotal numeric := 0;
  v_envio numeric := 0;
  v_servicio numeric;
  v_descuento numeric := 0;
  v_total numeric;
  v_cupon jsonb;
  v_cupon_codigo text;
  v_pedido uuid;
  v_telefono text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+ ()-]', '', 'g'), '');
  v_lat numeric := p_latitud;
  v_lng numeric := p_longitud;
  v_km numeric;
  v_retiro boolean := (p_tipo_entrega = 'retiro');
  v_direccion text;
  v_propina numeric := coalesce(p_propina, 0);
  v_estimada timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión para pedir'; END IF;
  IF p_tipo_entrega IS NULL OR p_tipo_entrega NOT IN ('delivery', 'retiro') THEN RAISE EXCEPTION 'Tipo de entrega inválido'; END IF;

  SELECT * INTO v_store FROM public.delivery_comercios WHERE id = p_comercio AND activo AND aprobado;
  IF NOT FOUND THEN RAISE EXCEPTION 'El comercio no está disponible'; END IF;
  IF v_retiro AND NOT v_store.acepta_retiro THEN RAISE EXCEPTION 'Este comercio no ofrece retiro en el local'; END IF;

  -- Horario: pedido inmediato (el comercio abierto ahora) o programado (abierto a esa hora).
  IF p_programado_para IS NULL THEN
    IF NOT v_store.esta_abierto OR NOT public.delivery_abierto_ahora(v_store.horarios) THEN
      RAISE EXCEPTION 'El comercio está cerrado en este momento';
    END IF;
  ELSE
    IF NOT v_store.acepta_programados THEN RAISE EXCEPTION 'Este comercio no acepta pedidos programados'; END IF;
    IF NOT v_store.esta_abierto THEN RAISE EXCEPTION 'El comercio pausó los pedidos por ahora'; END IF;
    IF p_programado_para < now() + interval '45 minutes' OR p_programado_para > now() + interval '72 hours' THEN
      RAISE EXCEPTION 'Elegí un horario entre dentro de 45 minutos y los próximos 3 días';
    END IF;
    IF NOT public.delivery_abierto_ahora(v_store.horarios, p_programado_para) THEN
      RAISE EXCEPTION 'El comercio está cerrado en ese horario';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'El carrito está vacío'; END IF;
  IF jsonb_array_length(p_items) > 60 THEN RAISE EXCEPTION 'Demasiados productos en un solo pedido'; END IF;
  IF v_telefono IS NULL OR length(regexp_replace(v_telefono, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'Indicá un teléfono de contacto válido';
  END IF;
  IF p_metodo_pago NOT IN ('efectivo', 'tarjeta', 'transferencia') THEN RAISE EXCEPTION 'Método de pago inválido'; END IF;
  IF v_propina < 0 OR v_propina > 100000 THEN RAISE EXCEPTION 'Propina inválida'; END IF;

  IF v_retiro THEN
    v_propina := 0;
    v_lat := NULL; v_lng := NULL; p_direccion_id := NULL;
    v_direccion := left('Retiro en ' || v_store.nombre || ' · ' || v_store.direccion, 300);
  ELSE
    IF coalesce(trim(p_direccion), '') = '' THEN RAISE EXCEPTION 'Indicá una dirección de entrega'; END IF;
    v_direccion := left(trim(p_direccion), 300);
    IF p_direccion_id IS NOT NULL THEN
      SELECT d.latitud, d.longitud INTO v_lat, v_lng FROM public.delivery_direcciones d WHERE d.id = p_direccion_id AND d.perfil_id = v_uid;
      IF NOT FOUND THEN p_direccion_id := NULL; v_lat := p_latitud; v_lng := p_longitud; END IF;
    END IF;
    -- Zona de entrega: si el comercio tiene ubicación, la dirección también tiene que tenerla y estar dentro del radio.
    IF v_store.latitud IS NOT NULL AND v_store.longitud IS NOT NULL THEN
      IF v_lat IS NULL OR v_lng IS NULL THEN RAISE EXCEPTION 'Marcá tu dirección en el mapa para calcular el envío'; END IF;
      v_km := public.delivery_distancia_km(v_store.latitud, v_store.longitud, v_lat, v_lng);
      IF v_km > v_store.radio_entrega_km THEN
        RAISE EXCEPTION 'Este comercio no llega a tu dirección (está a % km y entrega hasta % km)', round(v_km, 1), v_store.radio_entrega_km;
      END IF;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := (v_item->>'cantidad')::integer;
    IF v_cantidad IS NULL OR v_cantidad < 1 OR v_cantidad > 50 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
    SELECT * INTO v_prod FROM public.delivery_productos
      WHERE id = (v_item->>'producto_id')::uuid AND comercio_id = p_comercio FOR UPDATE;
    IF NOT FOUND OR NOT v_prod.disponible THEN RAISE EXCEPTION 'Un producto de tu carrito ya no está disponible'; END IF;
    IF v_prod.stock IS NOT NULL AND v_prod.stock < (
      SELECT sum((i->>'cantidad')::integer) FROM jsonb_array_elements(p_items) i WHERE (i->>'producto_id')::uuid = v_prod.id
    ) THEN RAISE EXCEPTION 'No hay stock suficiente de %', v_prod.nombre; END IF;
    v_opciones := public.delivery_resolver_opciones(v_prod.id, v_item->'opciones');
    v_subtotal := v_subtotal + (v_prod.precio + (v_opciones->>'extra')::numeric) * v_cantidad;
  END LOOP;

  IF v_subtotal < v_store.pedido_minimo THEN
    RAISE EXCEPTION 'El pedido mínimo de este comercio es $%', to_char(v_store.pedido_minimo, 'FM999G999G999');
  END IF;

  IF NOT v_retiro THEN
    v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);
    IF v_store.envio_gratis_desde IS NOT NULL AND v_subtotal >= v_store.envio_gratis_desde THEN v_envio := 0; END IF;
  END IF;

  IF coalesce(trim(p_cupon), '') <> '' THEN
    v_cupon := public.delivery_validar_cupon(p_cupon, p_comercio, v_subtotal);
    IF NOT (v_cupon->>'valido')::boolean THEN RAISE EXCEPTION '%', v_cupon->>'mensaje'; END IF;
    IF v_retiro AND coalesce((v_cupon->>'envio_gratis')::boolean, false) THEN RAISE EXCEPTION 'Ese cupón es solo para pedidos con envío'; END IF;
    v_cupon_codigo := v_cupon->>'codigo';
    v_descuento := (v_cupon->>'descuento')::numeric;
    IF coalesce((v_cupon->>'envio_gratis')::boolean, false) THEN v_envio := 0; END IF;
    UPDATE public.delivery_cupones SET usos = usos + 1 WHERE codigo = v_cupon_codigo;
  END IF;

  v_servicio := round(v_subtotal * 0.05);
  v_total := greatest(v_subtotal + v_envio + v_servicio + v_propina - v_descuento, 0);

  -- Vuelto: solo con efectivo, y el billete tiene que cubrir el total calculado por el servidor.
  IF p_paga_con IS NOT NULL THEN
    IF p_metodo_pago <> 'efectivo' THEN RAISE EXCEPTION 'El vuelto solo aplica a pagos en efectivo'; END IF;
    IF p_paga_con < v_total THEN RAISE EXCEPTION 'El monto con el que pagás tiene que cubrir el total ($%)', to_char(v_total, 'FM999G999G999'); END IF;
    IF p_paga_con > v_total + 500000 THEN RAISE EXCEPTION 'El monto con el que pagás es demasiado alto'; END IF;
  END IF;

  v_estimada := coalesce(
    p_programado_para,
    now() + make_interval(mins => v_store.tiempo_max + CASE WHEN v_retiro THEN 0 ELSE 5 + ceil(coalesce(v_km, 0) * 2)::int END)
  );

  INSERT INTO public.delivery_pedidos (
    cliente_id, comercio_id, direccion_id, direccion_entrega, subtotal, costo_envio, tarifa_servicio,
    descuento, propina, total, metodo_pago, notas, cupon_codigo, entrega_estimada, telefono_contacto,
    latitud, longitud, distancia_km, tipo_entrega, programado_para, efectivo_paga_con
  ) VALUES (
    v_uid, p_comercio, p_direccion_id, v_direccion, v_subtotal, v_envio, v_servicio,
    v_descuento, v_propina, v_total, p_metodo_pago, nullif(left(trim(coalesce(p_notas, '')), 500), ''), v_cupon_codigo,
    v_estimada, left(v_telefono, 30), v_lat, v_lng, v_km, p_tipo_entrega, p_programado_para, p_paga_con
  ) RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := (v_item->>'cantidad')::integer;
    SELECT * INTO v_prod FROM public.delivery_productos WHERE id = (v_item->>'producto_id')::uuid;
    v_opciones := public.delivery_resolver_opciones(v_prod.id, v_item->'opciones');
    INSERT INTO public.delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad, notas, opciones)
      VALUES (v_pedido, v_prod.id, v_prod.nombre, v_prod.precio + (v_opciones->>'extra')::numeric, v_cantidad,
              nullif(left(trim(coalesce(v_item->>'notas', '')), 200), ''), v_opciones->'detalle');
    IF v_prod.stock IS NOT NULL THEN
      UPDATE public.delivery_productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    END IF;
  END LOOP;

  INSERT INTO public.delivery_pedido_codigos (pedido_id, codigo)
    VALUES (v_pedido, lpad(floor(random() * 10000)::integer::text, 4, '0'));

  UPDATE public.perfiles SET telefono = left(v_telefono, 30) WHERE id = v_uid AND telefono IS DISTINCT FROM left(v_telefono, 30);

  RETURN v_pedido;
END $$;

REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_crear_pedido_online(
  p_comercio uuid,
  p_items jsonb,
  p_direccion text,
  p_direccion_id uuid DEFAULT NULL,
  p_propina numeric DEFAULT 0,
  p_cupon text DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_latitud numeric DEFAULT NULL,
  p_longitud numeric DEFAULT NULL,
  p_tipo_entrega text DEFAULT 'delivery',
  p_programado_para timestamptz DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido uuid;
BEGIN
  IF NOT public.delivery_pagos_online_activos() THEN RAISE EXCEPTION 'El pago online no está disponible por ahora'; END IF;
  PERFORM set_config('woref.pago_online', '1', true);
  v_pedido := public.delivery_crear_pedido(p_comercio, p_items, p_direccion, p_direccion_id, 'efectivo', p_propina, p_cupon, p_notas, p_telefono, p_latitud, p_longitud, p_tipo_entrega, p_programado_para, NULL);
  PERFORM set_config('woref.pago_online', '', true);
  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.delivery_crear_pedido_online(uuid, jsonb, text, uuid, numeric, text, text, text, numeric, numeric, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido_online(uuid, jsonb, text, uuid, numeric, text, text, text, numeric, numeric, text, timestamptz) TO authenticated;

-- ============================================================
-- Cambios de estado: flujo de retiro y cancelación de programados
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_actualizar_estado(
  p_pedido uuid,
  p_estado public.delivery_estado_pedido,
  p_motivo text DEFAULT NULL,
  p_codigo text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  p public.delivery_pedidos;
  v_owner uuid;
  v_ok boolean := false;
  v_retiro boolean;
  v_pide_codigo boolean := false;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p.estado IN ('entregado', 'cancelado') THEN RAISE EXCEPTION 'El pedido ya está cerrado'; END IF;
  v_retiro := p.tipo_entrega = 'retiro';
  SELECT propietario_id INTO v_owner FROM public.delivery_comercios WHERE id = p.comercio_id;

  IF public.has_role(v_uid, 'admin'::app_role) THEN
    v_ok := true;
  ELSIF v_uid = v_owner THEN
    IF v_retiro THEN
      v_ok := (p.estado = 'pendiente' AND p_estado IN ('confirmado', 'cancelado'))
           OR (p.estado = 'confirmado' AND p_estado IN ('preparando', 'cancelado'))
           OR (p.estado = 'preparando' AND p_estado IN ('listo', 'cancelado'))
           OR (p.estado = 'listo' AND p_estado = 'entregado');
      v_pide_codigo := v_ok AND p_estado = 'entregado';
    ELSE
      v_ok := (p.estado = 'pendiente' AND p_estado IN ('confirmado', 'cancelado'))
           OR (p.estado = 'confirmado' AND p_estado IN ('preparando', 'cancelado'))
           OR (p.estado = 'preparando' AND p_estado = 'en_camino' AND p.repartidor_id IS NULL)
           OR (p.estado = 'en_camino' AND p_estado = 'entregado' AND p.repartidor_id IS NULL);
    END IF;
  ELSIF v_uid = p.repartidor_id AND NOT v_retiro THEN
    v_ok := (p.estado IN ('confirmado', 'preparando') AND p_estado = 'en_camino')
         OR (p.estado = 'en_camino' AND p_estado = 'entregado');
    v_pide_codigo := v_ok AND p_estado = 'entregado';
  ELSIF v_uid = p.cliente_id THEN
    -- Antes de que lo acepten, siempre. Un programado ya aceptado, hasta 1 hora antes.
    v_ok := p_estado = 'cancelado' AND (
      p.estado = 'pendiente'
      OR (p.estado = 'confirmado' AND p.programado_para IS NOT NULL AND p.programado_para > now() + interval '60 minutes')
    );
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'No podés realizar este cambio en el pedido'; END IF;

  IF v_pide_codigo AND NOT EXISTS (
    SELECT 1 FROM public.delivery_pedido_codigos c WHERE c.pedido_id = p.id AND c.codigo = trim(coalesce(p_codigo, ''))
  ) THEN
    RAISE EXCEPTION 'El código de entrega no coincide. Pedíselo al cliente.';
  END IF;

  UPDATE public.delivery_pedidos SET
    estado = p_estado,
    confirmado_at = CASE WHEN p_estado = 'confirmado' THEN now() ELSE confirmado_at END,
    preparando_at = CASE WHEN p_estado = 'preparando' THEN now() ELSE preparando_at END,
    listo_at = CASE WHEN p_estado = 'listo' THEN now() ELSE listo_at END,
    en_camino_at = CASE WHEN p_estado = 'en_camino' THEN now() ELSE en_camino_at END,
    entregado_at = CASE WHEN p_estado = 'entregado' THEN now() ELSE entregado_at END,
    cancelado_at = CASE WHEN p_estado = 'cancelado' THEN now() ELSE cancelado_at END,
    motivo_cancelacion = CASE WHEN p_estado = 'cancelado' THEN nullif(left(trim(coalesce(p_motivo, '')), 300), '') ELSE motivo_cancelacion END
  WHERE id = p_pedido;

  IF p_estado = 'cancelado' THEN
    UPDATE public.delivery_productos dp SET stock = dp.stock + i.total
    FROM (SELECT producto_id, sum(cantidad) AS total FROM public.delivery_pedido_items WHERE pedido_id = p_pedido GROUP BY producto_id) i
    WHERE dp.id = i.producto_id AND dp.stock IS NOT NULL;
    IF p.cupon_codigo IS NOT NULL THEN
      UPDATE public.delivery_cupones SET usos = greatest(usos - 1, 0) WHERE codigo = p.cupon_codigo;
    END IF;
  END IF;
END $$;

-- ============================================================
-- Repartidores: solo pedidos con envío y, si son programados, cuando ya se acerca la hora
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_tomar_pedido(p_pedido uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = auth.uid() AND activo) THEN
    RAISE EXCEPTION 'Primero activá tu perfil de repartidor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_pedidos WHERE repartidor_id = auth.uid() AND estado IN ('confirmado', 'preparando', 'en_camino')) THEN
    RAISE EXCEPTION 'Ya tenés un pedido en curso';
  END IF;
  UPDATE public.delivery_pedidos SET repartidor_id = auth.uid()
    WHERE id = p_pedido AND repartidor_id IS NULL AND estado IN ('confirmado', 'preparando')
      AND tipo_entrega = 'delivery'
      AND (programado_para IS NULL OR programado_para <= now() + public.delivery_margen_programado())
      AND pago_estado NOT IN ('pendiente', 'rechazado');
  IF NOT FOUND THEN RAISE EXCEPTION 'Otro repartidor ya tomó este pedido'; END IF;
END $$;

DROP POLICY IF EXISTS "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos;
CREATE POLICY "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (
    repartidor_id = auth.uid()
    OR (repartidor_id IS NULL AND estado IN ('confirmado', 'preparando') AND tipo_entrega = 'delivery'
        AND (programado_para IS NULL OR programado_para <= now() + public.delivery_margen_programado())
        AND pago_estado NOT IN ('pendiente', 'rechazado')
        AND EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = auth.uid() AND r.activo))
  );
