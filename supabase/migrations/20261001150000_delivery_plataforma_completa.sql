-- Plataforma de entregas completa: pedidos validados en el servidor, cupones, reseñas,
-- favoritos, repartidores, panel de administración y catálogo ampliado.

-- ============================================================
-- Columnas nuevas
-- ============================================================
ALTER TABLE public.delivery_comercios
  ADD COLUMN IF NOT EXISTS rubro text,
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS horario text NOT NULL DEFAULT 'Todos los días de 10 a 23 h',
  ADD COLUMN IF NOT EXISTS promo_texto text,
  ADD COLUMN IF NOT EXISTS envio_gratis_desde numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_resenas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS descuento numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS propina numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_servicio numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cupon_codigo text,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
  ADD COLUMN IF NOT EXISTS calificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparando_at timestamptz,
  ADD COLUMN IF NOT EXISTS en_camino_at timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS repartidor_id uuid;

DO $$ BEGIN
  ALTER TABLE public.delivery_pedidos
    ADD CONSTRAINT delivery_pedidos_repartidor_id_fkey FOREIGN KEY (repartidor_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS delivery_pedidos_repartidor_idx ON public.delivery_pedidos(repartidor_id, estado);
CREATE INDEX IF NOT EXISTS delivery_pedidos_estado_idx ON public.delivery_pedidos(estado, created_at DESC);

-- ============================================================
-- Tablas nuevas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_pedido_codigos (
  pedido_id uuid PRIMARY KEY REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  codigo text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.delivery_resenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL UNIQUE REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  puntaje integer NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario text,
  respuesta text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_resenas_comercio_idx ON public.delivery_resenas(comercio_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_favoritos (
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, comercio_id)
);

CREATE TABLE IF NOT EXISTS public.delivery_cupones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo = upper(codigo) AND length(codigo) BETWEEN 3 AND 30),
  descripcion text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('porcentaje', 'monto', 'envio_gratis')),
  valor numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  tope numeric(12,2),
  minimo numeric(12,2) NOT NULL DEFAULT 0,
  comercio_id uuid REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  un_uso_por_cliente boolean NOT NULL DEFAULT true,
  usos_max integer,
  usos integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  vence_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_repartidores (
  perfil_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  vehiculo text NOT NULL DEFAULT 'moto' CHECK (vehiculo IN ('bici', 'moto', 'auto', 'a_pie')),
  telefono text,
  disponible boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_pedido_codigos TO authenticated;
GRANT SELECT ON public.delivery_resenas TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.delivery_favoritos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_cupones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_repartidores TO authenticated;
GRANT ALL ON public.delivery_pedido_codigos, public.delivery_resenas, public.delivery_favoritos, public.delivery_cupones, public.delivery_repartidores TO service_role;

ALTER TABLE public.delivery_pedido_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_resenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_repartidores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas
-- ============================================================
-- Los pedidos y sus ítems solo se crean y modifican mediante funciones del servidor,
-- así los precios, totales y estados no pueden manipularse desde el navegador.
DROP POLICY IF EXISTS "Clientes crean pedidos" ON public.delivery_pedidos;
DROP POLICY IF EXISTS "Clientes cancelan pendientes" ON public.delivery_pedidos;
DROP POLICY IF EXISTS "Comercios actualizan pedidos" ON public.delivery_pedidos;
DROP POLICY IF EXISTS "Clientes agregan items a sus pedidos" ON public.delivery_pedido_items;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_pedidos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_pedido_items FROM authenticated;

CREATE POLICY "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (
    repartidor_id = auth.uid()
    OR (repartidor_id IS NULL AND estado IN ('confirmado', 'preparando')
        AND EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = auth.uid() AND r.activo))
  );
CREATE POLICY "Admins ven todos los pedidos" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Repartidores ven items de pedidos visibles" ON public.delivery_pedido_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_pedidos p WHERE p.id = pedido_id AND (
      p.repartidor_id = auth.uid()
      OR (p.repartidor_id IS NULL AND p.estado IN ('confirmado', 'preparando')
          AND EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = auth.uid() AND r.activo))
    )
  ));
