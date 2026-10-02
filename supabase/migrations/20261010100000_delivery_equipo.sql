-- Equipo del comercio: el dueño invita personas con un rol (encargado / operador).
-- Todos los permisos se resuelven en delivery_permiso(); las RLS y los RPC lo usan en lugar de comparar con propietario_id.

CREATE TABLE IF NOT EXISTS public.delivery_comercio_equipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 5 AND 200),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('encargado', 'operador')),
  estado text NOT NULL DEFAULT 'invitado' CHECK (estado IN ('invitado', 'activo')),
  invitado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comercio_id, email)
);
CREATE INDEX IF NOT EXISTS delivery_equipo_user_idx ON public.delivery_comercio_equipo (user_id) WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS delivery_equipo_email_idx ON public.delivery_comercio_equipo (email) WHERE estado = 'invitado';
ALTER TABLE public.delivery_comercio_equipo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_comercio_equipo FROM PUBLIC, anon, authenticated;
-- Sin políticas: la tabla solo se toca desde los RPC de abajo.

CREATE OR REPLACE FUNCTION public.delivery_permiso(p_comercio uuid, p_permiso text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = p_comercio AND c.propietario_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.delivery_comercio_equipo e
      WHERE e.comercio_id = p_comercio AND e.user_id = auth.uid() AND e.estado = 'activo'
        AND ((e.rol = 'operador' AND p_permiso = 'pedidos')
          OR (e.rol = 'encargado' AND p_permiso IN ('pedidos', 'catalogo', 'promociones', 'opiniones', 'estadisticas', 'ajustes')))
    ), false)
