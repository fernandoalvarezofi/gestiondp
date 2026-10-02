-- Zonas (geocercas) con recargo/cierre y tarifa dinámica (demanda + clima) aplicada al costo de envío.

CREATE OR REPLACE FUNCTION public.delivery_poligono_valido(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE pt jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) < 3 OR jsonb_array_length(p) > 200 THEN RETURN false; END IF;
  FOR pt IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(pt) <> 'array' OR jsonb_array_length(pt) <> 2
       OR jsonb_typeof(pt->0) <> 'number' OR jsonb_typeof(pt->1) <> 'number'
       OR (pt->>0)::numeric NOT BETWEEN -90 AND 90 OR (pt->>1)::numeric NOT BETWEEN -180 AND 180 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_zonas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 60),
  poligono jsonb NOT NULL CHECK (public.delivery_poligono_valido(poligono)),
  activa boolean NOT NULL DEFAULT true,
  cerrada boolean NOT NULL DEFAULT false,
  multiplicador numeric NOT NULL DEFAULT 1 CHECK (multiplicador BETWEEN 1 AND 3),
  recargo numeric NOT NULL DEFAULT 0 CHECK (recargo BETWEEN 0 AND 20000),
  nota text CHECK (nota IS NULL OR length(nota) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zonas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Zonas: administración" ON public.delivery_zonas;
CREATE POLICY "Zonas: administración" ON public.delivery_zonas FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));
REVOKE ALL ON public.delivery_zonas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zonas TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_zonas_touch() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS delivery_zonas_touch_trg ON public.delivery_zonas;
CREATE TRIGGER delivery_zonas_touch_trg BEFORE UPDATE ON public.delivery_zonas FOR EACH ROW EXECUTE FUNCTION public.delivery_zonas_touch();
DROP TRIGGER IF EXISTS delivery_aud_zonas ON public.delivery_zonas;
CREATE TRIGGER delivery_aud_zonas AFTER INSERT OR UPDATE ON public.delivery_zonas FOR EACH ROW EXECUTE FUNCTION public.delivery_auditar_cambio('id', 'nombre', 'activa', 'cerrada', 'multiplicador', 'recargo');

