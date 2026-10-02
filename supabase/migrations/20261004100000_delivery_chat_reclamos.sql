-- Etapa 7: chat del pedido (cliente <-> comercio y cliente <-> repartidor) y reclamos con resolución del administrador.
-- Nadie escribe directo en las tablas: todo pasa por funciones que validan identidad, pertenencia al pedido y límites.

-- ============================================================
-- Chat
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('comercio', 'repartidor')),
  autor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  leido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_mensajes_pedido_idx ON public.delivery_mensajes(pedido_id, canal, created_at);

-- Rol de quien consulta dentro de la conversación de un pedido (NULL = no participa).
CREATE OR REPLACE FUNCTION public.delivery_rol_en_chat(p_pedido uuid, p_canal text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
    WHEN p.cliente_id = auth.uid() THEN 'cliente'
    WHEN p_canal = 'comercio' AND c.propietario_id = auth.uid() THEN 'comercio'
    WHEN p_canal = 'repartidor' AND p.repartidor_id = auth.uid() THEN 'repartidor'
    ELSE NULL
  END
  FROM public.delivery_pedidos p
  JOIN public.delivery_comercios c ON c.id = p.comercio_id
  WHERE p.id = p_pedido
$$;
REVOKE ALL ON FUNCTION public.delivery_rol_en_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_rol_en_chat(uuid, text) TO authenticated;

ALTER TABLE public.delivery_mensajes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_mensajes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_mensajes TO authenticated;
GRANT ALL ON public.delivery_mensajes TO service_role;
DROP POLICY IF EXISTS "Participantes leen el chat" ON public.delivery_mensajes;
CREATE POLICY "Participantes leen el chat" ON public.delivery_mensajes FOR SELECT TO authenticated
  USING (public.delivery_rol_en_chat(pedido_id, canal) IS NOT NULL);

CREATE OR REPLACE FUNCTION public.delivery_enviar_mensaje(p_pedido uuid, p_canal text, p_texto text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rol text;
  p public.delivery_pedidos;
  v_texto text := trim(regexp_replace(coalesce(p_texto, ''), '[[:cntrl:]]', ' ', 'g'));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión'; END IF;
  IF p_canal NOT IN ('comercio', 'repartidor') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
  v_rol := public.delivery_rol_en_chat(p_pedido, p_canal);
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No participás de esta conversación'; END IF;
  IF char_length(v_texto) < 1 THEN RAISE EXCEPTION 'Escribí un mensaje'; END IF;
  IF char_length(v_texto) > 500 THEN RAISE EXCEPTION 'El mensaje es demasiado largo (máximo 500 caracteres)'; END IF;

  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido;
  IF p.pago_estado IN ('pendiente', 'rechazado') AND p.estado = 'pendiente' THEN
    RAISE EXCEPTION 'El pedido todavía no fue confirmado';
  END IF;
  -- La conversación sigue abierta 2 horas después de cerrado el pedido (por si hay que coordinar algo).
  IF p.estado IN ('entregado', 'cancelado') AND coalesce(p.entregado_at, p.cancelado_at, p.updated_at) < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'La conversación de este pedido ya está cerrada. Si necesitás ayuda, hacé un reclamo.';
  END IF;

  IF (SELECT count(*) FROM public.delivery_mensajes WHERE autor_id = v_uid AND created_at > now() - interval '1 minute') >= 15 THEN
    RAISE EXCEPTION 'Estás enviando mensajes muy rápido. Esperá un momento.';
  END IF;

  INSERT INTO public.delivery_mensajes (pedido_id, canal, autor_id, texto) VALUES (p_pedido, p_canal, v_uid, v_texto) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_enviar_mensaje(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_enviar_mensaje(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_marcar_leidos(p_pedido uuid, p_canal text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.delivery_rol_en_chat(p_pedido, p_canal) IS NULL THEN RETURN; END IF;
  UPDATE public.delivery_mensajes SET leido_at = now()
    WHERE pedido_id = p_pedido AND canal = p_canal AND autor_id <> auth.uid() AND leido_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.delivery_marcar_leidos(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_marcar_leidos(uuid, text) TO authenticated;

-- Mensajes sin leer por pedido y canal (respeta RLS: solo cuenta lo que la persona puede ver).
CREATE OR REPLACE FUNCTION public.delivery_mensajes_sin_leer(p_pedidos uuid[])
RETURNS TABLE (pedido_id uuid, canal text, total integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT m.pedido_id, m.canal, count(*)::integer
  FROM public.delivery_mensajes m
  WHERE m.pedido_id = ANY(p_pedidos) AND m.autor_id <> auth.uid() AND m.leido_at IS NULL
  GROUP BY m.pedido_id, m.canal
$$;
REVOKE ALL ON FUNCTION public.delivery_mensajes_sin_leer(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mensajes_sin_leer(uuid[]) TO authenticated;

-- ============================================================
-- Reclamos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_reclamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('demora', 'faltante', 'mal_estado', 'equivocado', 'cobro', 'repartidor', 'otro')),
  detalle text NOT NULL CHECK (char_length(detalle) BETWEEN 10 AND 1000),
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'resuelto', 'rechazado')),
  resolucion text CHECK (resolucion IS NULL OR char_length(resolucion) <= 1000),
  reembolso_monto numeric(12,2) NOT NULL DEFAULT 0 CHECK (reembolso_monto >= 0),
  resuelto_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  resuelto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_reclamos_abierto_idx ON public.delivery_reclamos(pedido_id, tipo) WHERE estado = 'abierto';
CREATE INDEX IF NOT EXISTS delivery_reclamos_estado_idx ON public.delivery_reclamos(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_reclamos_cliente_idx ON public.delivery_reclamos(cliente_id, created_at DESC);

ALTER TABLE public.delivery_reclamos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_reclamos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_reclamos TO authenticated;
GRANT ALL ON public.delivery_reclamos TO service_role;
DROP POLICY IF EXISTS "Clientes ven sus reclamos" ON public.delivery_reclamos;
CREATE POLICY "Clientes ven sus reclamos" ON public.delivery_reclamos FOR SELECT TO authenticated USING (cliente_id = auth.uid());
DROP POLICY IF EXISTS "Comercios ven reclamos de sus pedidos" ON public.delivery_reclamos;
CREATE POLICY "Comercios ven reclamos de sus pedidos" ON public.delivery_reclamos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
DROP POLICY IF EXISTS "Admins ven todos los reclamos" ON public.delivery_reclamos;
CREATE POLICY "Admins ven todos los reclamos" ON public.delivery_reclamos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.delivery_crear_reclamo(p_pedido uuid, p_tipo text, p_detalle text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  p public.delivery_pedidos;
  v_detalle text := trim(regexp_replace(coalesce(p_detalle, ''), '[[:cntrl:]]', ' ', 'g'));
  v_limite timestamptz;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión'; END IF;
  IF p_tipo NOT IN ('demora', 'faltante', 'mal_estado', 'equivocado', 'cobro', 'repartidor', 'otro') THEN RAISE EXCEPTION 'Tipo de reclamo inválido'; END IF;
  IF char_length(v_detalle) < 10 THEN RAISE EXCEPTION 'Contanos un poco más (al menos 10 caracteres)'; END IF;
  IF char_length(v_detalle) > 1000 THEN RAISE EXCEPTION 'El detalle es demasiado largo (máximo 1000 caracteres)'; END IF;

  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido AND cliente_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p.estado = 'cancelado' THEN RAISE EXCEPTION 'Este pedido fue cancelado'; END IF;
  IF p.estado = 'pendiente' AND p.pago_estado IN ('pendiente', 'rechazado') THEN RAISE EXCEPTION 'El pedido todavía no fue confirmado'; END IF;

  IF p_tipo = 'demora' THEN
    -- Solo si el pedido sigue en curso y ya pasó la hora estimada.
    v_limite := coalesce(p.programado_para, p.entrega_estimada);
    IF p.estado = 'entregado' OR v_limite IS NULL OR now() < v_limite + interval '10 minutes' THEN
      RAISE EXCEPTION 'Todavía estás dentro del tiempo estimado de entrega';
    END IF;
  ELSIF p_tipo <> 'otro' THEN
    IF p.estado <> 'entregado' THEN RAISE EXCEPTION 'Podés hacer este reclamo cuando recibas el pedido'; END IF;
    IF p.entregado_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'Pasaron más de 48 horas desde la entrega'; END IF;
  END IF;

  IF (SELECT count(*) FROM public.delivery_reclamos WHERE cliente_id = v_uid AND estado = 'abierto') >= 3 THEN
    RAISE EXCEPTION 'Ya tenés 3 reclamos abiertos. Esperá a que los resolvamos.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_reclamos WHERE pedido_id = p_pedido AND tipo = p_tipo AND estado = 'abierto') THEN
    RAISE EXCEPTION 'Ya tenés un reclamo abierto de este tipo para el pedido';
  END IF;

  INSERT INTO public.delivery_reclamos (pedido_id, cliente_id, comercio_id, tipo, detalle)
    VALUES (p_pedido, v_uid, p.comercio_id, p_tipo, v_detalle) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_crear_reclamo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_reclamo(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_resolver_reclamo(p_reclamo uuid, p_estado text, p_resolucion text, p_monto numeric DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.delivery_reclamos;
  v_total numeric;
  v_resolucion text := trim(coalesce(p_resolucion, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_estado NOT IN ('resuelto', 'rechazado') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF char_length(v_resolucion) < 5 THEN RAISE EXCEPTION 'Escribí una respuesta para el cliente'; END IF;
  IF char_length(v_resolucion) > 1000 THEN RAISE EXCEPTION 'La respuesta es demasiado larga'; END IF;
  SELECT * INTO r FROM public.delivery_reclamos WHERE id = p_reclamo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reclamo no encontrado'; END IF;
  IF r.estado <> 'abierto' THEN RAISE EXCEPTION 'Este reclamo ya fue resuelto'; END IF;
  SELECT total INTO v_total FROM public.delivery_pedidos WHERE id = r.pedido_id;
  IF coalesce(p_monto, 0) < 0 OR coalesce(p_monto, 0) > v_total THEN RAISE EXCEPTION 'El reintegro no puede superar el total del pedido ($%)', v_total; END IF;
  IF p_estado = 'rechazado' AND coalesce(p_monto, 0) > 0 THEN RAISE EXCEPTION 'Un reclamo rechazado no lleva reintegro'; END IF;
  UPDATE public.delivery_reclamos
    SET estado = p_estado, resolucion = v_resolucion, reembolso_monto = coalesce(p_monto, 0), resuelto_por = auth.uid(), resuelto_at = now()
    WHERE id = p_reclamo;
END $$;
REVOKE ALL ON FUNCTION public.delivery_resolver_reclamo(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_resolver_reclamo(uuid, text, text, numeric) TO authenticated;

-- ============================================================
-- Avisos push: mensaje nuevo y reclamo nuevo / resuelto
-- ============================================================
CREATE OR REPLACE FUNCTION public.delivery_notificar_social()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url text;
  v_secret text;
  v_body jsonb;
BEGIN
  SELECT valor INTO v_url FROM public.app_config WHERE clave = 'push_function_url';
  SELECT valor INTO v_secret FROM public.app_config WHERE clave = 'push_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'delivery_mensajes' THEN
    v_body := jsonb_build_object('evento', 'mensaje', 'mensaje_id', NEW.id, 'pedido_id', NEW.pedido_id);
  ELSIF TG_OP = 'INSERT' THEN
    v_body := jsonb_build_object('evento', 'reclamo_nuevo', 'reclamo_id', NEW.id, 'pedido_id', NEW.pedido_id);
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_body := jsonb_build_object('evento', 'reclamo_resuelto', 'reclamo_id', NEW.id, 'pedido_id', NEW.pedido_id);
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(url := v_url, body := v_body, headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-secret', v_secret));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.delivery_notificar_social() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS delivery_mensajes_notificar ON public.delivery_mensajes;
CREATE TRIGGER delivery_mensajes_notificar AFTER INSERT ON public.delivery_mensajes
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notificar_social();
DROP TRIGGER IF EXISTS delivery_reclamos_notificar ON public.delivery_reclamos;
CREATE TRIGGER delivery_reclamos_notificar AFTER INSERT OR UPDATE ON public.delivery_reclamos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notificar_social();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_mensajes; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_reclamos; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
