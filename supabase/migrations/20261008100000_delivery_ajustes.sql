-- Ajustes de la plataforma editables por administración (antes estaban fijos en el código).

CREATE TABLE IF NOT EXISTS public.delivery_ajustes (
  clave text PRIMARY KEY,
  valor numeric NOT NULL,
  etiqueta text NOT NULL,
  ayuda text,
  unidad text NOT NULL DEFAULT '',
  minimo numeric NOT NULL,
  maximo numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  CHECK (valor BETWEEN minimo AND maximo)
);

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('tarifa_servicio_pct', 5, 'Tarifa de servicio al cliente', 'Porcentaje del subtotal que se le suma al cliente en cada pedido.', '%', 0, 30),
  ('comision_default_pct', 10, 'Comisión por defecto a comercios', 'Porcentaje que se asigna a cada comercio nuevo. Se puede ajustar comercio por comercio.', '%', 0, 40),
  ('minutos_responder', 10, 'Tiempo para que el comercio responda', 'Si no acepta ni rechaza en este tiempo, el pedido se cancela solo.', 'min', 3, 30),
  ('segundos_oferta', 45, 'Tiempo de cada oferta al repartidor', 'Cuánto tiene cada repartidor para aceptar antes de pasarle la oferta al siguiente.', 's', 20, 120)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.delivery_ajustes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_ajustes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_ajustes TO anon, authenticated;
GRANT ALL ON public.delivery_ajustes TO service_role;
DROP POLICY IF EXISTS "Ajustes visibles" ON public.delivery_ajustes;
CREATE POLICY "Ajustes visibles" ON public.delivery_ajustes FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.delivery_ajuste(p_clave text, p_defecto numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT valor FROM public.delivery_ajustes WHERE clave = p_clave), p_defecto)
$$;
REVOKE ALL ON FUNCTION public.delivery_ajuste(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_ajuste(text, numeric) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_guardar_ajuste(p_clave text, p_valor numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.delivery_ajustes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO a FROM public.delivery_ajustes WHERE clave = p_clave;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste inexistente'; END IF;
  IF p_valor IS NULL OR p_valor < a.minimo OR p_valor > a.maximo THEN
    RAISE EXCEPTION '% tiene que estar entre % y % %', a.etiqueta, a.minimo, a.maximo, a.unidad;
  END IF;
  UPDATE public.delivery_ajustes SET valor = p_valor, updated_at = now(), updated_by = auth.uid() WHERE clave = p_clave;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_guardar_ajuste(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_guardar_ajuste(text, numeric) TO authenticated;

-- Las funciones que usaban valores fijos pasan a leer los ajustes.
DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  -- Tarifa de servicio en la creación de pedidos
  v_def := pg_get_functiondef('public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric)'::regprocedure);
  v_new := replace(v_def, 'v_servicio := round(v_subtotal * 0.05);', 'v_servicio := round(v_subtotal * public.delivery_ajuste(''tarifa_servicio_pct'', 5) / 100);');
  IF v_new = v_def THEN RAISE EXCEPTION 'No se encontró la tarifa de servicio fija'; END IF;
  EXECUTE v_new;

  -- Tiempo para responder
  v_def := pg_get_functiondef('public.delivery_marcar_visible()'::regprocedure);
  v_new := replace(v_def, 'now() + interval ''10 minutes''', 'now() + make_interval(mins => public.delivery_ajuste(''minutos_responder'', 10)::integer)');
  IF v_new = v_def THEN RAISE EXCEPTION 'No se encontró el tiempo de respuesta fijo'; END IF;
  EXECUTE v_new;

  -- Tiempo de cada oferta al repartidor
  v_def := pg_get_functiondef('public.delivery_ofertas_visibles(uuid)'::regprocedure);
  v_new := replace(replace(v_def, 'floor(extract(epoch FROM now() - r.base) / 45)', 'floor(extract(epoch FROM now() - r.base) / public.delivery_ajuste(''segundos_oferta'', 45))'), '(t.slot + 1) * 45', '(t.slot + 1) * public.delivery_ajuste(''segundos_oferta'', 45)');
  IF v_new = v_def THEN RAISE EXCEPTION 'No se encontró el tiempo de oferta fijo'; END IF;
  EXECUTE v_new;

  -- Comisión por defecto de los comercios nuevos
  v_def := pg_get_functiondef('public.delivery_proteger_comercio()'::regprocedure);
  v_new := replace(v_def, 'NEW.comision_pct := 10;', 'NEW.comision_pct := public.delivery_ajuste(''comision_default_pct'', 10);');
  IF v_new = v_def THEN RAISE EXCEPTION 'No se encontró la comisión fija'; END IF;
  EXECUTE v_new;
END $$;
