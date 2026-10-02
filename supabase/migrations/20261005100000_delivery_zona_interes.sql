-- Demanda por zona: cuando alguien pide desde un lugar al que no llega ningún comercio, queda registrado.
-- El administrador ve dónde hay más pedidos sin cobertura para decidir dónde sumar comercios.

CREATE TABLE IF NOT EXISTS public.delivery_zona_interes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  latitud numeric(10,7) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
  longitud numeric(10,7) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  direccion text CHECK (direccion IS NULL OR char_length(direccion) <= 300),
  comercio_mas_cercano_km numeric(7,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_zona_interes_perfil_idx ON public.delivery_zona_interes(perfil_id, created_at DESC);

ALTER TABLE public.delivery_zona_interes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_zona_interes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.delivery_zona_interes TO service_role;
DROP POLICY IF EXISTS "Usuarios ven su interés" ON public.delivery_zona_interes;
GRANT SELECT ON public.delivery_zona_interes TO authenticated;
CREATE POLICY "Usuarios ven su interés" ON public.delivery_zona_interes FOR SELECT TO authenticated USING (perfil_id = auth.uid());

-- Registra el interés (a lo sumo una vez por día y por lugar de ~1 km). El servidor calcula el comercio más cercano.
CREATE OR REPLACE FUNCTION public.delivery_registrar_zona(p_lat numeric, p_lng numeric, p_direccion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cercano numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Ubicación inválida'; END IF;

  SELECT min(public.delivery_distancia_km(c.latitud, c.longitud, p_lat, p_lng)) INTO v_cercano
    FROM public.delivery_comercios c WHERE c.activo AND c.aprobado AND c.latitud IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM public.delivery_zona_interes z
    WHERE z.perfil_id = v_uid AND z.created_at > now() - interval '1 day'
      AND public.delivery_distancia_km(z.latitud, z.longitud, p_lat, p_lng) < 1
  ) THEN
    RETURN jsonb_build_object('registrado', false, 'ya_registrado', true, 'comercio_mas_cercano_km', v_cercano);
  END IF;
  IF (SELECT count(*) FROM public.delivery_zona_interes WHERE perfil_id = v_uid AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'Ya registramos varios lugares hoy. Probá mañana.';
  END IF;

  INSERT INTO public.delivery_zona_interes (perfil_id, latitud, longitud, direccion, comercio_mas_cercano_km)
    VALUES (v_uid, p_lat, p_lng, nullif(left(trim(coalesce(p_direccion, '')), 300), ''), v_cercano);
  RETURN jsonb_build_object('registrado', true, 'ya_registrado', false, 'comercio_mas_cercano_km', v_cercano);
END $$;
REVOKE ALL ON FUNCTION public.delivery_registrar_zona(numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_registrar_zona(numeric, numeric, text) TO authenticated;

-- Demanda agrupada en celdas de ~1 km (últimos 60 días), para el panel de administración.
CREATE OR REPLACE FUNCTION public.delivery_admin_demanda_zonas()
RETURNS TABLE (latitud numeric, longitud numeric, personas integer, solicitudes integer, ultima timestamptz, direccion_ejemplo text, comercio_mas_cercano_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  RETURN QUERY
    SELECT round(z.latitud, 2), round(z.longitud, 2), count(DISTINCT z.perfil_id)::integer, count(*)::integer, max(z.created_at),
           (array_agg(z.direccion ORDER BY z.created_at DESC) FILTER (WHERE z.direccion IS NOT NULL))[1], min(z.comercio_mas_cercano_km)
    FROM public.delivery_zona_interes z
    WHERE z.created_at > now() - interval '60 days'
    GROUP BY round(z.latitud, 2), round(z.longitud, 2)
    ORDER BY count(DISTINCT z.perfil_id) DESC, max(z.created_at) DESC
    LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_demanda_zonas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_demanda_zonas() TO authenticated;
