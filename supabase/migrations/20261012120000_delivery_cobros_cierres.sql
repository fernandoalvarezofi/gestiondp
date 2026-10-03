-- 1) Datos de cobro (CBU/alias) de comercios y repartidores: privados, validados y con auditoría.
CREATE OR REPLACE FUNCTION public.delivery_cbu_valido(p_cbu text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  d int[];
  w1 int[] := ARRAY[7,1,3,9,7,1,3];
  w2 int[] := ARRAY[3,9,7,1,3,9,7,1,3,9,7,1,3];
  s int := 0;
  i int;
BEGIN
  IF p_cbu IS NULL OR p_cbu !~ '^[0-9]{22}$' THEN RETURN false; END IF;
  SELECT array_agg(c::int ORDER BY o) INTO d FROM regexp_split_to_table(p_cbu, '') WITH ORDINALITY AS t(c, o);
  FOR i IN 1..7 LOOP s := s + d[i] * w1[i]; END LOOP;
  IF (10 - (s % 10)) % 10 <> d[8] THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..13 LOOP s := s + d[8 + i] * w2[i]; END LOOP;
  RETURN (10 - (s % 10)) % 10 = d[22];
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_datos_cobro (
  entidad text NOT NULL CHECK (entidad IN ('comercio', 'repartidor')),
  entidad_id uuid NOT NULL,
  titular text NOT NULL CHECK (char_length(titular) BETWEEN 5 AND 120),
  cuit text NOT NULL CHECK (cuit ~ '^[0-9]{11}$'),
  cbu text CHECK (cbu IS NULL OR cbu ~ '^[0-9]{22}$'),
  alias text CHECK (alias IS NULL OR alias ~ '^[A-Za-z0-9.-]{6,20}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (entidad, entidad_id),
  CHECK (cbu IS NOT NULL OR alias IS NOT NULL)
);
ALTER TABLE public.delivery_datos_cobro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_datos_cobro FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_datos_cobro TO authenticated;
GRANT ALL ON public.delivery_datos_cobro TO service_role;
DROP POLICY IF EXISTS "Cobro: el titular, quien ve finanzas o administración" ON public.delivery_datos_cobro;
CREATE POLICY "Cobro: el titular, quien ve finanzas o administración" ON public.delivery_datos_cobro FOR SELECT TO authenticated USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR (entidad = 'repartidor' AND entidad_id = (SELECT auth.uid()))
  OR (entidad = 'comercio' AND public.delivery_puede_ver_finanzas(entidad_id))
);

CREATE OR REPLACE FUNCTION public.delivery_cobro_guardar(p_entidad text, p_entidad_id uuid, p_titular text, p_cuit text, p_cbu text, p_alias text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_titular text := regexp_replace(trim(coalesce(p_titular, '')), '\s+', ' ', 'g');
  v_cuit text := regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g');
  v_cbu text := nullif(regexp_replace(coalesce(p_cbu, ''), '\s', '', 'g'), '');
  v_alias text := nullif(trim(coalesce(p_alias, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  IF p_entidad = 'repartidor' THEN
    IF p_entidad_id <> v_uid OR NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = v_uid) THEN RAISE EXCEPTION 'No podés cambiar los datos de cobro de esta cuenta'; END IF;
  ELSIF p_entidad = 'comercio' THEN
    IF NOT coalesce((SELECT propietario_id = v_uid FROM public.delivery_comercios WHERE id = p_entidad_id), false) THEN RAISE EXCEPTION 'Solo el dueño puede cambiar los datos de cobro'; END IF;
  ELSE RAISE EXCEPTION 'Entidad inválida'; END IF;
  IF char_length(v_titular) < 5 OR v_titular !~ '\s' THEN RAISE EXCEPTION 'Ingresá el nombre completo o la razón social del titular de la cuenta'; END IF;
  IF NOT public.delivery_cuit_valido(v_cuit) THEN RAISE EXCEPTION 'El CUIT o CUIL del titular no es válido'; END IF;
  IF v_cbu IS NULL AND v_alias IS NULL THEN RAISE EXCEPTION 'Ingresá el CBU o el alias de la cuenta'; END IF;
  IF v_cbu IS NOT NULL AND NOT public.delivery_cbu_valido(v_cbu) THEN RAISE EXCEPTION 'El CBU no es válido: revisá los 22 números'; END IF;
  IF v_alias IS NOT NULL AND v_alias !~ '^[A-Za-z0-9.-]{6,20}$' THEN RAISE EXCEPTION 'El alias tiene entre 6 y 20 caracteres: letras, números, punto o guion'; END IF;

  INSERT INTO public.delivery_datos_cobro (entidad, entidad_id, titular, cuit, cbu, alias, updated_by)
  VALUES (p_entidad, p_entidad_id, v_titular, v_cuit, v_cbu, v_alias, v_uid)
  ON CONFLICT (entidad, entidad_id) DO UPDATE SET titular = EXCLUDED.titular, cuit = EXCLUDED.cuit, cbu = EXCLUDED.cbu, alias = EXCLUDED.alias, updated_at = now(), updated_by = v_uid;
  -- Queda registrado quién y cuándo lo cambió (sin guardar el número de cuenta en la auditoría).
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
  VALUES (v_uid, 'cobro_actualizado', p_entidad, p_entidad_id::text, jsonb_build_object('terminacion_cbu', right(coalesce(v_cbu, ''), 4), 'alias', v_alias));
END $$;
REVOKE ALL ON FUNCTION public.delivery_cobro_guardar(text, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_cobro_guardar(text, uuid, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.delivery_cbu_valido(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_cbu_valido(text) TO authenticated, service_role;

-- 2) Cierres especiales (feriados, vacaciones): viven dentro de "horarios" -> "cierres" y los respeta delivery_abierto_ahora.
-- Formato: {"cierres": [{"desde": "2026-12-24", "hasta": "2026-12-25", "motivo": "Navidad"}]}
CREATE OR REPLACE FUNCTION public.delivery_abierto_ahora(p_horarios jsonb, p_momento timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_local timestamp := p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_hoy text := extract(dow FROM v_local)::int::text;
  v_ayer text := ((extract(dow FROM v_local)::int + 6) % 7)::text;
  v_hora time := v_local::time;
  v_turno jsonb;
  v_cierre jsonb;
  v_abre time;
  v_cierra time;
BEGIN
  IF p_horarios IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p_horarios->'cierres') = 'array' THEN
    FOR v_cierre IN SELECT * FROM jsonb_array_elements(p_horarios->'cierres') LOOP
      BEGIN
        IF v_local::date BETWEEN (v_cierre->>'desde')::date AND coalesce((v_cierre->>'hasta')::date, (v_cierre->>'desde')::date) THEN RETURN false; END IF;
      EXCEPTION WHEN others THEN CONTINUE; -- un cierre mal cargado se ignora, no rompe el pedido
      END;
    END LOOP;
  END IF;
  FOR v_turno IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios->v_hoy, '[]'::jsonb)) LOOP
    v_abre := (v_turno->>'abre')::time;
    v_cierra := (v_turno->>'cierra')::time;
    IF v_cierra > v_abre AND v_hora >= v_abre AND v_hora < v_cierra THEN RETURN true; END IF;
    IF v_cierra <= v_abre AND v_hora >= v_abre THEN RETURN true; END IF;
  END LOOP;
  FOR v_turno IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios->v_ayer, '[]'::jsonb)) LOOP
    v_abre := (v_turno->>'abre')::time;
    v_cierra := (v_turno->>'cierra')::time;
    IF v_cierra <= v_abre AND v_hora < v_cierra THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
