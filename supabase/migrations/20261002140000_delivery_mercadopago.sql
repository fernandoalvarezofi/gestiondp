-- Etapa 5: pago online con Mercado Pago (Checkout Pro).
-- Un pedido pagado online no le llega al comercio hasta que Mercado Pago confirma el pago.

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.delivery_pedidos
  ADD COLUMN IF NOT EXISTS pago_estado text NOT NULL DEFAULT 'no_requiere'
    CHECK (pago_estado IN ('no_requiere', 'pendiente', 'aprobado', 'rechazado', 'a_reintegrar', 'reintegrado')),
  ADD COLUMN IF NOT EXISTS pago_id text,
  ADD COLUMN IF NOT EXISTS pago_preferencia text;

-- ¿Está configurado Mercado Pago? (lo puede consultar cualquiera; no revela la credencial)
CREATE OR REPLACE FUNCTION public.delivery_pagos_online_activos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_config WHERE clave = 'mp_access_token' AND length(valor) > 20)
$$;
GRANT EXECUTE ON FUNCTION public.delivery_pagos_online_activos() TO anon, authenticated;

-- El admin carga la credencial de Mercado Pago. Se puede reemplazar o borrar, nunca leer desde la app.
CREATE OR REPLACE FUNCTION public.delivery_admin_guardar_mp(p_access_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo un administrador puede configurar los pagos'; END IF;
  IF coalesce(trim(p_access_token), '') = '' THEN
    DELETE FROM public.app_config WHERE clave = 'mp_access_token';
    RETURN;
  END IF;
  IF trim(p_access_token) !~ '^(APP_USR|TEST)-[A-Za-z0-9-]{20,}$' THEN
    RAISE EXCEPTION 'Esa no parece una credencial de Mercado Pago: tiene que empezar con APP_USR- o TEST-';
  END IF;
  INSERT INTO public.app_config (clave, valor) VALUES ('mp_access_token', trim(p_access_token))
  ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_guardar_mp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_guardar_mp(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_estado_mp()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text; v_fecha timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT valor, updated_at INTO v_token, v_fecha FROM public.app_config WHERE clave = 'mp_access_token';
  RETURN jsonb_build_object(
    'configurado', v_token IS NOT NULL,
    'modo', CASE WHEN v_token LIKE 'TEST-%' THEN 'prueba' WHEN v_token IS NOT NULL THEN 'produccion' END,
    'termina_en', CASE WHEN v_token IS NOT NULL THEN right(v_token, 4) END,
    'actualizado', v_fecha
  );
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_estado_mp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_estado_mp() TO authenticated;

-- Un pedido sin pagar no lo ven el comercio ni los repartidores.
DROP POLICY IF EXISTS "Comercios ven pedidos recibidos" ON public.delivery_pedidos;
CREATE POLICY "Comercios ven pedidos recibidos" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (pago_estado NOT IN ('pendiente', 'rechazado') AND EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));

DROP POLICY IF EXISTS "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos;
CREATE POLICY "Repartidores ven pedidos disponibles y asignados" ON public.delivery_pedidos FOR SELECT TO authenticated
  USING (
    repartidor_id = auth.uid()
    OR (repartidor_id IS NULL AND estado IN ('confirmado', 'preparando') AND pago_estado NOT IN ('pendiente', 'rechazado')
        AND EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = auth.uid() AND r.activo))
  );

-- Si se cancela un pedido ya pagado online, queda marcado para reintegrar el dinero.
CREATE OR REPLACE FUNCTION public.delivery_marcar_reintegro()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'cancelado' AND OLD.estado <> 'cancelado' AND OLD.pago_estado = 'aprobado' THEN
    NEW.pago_estado := 'a_reintegrar';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_reintegro ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_reintegro BEFORE UPDATE ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_marcar_reintegro();

-- Avisos: un pedido pagado online recién "entra" para el comercio cuando se aprueba el pago.
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

-- Pedidos con pago online sin completar: se cancelan solos a los 30 minutos y se devuelve el stock.
CREATE OR REPLACE FUNCTION public.delivery_cancelar_impagos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido record; v_total integer := 0;
BEGIN
  FOR v_pedido IN SELECT id, cupon_codigo FROM public.delivery_pedidos
    WHERE estado = 'pendiente' AND pago_estado IN ('pendiente', 'rechazado') AND created_at < now() - interval '30 minutes' FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.delivery_pedidos SET estado = 'cancelado', cancelado_at = now(), motivo_cancelacion = 'No se completó el pago online' WHERE id = v_pedido.id;
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
REVOKE ALL ON FUNCTION public.delivery_cancelar_impagos() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'delivery-cancelar-impagos';
SELECT cron.schedule('delivery-cancelar-impagos', '*/5 * * * *', 'SELECT public.delivery_cancelar_impagos()');

-- Pedido con pago online: reutiliza delivery_crear_pedido (mismas validaciones y precios) y lo marca
-- como "esperando pago" antes de que se dispare el aviso al comercio.
CREATE OR REPLACE FUNCTION public.delivery_marcar_pago_online()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('woref.pago_online', true) = '1' THEN
    NEW.metodo_pago := 'mercadopago';
    NEW.pago_estado := 'pendiente';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_pago_online ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_pago_online BEFORE INSERT ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_marcar_pago_online();

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
  p_longitud numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido uuid;
BEGIN
  IF NOT public.delivery_pagos_online_activos() THEN RAISE EXCEPTION 'El pago online no está disponible por ahora'; END IF;
  PERFORM set_config('woref.pago_online', '1', true);
  v_pedido := public.delivery_crear_pedido(p_comercio, p_items, p_direccion, p_direccion_id, 'efectivo', p_propina, p_cupon, p_notas, p_telefono, p_latitud, p_longitud);
  PERFORM set_config('woref.pago_online', '', true);
  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.delivery_crear_pedido_online(uuid, jsonb, text, uuid, numeric, text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido_online(uuid, jsonb, text, uuid, numeric, text, text, text, numeric, numeric) TO authenticated;

-- El admin marca como hecho el reintegro de un pedido pagado y cancelado.
CREATE OR REPLACE FUNCTION public.delivery_admin_marcar_reintegrado(p_pedido uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  UPDATE public.delivery_pedidos SET pago_estado = 'reintegrado' WHERE id = p_pedido AND pago_estado = 'a_reintegrar';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese pedido no tiene un reintegro pendiente'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_marcar_reintegrado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_marcar_reintegrado(uuid) TO authenticated;
