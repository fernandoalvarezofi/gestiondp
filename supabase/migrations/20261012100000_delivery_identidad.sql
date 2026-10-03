-- Verificación de identidad: datos legales + documentos + desafío de la selfie + revisión de administración con lista de controles.
-- Sirve para repartidores (obligatoria para conectarse) y para cualquier persona (nivel de cuenta verificada).

ALTER TABLE public.delivery_documentos DROP CONSTRAINT IF EXISTS delivery_documentos_entidad_check;
ALTER TABLE public.delivery_documentos ADD CONSTRAINT delivery_documentos_entidad_check CHECK (entidad IN ('repartidor', 'comercio', 'persona'));

CREATE TABLE IF NOT EXISTS public.delivery_identidad (
  perfil_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_legal text NOT NULL CHECK (char_length(nombre_legal) BETWEEN 5 AND 120),
  dni text NOT NULL CHECK (dni ~ '^[0-9]{7,8}$'),
  fecha_nacimiento date CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento > DATE '1900-01-01'),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'aprobada', 'rechazada')),
  motivo_rechazo text CHECK (motivo_rechazo IS NULL OR char_length(motivo_rechazo) <= 300),
  desafio text NOT NULL,
  intentos integer NOT NULL DEFAULT 0,
  enviado_at timestamptz,
  revisado_at timestamptz,
  revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  controles jsonb NOT NULL DEFAULT '{}'::jsonb,
  vence_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un mismo DNI no puede estar en revisión o aprobado en dos cuentas (evita cuentas duplicadas y fraude).
CREATE UNIQUE INDEX IF NOT EXISTS delivery_identidad_dni_unico ON public.delivery_identidad (dni) WHERE estado IN ('en_revision', 'aprobada');
CREATE INDEX IF NOT EXISTS delivery_identidad_estado_idx ON public.delivery_identidad (estado, enviado_at);

ALTER TABLE public.delivery_identidad ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_identidad FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_identidad TO authenticated;
GRANT ALL ON public.delivery_identidad TO service_role;
DROP POLICY IF EXISTS "Identidad: la propia o administración" ON public.delivery_identidad;
CREATE POLICY "Identidad: la propia o administración" ON public.delivery_identidad FOR SELECT TO authenticated
  USING (perfil_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Los documentos de una persona (sin ser repartidor) también los ve ella misma.
DROP POLICY IF EXISTS "Documentos: dueño y administración" ON public.delivery_documentos;
CREATE POLICY "Documentos: dueño y administración" ON public.delivery_documentos FOR SELECT TO authenticated USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR (entidad IN ('repartidor', 'persona') AND entidad_id = (SELECT auth.uid()))
  OR (entidad = 'comercio' AND public.delivery_puede_ver_finanzas(entidad_id))
);

-- Personas que ya estaban verificadas como repartidores: pasan a tener identidad aprobada (sin repetir el trámite).
INSERT INTO public.delivery_identidad (perfil_id, nombre_legal, dni, estado, desafio, revisado_at, vence_at, enviado_at)
SELECT DISTINCT ON (r.dni) r.perfil_id, coalesce(nullif(trim(p.nombre), ''), 'Repartidor Woref'), regexp_replace(r.dni, '\D', '', 'g'),
       CASE WHEN r.verificado THEN 'aprobada' WHEN r.motivo_rechazo IS NOT NULL THEN 'rechazada' ELSE 'pendiente' END,
       'Mostrá la palma de la mano abierta', r.verificado_at, CASE WHEN r.verificado THEN now() + interval '1 year' END, r.created_at
FROM public.delivery_repartidores r LEFT JOIN public.perfiles p ON p.id = r.perfil_id
WHERE r.dni ~ '^[0-9]{7,8}$' AND char_length(coalesce(nullif(trim(p.nombre), ''), 'Repartidor Woref')) >= 5
ORDER BY r.dni, r.verificado DESC, r.created_at
ON CONFLICT (perfil_id) DO NOTHING;

