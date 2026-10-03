-- Incentivos del repartidor: registro de conexiones, metas con bono (por día o semana, con franja horaria opcional) y turnos reservables con asistencia.

INSERT INTO public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) VALUES
  ('turno_cancelar_horas', 2, 'Anticipación para cancelar un turno', 'Un repartidor puede cancelar su turno hasta estas horas antes de que empiece.', 'h', 0, 24),
  ('turno_asistencia_pct', 70, 'Asistencia mínima para cumplir un turno', 'Porcentaje del turno que el repartidor tiene que estar conectado para que cuente como cumplido.', '%', 30, 100),
  ('turno_ausencias_max', 3, 'Ausencias que bloquean reservar turnos', 'Con tantas ausencias en los últimos 30 días, el repartidor no puede reservar nuevos turnos.', '', 1, 20)
ON CONFLICT (clave) DO NOTHING;

-- 1) Conexiones: cuándo estuvo conectado cada repartidor (se arma sola al conectarse y desconectarse).
CREATE TABLE IF NOT EXISTS public.delivery_conexiones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repartidor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desde timestamptz NOT NULL DEFAULT now(),
  hasta timestamptz
);
CREATE INDEX IF NOT EXISTS delivery_conexiones_rep_idx ON public.delivery_conexiones (repartidor_id, desde);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_conexiones_abierta_uk ON public.delivery_conexiones (repartidor_id) WHERE hasta IS NULL;
ALTER TABLE public.delivery_conexiones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_conexiones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_conexiones TO authenticated;
DROP POLICY IF EXISTS "Conexiones: propias o administración" ON public.delivery_conexiones;
CREATE POLICY "Conexiones: propias o administración" ON public.delivery_conexiones FOR SELECT TO authenticated USING (repartidor_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.delivery_conexiones_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.disponible AND NOT OLD.disponible THEN
    INSERT INTO public.delivery_conexiones (repartidor_id) VALUES (NEW.perfil_id) ON CONFLICT DO NOTHING;
  ELSIF NOT NEW.disponible AND OLD.disponible THEN
    UPDATE public.delivery_conexiones SET hasta = now() WHERE repartidor_id = NEW.perfil_id AND hasta IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_repartidores_conexiones ON public.delivery_repartidores;
CREATE TRIGGER delivery_repartidores_conexiones AFTER UPDATE OF disponible ON public.delivery_repartidores FOR EACH ROW WHEN (NEW.disponible IS DISTINCT FROM OLD.disponible) EXECUTE FUNCTION public.delivery_conexiones_trg();
INSERT INTO public.delivery_conexiones (repartidor_id) SELECT perfil_id FROM public.delivery_repartidores WHERE disponible ON CONFLICT DO NOTHING;

-- Minutos conectado dentro de un intervalo
CREATE OR REPLACE FUNCTION public.delivery_minutos_conectado(p_rep uuid, p_desde timestamptz, p_hasta timestamptz) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(greatest(0, extract(epoch FROM least(coalesce(c.hasta, now()), p_hasta) - greatest(c.desde, p_desde)) / 60)), 0)
  FROM public.delivery_conexiones c WHERE c.repartidor_id = p_rep AND c.desde < p_hasta AND coalesce(c.hasta, now()) > p_desde