CREATE POLICY "Admins ven todos los items" ON public.delivery_pedido_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercios visibles para todos" ON public.delivery_comercios;
CREATE POLICY "Comercios visibles para todos" ON public.delivery_comercios FOR SELECT TO anon, authenticated
  USING (activo OR propietario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins administran comercios" ON public.delivery_comercios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins administran productos" ON public.delivery_productos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clientes ven el código de sus pedidos" ON public.delivery_pedido_codigos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.id = pedido_id AND p.cliente_id = auth.uid()));

CREATE POLICY "Reseñas visibles para todos" ON public.delivery_resenas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Usuarios ven sus favoritos" ON public.delivery_favoritos FOR SELECT TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "Usuarios agregan favoritos" ON public.delivery_favoritos FOR INSERT TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "Usuarios quitan favoritos" ON public.delivery_favoritos FOR DELETE TO authenticated USING (perfil_id = auth.uid());

CREATE POLICY "Cupones activos visibles" ON public.delivery_cupones FOR SELECT TO authenticated
  USING (
    activo
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())
  );
CREATE POLICY "Comercios y admins crean cupones" ON public.delivery_cupones FOR INSERT TO authenticated
  WITH CHECK (
    (comercio_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND (c.propietario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
  );
CREATE POLICY "Comercios y admins editan cupones" ON public.delivery_cupones FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())
  );
CREATE POLICY "Comercios y admins eliminan cupones" ON public.delivery_cupones FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())
  );

