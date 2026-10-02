-- Etapa 4: notificaciones push. Los valores secretos (clave VAPID privada, secreto del webhook)
-- se cargan aparte en app_config y nunca se guardan en el repositorio.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Configuración privada: solo la leen funciones del servidor.
CREATE TABLE IF NOT EXISTS public.app_config (
  clave text PRIMARY KEY,
  valor text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT ALL ON public.app_config TO service_role;

CREATE TABLE IF NOT EXISTS public.delivery_push_suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  dispositivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_push_suscripciones_perfil_idx ON public.delivery_push_suscripciones(perfil_id);
ALTER TABLE public.delivery_push_suscripciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.delivery_push_suscripciones TO authenticated;
GRANT ALL ON public.delivery_push_suscripciones TO service_role;
CREATE POLICY "Usuarios ven sus dispositivos" ON public.delivery_push_suscripciones FOR SELECT TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "Usuarios quitan sus dispositivos" ON public.delivery_push_suscripciones FOR DELETE TO authenticated USING (perfil_id = auth.uid());

-- Alta de un dispositivo. Si el navegador ya estaba registrado por otra cuenta (compu compartida), pasa a la actual.
CREATE OR REPLACE FUNCTION public.delivery_guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión'; END IF;
  IF p_endpoint !~ '^https://' OR length(p_endpoint) > 1000 THEN RAISE EXCEPTION 'Suscripción inválida'; END IF;
  INSERT INTO public.delivery_push_suscripciones (perfil_id, endpoint, p256dh, auth, dispositivo)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 120))
  ON CONFLICT (endpoint) DO UPDATE SET perfil_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, dispositivo = excluded.dispositivo, created_at = now();
END $$;
REVOKE ALL ON FUNCTION public.delivery_guardar_suscripcion(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_guardar_suscripcion(text, text, text, text) TO authenticated;

-- Avisa a la función "enviar-push" cuando entra un pedido, cambia de estado o lo toma un repartidor.
-- pg_net manda la llamada recién cuando se confirma la transacción, así que los ítems ya están guardados.
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
  -- Una falla al avisar nunca debe impedir crear o actualizar un pedido.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.delivery_notificar_pedido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS delivery_pedidos_notificar ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_notificar AFTER INSERT OR UPDATE ON public.delivery_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notificar_pedido();