-- Documentos: aceptar entidad "persona" y no dejar tocar los de una identidad ya aprobada.
CREATE OR REPLACE FUNCTION public.delivery_documento_registrar(p_entidad text, p_entidad_id uuid, p_tipo text, p_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  IF p_path IS NULL OR p_path NOT LIKE auth.uid()::text || '/%' OR p_path LIKE '%..%' THEN RAISE EXCEPTION 'Archivo inválido'; END IF;
  IF p_entidad = 'repartidor' THEN
    IF p_entidad_id <> auth.uid() OR NOT EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = auth.uid()) THEN RAISE EXCEPTION 'No podés cargar documentos de esta cuenta'; END IF;
    IF p_tipo NOT IN ('dni_frente', 'dni_dorso', 'selfie', 'licencia', 'cedula_vehiculo') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
  ELSIF p_entidad = 'persona' THEN
    IF p_entidad_id <> auth.uid() THEN RAISE EXCEPTION 'No podés cargar documentos de otra persona'; END IF;
    IF p_tipo NOT IN ('dni_frente', 'dni_dorso', 'selfie') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
  ELSIF p_entidad = 'comercio' THEN
    IF NOT coalesce((SELECT propietario_id = auth.uid() FROM public.delivery_comercios WHERE id = p_entidad_id), false) THEN RAISE EXCEPTION 'Solo el dueño puede cargar documentos del comercio'; END IF;
    IF p_tipo NOT IN ('habilitacion', 'constancia_afip', 'dni_titular') THEN RAISE EXCEPTION 'Tipo de documento inválido'; END IF;
  ELSE RAISE EXCEPTION 'Entidad inválida'; END IF;

  IF p_entidad IN ('repartidor', 'persona') AND p_tipo IN ('dni_frente', 'dni_dorso', 'selfie') THEN
    IF EXISTS (SELECT 1 FROM public.delivery_identidad WHERE perfil_id = auth.uid() AND estado = 'en_revision') THEN
      RAISE EXCEPTION 'Tu identidad está en revisión: esperá el resultado antes de cambiar los documentos';
    END IF;
  END IF;

  INSERT INTO public.delivery_documentos (entidad, entidad_id, tipo, path, subido_por) VALUES (p_entidad, p_entidad_id, p_tipo, p_path, auth.uid())
  ON CONFLICT (entidad, entidad_id, tipo) DO UPDATE SET path = EXCLUDED.path, subido_por = auth.uid(), created_at = now()
  RETURNING id INTO v_id;

  -- Cambiar un documento de identidad de alguien ya verificado obliga a revisarlo de nuevo.
  IF p_entidad IN ('repartidor', 'persona') AND p_tipo IN ('dni_frente', 'dni_dorso', 'selfie') THEN
    UPDATE public.delivery_identidad SET estado = 'pendiente', vence_at = NULL, controles = '{}'::jsonb, updated_at = now() WHERE perfil_id = auth.uid() AND estado = 'aprobada';
    IF p_entidad = 'repartidor' THEN
      UPDATE public.delivery_repartidores SET verificado = false, verificado_at = NULL, disponible = false WHERE perfil_id = auth.uid() AND verificado;
    END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_documento_quitar(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.delivery_documentos d WHERE d.id = p_id AND d.subido_por = auth.uid()
    AND (d.entidad = 'comercio'
      OR (d.entidad = 'repartidor' AND NOT EXISTS (SELECT 1 FROM public.delivery_repartidores r WHERE r.perfil_id = d.entidad_id AND r.verificado))
      OR (d.entidad = 'persona' AND NOT EXISTS (SELECT 1 FROM public.delivery_identidad i WHERE i.perfil_id = d.entidad_id AND i.estado IN ('en_revision', 'aprobada'))));
  IF NOT FOUND THEN RAISE EXCEPTION 'No podés quitar este documento'; END IF;
END $$;

-- Guarda los datos personales (borrador). Cambiar nombre o DNI de una identidad aprobada obliga a revisarla de nuevo.
CREATE OR REPLACE FUNCTION public.delivery_identidad_guardar(p_nombre text, p_dni text, p_nacimiento date)
RETURNS public.delivery_identidad LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_dni text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
  v_old public.delivery_identidad;
  v_row public.delivery_identidad;
  v_desafios text[] := ARRAY['Mostrá la palma de la mano abierta', 'Levantá dos dedos (paz) al lado de tu cara', 'Tocate la oreja derecha con una mano', 'Hacé el gesto de "ok" con la mano', 'Sostené el DNI y girá la cabeza un poco a la izquierda'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  IF char_length(v_nombre) < 5 OR v_nombre !~ '\s' THEN RAISE EXCEPTION 'Ingresá tu nombre y apellido tal como figuran en el DNI'; END IF;
  IF v_dni !~ '^[0-9]{7,8}$' THEN RAISE EXCEPTION 'El DNI tiene que tener 7 u 8 números, sin puntos'; END IF;
  IF p_nacimiento IS NULL OR p_nacimiento > current_date - interval '18 years' THEN RAISE EXCEPTION 'Tenés que ser mayor de 18 años'; END IF;
  IF p_nacimiento < DATE '1900-01-01' THEN RAISE EXCEPTION 'La fecha de nacimiento no es válida'; END IF;

  SELECT * INTO v_old FROM public.delivery_identidad WHERE perfil_id = v_uid FOR UPDATE;
  IF FOUND AND v_old.estado = 'en_revision' THEN RAISE EXCEPTION 'Tu identidad está en revisión: esperá el resultado'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_identidad WHERE dni = v_dni AND perfil_id <> v_uid AND estado IN ('en_revision', 'aprobada')) THEN
    RAISE EXCEPTION 'Ese DNI ya está asociado a otra cuenta. Si es tuyo, escribinos desde Ayuda';
  END IF;

  INSERT INTO public.delivery_identidad (perfil_id, nombre_legal, dni, fecha_nacimiento, desafio)
  VALUES (v_uid, v_nombre, v_dni, p_nacimiento, v_desafios[1 + floor(random() * array_length(v_desafios, 1))::int])
  ON CONFLICT (perfil_id) DO UPDATE SET
    nombre_legal = EXCLUDED.nombre_legal, dni = EXCLUDED.dni, fecha_nacimiento = EXCLUDED.fecha_nacimiento, updated_at = now(),
    estado = CASE WHEN delivery_identidad.estado = 'aprobada' AND (delivery_identidad.nombre_legal <> EXCLUDED.nombre_legal OR delivery_identidad.dni <> EXCLUDED.dni) THEN 'pendiente' ELSE delivery_identidad.estado END,
    vence_at = CASE WHEN delivery_identidad.estado = 'aprobada' AND (delivery_identidad.nombre_legal <> EXCLUDED.nombre_legal OR delivery_identidad.dni <> EXCLUDED.dni) THEN NULL ELSE delivery_identidad.vence_at END
  RETURNING * INTO v_row;

  -- El repartidor tiene el DNI también en su ficha; las dos tienen que coincidir.
  UPDATE public.delivery_repartidores SET dni = v_dni WHERE perfil_id = v_uid AND dni IS DISTINCT FROM v_dni;
  IF v_old.estado = 'aprobada' AND v_row.estado = 'pendiente' THEN
    UPDATE public.delivery_repartidores SET verificado = false, verificado_at = NULL, disponible = false WHERE perfil_id = v_uid;
  END IF;
  RETURN v_row;
END $$;

-- Envía la identidad a revisión: exige los tres documentos obligatorios.
CREATE OR REPLACE FUNCTION public.delivery_identidad_enviar()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ident public.delivery_identidad;
  v_entidad text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT * INTO v_ident FROM public.delivery_identidad WHERE perfil_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Primero completá tus datos personales'; END IF;
  IF v_ident.estado IN ('en_revision', 'aprobada') THEN RAISE EXCEPTION 'Tu identidad ya está %', CASE v_ident.estado WHEN 'aprobada' THEN 'verificada' ELSE 'en revisión' END; END IF;
  IF v_ident.fecha_nacimiento IS NULL THEN RAISE EXCEPTION 'Completá tu fecha de nacimiento'; END IF;
  v_entidad := CASE WHEN EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = v_uid) THEN 'repartidor' ELSE 'persona' END;
  IF (SELECT count(DISTINCT tipo) FROM public.delivery_documentos WHERE entidad = v_entidad AND entidad_id = v_uid AND tipo IN ('dni_frente', 'dni_dorso', 'selfie')) < 3 THEN
    RAISE EXCEPTION 'Faltan fotos: necesitamos el frente y el dorso del DNI y la selfie';
  END IF;
  BEGIN
    UPDATE public.delivery_identidad SET estado = 'en_revision', motivo_rechazo = NULL, intentos = intentos + 1, enviado_at = now(), controles = '{}'::jsonb, updated_at = now() WHERE perfil_id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ese DNI ya está asociado a otra cuenta. Si es tuyo, escribinos desde Ayuda';
  END;
  UPDATE public.delivery_repartidores SET motivo_rechazo = NULL WHERE perfil_id = v_uid AND motivo_rechazo IS NOT NULL;
