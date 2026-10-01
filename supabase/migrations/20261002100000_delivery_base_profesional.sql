-- Etapa 1: fotos en Storage, horarios automáticos, aprobación de comercios y teléfono de contacto.

-- ============================================================
-- Fotos: bucket público, cada usuario sube solo a su carpeta
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery', 'delivery', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Fotos delivery visibles" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios suben fotos a su carpeta" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios reemplazan sus fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios borran sus fotos" ON storage.objects;
CREATE POLICY "Fotos delivery visibles" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'delivery');
CREATE POLICY "Usuarios suben fotos a su carpeta" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Usuarios reemplazan sus fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'delivery' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Usuarios borran sus fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'delivery' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Horarios por día y aprobación de comercios
-- ============================================================
-- horarios: {"0": [{"abre": "10:00", "cierra": "23:00"}], ..., "6": [...]} (0 = domingo).
-- Un día sin turnos está cerrado. NULL = sin horario cargado (manda solo el interruptor esta_abierto).
ALTER TABLE public.delivery_comercios
  ADD COLUMN IF NOT EXISTS horarios jsonb,
  ADD COLUMN IF NOT EXISTS aprobado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE public.delivery_pedidos ADD COLUMN IF NOT EXISTS telefono_contacto text;

CREATE OR REPLACE FUNCTION public.delivery_abierto_ahora(p_horarios jsonb, p_momento timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_local timestamp := p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_hoy text := extract(dow FROM v_local)::int::text;
  v_ayer text := ((extract(dow FROM v_local)::int + 6) % 7)::text;
  v_hora time := v_local::time;
  v_turno jsonb;
  v_abre time;
  v_cierra time;
BEGIN
  IF p_horarios IS NULL THEN RETURN true; END IF;
  FOR v_turno IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios->v_hoy, '[]'::jsonb)) LOOP
    v_abre := (v_turno->>'abre')::time;
    v_cierra := (v_turno->>'cierra')::time;
    IF v_cierra > v_abre AND v_hora >= v_abre AND v_hora < v_cierra THEN RETURN true; END IF;
    IF v_cierra <= v_abre AND v_hora >= v_abre THEN RETURN true; END IF;
  END LOOP;
  -- Turnos de ayer que cruzan la medianoche (ej. 20:00 a 02:00)
  FOR v_turno IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios->v_ayer, '[]'::jsonb)) LOOP
    v_abre := (v_turno->>'abre')::time;
    v_cierra := (v_turno->>'cierra')::time;
    IF v_cierra <= v_abre AND v_hora < v_cierra THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.delivery_abierto_ahora(jsonb, timestamptz) TO anon, authenticated;

-- Los comercios nuevos creados por usuarios quedan pendientes de aprobación.
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
    ELSE
      NEW.rating := OLD.rating;
      NEW.total_resenas := OLD.total_resenas;
      NEW.destacado := OLD.destacado;
      NEW.activo := OLD.activo;
      NEW.aprobado := OLD.aprobado;
      NEW.motivo_rechazo := OLD.motivo_rechazo;
      NEW.propietario_id := OLD.propietario_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS "Comercios visibles para todos" ON public.delivery_comercios;
CREATE POLICY "Comercios visibles para todos" ON public.delivery_comercios FOR SELECT TO anon, authenticated
  USING ((activo AND aprobado) OR propietario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Horarios de ejemplo para los comercios cargados
UPDATE public.delivery_comercios SET horarios = (
  SELECT jsonb_object_agg(d::text, jsonb_build_array(jsonb_build_object('abre', '08:00', 'cierra', '23:59')))
  FROM generate_series(0, 6) d
) WHERE horarios IS NULL AND propietario_id IS NULL;

-- ============================================================
-- Crear pedido: ahora valida horario, aprobación y guarda teléfono de contacto
-- ============================================================
DROP FUNCTION IF EXISTS public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text);

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
  v_cantidad integer;
  v_subtotal numeric := 0;
  v_envio numeric;
  v_servicio numeric;
  v_descuento numeric := 0;
  v_cupon jsonb;
  v_cupon_codigo text;
  v_pedido uuid;
  v_telefono text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+ ]', '', 'g'), '');
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := (v_item->>'cantidad')::integer;
    IF v_cantidad IS NULL OR v_cantidad < 1 OR v_cantidad > 50 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
    SELECT * INTO v_prod FROM public.delivery_productos
      WHERE id = (v_item->>'producto_id')::uuid AND comercio_id = p_comercio FOR UPDATE;
    IF NOT FOUND OR NOT v_prod.disponible THEN RAISE EXCEPTION 'Un producto de tu carrito ya no está disponible'; END IF;
    IF v_prod.stock IS NOT NULL AND v_prod.stock < v_cantidad THEN RAISE EXCEPTION 'No hay stock suficiente de %', v_prod.nombre; END IF;
    v_subtotal := v_subtotal + v_prod.precio * v_cantidad;
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
    INSERT INTO public.delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad, notas)
      VALUES (v_pedido, v_prod.id, v_prod.nombre, v_prod.precio, v_cantidad, nullif(left(trim(coalesce(v_item->>'notas', '')), 200), ''));
    IF v_prod.stock IS NOT NULL THEN
      UPDATE public.delivery_productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    END IF;
  END LOOP;

  INSERT INTO public.delivery_pedido_codigos (pedido_id, codigo)
    VALUES (v_pedido, lpad(floor(random() * 10000)::integer::text, 4, '0'));

  -- Guarda el teléfono en el perfil para el próximo pedido
  UPDATE public.perfiles SET telefono = left(v_telefono, 30) WHERE id = v_uid AND telefono IS DISTINCT FROM left(v_telefono, 30);

  RETURN v_pedido;
END $$;

REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text) TO authenticated;

-- Aprobación o rechazo de comercios por un admin
CREATE OR REPLACE FUNCTION public.delivery_moderar_comercio(p_comercio uuid, p_aprobado boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo un administrador puede aprobar comercios'; END IF;
  UPDATE public.delivery_comercios
    SET aprobado = p_aprobado, motivo_rechazo = CASE WHEN p_aprobado THEN NULL ELSE nullif(left(trim(coalesce(p_motivo, '')), 300), '') END
  WHERE id = p_comercio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comercio no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_moderar_comercio(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_moderar_comercio(uuid, boolean, text) TO authenticated;
