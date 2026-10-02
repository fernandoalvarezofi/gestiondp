-- Etapa 3: ubicación de comercios y direcciones, radio de entrega, costo por distancia y repartidor en vivo.

ALTER TABLE public.delivery_comercios
  ADD COLUMN IF NOT EXISTS latitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS radio_entrega_km numeric(5,2) NOT NULL DEFAULT 6 CHECK (radio_entrega_km > 0 AND radio_entrega_km <= 50),
  ADD COLUMN IF NOT EXISTS costo_por_km numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo_por_km >= 0);

ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS latitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS distancia_km numeric(6,2);

-- Distancia en línea recta (fórmula de Haversine), en km.
CREATE OR REPLACE FUNCTION public.delivery_distancia_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round((6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2) +
    cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2)
  )))::numeric, 2)
$$;
GRANT EXECUTE ON FUNCTION public.delivery_distancia_km(numeric, numeric, numeric, numeric) TO anon, authenticated;

-- Costo de envío según distancia: base + costo por km, redondeado a $10.
CREATE OR REPLACE FUNCTION public.delivery_costo_envio(p_base numeric, p_por_km numeric, p_km numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round((p_base + coalesce(p_por_km, 0) * coalesce(p_km, 0)) / 10) * 10
$$;
GRANT EXECUTE ON FUNCTION public.delivery_costo_envio(numeric, numeric, numeric) TO anon, authenticated;

-- Ubicación en vivo del repartidor
CREATE TABLE IF NOT EXISTS public.delivery_ubicaciones (
  repartidor_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  latitud numeric(10,7) NOT NULL,
  longitud numeric(10,7) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_ubicaciones TO authenticated;
GRANT ALL ON public.delivery_ubicaciones TO service_role;
ALTER TABLE public.delivery_ubicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repartidor publica su ubicación" ON public.delivery_ubicaciones FOR INSERT TO authenticated
  WITH CHECK (repartidor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = auth.uid() AND r.activo));
CREATE POLICY "Repartidor actualiza su ubicación" ON public.delivery_ubicaciones FOR UPDATE TO authenticated
  USING (repartidor_id = auth.uid()) WITH CHECK (repartidor_id = auth.uid());
-- La ven el propio repartidor, el admin, y el cliente o comercio de un pedido en curso que ese repartidor lleva.
CREATE POLICY "Ubicación visible para el pedido en curso" ON public.delivery_ubicaciones FOR SELECT TO authenticated
  USING (
    repartidor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.delivery_pedidos p
      LEFT JOIN public.delivery_comercios c ON c.id = p.comercio_id
      WHERE p.repartidor_id = delivery_ubicaciones.repartidor_id
        AND p.estado IN ('confirmado', 'preparando', 'en_camino')
        AND (p.cliente_id = auth.uid() OR c.propietario_id = auth.uid())
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_ubicaciones;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- Ubicación de los comercios de ejemplo (CABA)
UPDATE public.delivery_comercios c SET latitud = v.lat, longitud = v.lng
FROM (VALUES
  ('bebidas-ya', -34.57949, -58.42442), ('brunch-club', -34.58500, -58.43300), ('cafe-nomade', -34.58500, -58.43400),
  ('casa-y-mas', -34.58770, -58.42900), ('farma-vida', -34.55214, -58.46588), ('farmacia-central-24h', -34.60996, -58.40111),
  ('helados-polar', -34.56292, -58.45618), ('la-esquina-burger', -34.60420, -58.39269), ('la-nonna-pastas', -34.59193, -58.42675),
  ('mercado-fresco', -34.58864, -58.41089), ('moda-urbana', -34.59580, -58.39300), ('parrilla-don-ramon', -34.59350, -58.44000),
  ('pizzeria-san-telmo', -34.61653, -58.37162), ('pollo-crocante', -34.62046, -58.44104), ('sandwich-lab', -34.60426, -58.41310),
  ('super-ahorro-express', -34.58401, -58.40129), ('sushi-club-palermo', -34.58800, -58.43000), ('verde-bowl', -34.59530, -58.39343)
) AS v(slug, lat, lng)
WHERE c.slug = v.slug AND c.latitud IS NULL;

UPDATE public.delivery_comercios SET radio_entrega_km = 7, costo_por_km = 250 WHERE propietario_id IS NULL;
UPDATE public.delivery_comercios SET radio_entrega_km = 4, costo_por_km = 300 WHERE slug IN ('helados-polar', 'farma-vida');

-- ============================================================
-- Crear pedido: valida la zona y calcula el envío por distancia
-- ============================================================
DROP FUNCTION IF EXISTS public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text);

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
  p_longitud numeric DEFAULT NULL
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
  v_envio numeric;
  v_servicio numeric;
  v_descuento numeric := 0;
  v_cupon jsonb;
  v_cupon_codigo text;
  v_pedido uuid;
  v_telefono text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+ ()-]', '', 'g'), '');
  v_lat numeric := p_latitud;
  v_lng numeric := p_longitud;
  v_km numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión para pedir'; END IF;

  SELECT * INTO v_store FROM public.delivery_comercios WHERE id = p_comercio AND activo AND aprobado;
  IF NOT FOUND THEN RAISE EXCEPTION 'El comercio no está disponible'; END IF;
  IF NOT v_store.esta_abierto OR NOT public.delivery_abierto_ahora(v_store.horarios) THEN
    RAISE EXCEPTION 'El comercio está cerrado en este momento';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'El carrito está vacío'; END IF;
  IF jsonb_array_length(p_items) > 60 THEN RAISE EXCEPTION 'Demasiados productos en un solo pedido'; END IF;
  IF coalesce(trim(p_direccion), '') = '' THEN RAISE EXCEPTION 'Indicá una dirección de entrega'; END IF;
  IF v_telefono IS NULL OR length(regexp_replace(v_telefono, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'Indicá un teléfono de contacto válido';
  END IF;
  IF p_metodo_pago NOT IN ('efectivo', 'tarjeta', 'transferencia') THEN RAISE EXCEPTION 'Método de pago inválido'; END IF;
  IF coalesce(p_propina, 0) < 0 OR coalesce(p_propina, 0) > 100000 THEN RAISE EXCEPTION 'Propina inválida'; END IF;

  IF p_direccion_id IS NOT NULL THEN
    SELECT d.latitud, d.longitud INTO v_lat, v_lng FROM public.delivery_direcciones d WHERE d.id = p_direccion_id AND d.perfil_id = v_uid;
    IF NOT FOUND THEN p_direccion_id := NULL; v_lat := p_latitud; v_lng := p_longitud; END IF;
  END IF;

  -- Zona de entrega: si el comercio tiene ubicación, la dirección también tiene que tenerla y estar dentro del radio.
  IF v_store.latitud IS NOT NULL AND v_store.longitud IS NOT NULL THEN
    IF v_lat IS NULL OR v_lng IS NULL THEN
      RAISE EXCEPTION 'Marcá tu dirección en el mapa para calcular el envío';
    END IF;
    v_km := public.delivery_distancia_km(v_store.latitud, v_store.longitud, v_lat, v_lng);
    IF v_km > v_store.radio_entrega_km THEN
      RAISE EXCEPTION 'Este comercio no llega a tu dirección (está a % km y entrega hasta % km)', round(v_km, 1), v_store.radio_entrega_km;
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

  v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);
  IF v_store.envio_gratis_desde IS NOT NULL AND v_subtotal >= v_store.envio_gratis_desde THEN v_envio := 0; END IF;

  IF coalesce(trim(p_cupon), '') <> '' THEN
    v_cupon := public.delivery_validar_cupon(p_cupon, p_comercio, v_subtotal);
    IF NOT (v_cupon->>'valido')::boolean THEN RAISE EXCEPTION '%', v_cupon->>'mensaje'; END IF;
    v_cupon_codigo := v_cupon->>'codigo';
    v_descuento := (v_cupon->>'descuento')::numeric;
    IF (v_cupon->>'envio_gratis')::boolean THEN v_envio := 0; END IF;
    UPDATE public.delivery_cupones SET usos = usos + 1 WHERE codigo = v_cupon_codigo;
  END IF;

  v_servicio := round(v_subtotal * 0.05);

  INSERT INTO public.delivery_pedidos (
    cliente_id, comercio_id, direccion_id, direccion_entrega, subtotal, costo_envio, tarifa_servicio,
    descuento, propina, total, metodo_pago, notas, cupon_codigo, entrega_estimada, telefono_contacto,
    latitud, longitud, distancia_km
  ) VALUES (
    v_uid, p_comercio, p_direccion_id, left(trim(p_direccion), 300), v_subtotal, v_envio, v_servicio,
    v_descuento, coalesce(p_propina, 0), greatest(v_subtotal + v_envio + v_servicio + coalesce(p_propina, 0) - v_descuento, 0),
    p_metodo_pago, nullif(left(trim(coalesce(p_notas, '')), 500), ''), v_cupon_codigo,
    now() + make_interval(mins => v_store.tiempo_max + 5 + ceil(coalesce(v_km, 0) * 2)::int), left(v_telefono, 30),
    v_lat, v_lng, v_km
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

REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric) TO authenticated;