CREATE POLICY "Repartidores ven su perfil" ON public.delivery_repartidores FOR SELECT TO authenticated
  USING (perfil_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuarios se registran como repartidores" ON public.delivery_repartidores FOR INSERT TO authenticated
  WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "Repartidores editan su perfil" ON public.delivery_repartidores FOR UPDATE TO authenticated
  USING (perfil_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (perfil_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Protecciones: campos que solo el sistema o un admin pueden tocar
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_proteger_comercio()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating := 0;
      NEW.total_resenas := 0;
      NEW.destacado := false;
      NEW.activo := true;
    ELSE
      NEW.rating := OLD.rating;
      NEW.total_resenas := OLD.total_resenas;
      NEW.destacado := OLD.destacado;
      NEW.activo := OLD.activo;
      NEW.propietario_id := OLD.propietario_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS delivery_comercios_proteger ON public.delivery_comercios;
CREATE TRIGGER delivery_comercios_proteger BEFORE INSERT OR UPDATE ON public.delivery_comercios
  FOR EACH ROW EXECUTE FUNCTION public.delivery_proteger_comercio();

CREATE OR REPLACE FUNCTION public.delivery_proteger_repartidor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN NEW.activo := true; ELSE NEW.activo := OLD.activo; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS delivery_repartidores_proteger ON public.delivery_repartidores;
CREATE TRIGGER delivery_repartidores_proteger BEFORE INSERT OR UPDATE ON public.delivery_repartidores
  FOR EACH ROW EXECUTE FUNCTION public.delivery_proteger_repartidor();

CREATE OR REPLACE FUNCTION public.delivery_proteger_cupon()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.codigo := upper(trim(NEW.codigo));
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.usos := 0; ELSE NEW.usos := OLD.usos; NEW.comercio_id := OLD.comercio_id; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS delivery_cupones_proteger ON public.delivery_cupones;
CREATE TRIGGER delivery_cupones_proteger BEFORE INSERT OR UPDATE ON public.delivery_cupones
  FOR EACH ROW EXECUTE FUNCTION public.delivery_proteger_cupon();

-- ============================================================
-- Funciones del servidor
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_validar_cupon(p_codigo text, p_comercio uuid, p_subtotal numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.delivery_cupones;
  v_descuento numeric := 0;
  v_envio boolean := false;
BEGIN
  SELECT * INTO c FROM public.delivery_cupones WHERE codigo = upper(trim(p_codigo)) AND activo LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón no existe o no está activo'); END IF;
  IF c.vence_at IS NOT NULL AND c.vence_at < now() THEN RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón venció'); END IF;
  IF c.comercio_id IS NOT NULL AND c.comercio_id <> p_comercio THEN RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón no aplica a este comercio'); END IF;
  IF c.usos_max IS NOT NULL AND c.usos >= c.usos_max THEN RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón alcanzó su límite de usos'); END IF;
  IF p_subtotal < c.minimo THEN RETURN jsonb_build_object('valido', false, 'mensaje', 'Compra mínima de $' || to_char(c.minimo, 'FM999G999G999')); END IF;
  IF c.un_uso_por_cliente AND EXISTS (
    SELECT 1 FROM public.delivery_pedidos p WHERE p.cliente_id = auth.uid() AND p.cupon_codigo = c.codigo AND p.estado <> 'cancelado'
  ) THEN
    RETURN jsonb_build_object('valido', false, 'mensaje', 'Ya usaste este cupón');
  END IF;

  IF c.tipo = 'porcentaje' THEN
    v_descuento := round(p_subtotal * c.valor / 100);
    IF c.tope IS NOT NULL THEN v_descuento := least(v_descuento, c.tope); END IF;
  ELSIF c.tipo = 'monto' THEN
    v_descuento := least(c.valor, p_subtotal);
  ELSE
    v_envio := true;
  END IF;

  RETURN jsonb_build_object('valido', true, 'codigo', c.codigo, 'descuento', v_descuento, 'envio_gratis', v_envio, 'mensaje', c.descripcion);
END $$;

CREATE OR REPLACE FUNCTION public.delivery_crear_pedido(
  p_comercio uuid,
  p_items jsonb,
  p_direccion text,
  p_direccion_id uuid DEFAULT NULL,
  p_metodo_pago text DEFAULT 'efectivo',
  p_propina numeric DEFAULT 0,
  p_cupon text DEFAULT NULL,
  p_notas text DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión para pedir'; END IF;

  SELECT * INTO v_store FROM public.delivery_comercios WHERE id = p_comercio AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'El comercio no está disponible'; END IF;
  IF NOT v_store.esta_abierto THEN RAISE EXCEPTION 'El comercio está cerrado en este momento'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'El carrito está vacío'; END IF;
  IF jsonb_array_length(p_items) > 60 THEN RAISE EXCEPTION 'Demasiados productos en un solo pedido'; END IF;
  IF coalesce(trim(p_direccion), '') = '' THEN RAISE EXCEPTION 'Indicá una dirección de entrega'; END IF;
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
    descuento, propina, total, metodo_pago, notas, cupon_codigo, entrega_estimada
  ) VALUES (
    v_uid, p_comercio, p_direccion_id, left(trim(p_direccion), 300), v_subtotal, v_envio, v_servicio,
    v_descuento, coalesce(p_propina, 0), greatest(v_subtotal + v_envio + v_servicio + coalesce(p_propina, 0) - v_descuento, 0),
    p_metodo_pago, nullif(left(trim(coalesce(p_notas, '')), 500), ''), v_cupon_codigo,
    now() + make_interval(mins => v_store.tiempo_max + 5)
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

  RETURN v_pedido;
END $$;

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
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p.estado IN ('entregado', 'cancelado') THEN RAISE EXCEPTION 'El pedido ya está cerrado'; END IF;
  SELECT propietario_id INTO v_owner FROM public.delivery_comercios WHERE id = p.comercio_id;

  IF public.has_role(v_uid, 'admin'::app_role) THEN
    v_ok := true;
  ELSIF v_uid = v_owner THEN
    v_ok := (p.estado = 'pendiente' AND p_estado IN ('confirmado', 'cancelado'))
         OR (p.estado = 'confirmado' AND p_estado IN ('preparando', 'cancelado'))
         OR (p.estado = 'preparando' AND p_estado = 'en_camino' AND p.repartidor_id IS NULL)
         OR (p.estado = 'en_camino' AND p_estado = 'entregado' AND p.repartidor_id IS NULL);
  ELSIF v_uid = p.repartidor_id THEN
    v_ok := (p.estado IN ('confirmado', 'preparando') AND p_estado = 'en_camino')
         OR (p.estado = 'en_camino' AND p_estado = 'entregado');
    IF v_ok AND p_estado = 'entregado' AND NOT EXISTS (
      SELECT 1 FROM public.delivery_pedido_codigos c WHERE c.pedido_id = p.id AND c.codigo = trim(coalesce(p_codigo, ''))
    ) THEN
      RAISE EXCEPTION 'El código de entrega no coincide. Pedíselo al cliente.';
    END IF;
  ELSIF v_uid = p.cliente_id THEN
    v_ok := p.estado = 'pendiente' AND p_estado = 'cancelado';
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'No podés realizar este cambio en el pedido'; END IF;

  UPDATE public.delivery_pedidos SET
    estado = p_estado,
    confirmado_at = CASE WHEN p_estado = 'confirmado' THEN now() ELSE confirmado_at END,
    preparando_at = CASE WHEN p_estado = 'preparando' THEN now() ELSE preparando_at END,
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
    WHERE id = p_pedido AND repartidor_id IS NULL AND estado IN ('confirmado', 'preparando');
  IF NOT FOUND THEN RAISE EXCEPTION 'Otro repartidor ya tomó este pedido'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_calificar(p_pedido uuid, p_puntaje integer, p_comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.delivery_pedidos;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido AND cliente_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p.estado <> 'entregado' THEN RAISE EXCEPTION 'Podés calificar cuando recibas el pedido'; END IF;
  IF p.calificado THEN RAISE EXCEPTION 'Ya calificaste este pedido'; END IF;
  IF p_puntaje IS NULL OR p_puntaje < 1 OR p_puntaje > 5 THEN RAISE EXCEPTION 'La calificación va de 1 a 5'; END IF;

  INSERT INTO public.delivery_resenas (pedido_id, comercio_id, cliente_id, puntaje, comentario)
    VALUES (p.id, p.comercio_id, p.cliente_id, p_puntaje, nullif(left(trim(coalesce(p_comentario, '')), 500), ''));
  UPDATE public.delivery_pedidos SET calificado = true WHERE id = p.id;
  UPDATE public.delivery_comercios c SET
    rating = round((c.rating * c.total_resenas + p_puntaje)::numeric / (c.total_resenas + 1), 1),
    total_resenas = c.total_resenas + 1
  WHERE c.id = p.comercio_id;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_responder_resena(p_resena uuid, p_respuesta text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.delivery_resenas r SET respuesta = nullif(left(trim(coalesce(p_respuesta, '')), 500), '')
  WHERE r.id = p_resena AND EXISTS (
    SELECT 1 FROM public.delivery_comercios c WHERE c.id = r.comercio_id
      AND (c.propietario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés responder esta reseña'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.delivery_validar_cupon(text, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_actualizar_estado(uuid, public.delivery_estado_pedido, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_tomar_pedido(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_calificar(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_responder_resena(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_validar_cupon(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_actualizar_estado(uuid, public.delivery_estado_pedido, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_tomar_pedido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_calificar(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_responder_resena(uuid, text) TO authenticated;

-- Seguimiento en tiempo real de pedidos
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_pedidos;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ============================================================
-- Catálogo de ejemplo con fotos
-- ============================================================
UPDATE public.delivery_comercios SET rubro = 'Hamburguesas', total_resenas = 1240, promo_texto = '25% OFF en combos', envio_gratis_desde = 15000,
  imagen_url = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=80&auto=format&fit=crop' WHERE slug = 'la-esquina-burger';
UPDATE public.delivery_comercios SET rubro = 'Pizza', total_resenas = 980, promo_texto = '2x1 en empanadas',
  imagen_url = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80&auto=format&fit=crop' WHERE slug = 'pizzeria-san-telmo';
UPDATE public.delivery_comercios SET rubro = 'Supermercado', total_resenas = 2310, promo_texto = 'Envío gratis desde $20.000', envio_gratis_desde = 20000,
  imagen_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80&auto=format&fit=crop' WHERE slug = 'mercado-fresco';
UPDATE public.delivery_comercios SET rubro = 'Farmacia', total_resenas = 640, horario = 'Abierto 24 horas',
  imagen_url = 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=1200&q=80&auto=format&fit=crop' WHERE slug = 'farmacia-central-24h';
UPDATE public.delivery_comercios SET rubro = 'Regalos', total_resenas = 210,
  imagen_url = 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&q=80&auto=format&fit=crop' WHERE slug = 'casa-y-mas';

INSERT INTO public.delivery_comercios (nombre, slug, categoria, rubro, descripcion, direccion, imagen_url, rating, total_resenas, tiempo_min, tiempo_max, costo_envio, pedido_minimo, destacado, promo_texto, envio_gratis_desde, horario) VALUES
('Sushi Club Palermo', 'sushi-club-palermo', 'comida', 'Sushi', 'Rolls, nigiris y combinados para compartir.', 'Honduras 4820, CABA', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200&q=80&auto=format&fit=crop', 4.8, 1530, 30, 45, 1490, 9000, true, '30% OFF en combinados', NULL, 'Todos los días de 12 a 0 h'),
('Café Nómade', 'cafe-nomade', 'comida', 'Café', 'Café de especialidad, tostados y pastelería.', 'Gorriti 5190, CABA', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80&auto=format&fit=crop', 4.9, 870, 15, 25, 690, 3000, true, 'Envío gratis', 1, 'Lunes a domingo de 8 a 20 h'),
('Helados Polar', 'helados-polar', 'comida', 'Helados', 'Helado artesanal, postres y donas.', 'Av. Cabildo 2010, CABA', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1200&q=80&auto=format&fit=crop', 4.7, 1120, 20, 35, 990, 4000, false, '2do kilo al 50%', NULL, 'Todos los días de 12 a 1 h'),
('Verde Bowl', 'verde-bowl', 'comida', 'Saludable', 'Bowls, ensaladas y platos livianos.', 'Av. Callao 1150, CABA', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&q=80&auto=format&fit=crop', 4.6, 450, 20, 30, 890, 5000, false, NULL, 18000, 'Lunes a sábado de 11 a 22 h'),
('Parrilla Don Ramón', 'parrilla-don-ramon', 'comida', 'Parrilla', 'Cortes a la parrilla, guarniciones y minutas.', 'Av. Juan B. Justo 3200, CABA', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1200&q=80&auto=format&fit=crop', 4.7, 760, 35, 50, 1590, 12000, true, '15% OFF pagando con tarjeta', NULL, 'Martes a domingo de 12 a 0 h'),
('La Nonna Pastas', 'la-nonna-pastas', 'comida', 'Pastas', 'Pastas caseras, salsas y platos del día.', 'Av. Scalabrini Ortiz 1420, CABA', 'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?w=1200&q=80&auto=format&fit=crop', 4.5, 390, 30, 45, 1190, 7000, false, NULL, NULL, 'Todos los días de 12 a 23 h'),
('Pollo Crocante', 'pollo-crocante', 'comida', 'Pollo', 'Pollo frito crocante, baldes y combos.', 'Av. Rivadavia 5400, CABA', 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=1200&q=80&auto=format&fit=crop', 4.4, 1890, 20, 35, 990, 6000, false, 'Balde familiar 20% OFF', NULL, 'Todos los días de 11 a 0 h'),
('Brunch Club', 'brunch-club', 'comida', 'Desayunos', 'Desayunos, brunch y meriendas todo el día.', 'Thames 2100, CABA', 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=1200&q=80&auto=format&fit=crop', 4.8, 640, 25, 40, 1090, 6000, true, NULL, 20000, 'Todos los días de 8 a 19 h'),
('Sándwich Lab', 'sandwich-lab', 'comida', 'Sándwiches', 'Sándwiches de autor, tostados y bebidas.', 'Av. Corrientes 3400, CABA', 'https://images.unsplash.com/photo-1592415486689-125cbbfcbee2?w=1200&q=80&auto=format&fit=crop', 4.6, 520, 15, 30, 790, 4000, false, NULL, NULL, 'Lunes a sábado de 9 a 22 h'),
('Súper Ahorro Express', 'super-ahorro-express', 'supermercado', 'Supermercado', 'Todo para tu casa en menos de 30 minutos.', 'Av. Las Heras 2800, CABA', 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&q=80&auto=format&fit=crop', 4.5, 3020, 15, 30, 990, 8000, true, 'Hasta 40% OFF en frescos', 25000, 'Todos los días de 8 a 23 h'),
('Bebidas Ya', 'bebidas-ya', 'supermercado', 'Bebidas', 'Cervezas, vinos, gaseosas y snacks bien fríos.', 'Av. Santa Fe 4500, CABA', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80&auto=format&fit=crop', 4.6, 1410, 15, 25, 890, 5000, false, 'Llevá 6 y pagá 5', NULL, 'Todos los días de 10 a 2 h'),
('Farma Vida', 'farma-vida', 'farmacia', 'Farmacia', 'Medicamentos de venta libre, dermocosmética y cuidado personal.', 'Av. Cabildo 3300, CABA', 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200&q=80&auto=format&fit=crop', 4.7, 380, 20, 35, 690, 2500, false, '20% OFF en dermocosmética', NULL, 'Todos los días de 8 a 22 h'),
('Moda Urbana', 'moda-urbana', 'tiendas', 'Indumentaria', 'Ropa, accesorios y gift cards.', 'Av. Santa Fe 1800, CABA', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop', 4.4, 160, 40, 60, 1890, 10000, false, 'Hasta 50% OFF', NULL, 'Lunes a sábado de 10 a 20 h')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.delivery_productos (comercio_id, nombre, descripcion, categoria, imagen_url, precio, precio_anterior, destacado)
SELECT c.id, v.nombre, v.descripcion, v.categoria, 'https://images.unsplash.com/photo-' || v.foto || '?w=600&q=80&auto=format&fit=crop', v.precio, v.anterior, v.destacado
FROM (VALUES
  ('la-esquina-burger', 'Doble bacon', 'Doble medallón, cheddar, bacon crocante y salsa de la casa.', 'Hamburguesas', '1571091718767-18b5b1457add', 9800, NULL, true),
  ('la-esquina-burger', 'Burger BBQ', 'Carne, bacon, cebolla caramelizada y salsa barbacoa.', 'Hamburguesas', '1586190848861-99aa4a171e90', 9200, NULL, false),
  ('la-esquina-burger', 'Pulled pork', 'Cerdo desmechado, coleslaw y pan brioche.', 'Hamburguesas', '1606755962773-d324e0a13086', 8900, NULL, false),
  ('la-esquina-burger', 'Combo para dos', 'Dos hamburguesas clásicas con papas y bebidas.', 'Combos', '1568901346375-23c9450c58cd', 17900, 21500, true),
  ('pizzeria-san-telmo', 'Pizza napolitana', 'Muzzarella, tomate en rodajas, ajo y albahaca.', 'Pizzas', '1565299624946-b28f40a0ae38', 13900, NULL, true),
  ('pizzeria-san-telmo', 'Pizza especial', 'Jamón, morrones, aceitunas y muzzarella.', 'Pizzas', '1594007654729-407eedc4be65', 14900, NULL, false),
  ('pizzeria-san-telmo', 'Fugazzeta rellena', 'Rellena de muzzarella con cebolla gratinada.', 'Pizzas', '1618213837799-25d5552820d3', 15500, NULL, false),
  ('sushi-club-palermo', 'Combinado 30 piezas', 'Rolls, nigiris y sashimi de salmón para compartir.', 'Combinados', '1553621042-f6e147245754', 28900, 34900, true),
  ('sushi-club-palermo', 'Nigiri de salmón x6', 'Arroz de sushi con salmón rosado.', 'Nigiris', '1615361200141-f45040f367be', 9900, NULL, false),
  ('sushi-club-palermo', 'Variedad de autor x10', 'Selección del chef con salmón, langostino y palta.', 'Rolls', '1617196034796-73dfa7b1fd56', 13900, NULL, true),
  ('sushi-club-palermo', 'Philadelphia roll x8', 'Salmón, queso crema y palta.', 'Rolls', '1579871494447-9811cf80d66c', 10900, NULL, false),
  ('cafe-nomade', 'Flat white', 'Doble ristretto con leche texturizada.', 'Cafetería', '1509042239860-f550ce710b93', 3600, NULL, true),
  ('cafe-nomade', 'Tostado de jamón y queso', 'En pan de molde artesanal.', 'Salado', '1528735602780-2552fd46c7af', 5900, NULL, false),
  ('cafe-nomade', 'Avocado toast', 'Pan de masa madre, palta y huevo a la plancha.', 'Salado', '1525351484163-7529414344d8', 7400, NULL, true),
  ('cafe-nomade', 'Panificados del día', 'Selección de panes y facturas de nuestra panadería.', 'Dulce', '1608198093002-ad4e005484ec', 6200, NULL, false),
  ('cafe-nomade', 'Pancakes con miel', 'Stack de pancakes con miel y manteca.', 'Dulce', '1567620905732-2d1ec7ab7445', 6900, NULL, false),
  ('helados-polar', 'Sundae de chocolate', 'Helado, salsa de chocolate, crema y galletitas.', 'Postres', '1563805042-7684c019e1cb', 5900, NULL, true),
  ('helados-polar', 'Torta de frutos rojos', 'Porción de torta helada con frambuesas.', 'Postres', '1565958011703-44f9829ba187', 6400, NULL, false),
  ('helados-polar', 'Donas surtidas x4', 'Glaseadas con chocolate y sprinkles.', 'Donas', '1551024601-bec78aea704b', 7200, 8400, false),
  ('verde-bowl', 'Bowl veggie', 'Palta, garbanzos, hojas verdes, tomates y semillas.', 'Bowls', '1512621776951-a57141f2eefd', 8900, NULL, true),
  ('verde-bowl', 'Ensalada de la huerta', 'Hojas verdes, zanahoria, cebolla morada y semillas.', 'Ensaladas', '1540189549336-e6e99c3679fe', 7600, NULL, false),
  ('verde-bowl', 'Salmón grillado', 'Con salsa cítrica y vegetales salteados.', 'Platos', '1580959375944-abd7e991f971', 15900, NULL, true),
  ('verde-bowl', 'Pollo grillado', 'Pechuga grillada con vegetales.', 'Platos', '1598515214211-89d3c73ae83b', 10900, NULL, false),
  ('verde-bowl', 'Ensalada con huevo', 'Espinaca, huevo duro, palta y queso.', 'Ensaladas', '1482049016688-2d3e1b311543', 8200, NULL, false),
  ('parrilla-don-ramon', 'Bife de chorizo con papas', '400 g a la parrilla con papas fritas.', 'Parrilla', '1600891964092-4316c288032e', 19900, NULL, true),
  ('parrilla-don-ramon', 'Costillas BBQ', 'Costillas de cerdo glaseadas a la barbacoa.', 'Parrilla', '1544025162-d76694265947', 17500, NULL, true),
  ('parrilla-don-ramon', 'Albóndigas caseras', 'Con salsa y hojas verdes.', 'Minutas', '1529042410759-befb1204b468', 11200, NULL, false),
  ('la-nonna-pastas', 'Pappardelle al ragú', 'Pasta fresca con ragú de carne cocido lento.', 'Pastas', '1611270629569-8b357cb88da9', 11900, NULL, true),
  ('la-nonna-pastas', 'Arroz con mariscos', 'Arroz azafranado con mariscos y limón.', 'Platos del día', '1512058564366-18510be2db19', 15400, NULL, false),
  ('la-nonna-pastas', 'Langostinos al curry', 'Con arroz blanco y salsa especiada.', 'Platos del día', '1559847844-5315695dadae', 16800, NULL, false),
  ('pollo-crocante', 'Balde familiar 12 presas', 'Pollo frito crocante con dip a elección.', 'Baldes', '1626645738196-c2a7c87a8f58', 21900, 27400, true),
  ('pollo-crocante', 'Combo 3 presas', 'Tres presas, papas y bebida.', 'Combos', '1626082927389-6cd097cdc6ec', 8900, NULL, true),
  ('brunch-club', 'Brunch para dos', 'Huevos, panes, frutas, jugos y café.', 'Brunch', '1535140728325-a4d3707eee61', 21900, NULL, true),
  ('brunch-club', 'Tostadas francesas', 'Con banana, arándanos y miel.', 'Dulce', '1484723091739-30a097e8f929', 8400, NULL, true),
  ('brunch-club', 'Huevos benedictinos', 'Huevos pochados, salmón y salsa holandesa.', 'Salado', '1608039829572-78524f79c4c7', 9900, NULL, false),
  ('sandwich-lab', 'Sándwich veggie', 'Hamburguesa vegetal, palta, tomate y brotes.', 'Sándwiches', '1592415486689-125cbbfcbee2', 7900, NULL, true),
  ('sandwich-lab', 'Tostado triple', 'Jamón, queso y tomate en pan de miga.', 'Tostados', '1528735602780-2552fd46c7af', 5400, NULL, false),
  ('sandwich-lab', 'Mini burger', 'Pan de papa, carne y cheddar.', 'Sándwiches', '1499028344343-cd173ffc68a9', 6200, NULL, false),
  ('mercado-fresco', 'Pan de campo', 'Panes artesanales del día.', 'Panadería', '1608198093002-ad4e005484ec', 3200, NULL, false),
  ('mercado-fresco', 'Cerezas 500 g', 'Cerezas frescas de estación.', 'Frutas y verduras', '1559181567-c3190ca9959b', 5900, NULL, true),
  ('super-ahorro-express', 'Mix de frutas 2 kg', 'Naranjas, kiwis, pomelos y más.', 'Frutas y verduras', '1610832958506-aa56368176cf', 7900, 9500, true),
  ('super-ahorro-express', 'Leche entera 1 L', 'Leche fresca entera.', 'Lácteos', '1550583724-b2692b85b150', 1650, NULL, false),
  ('super-ahorro-express', 'Papas fritas 150 g', 'Snack de papas clásicas.', 'Almacén', '1599490659213-e2b9527bd087', 2400, NULL, false),
  ('super-ahorro-express', 'Box desayuno completo', 'Frutas, huevos, panificados y untables.', 'Combos', '1606787366850-de6330128bfc', 18900, 22900, true),
  ('super-ahorro-express', 'Verduras de estación', 'Selección de verduras frescas.', 'Frutas y verduras', '1488459716781-31db52582fe9', 6900, NULL, false),
  ('bebidas-ya', 'Cerveza rubia 1 L', 'Bien fría, lista para tomar.', 'Cervezas', '1608270586620-248524c67de9', 3900, NULL, true),
  ('bebidas-ya', 'Papas fritas 150 g', 'El snack perfecto para acompañar.', 'Snacks', '1599490659213-e2b9527bd087', 2400, NULL, false),
  ('farma-vida', 'Ibuprofeno 400 mg x10', 'Analgésico de venta libre.', 'Medicamentos', '1584308666744-24d5c474f2ae', 3200, NULL, false),
  ('farma-vida', 'Vitaminas multivitamínico', 'Suplemento dietario x30.', 'Vitaminas', '1471864190281-a93a3070b6de', 8900, 10400, true),
  ('farma-vida', 'Sérum facial', 'Hidratación intensa, 30 ml.', 'Dermocosmética', '1608571423902-eed4a5ad8108', 15900, 19900, true),
  ('farma-vida', 'Barbijos x10', 'Barbijos descartables tricapa.', 'Cuidado personal', '1585435557343-3b092031a831', 2900, NULL, false),
  ('moda-urbana', 'Gift card $20.000', 'Para usar en cualquier producto de la tienda.', 'Gift cards', '1607083206869-4c7672e72a8a', 20000, NULL, true),
  ('moda-urbana', 'Caja de regalo sorpresa', 'Accesorios seleccionados con envoltorio.', 'Regalos', '1513885535751-8b9238bd345a', 14900, NULL, false),
  ('casa-y-mas', 'Set de regalo', 'Caja con envoltorio y tarjeta.', 'Regalos', '1513885535751-8b9238bd345a', 12900, NULL, false)
) AS v(slug, nombre, descripcion, categoria, foto, precio, anterior, destacado)
JOIN public.delivery_comercios c ON c.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_productos p WHERE p.comercio_id = c.id AND p.nombre = v.nombre);

INSERT INTO public.delivery_cupones (codigo, descripcion, tipo, valor, tope, minimo) VALUES
  ('BIENVENIDA', '30% OFF en tu primer pedido (tope $5.000)', 'porcentaje', 30, 5000, 5000),
  ('ENVIOGRATIS', 'Envío gratis en pedidos desde $8.000', 'envio_gratis', 0, NULL, 8000),
  ('AHORRA2000', '$2.000 de descuento en compras desde $15.000', 'monto', 2000, NULL, 15000)
ON CONFLICT (codigo) DO NOTHING;