END $$;

-- Administración: aprueba solo si tildó TODOS los controles; el rechazo exige motivo.
CREATE OR REPLACE FUNCTION public.delivery_admin_revisar_identidad(p_perfil uuid, p_aprobada boolean, p_motivo text DEFAULT NULL, p_controles jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ident public.delivery_identidad;
  v_es_repartidor boolean;
  v_motivo text := left(trim(coalesce(p_motivo, '')), 300);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO v_ident FROM public.delivery_identidad WHERE perfil_id = p_perfil FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa persona no cargó sus datos de identidad'; END IF;
  IF v_ident.estado <> 'en_revision' THEN RAISE EXCEPTION 'Esta identidad no está en revisión'; END IF;
  IF p_perfil = auth.uid() THEN RAISE EXCEPTION 'No podés revisar tu propia identidad'; END IF;
  v_es_repartidor := EXISTS (SELECT 1 FROM public.delivery_repartidores WHERE perfil_id = p_perfil);

  IF p_aprobada THEN
    IF NOT (coalesce((p_controles->>'datos')::boolean, false) AND coalesce((p_controles->>'nitidez')::boolean, false)
        AND coalesce((p_controles->>'rostro')::boolean, false) AND coalesce((p_controles->>'desafio')::boolean, false)) THEN
      RAISE EXCEPTION 'Para aprobar tenés que confirmar los cuatro controles';
    END IF;
    UPDATE public.delivery_identidad SET estado = 'aprobada', motivo_rechazo = NULL, revisado_at = now(), revisado_por = auth.uid(),
      controles = jsonb_build_object('datos', true, 'nitidez', true, 'rostro', true, 'desafio', true), vence_at = now() + interval '1 year', updated_at = now()
    WHERE perfil_id = p_perfil;
    IF v_es_repartidor THEN
      UPDATE public.delivery_repartidores SET verificado = true, verificado_at = now(), motivo_rechazo = NULL WHERE perfil_id = p_perfil;
    END IF;
  ELSE
    IF char_length(v_motivo) < 5 THEN RAISE EXCEPTION 'Indicá el motivo del rechazo'; END IF;
    UPDATE public.delivery_identidad SET estado = 'rechazada', motivo_rechazo = v_motivo, revisado_at = now(), revisado_por = auth.uid(),
      controles = coalesce(p_controles, '{}'::jsonb), vence_at = NULL, updated_at = now()
    WHERE perfil_id = p_perfil;
    IF v_es_repartidor THEN
      UPDATE public.delivery_repartidores SET verificado = false, verificado_at = NULL, motivo_rechazo = v_motivo, disponible = false WHERE perfil_id = p_perfil;
    END IF;
  END IF;
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
  VALUES (auth.uid(), CASE WHEN p_aprobada THEN 'identidad_aprobada' ELSE 'identidad_rechazada' END, 'identidad', p_perfil::text, jsonb_build_object('motivo', nullif(v_motivo, ''), 'controles', p_controles));
END $$;

-- Si administración revoca o rechaza a un repartidor por el camino viejo, la identidad queda en el mismo estado.
CREATE OR REPLACE FUNCTION public.delivery_admin_verificar_repartidor(p_repartidor uuid, p_aprobado boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_aprobado THEN RAISE EXCEPTION 'Para aprobar a un repartidor revisá su identidad con la lista de controles'; END IF;
  IF char_length(trim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Indicá el motivo del rechazo'; END IF;
  UPDATE public.delivery_repartidores SET verificado = false, verificado_at = NULL, motivo_rechazo = left(trim(p_motivo), 300), disponible = false WHERE perfil_id = p_repartidor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Repartidor no encontrado'; END IF;
  UPDATE public.delivery_identidad SET estado = 'rechazada', motivo_rechazo = left(trim(p_motivo), 300), vence_at = NULL, revisado_at = now(), revisado_por = auth.uid(), updated_at = now()
  WHERE perfil_id = p_repartidor AND estado IN ('en_revision', 'aprobada');
END $$;

-- Permisos: solo personas con sesión (las de administración validan el rol adentro).
REVOKE ALL ON FUNCTION public.delivery_identidad_guardar(text, text, date), public.delivery_identidad_enviar(), public.delivery_admin_revisar_identidad(uuid, boolean, text, jsonb), public.delivery_admin_verificar_repartidor(uuid, boolean, text), public.delivery_documento_registrar(text, uuid, text, text), public.delivery_documento_quitar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_identidad_guardar(text, text, date), public.delivery_identidad_enviar(), public.delivery_admin_revisar_identidad(uuid, boolean, text, jsonb), public.delivery_admin_verificar_repartidor(uuid, boolean, text), public.delivery_documento_registrar(text, uuid, text, text), public.delivery_documento_quitar(uuid) TO authenticated;
