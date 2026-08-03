-- ENUMS
CREATE TYPE public.operacion_inmueble AS ENUM ('venta','alquiler','alquiler_temporal');
CREATE TYPE public.tipo_inmueble AS ENUM ('casa','departamento','ph','terreno','local','oficina','galpon','cochera','campo','otro');
CREATE TYPE public.estado_propiedad AS ENUM ('borrador','activa','reservada','vendida','alquilada','pausada');
CREATE TYPE public.tour_estado AS ENUM ('sin_tour','procesando','listo','error');

-- PROPIEDADES
CREATE TABLE public.propiedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  slug text NOT NULL UNIQUE,
  descripcion text,
  operacion public.operacion_inmueble NOT NULL DEFAULT 'venta',
  tipo public.tipo_inmueble NOT NULL DEFAULT 'departamento',
  precio numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  expensas numeric(12,2),
  m2_totales numeric(10,2),
  m2_cubiertos numeric(10,2),
  ambientes int,
  dormitorios int,
  banos int,
  cocheras int DEFAULT 0,
  antiguedad int,
  direccion text,
  barrio text,
  ciudad text,
  provincia text,
  pais text DEFAULT 'Argentina',
  lat double precision,
  lng double precision,
  amenities text[] NOT NULL DEFAULT '{}',
  portada_url text,
  estado public.estado_propiedad NOT NULL DEFAULT 'activa',
  destacada boolean NOT NULL DEFAULT false,
  total_vistas int NOT NULL DEFAULT 0,
  total_favoritos int NOT NULL DEFAULT 0,
  total_consultas int NOT NULL DEFAULT 0,
  tour_estado public.tour_estado NOT NULL DEFAULT 'sin_tour',
  tour_job_id text,
  tour_url text,
  tour_video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.propiedades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propiedades TO authenticated;
GRANT ALL ON public.propiedades TO service_role;
ALTER TABLE public.propiedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propiedades_public_select" ON public.propiedades
  FOR SELECT USING (estado <> 'borrador');
CREATE POLICY "propiedades_owner_select" ON public.propiedades
  FOR SELECT TO authenticated USING (agente_id = auth.uid());
CREATE POLICY "propiedades_owner_insert" ON public.propiedades
  FOR INSERT TO authenticated WITH CHECK (agente_id = auth.uid());
CREATE POLICY "propiedades_owner_update" ON public.propiedades
  FOR UPDATE TO authenticated USING (agente_id = auth.uid()) WITH CHECK (agente_id = auth.uid());
CREATE POLICY "propiedades_owner_delete" ON public.propiedades
  FOR DELETE TO authenticated USING (agente_id = auth.uid());

CREATE INDEX idx_propiedades_estado ON public.propiedades (estado, created_at DESC);
CREATE INDEX idx_propiedades_filtros ON public.propiedades (operacion, tipo, precio);
CREATE INDEX idx_propiedades_ciudad ON public.propiedades (ciudad);
CREATE INDEX idx_propiedades_agente ON public.propiedades (agente_id);

CREATE TRIGGER trg_propiedades_updated BEFORE UPDATE ON public.propiedades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MEDIA
CREATE TABLE public.propiedad_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'imagen',
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.propiedad_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propiedad_media TO authenticated;
GRANT ALL ON public.propiedad_media TO service_role;
ALTER TABLE public.propiedad_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propiedad_media_select" ON public.propiedad_media
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.propiedades p
    WHERE p.id = propiedad_id AND (p.estado <> 'borrador' OR p.agente_id = auth.uid())
  ));
CREATE POLICY "propiedad_media_owner_write" ON public.propiedad_media
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.propiedades p WHERE p.id = propiedad_id AND p.agente_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.propiedades p WHERE p.id = propiedad_id AND p.agente_id = auth.uid()));

CREATE INDEX idx_propiedad_media_prop ON public.propiedad_media (propiedad_id, orden);

-- FAVORITOS
CREATE TABLE public.propiedad_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, propiedad_id)
);

GRANT SELECT, INSERT, DELETE ON public.propiedad_favoritos TO authenticated;
GRANT ALL ON public.propiedad_favoritos TO service_role;
ALTER TABLE public.propiedad_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propiedad_favoritos_own" ON public.propiedad_favoritos
  FOR ALL TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());

-- CONSULTAS
CREATE TABLE public.propiedad_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  telefono text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.propiedad_consultas TO authenticated;
GRANT ALL ON public.propiedad_consultas TO service_role;
ALTER TABLE public.propiedad_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propiedad_consultas_insert" ON public.propiedad_consultas
  FOR INSERT TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "propiedad_consultas_select" ON public.propiedad_consultas
  FOR SELECT TO authenticated USING (
    perfil_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.propiedades p WHERE p.id = propiedad_id AND p.agente_id = auth.uid())
  );

-- CONTADORES
CREATE OR REPLACE FUNCTION public.fn_propiedad_fav_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.propiedades SET total_favoritos = total_favoritos + 1 WHERE id = NEW.propiedad_id;
    RETURN NEW;
  ELSE
    UPDATE public.propiedades SET total_favoritos = GREATEST(total_favoritos - 1, 0) WHERE id = OLD.propiedad_id;
    RETURN OLD;
  END IF;
END $$;

CREATE TRIGGER trg_propiedad_fav_ins AFTER INSERT ON public.propiedad_favoritos
  FOR EACH ROW EXECUTE FUNCTION public.fn_propiedad_fav_count();
CREATE TRIGGER trg_propiedad_fav_del AFTER DELETE ON public.propiedad_favoritos
  FOR EACH ROW EXECUTE FUNCTION public.fn_propiedad_fav_count();

CREATE OR REPLACE FUNCTION public.fn_propiedad_consulta_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.propiedades SET total_consultas = total_consultas + 1 WHERE id = NEW.propiedad_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_propiedad_consulta AFTER INSERT ON public.propiedad_consultas
  FOR EACH ROW EXECUTE FUNCTION public.fn_propiedad_consulta_count();

CREATE OR REPLACE FUNCTION public.registrar_vista_propiedad(p_propiedad_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.propiedades SET total_vistas = total_vistas + 1
   WHERE id = p_propiedad_id AND estado <> 'borrador';
END $$;

REVOKE ALL ON FUNCTION public.registrar_vista_propiedad(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_vista_propiedad(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_propiedad_fav_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_propiedad_consulta_count() FROM PUBLIC, anon, authenticated;