$$;
REVOKE ALL ON FUNCTION public.delivery_permiso(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_permiso(uuid, text) TO authenticated;

-- Cuál es mi comercio (el propio, o aquel donde soy parte del equipo) y con qué rol.
CREATE OR REPLACE FUNCTION public.delivery_mi_acceso()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT jsonb_build_object('comercio_id', x.id, 'rol', x.rol, 'permisos', CASE x.rol
        WHEN 'dueno' THEN '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes","finanzas","equipo"]'::jsonb
        WHEN 'encargado' THEN '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes"]'::jsonb
        ELSE '["pedidos"]'::jsonb END)
    FROM (
      SELECT c.id, 'dueno'::text AS rol, 0 AS orden FROM public.delivery_comercios c WHERE c.propietario_id = auth.uid()
      UNION ALL
      SELECT e.comercio_id, e.rol, 1 FROM public.delivery_comercio_equipo e WHERE e.user_id = auth.uid() AND e.estado = 'activo'
      ORDER BY orden LIMIT 1
    ) x
  ), 'null'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.delivery_mi_acceso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mi_acceso() TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_equipo_listar(p_comercio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR coalesce((SELECT propietario_id = auth.uid() FROM public.delivery_comercios WHERE id = p_comercio), false)) THEN
    RAISE EXCEPTION 'Solo el dueño del comercio puede ver el equipo';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', e.id, 'email', e.email, 'rol', e.rol, 'estado', e.estado, 'nombre', pf.nombre, 'created_at', e.created_at) ORDER BY e.created_at)
    FROM public.delivery_comercio_equipo e LEFT JOIN public.perfiles pf ON pf.id = e.user_id
    WHERE e.comercio_id = p_comercio
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.delivery_equipo_listar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_listar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_equipo_invitar(p_comercio uuid, p_email text, p_rol text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(trim(coalesce(p_email, ''))); v_id uuid;
BEGIN
  IF NOT coalesce((SELECT propietario_id = auth.uid() FROM public.delivery_comercios WHERE id = p_comercio), false) THEN
    RAISE EXCEPTION 'Solo el dueño del comercio puede invitar personas';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN RAISE EXCEPTION 'Ingresá un email válido'; END IF;
  IF p_rol NOT IN ('encargado', 'operador') THEN RAISE EXCEPTION 'Rol inválido'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u JOIN public.delivery_comercios c ON c.propietario_id = u.id WHERE c.id = p_comercio AND lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'Ese email es el del dueño del comercio';
  END IF;
  IF (SELECT count(*) FROM public.delivery_comercio_equipo WHERE comercio_id = p_comercio) >= 10 THEN RAISE EXCEPTION 'El equipo puede tener hasta 10 personas'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_comercio_equipo WHERE comercio_id = p_comercio AND email = v_email AND estado = 'activo') THEN
    RAISE EXCEPTION 'Esa persona ya forma parte del equipo';
  END IF;
  INSERT INTO public.delivery_comercio_equipo (comercio_id, email, rol, invitado_por) VALUES (p_comercio, v_email, p_rol, auth.uid())
  ON CONFLICT (comercio_id, email) DO UPDATE SET rol = EXCLUDED.rol, invitado_por = auth.uid()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_equipo_invitar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_invitar(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_equipo_cambiar_rol(p_id uuid, p_rol text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_rol NOT IN ('encargado', 'operador') THEN RAISE EXCEPTION 'Rol inválido'; END IF;
  UPDATE public.delivery_comercio_equipo e SET rol = p_rol
  WHERE e.id = p_id AND coalesce((SELECT c.propietario_id = auth.uid() FROM public.delivery_comercios c WHERE c.id = e.comercio_id), false);
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés cambiar este rol'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_equipo_cambiar_rol(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_cambiar_rol(uuid, text) TO authenticated;

-- El dueño quita a cualquiera; cada persona puede salir del equipo por su cuenta.
CREATE OR REPLACE FUNCTION public.delivery_equipo_quitar(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.delivery_comercio_equipo e
  WHERE e.id = p_id AND (e.user_id = auth.uid()
    OR coalesce((SELECT c.propietario_id = auth.uid() FROM public.delivery_comercios c WHERE c.id = e.comercio_id), false));
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés quitar a esta persona'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_equipo_quitar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_quitar(uuid) TO authenticated;

-- Invitaciones pendientes para el email (confirmado) de la persona que consulta.
CREATE OR REPLACE FUNCTION public.delivery_equipo_invitaciones()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'rol', e.rol, 'comercio', c.nombre, 'created_at', e.created_at) ORDER BY e.created_at DESC), '[]'::jsonb)
  FROM public.delivery_comercio_equipo e
  JOIN public.delivery_comercios c ON c.id = e.comercio_id
  JOIN auth.users u ON u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = e.email
  WHERE e.estado = 'invitado'