$$;
REVOKE ALL ON FUNCTION public.delivery_minutos_conectado(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- 2) Metas con bono
CREATE TABLE IF NOT EXISTS public.delivery_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 60),
  periodo text NOT NULL CHECK (periodo IN ('dia', 'semana')),
  objetivo integer NOT NULL CHECK (objetivo BETWEEN 1 AND 500),
  bono numeric(12, 2) NOT NULL CHECK (bono BETWEEN 50 AND 100000),
  hora_desde time,
  hora_hasta time,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((hora_desde IS NULL) = (hora_hasta IS NULL))
);
CREATE TABLE IF NOT EXISTS public.delivery_metas_logradas (
  meta_id uuid NOT NULL REFERENCES public.delivery_metas(id) ON DELETE CASCADE,
  repartidor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  bono numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meta_id, repartidor_id, periodo_inicio)
);
ALTER TABLE public.delivery_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_metas_logradas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_metas, public.delivery_metas_logradas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_metas, public.delivery_metas_logradas TO authenticated;
DROP POLICY IF EXISTS "Metas: visibles" ON public.delivery_metas;
CREATE POLICY "Metas: visibles" ON public.delivery_metas FOR SELECT TO authenticated USING (activa OR public.has_role((SELECT auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Logros: propios o administración" ON public.delivery_metas_logradas;
CREATE POLICY "Logros: propios o administración" ON public.delivery_metas_logradas FOR SELECT TO authenticated USING (repartidor_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Entregas (pedidos y envíos) de un repartidor en un intervalo y, opcionalmente, dentro de una franja horaria (hora de Argentina).
CREATE OR REPLACE FUNCTION public.delivery_viajes_periodo(p_rep uuid, p_desde timestamptz, p_hasta timestamptz, p_hora_desde time, p_hora_hasta time) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM (
    SELECT entregado_at FROM public.delivery_pedidos WHERE repartidor_id = p_rep AND estado = 'entregado' AND entregado_at >= p_desde AND entregado_at < p_hasta
    UNION ALL
    SELECT entregado_at FROM public.delivery_envios WHERE repartidor_id = p_rep AND estado = 'entregado' AND entregado_at >= p_desde AND entregado_at < p_hasta
  ) v
  WHERE p_hora_desde IS NULL
     OR CASE WHEN p_hora_hasta > p_hora_desde THEN (v.entregado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::time >= p_hora_desde AND (v.entregado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < p_hora_hasta
             ELSE (v.entregado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::time >= p_hora_desde OR (v.entregado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < p_hora_hasta END
$$;
REVOKE ALL ON FUNCTION public.delivery_viajes_periodo(uuid, timestamptz, timestamptz, time, time) FROM PUBLIC, anon, authenticated;

-- Inicio del período actual (día o lunes de la semana) en hora de Argentina
CREATE OR REPLACE FUNCTION public.delivery_inicio_periodo(p_periodo text, p_momento timestamptz DEFAULT now()) RETURNS date
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN p_periodo = 'semana' THEN date_trunc('week', p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires')::date ELSE (p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires')::date END
$$;

CREATE OR REPLACE FUNCTION public.delivery_metas_evaluar(p_rep uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.delivery_metas; v_ini date; v_desde timestamptz; v_hasta timestamptz; v_viajes integer; v_n integer := 0; v_ok integer;
  tz constant text := 'America/Argentina/Buenos_Aires';
BEGIN
  FOR m IN SELECT * FROM public.delivery_metas WHERE activa LOOP
    v_ini := public.delivery_inicio_periodo(m.periodo);
    v_desde := v_ini::timestamp AT TIME ZONE tz;
    v_hasta := (v_ini + CASE WHEN m.periodo = 'semana' THEN 7 ELSE 1 END)::timestamp AT TIME ZONE tz;
    IF EXISTS (SELECT 1 FROM public.delivery_metas_logradas WHERE meta_id = m.id AND repartidor_id = p_rep AND periodo_inicio = v_ini) THEN CONTINUE; END IF;
    v_viajes := public.delivery_viajes_periodo(p_rep, v_desde, v_hasta, m.hora_desde, m.hora_hasta);
    IF v_viajes >= m.objetivo THEN
      INSERT INTO public.delivery_metas_logradas (meta_id, repartidor_id, periodo_inicio, bono) VALUES (m.id, p_rep, v_ini, m.bono) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_ok = ROW_COUNT;
      IF v_ok > 0 THEN
        INSERT INTO public.delivery_libro (titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle) VALUES
          ('repartidor', p_rep, 'ganancias', 'bono_meta', m.bono, m.id::text, jsonb_build_object('meta', m.nombre, 'periodo_inicio', v_ini)),
          ('plataforma', NULL, 'ingresos', 'bono_meta', -m.bono, m.id::text, jsonb_build_object('meta', m.nombre, 'repartidor', p_rep));
        v_n := v_n + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.delivery_metas_evaluar(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_metas_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.repartidor_id IS NOT NULL THEN PERFORM public.delivery_metas_evaluar(NEW.repartidor_id); END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'delivery_metas_evaluar % falló: %', NEW.repartidor_id, SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_metas ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_metas AFTER UPDATE OF estado ON public.delivery_pedidos FOR EACH ROW WHEN (NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado') EXECUTE FUNCTION public.delivery_metas_trg();
DROP TRIGGER IF EXISTS delivery_envios_metas ON public.delivery_envios;
CREATE TRIGGER delivery_envios_metas AFTER UPDATE OF estado ON public.delivery_envios FOR EACH ROW WHEN (NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado') EXECUTE FUNCTION public.delivery_metas_trg();

-- Progreso del repartidor en cada meta activa
CREATE OR REPLACE FUNCTION public.delivery_mis_metas() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); tz constant text := 'America/Argentina/Buenos_Aires'; v_out jsonb := '[]'::jsonb; m public.delivery_metas; v_ini date; v_desde timestamptz; v_hasta timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  FOR m IN SELECT * FROM public.delivery_metas WHERE activa ORDER BY periodo, objetivo LOOP
    v_ini := public.delivery_inicio_periodo(m.periodo);
    v_desde := v_ini::timestamp AT TIME ZONE tz;
    v_hasta := (v_ini + CASE WHEN m.periodo = 'semana' THEN 7 ELSE 1 END)::timestamp AT TIME ZONE tz;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'periodo', m.periodo, 'objetivo', m.objetivo, 'bono', m.bono,
      'hora_desde', to_char(m.hora_desde, 'HH24:MI'), 'hora_hasta', to_char(m.hora_hasta, 'HH24:MI'), 'termina', v_hasta,
      'viajes', public.delivery_viajes_periodo(v_uid, v_desde, v_hasta, m.hora_desde, m.hora_hasta),
      'lograda', EXISTS (SELECT 1 FROM public.delivery_metas_logradas l WHERE l.meta_id = m.id AND l.repartidor_id = v_uid AND l.periodo_inicio = v_ini)));
  END LOOP;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_mis_metas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mis_metas() TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_guardar_meta(p_id uuid, p_nombre text, p_periodo text, p_objetivo integer, p_bono numeric, p_hora_desde time, p_hora_hasta time, p_activa boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF (p_hora_desde IS NULL) <> (p_hora_hasta IS NULL) THEN RAISE EXCEPTION 'Cargá las dos horas de la franja o ninguna'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.delivery_metas (nombre, periodo, objetivo, bono, hora_desde, hora_hasta, activa) VALUES (trim(p_nombre), p_periodo, p_objetivo, p_bono, p_hora_desde, p_hora_hasta, coalesce(p_activa, true)) RETURNING id INTO v_id;
  ELSE
    UPDATE public.delivery_metas SET nombre = trim(p_nombre), periodo = p_periodo, objetivo = p_objetivo, bono = p_bono, hora_desde = p_hora_desde, hora_hasta = p_hora_hasta, activa = coalesce(p_activa, activa) WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Meta no encontrada'; END IF;
  END IF;
  INSERT INTO public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle) VALUES (auth.uid(), 'meta_guardada', 'meta', v_id::text, jsonb_build_object('nombre', trim(p_nombre), 'objetivo', p_objetivo, 'bono', p_bono));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_guardar_meta(uuid, text, text, integer, numeric, time, time, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_guardar_meta(uuid, text, text, integer, numeric, time, time, boolean) TO authenticated;

-- 3) Turnos reservables
CREATE TABLE IF NOT EXISTS public.delivery_turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  desde time NOT NULL,
  hasta time NOT NULL,
  cupos integer NOT NULL CHECK (cupos BETWEEN 1 AND 200),
  nota text CHECK (nota IS NULL OR char_length(nota) <= 100),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hasta > desde),
  UNIQUE (fecha, desde, hasta)
);
CREATE TABLE IF NOT EXISTS public.delivery_turnos_reservas (
  turno_id uuid NOT NULL REFERENCES public.delivery_turnos(id) ON DELETE CASCADE,
  repartidor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelado_at timestamptz,
  PRIMARY KEY (turno_id, repartidor_id)
);
CREATE INDEX IF NOT EXISTS delivery_turnos_reservas_rep_idx ON public.delivery_turnos_reservas (repartidor_id);
ALTER TABLE public.delivery_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_turnos_reservas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_turnos, public.delivery_turnos_reservas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_turnos, public.delivery_turnos_reservas TO authenticated;
DROP POLICY IF EXISTS "Turnos: visibles" ON public.delivery_turnos;
CREATE POLICY "Turnos: visibles" ON public.delivery_turnos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Reservas: propias o administración" ON public.delivery_turnos_reservas;
CREATE POLICY "Reservas: propias o administración" ON public.delivery_turnos_reservas FOR SELECT TO authenticated USING (repartidor_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.delivery_turno_inicio(t public.delivery_turnos) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT (t.fecha + t.desde) AT TIME ZONE 'America/Argentina/Buenos_Aires' $$;
CREATE OR REPLACE FUNCTION public.delivery_turno_fin(t public.delivery_turnos) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT (t.fecha + t.hasta) AT TIME ZONE 'America/Argentina/Buenos_Aires' $$;

-- Ausencias de un repartidor en los últimos 30 días: turnos terminados donde estuvo conectado menos del mínimo
CREATE OR REPLACE FUNCTION public.delivery_ausencias(p_rep uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.delivery_turnos_reservas r JOIN public.delivery_turnos t ON t.id = r.turno_id
  WHERE r.repartidor_id = p_rep AND r.cancelado_at IS NULL AND public.delivery_turno_fin(t) < now() AND public.delivery_turno_fin(t) > now() - interval '30 days'
    AND public.delivery_minutos_conectado(p_rep, public.delivery_turno_inicio(t), public.delivery_turno_fin(t)) < (extract(epoch FROM (t.hasta - t.desde)) / 60) * public.delivery_ajuste('turno_asistencia_pct', 70) / 100
$$;
REVOKE ALL ON FUNCTION public.delivery_ausencias(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_mis_turnos() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT jsonb_build_object(
    'ausencias', public.delivery_ausencias(v_uid),
    'max_ausencias', public.delivery_ajuste('turno_ausencias_max', 3),
    'cancelar_horas', public.delivery_ajuste('turno_cancelar_horas', 2),
    'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'fecha', t.fecha, 'desde', to_char(t.desde, 'HH24:MI'), 'hasta', to_char(t.hasta, 'HH24:MI'), 'nota', t.nota, 'cupos', t.cupos,
        'ocupados', (SELECT count(*) FROM public.delivery_turnos_reservas r WHERE r.turno_id = t.id AND r.cancelado_at IS NULL),
        'mio', EXISTS (SELECT 1 FROM public.delivery_turnos_reservas r WHERE r.turno_id = t.id AND r.repartidor_id = v_uid AND r.cancelado_at IS NULL),
        'inicio', public.delivery_turno_inicio(t)) ORDER BY t.fecha, t.desde)
      FROM public.delivery_turnos t WHERE t.activo AND public.delivery_turno_fin(t) > now() AND t.fecha <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 14), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.delivery_mis_turnos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mis_turnos() TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_turno_reservar(p_turno uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); t public.delivery_turnos; c public.delivery_repartidores; v_ocupados integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT * INTO c FROM public.delivery_repartidores WHERE perfil_id = v_uid;
  IF NOT FOUND OR NOT c.verificado OR NOT c.activo THEN RAISE EXCEPTION 'Tu cuenta de repartidor tiene que estar verificada'; END IF;
  SELECT * INTO t FROM public.delivery_turnos WHERE id = p_turno AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El turno no existe o ya no está disponible'; END IF;
  IF public.delivery_turno_inicio(t) <= now() THEN RAISE EXCEPTION 'Ese turno ya empezó'; END IF;
  IF public.delivery_ausencias(v_uid) >= public.delivery_ajuste('turno_ausencias_max', 3) THEN RAISE EXCEPTION 'Tenés demasiadas ausencias en los últimos 30 días: por ahora no podés reservar turnos'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_turnos_reservas r JOIN public.delivery_turnos o ON o.id = r.turno_id
             WHERE r.repartidor_id = v_uid AND r.cancelado_at IS NULL AND o.id <> t.id AND public.delivery_turno_inicio(o) < public.delivery_turno_fin(t) AND public.delivery_turno_fin(o) > public.delivery_turno_inicio(t)) THEN
    RAISE EXCEPTION 'Ya tenés un turno reservado en ese horario';
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_turnos_reservas WHERE turno_id = t.id AND repartidor_id = v_uid AND cancelado_at IS NULL) THEN RAISE EXCEPTION 'Ya reservaste este turno'; END IF;
  SELECT count(*) INTO v_ocupados FROM public.delivery_turnos_reservas WHERE turno_id = t.id AND cancelado_at IS NULL;
  IF v_ocupados >= t.cupos THEN RAISE EXCEPTION 'El turno se llenó'; END IF;
  INSERT INTO public.delivery_turnos_reservas (turno_id, repartidor_id) VALUES (t.id, v_uid)
  ON CONFLICT (turno_id, repartidor_id) DO UPDATE SET cancelado_at = NULL, created_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.delivery_turno_cancelar(p_turno uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); t public.delivery_turnos; v_horas numeric := public.delivery_ajuste('turno_cancelar_horas', 2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  SELECT * INTO t FROM public.delivery_turnos WHERE id = p_turno;
  IF NOT FOUND THEN RAISE EXCEPTION 'El turno no existe'; END IF;
  IF public.delivery_turno_inicio(t) - now() < make_interval(hours => v_horas::int) THEN RAISE EXCEPTION 'Solo se puede cancelar hasta % horas antes de que empiece el turno', v_horas::int; END IF;
  UPDATE public.delivery_turnos_reservas SET cancelado_at = now() WHERE turno_id = p_turno AND repartidor_id = v_uid AND cancelado_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tenés este turno reservado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.delivery_turno_reservar(uuid), public.delivery_turno_cancelar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_turno_reservar(uuid), public.delivery_turno_cancelar(uuid) TO authenticated;

-- Administración: crear turnos (repitiéndolos los próximos días), activar/desactivar y ver cobertura
CREATE OR REPLACE FUNCTION public.delivery_admin_crear_turno(p_fecha date, p_desde time, p_hasta time, p_cupos integer, p_nota text, p_repetir_dias integer DEFAULT 0) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer := 0; i integer; v_ok integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_fecha IS NULL OR p_fecha < (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN RAISE EXCEPTION 'La fecha tiene que ser de hoy en adelante'; END IF;
  IF p_hasta <= p_desde THEN RAISE EXCEPTION 'El turno tiene que terminar después de empezar'; END IF;
  IF p_repetir_dias < 0 OR p_repetir_dias > 30 THEN RAISE EXCEPTION 'Podés repetir hasta 30 días'; END IF;
  FOR i IN 0..p_repetir_dias LOOP
    INSERT INTO public.delivery_turnos (fecha, desde, hasta, cupos, nota) VALUES (p_fecha + i, p_desde, p_hasta, p_cupos, nullif(trim(coalesce(p_nota, '')), '')) ON CONFLICT (fecha, desde, hasta) DO NOTHING;
    GET DIAGNOSTICS v_ok = ROW_COUNT; v_n := v_n + v_ok;
  END LOOP;
  RETURN v_n;
END $$;
CREATE OR REPLACE FUNCTION public.delivery_admin_turno_activo(p_id uuid, p_activo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  UPDATE public.delivery_turnos SET activo = p_activo WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.delivery_admin_turnos() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'fecha', t.fecha, 'desde', to_char(t.desde, 'HH24:MI'), 'hasta', to_char(t.hasta, 'HH24:MI'), 'nota', t.nota, 'cupos', t.cupos, 'activo', t.activo,
      'pasado', public.delivery_turno_fin(t) < now(),
      'repartidores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.repartidor_id, 'nombre', p.nombre,
          'minutos', round(public.delivery_minutos_conectado(r.repartidor_id, public.delivery_turno_inicio(t), public.delivery_turno_fin(t)))) ORDER BY p.nombre)
        FROM public.delivery_turnos_reservas r LEFT JOIN public.perfiles p ON p.id = r.repartidor_id WHERE r.turno_id = t.id AND r.cancelado_at IS NULL), '[]'::jsonb),
      'duracion', round(extract(epoch FROM (t.hasta - t.desde)) / 60)) ORDER BY t.fecha DESC, t.desde)
    FROM public.delivery_turnos t WHERE t.fecha >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 7), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_crear_turno(date, time, time, integer, text, integer), public.delivery_admin_turno_activo(uuid, boolean), public.delivery_admin_turnos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_crear_turno(date, time, time, integer, text, integer), public.delivery_admin_turno_activo(uuid, boolean), public.delivery_admin_turnos() TO authenticated;
