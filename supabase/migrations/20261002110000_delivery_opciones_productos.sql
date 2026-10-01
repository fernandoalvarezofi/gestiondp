-- Etapa 2: grupos de opciones por producto (tamaño, punto, extras), validados y cobrados en el servidor.

CREATE TABLE IF NOT EXISTS public.delivery_producto_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.delivery_productos(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 60),
  minimo integer NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  maximo integer NOT NULL DEFAULT 1 CHECK (maximo >= 1),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (maximo >= minimo)
);
CREATE INDEX IF NOT EXISTS delivery_producto_grupos_producto_idx ON public.delivery_producto_grupos(producto_id, orden);

CREATE TABLE IF NOT EXISTS public.delivery_producto_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.delivery_producto_grupos(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 60),
  precio_extra numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_extra >= 0),
  disponible boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_producto_opciones_grupo_idx ON public.delivery_producto_opciones(grupo_id, orden);

ALTER TABLE public.delivery_pedido_items ADD COLUMN IF NOT EXISTS opciones jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT SELECT ON public.delivery_producto_grupos, public.delivery_producto_opciones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_producto_grupos, public.delivery_producto_opciones TO authenticated;
GRANT ALL ON public.delivery_producto_grupos, public.delivery_producto_opciones TO service_role;
ALTER TABLE public.delivery_producto_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_producto_opciones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.delivery_es_duenio_producto(p_producto uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_productos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE p.id = p_producto AND (c.propietario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;
GRANT EXECUTE ON FUNCTION public.delivery_es_duenio_producto(uuid) TO authenticated;

CREATE POLICY "Grupos visibles" ON public.delivery_producto_grupos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dueños crean grupos" ON public.delivery_producto_grupos FOR INSERT TO authenticated WITH CHECK (public.delivery_es_duenio_producto(producto_id));
CREATE POLICY "Dueños editan grupos" ON public.delivery_producto_grupos FOR UPDATE TO authenticated USING (public.delivery_es_duenio_producto(producto_id)) WITH CHECK (public.delivery_es_duenio_producto(producto_id));
CREATE POLICY "Dueños borran grupos" ON public.delivery_producto_grupos FOR DELETE TO authenticated USING (public.delivery_es_duenio_producto(producto_id));

CREATE POLICY "Opciones visibles" ON public.delivery_producto_opciones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dueños crean opciones" ON public.delivery_producto_opciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.id = grupo_id AND public.delivery_es_duenio_producto(g.producto_id)));
CREATE POLICY "Dueños editan opciones" ON public.delivery_producto_opciones FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.id = grupo_id AND public.delivery_es_duenio_producto(g.producto_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.id = grupo_id AND public.delivery_es_duenio_producto(g.producto_id)));
CREATE POLICY "Dueños borran opciones" ON public.delivery_producto_opciones FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.id = grupo_id AND public.delivery_es_duenio_producto(g.producto_id)));