$$;
REVOKE ALL ON FUNCTION public.delivery_equipo_invitaciones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_invitaciones() TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_equipo_responder(p_id uuid, p_acepta boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Tenés que confirmar tu email primero'; END IF;
  IF p_acepta THEN
    UPDATE public.delivery_comercio_equipo SET user_id = auth.uid(), estado = 'activo' WHERE id = p_id AND email = v_email AND estado = 'invitado';
  ELSE
    DELETE FROM public.delivery_comercio_equipo WHERE id = p_id AND email = v_email AND estado = 'invitado';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está disponible'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_equipo_responder(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_equipo_responder(uuid, boolean) TO authenticated;

-- ===== Funciones existentes: del "es el dueño" a "tiene el permiso" =====
DO $$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.delivery_aceptar_pedido(uuid, integer)'::regprocedure);
  IF position('coalesce(s.propietario_id = auth.uid(), false)' IN v_def) = 0 THEN RAISE EXCEPTION 'aceptar_pedido cambió'; END IF;
  EXECUTE replace(v_def, 'coalesce(s.propietario_id = auth.uid(), false)', 'public.delivery_permiso(s.id, ''pedidos'')');

  v_def := pg_get_functiondef('public.delivery_actualizar_estado(uuid, delivery_estado_pedido, text, text)'::regprocedure);
  IF position('ELSIF v_uid = v_owner THEN' IN v_def) = 0 THEN RAISE EXCEPTION 'actualizar_estado cambió'; END IF;
  EXECUTE replace(v_def, 'ELSIF v_uid = v_owner THEN', 'ELSIF public.delivery_permiso(p.comercio_id, ''pedidos'') THEN');

  v_def := pg_get_functiondef('public.delivery_agregar_demora(uuid, integer)'::regprocedure);
  IF position('coalesce(v_owner = auth.uid(), false)' IN v_def) = 0 THEN RAISE EXCEPTION 'agregar_demora cambió'; END IF;
  EXECUTE replace(v_def, 'coalesce(v_owner = auth.uid(), false)', 'public.delivery_permiso(p.comercio_id, ''pedidos'')');

  v_def := pg_get_functiondef('public.delivery_pausar_comercio(uuid, integer)'::regprocedure);
  IF position('EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())' IN v_def) = 0 THEN RAISE EXCEPTION 'pausar_comercio cambió'; END IF;
  EXECUTE replace(v_def, 'EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())', 'public.delivery_permiso(p_comercio, ''pedidos'')');

  v_def := pg_get_functiondef('public.delivery_estadisticas_comercio(uuid, integer)'::regprocedure);
  IF position('EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())' IN v_def) = 0 THEN RAISE EXCEPTION 'estadisticas cambió'; END IF;
  EXECUTE replace(v_def, 'EXISTS (SELECT 1 FROM public.delivery_comercios WHERE id = p_comercio AND propietario_id = auth.uid())', 'public.delivery_permiso(p_comercio, ''estadisticas'')');
END $$;

CREATE OR REPLACE FUNCTION public.delivery_puede_ver_finanzas(p_comercio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = p_comercio AND c.propietario_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.delivery_es_duenio_producto(p_producto uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_productos p WHERE p.id = p_producto AND public.delivery_permiso(p.comercio_id, 'catalogo'))
$$;

CREATE OR REPLACE FUNCTION public.delivery_responder_resena(p_resena uuid, p_respuesta text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.delivery_resenas r SET respuesta = nullif(left(trim(coalesce(p_respuesta, '')), 500), '')
  WHERE r.id = p_resena AND public.delivery_permiso(r.comercio_id, 'opiniones');
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés responder esta reseña'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_rol_en_chat(p_pedido uuid, p_canal text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
    WHEN p.cliente_id = auth.uid() THEN 'cliente'
    WHEN p_canal = 'comercio' AND public.delivery_permiso(p.comercio_id, 'pedidos') THEN 'comercio'
    WHEN p_canal = 'repartidor' AND p.repartidor_id = auth.uid() THEN 'repartidor'
    ELSE NULL
  END
  FROM public.delivery_pedidos p WHERE p.id = p_pedido
$$;

-- ===== Políticas de acceso =====
DROP POLICY IF EXISTS "Comercios visibles para todos" ON public.delivery_comercios;
CREATE POLICY "Comercios visibles para todos" ON public.delivery_comercios FOR SELECT
  USING ((activo AND aprobado) OR public.delivery_permiso(id, 'pedidos'));
DROP POLICY IF EXISTS "Propietarios actualizan comercios" ON public.delivery_comercios;
CREATE POLICY "Propietarios actualizan comercios" ON public.delivery_comercios FOR UPDATE
  USING (public.delivery_permiso(id, 'ajustes'))
  WITH CHECK (public.delivery_permiso(id, 'ajustes'));

DROP POLICY IF EXISTS "Propietarios crean productos" ON public.delivery_productos;
CREATE POLICY "Propietarios crean productos" ON public.delivery_productos FOR INSERT WITH CHECK (public.delivery_permiso(comercio_id, 'catalogo'));
DROP POLICY IF EXISTS "Propietarios actualizan productos" ON public.delivery_productos;
CREATE POLICY "Propietarios actualizan productos" ON public.delivery_productos FOR UPDATE USING (public.delivery_permiso(comercio_id, 'catalogo')) WITH CHECK (public.delivery_permiso(comercio_id, 'catalogo'));
DROP POLICY IF EXISTS "Propietarios eliminan productos" ON public.delivery_productos;
CREATE POLICY "Propietarios eliminan productos" ON public.delivery_productos FOR DELETE USING (public.delivery_permiso(comercio_id, 'catalogo'));

DROP POLICY IF EXISTS "Comercios y admins crean cupones" ON public.delivery_cupones;
CREATE POLICY "Comercios y admins crean cupones" ON public.delivery_cupones FOR INSERT
  WITH CHECK ((comercio_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role)) OR (comercio_id IS NOT NULL AND public.delivery_permiso(comercio_id, 'promociones')));
DROP POLICY IF EXISTS "Comercios y admins editan cupones" ON public.delivery_cupones;
CREATE POLICY "Comercios y admins editan cupones" ON public.delivery_cupones FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (comercio_id IS NOT NULL AND public.delivery_permiso(comercio_id, 'promociones')))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (comercio_id IS NOT NULL AND public.delivery_permiso(comercio_id, 'promociones')));
DROP POLICY IF EXISTS "Comercios y admins eliminan cupones" ON public.delivery_cupones;
CREATE POLICY "Comercios y admins eliminan cupones" ON public.delivery_cupones FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (comercio_id IS NOT NULL AND public.delivery_permiso(comercio_id, 'promociones')));
DROP POLICY IF EXISTS "Cupones activos visibles" ON public.delivery_cupones;
CREATE POLICY "Cupones activos visibles" ON public.delivery_cupones FOR SELECT
  USING (activo OR public.has_role(auth.uid(), 'admin'::app_role) OR (comercio_id IS NOT NULL AND public.delivery_permiso(comercio_id, 'promociones')));