-- Punto dentro de polígono (trazado de rayos). Polígono = [[lat,lng], ...].
CREATE OR REPLACE FUNCTION public.delivery_punto_en_poligono(p_lat numeric, p_lng numeric, p_poly jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE n int := jsonb_array_length(p_poly); i int; j int := n - 1; inside boolean := false;
  yi numeric; xi numeric; yj numeric; xj numeric;
BEGIN
  FOR i IN 0..n - 1 LOOP
    yi := (p_poly->i->>0)::numeric; xi := (p_poly->i->>1)::numeric;
    yj := (p_poly->j->>0)::numeric; xj := (p_poly->j->>1)::numeric;
    IF ((yi > p_lat) <> (yj > p_lat)) AND (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) THEN inside := NOT inside; END IF;
    j := i;
  END LOOP;
  RETURN inside;
END $$;

-- Ajustes de la tarifa dinámica
INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('surge_auto', 1, 'Tarifa dinámica por demanda', '1 = el costo de envío sube solo cuando hay más pedidos esperando repartidor que repartidores libres. 0 = desactivada.', '', 0, 1),
  ('surge_max_demanda', 0.5, 'Tope del recargo por demanda', 'Máximo aumento automático por alta demanda (0,5 = hasta +50%).', 'x', 0, 1.5),
  ('clima_activo', 0, 'Recargo por clima (lluvia, tormenta)', '1 = aplicar el recargo por clima a todos los envíos mientras dure el mal tiempo. Los repartidores cobran más por esos envíos.', '', 0, 1),
  ('clima_recargo_pct', 15, 'Recargo por clima', 'Porcentaje que se suma al costo de envío cuando el recargo por clima está activo.', '%', 0, 100)
ON CONFLICT (clave) DO NOTHING;

-- Demanda actual: pedidos con envío esperando repartidor vs repartidores libres.
CREATE OR REPLACE FUNCTION public.delivery_demanda_actual() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pend int; v_rep int; v_ratio numeric; v_extra numeric := 0;
BEGIN
  SELECT count(*) INTO v_pend FROM public.delivery_pedidos
    WHERE tipo_entrega = 'delivery' AND repartidor_id IS NULL AND estado IN ('confirmado', 'preparando', 'listo') AND created_at > now() - interval '3 hours';
  SELECT count(*) INTO v_rep FROM public.delivery_repartidores r
    WHERE r.activo AND r.verificado AND r.disponible AND NOT public.delivery_repartidor_ocupado(r.perfil_id);
  v_ratio := v_pend::numeric / greatest(v_rep, 1);
  IF public.delivery_ajuste('surge_auto', 1) >= 1 AND v_pend >= 2 AND v_ratio > 1 THEN
    v_extra := least(public.delivery_ajuste('surge_max_demanda', 0.5), round(0.15 * (v_ratio - 1) / 0.05) * 0.05);
  END IF;
  RETURN jsonb_build_object('pendientes', v_pend, 'repartidores_libres', v_rep, 'ratio', round(v_ratio, 2), 'recargo', v_extra);
END $$;

-- Tarifa para un punto: zona que lo contiene + demanda + clima. Público (el carrito la consulta antes de pedir).
CREATE OR REPLACE FUNCTION public.delivery_tarifa_zona(p_lat numeric, p_lng numeric) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE z public.delivery_zonas; d jsonb; v_mult numeric := 1; v_motivos text[] := '{}'; v_clima numeric := 0;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN RETURN jsonb_build_object('zona', null, 'cerrada', false, 'multiplicador', 1, 'recargo', 0, 'motivos', '[]'::jsonb); END IF;
  SELECT * INTO z FROM public.delivery_zonas WHERE activa AND public.delivery_punto_en_poligono(p_lat, p_lng, poligono)
    ORDER BY cerrada DESC, multiplicador DESC, recargo DESC LIMIT 1;
  IF FOUND AND z.cerrada THEN
    RETURN jsonb_build_object('zona', z.nombre, 'zona_id', z.id, 'cerrada', true, 'multiplicador', 1, 'recargo', 0, 'motivos', jsonb_build_array('Sin entregas en ' || z.nombre));
  END IF;
  IF FOUND THEN
    v_mult := z.multiplicador;
    IF z.multiplicador > 1 THEN v_motivos := v_motivos || ('Zona ' || z.nombre || ' +' || round((z.multiplicador - 1) * 100) || '%'); END IF;
    IF z.recargo > 0 THEN v_motivos := v_motivos || ('Zona ' || z.nombre || ' +$' || z.recargo::int); END IF;
  END IF;
  d := public.delivery_demanda_actual();
  IF (d->>'recargo')::numeric > 0 THEN v_mult := v_mult + (d->>'recargo')::numeric; v_motivos := v_motivos || ('Alta demanda +' || round((d->>'recargo')::numeric * 100) || '%'); END IF;
  IF public.delivery_ajuste('clima_activo', 0) >= 1 THEN
    v_clima := public.delivery_ajuste('clima_recargo_pct', 15) / 100;
    IF v_clima > 0 THEN v_mult := v_mult + v_clima; v_motivos := v_motivos || ('Mal clima +' || round(v_clima * 100) || '%'); END IF;
  END IF;
  RETURN jsonb_build_object('zona', CASE WHEN z.id IS NULL THEN NULL ELSE z.nombre END, 'zona_id', z.id, 'cerrada', false,
    'multiplicador', least(v_mult, 3), 'recargo', coalesce(z.recargo, 0), 'motivos', to_jsonb(v_motivos));
END $$;

CREATE OR REPLACE FUNCTION public.delivery_aplicar_tarifa(p_costo numeric, p_tarifa jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(p_costo, 0) <= 0 THEN coalesce(p_costo, 0)
    ELSE round((p_costo * coalesce((p_tarifa->>'multiplicador')::numeric, 1) + coalesce((p_tarifa->>'recargo')::numeric, 0)) / 10) * 10 END
$$;

REVOKE ALL ON FUNCTION public.delivery_demanda_actual() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_demanda_actual() TO authenticated;
REVOKE ALL ON FUNCTION public.delivery_tarifa_zona(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_tarifa_zona(numeric, numeric) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_aplicar_tarifa(numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_aplicar_tarifa(numeric, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_punto_en_poligono(numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_punto_en_poligono(numeric, numeric, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.delivery_poligono_valido(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_poligono_valido(jsonb) TO authenticated;

-- Pedidos: guardar qué tarifa se aplicó (transparencia y auditoría)
ALTER TABLE public.delivery_pedidos ADD COLUMN IF NOT EXISTS tarifa_detalle jsonb;

-- Pedido con envío: aplicar la tarifa (y bloquear zonas cerradas)
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.delivery_crear_pedido'::regproc) INTO d;
  IF position('v_tarifa' IN d) = 0 THEN
    d := replace(d, 'v_estimada timestamptz;', 'v_estimada timestamptz; v_tarifa jsonb;');
    IF position('v_tarifa jsonb' IN d) = 0 THEN RAISE EXCEPTION 'patch declare'; END IF;
    d := replace(d, E'    v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);\n',
      E'    v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);\n    IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN\n      v_tarifa := public.delivery_tarifa_zona(v_lat, v_lng);\n      IF (v_tarifa->>''cerrada'')::boolean THEN RAISE EXCEPTION ''Por ahora no entregamos en %'', v_tarifa->>''zona''; END IF;\n      v_envio := public.delivery_aplicar_tarifa(v_envio, v_tarifa);\n    END IF;\n');
    IF position('delivery_aplicar_tarifa' IN d) = 0 THEN RAISE EXCEPTION 'patch envio'; END IF;
    d := replace(d, 'programado_para, efectivo_paga_con' || E'\n  ) VALUES (', 'programado_para, efectivo_paga_con, tarifa_detalle' || E'\n  ) VALUES (');
    d := replace(d, 'p_programado_para, p_paga_con' || E'\n  ) RETURNING', 'p_programado_para, p_paga_con, CASE WHEN v_retiro THEN NULL ELSE v_tarifa END' || E'\n  ) RETURNING');
    IF position('tarifa_detalle' IN d) = 0 OR position('CASE WHEN v_retiro THEN NULL ELSE v_tarifa' IN d) = 0 THEN RAISE EXCEPTION 'patch insert'; END IF;
    EXECUTE d;
  END IF;
END $mig$;

-- Mensajería: la tarifa aplica según origen y destino (la más alta); sube también la ganancia del repartidor.
CREATE OR REPLACE FUNCTION public.delivery_cotizar_envio(p_olat numeric, p_olng numeric, p_dlat numeric, p_dlng numeric, p_tamano text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_km numeric; v_costo numeric; v_base numeric; v_rec numeric; v_comision numeric := public.delivery_ajuste('mensajeria_comision_pct', 20);
  c_lat constant numeric := -34.8667; c_lng constant numeric := -61.5333;
  v_to jsonb; v_td jsonb; v_t jsonb;
BEGIN
  IF p_olat IS NULL OR p_olng IS NULL OR p_dlat IS NULL OR p_dlng IS NULL
     OR p_olat NOT BETWEEN -90 AND 90 OR p_dlat NOT BETWEEN -90 AND 90 OR p_olng NOT BETWEEN -180 AND 180 OR p_dlng NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Marcá el retiro y la entrega en el mapa');
  END IF;
  IF p_tamano NOT IN ('sobre', 'chico', 'mediano', 'grande') THEN RETURN jsonb_build_object('ok', false, 'motivo', 'Elegí el tamaño del paquete'); END IF;
  v_km := public.delivery_ruta_km(p_olat, p_olng, p_dlat, p_dlng);
  IF public.delivery_distancia_km(p_olat, p_olng, c_lat, c_lng) > public.delivery_ajuste('mensajeria_radio_km', 15)
     OR public.delivery_distancia_km(p_dlat, p_dlng, c_lat, c_lng) > public.delivery_ajuste('mensajeria_radio_km', 15) THEN
    RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Todavía solo hacemos envíos dentro de Lincoln y alrededores');
  END IF;
  IF v_km > public.delivery_ajuste('mensajeria_max_km', 12) THEN
    RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'La distancia máxima por envío es de ' || public.delivery_ajuste('mensajeria_max_km', 12) || ' km');
  END IF;
  v_to := public.delivery_tarifa_zona(p_olat, p_olng); v_td := public.delivery_tarifa_zona(p_dlat, p_dlng);
  IF (v_to->>'cerrada')::boolean THEN RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no retiramos en ' || (v_to->>'zona')); END IF;
  IF (v_td->>'cerrada')::boolean THEN RETURN jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no entregamos en ' || (v_td->>'zona')); END IF;
  v_t := CASE WHEN (v_to->>'multiplicador')::numeric >= (v_td->>'multiplicador')::numeric THEN v_to ELSE v_td END;
  v_t := jsonb_set(v_t, '{recargo}', to_jsonb(greatest((v_to->>'recargo')::numeric, (v_td->>'recargo')::numeric)));
  v_rec := CASE p_tamano WHEN 'mediano' THEN 300 WHEN 'grande' THEN 800 ELSE 0 END;
  v_base := public.delivery_costo_envio(public.delivery_ajuste('mensajeria_base', 1500), public.delivery_ajuste('mensajeria_por_km', 350), v_km) + v_rec;
  v_costo := public.delivery_aplicar_tarifa(v_base, v_t);
  RETURN jsonb_build_object('ok', true, 'km', v_km, 'costo', v_costo, 'costo_base', v_base, 'tarifa', v_t, 'comision_pct', v_comision,
    'ganancia', round(v_costo * (1 - v_comision / 100) / 10) * 10);
END $$;