-- Valida las opciones elegidas para un producto y devuelve {extra, detalle}. Lanza error si no cumplen mínimos/máximos.
CREATE OR REPLACE FUNCTION public.delivery_resolver_opciones(p_producto uuid, p_opciones jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_ids uuid[] := ARRAY(SELECT DISTINCT (value #>> '{}')::uuid FROM jsonb_array_elements(coalesce(p_opciones, '[]'::jsonb)));
  v_grupo record;
  v_cantidad integer;
  v_extra numeric := 0;
  v_detalle jsonb := '[]'::jsonb;
  v_validas integer;
BEGIN
  SELECT count(*) INTO v_validas
  FROM public.delivery_producto_opciones o JOIN public.delivery_producto_grupos g ON g.id = o.grupo_id
  WHERE o.id = ANY(v_ids) AND g.producto_id = p_producto AND o.disponible;
  IF v_validas <> coalesce(array_length(v_ids, 1), 0) THEN
    RAISE EXCEPTION 'Una de las opciones elegidas ya no está disponible';
  END IF;

  FOR v_grupo IN SELECT * FROM public.delivery_producto_grupos WHERE producto_id = p_producto ORDER BY orden, created_at LOOP
    SELECT count(*) INTO v_cantidad FROM public.delivery_producto_opciones WHERE grupo_id = v_grupo.id AND id = ANY(v_ids);
    IF v_cantidad < v_grupo.minimo THEN RAISE EXCEPTION 'Elegí una opción en "%"', v_grupo.nombre; END IF;
    IF v_cantidad > v_grupo.maximo THEN RAISE EXCEPTION 'Podés elegir hasta % en "%"', v_grupo.maximo, v_grupo.nombre; END IF;
  END LOOP;

  SELECT coalesce(sum(o.precio_extra), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'grupo', g.nombre, 'nombre', o.nombre, 'precio', o.precio_extra) ORDER BY g.orden, g.created_at, o.orden, o.created_at), '[]'::jsonb)
    INTO v_extra, v_detalle
  FROM public.delivery_producto_opciones o JOIN public.delivery_producto_grupos g ON g.id = o.grupo_id
  WHERE o.id = ANY(v_ids);

  RETURN jsonb_build_object('extra', v_extra, 'detalle', v_detalle);
END $$;

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
  p_telefono text DEFAULT NULL
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
  IF p_direccion_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.delivery_direcciones d WHERE d.id = p_direccion_id AND d.perfil_id = v_uid) THEN
    p_direccion_id := NULL;
  END IF;

  -- Primera pasada: valida productos, stock total por producto y opciones; calcula el subtotal.
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

  v_envio := v_store.costo_envio;
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
    descuento, propina, total, metodo_pago, notas, cupon_codigo, entrega_estimada, telefono_contacto
  ) VALUES (
    v_uid, p_comercio, p_direccion_id, left(trim(p_direccion), 300), v_subtotal, v_envio, v_servicio,
    v_descuento, coalesce(p_propina, 0), greatest(v_subtotal + v_envio + v_servicio + coalesce(p_propina, 0) - v_descuento, 0),
    p_metodo_pago, nullif(left(trim(coalesce(p_notas, '')), 500), ''), v_cupon_codigo,
    now() + make_interval(mins => v_store.tiempo_max + 5), left(v_telefono, 30)
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

REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.delivery_resolver_opciones(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Opciones de ejemplo
DO $$
DECLARE v_prod record; v_grupo uuid;
BEGIN
  FOR v_prod IN SELECT p.id FROM public.delivery_productos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE c.slug = 'la-esquina-burger' AND p.categoria = 'Hamburguesas'
      AND NOT EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.producto_id = p.id) LOOP
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Punto de la carne', 1, 1, 0) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Jugosa', 0, 0), (v_grupo, 'A punto', 0, 1), (v_grupo, 'Bien cocida', 0, 2);
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Extras', 0, 3, 1) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Bacon', 900, 0), (v_grupo, 'Cheddar extra', 700, 1), (v_grupo, 'Huevo frito', 600, 2), (v_grupo, 'Papas grandes', 1500, 3);
  END LOOP;

  FOR v_prod IN SELECT p.id FROM public.delivery_productos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE c.slug = 'pizzeria-san-telmo' AND p.categoria = 'Pizzas'
      AND NOT EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.producto_id = p.id) LOOP
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Tamaño', 1, 1, 0) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Grande (8 porciones)', 0, 0), (v_grupo, 'Familiar (12 porciones)', 4500, 1);
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Agregados', 0, 2, 1) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Doble muzzarella', 1800, 0), (v_grupo, 'Aceitunas extra', 500, 1), (v_grupo, 'Borde relleno', 2500, 2);
  END LOOP;

  FOR v_prod IN SELECT p.id FROM public.delivery_productos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE c.slug = 'cafe-nomade' AND p.categoria = 'Cafetería'
      AND NOT EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.producto_id = p.id) LOOP
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Tamaño', 1, 1, 0) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Chico', 0, 0), (v_grupo, 'Grande', 800, 1);
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Leche', 1, 1, 1) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Entera', 0, 0), (v_grupo, 'Descremada', 0, 1), (v_grupo, 'De almendras', 600, 2);
  END LOOP;

  FOR v_prod IN SELECT p.id FROM public.delivery_productos p JOIN public.delivery_comercios c ON c.id = p.comercio_id
    WHERE c.slug = 'sushi-club-palermo'
      AND NOT EXISTS (SELECT 1 FROM public.delivery_producto_grupos g WHERE g.producto_id = p.id) LOOP
    INSERT INTO public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) VALUES (v_prod.id, 'Salsas', 0, 2, 0) RETURNING id INTO v_grupo;
    INSERT INTO public.delivery_producto_opciones (grupo_id, nombre, precio_extra, orden) VALUES (v_grupo, 'Soja', 0, 0), (v_grupo, 'Teriyaki', 400, 1), (v_grupo, 'Acevichada', 600, 2);
  END LOOP;
END $$;