DROP POLICY IF EXISTS "Comercio y admin ven items de liquidaciones" ON public.delivery_liquidacion_items;
CREATE POLICY "Comercio y admin ven items de liquidaciones" ON public.delivery_liquidacion_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.delivery_liquidaciones l WHERE l.id = delivery_liquidacion_items.liquidacion_id AND public.delivery_puede_ver_finanzas(l.comercio_id)));
DROP POLICY IF EXISTS "Comercio y admin ven liquidaciones" ON public.delivery_liquidaciones;
CREATE POLICY "Comercio y admin ven liquidaciones" ON public.delivery_liquidaciones FOR SELECT USING (public.delivery_puede_ver_finanzas(comercio_id));

DROP POLICY IF EXISTS "Comercios ven items recibidos" ON public.delivery_pedido_items;
CREATE POLICY "Comercios ven items recibidos" ON public.delivery_pedido_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.id = delivery_pedido_items.pedido_id AND public.delivery_permiso(p.comercio_id, 'pedidos')));
DROP POLICY IF EXISTS "Comercios ven pedidos recibidos" ON public.delivery_pedidos;
CREATE POLICY "Comercios ven pedidos recibidos" ON public.delivery_pedidos FOR SELECT
  USING (pago_estado <> ALL (ARRAY['pendiente'::text, 'rechazado'::text]) AND public.delivery_permiso(comercio_id, 'pedidos'));
DROP POLICY IF EXISTS "Comercios ven reclamos de sus pedidos" ON public.delivery_reclamos;
CREATE POLICY "Comercios ven reclamos de sus pedidos" ON public.delivery_reclamos FOR SELECT USING (public.delivery_permiso(comercio_id, 'pedidos'));

DROP POLICY IF EXISTS "Ubicación visible para el pedido en curso" ON public.delivery_ubicaciones;
CREATE POLICY "Ubicación visible para el pedido en curso" ON public.delivery_ubicaciones FOR SELECT
  USING (repartidor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.delivery_pedidos p
    WHERE p.repartidor_id = delivery_ubicaciones.repartidor_id
      AND p.estado = ANY (ARRAY['confirmado'::delivery_estado_pedido, 'preparando'::delivery_estado_pedido, 'en_camino'::delivery_estado_pedido])
      AND (p.cliente_id = auth.uid() OR public.delivery_permiso(p.comercio_id, 'pedidos'))));
