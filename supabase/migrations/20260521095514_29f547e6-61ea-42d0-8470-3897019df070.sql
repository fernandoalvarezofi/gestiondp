
-- ============================================================
-- COMUNIDADES PRO (Discord-style: roles, hilos, reacciones, categorías de canales)
-- ============================================================

-- Categorías de canales (agrupador visual)
CREATE TABLE IF NOT EXISTS public.comunidad_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id uuid NOT NULL,
  nombre text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comunidad_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY com_cat_pub ON public.comunidad_categorias FOR SELECT USING (true);
CREATE POLICY com_cat_creador ON public.comunidad_categorias FOR ALL USING (
  auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_categorias.comunidad_id)
) WITH CHECK (
  auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_categorias.comunidad_id)
);

-- Extender canales: categoría, topic, NSFW, slow_mode, tipo voz
ALTER TABLE public.comunidad_canales ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.comunidad_categorias(id) ON DELETE SET NULL;
ALTER TABLE public.comunidad_canales ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.comunidad_canales ADD COLUMN IF NOT EXISTS nsfw boolean NOT NULL DEFAULT false;
ALTER TABLE public.comunidad_canales ADD COLUMN IF NOT EXISTS slow_mode_seg int NOT NULL DEFAULT 0;
ALTER TABLE public.comunidad_canales ADD COLUMN IF NOT EXISTS solo_lectura boolean NOT NULL DEFAULT false;

-- Roles dentro de la comunidad
CREATE TABLE IF NOT EXISTS public.comunidad_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id uuid NOT NULL,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  permisos jsonb NOT NULL DEFAULT '{"administrar":false,"moderar":false,"crear_canales":false,"gestionar_mensajes":false,"mencionar_todos":false}'::jsonb,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comunidad_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY com_roles_pub ON public.comunidad_roles FOR SELECT USING (true);
CREATE POLICY com_roles_creador ON public.comunidad_roles FOR ALL USING (
  auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_roles.comunidad_id)
) WITH CHECK (
  auth.uid() = (SELECT creador_id FROM public.comunidades WHERE id = comunidad_roles.comunidad_id)
);

-- Asignar rol a miembros
ALTER TABLE public.comunidad_miembros ADD COLUMN IF NOT EXISTS rol_id uuid REFERENCES public.comunidad_roles(id) ON DELETE SET NULL;
ALTER TABLE public.comunidad_miembros ADD COLUMN IF NOT EXISTS nickname text;

-- Hilos: respuesta_a en posts (thread parent)
ALTER TABLE public.comunidad_posts ADD COLUMN IF NOT EXISTS respuesta_a uuid REFERENCES public.comunidad_posts(id) ON DELETE CASCADE;
ALTER TABLE public.comunidad_posts ADD COLUMN IF NOT EXISTS hilo_titulo text;
ALTER TABLE public.comunidad_posts ADD COLUMN IF NOT EXISTS editado_at timestamptz;
ALTER TABLE public.comunidad_posts ADD COLUMN IF NOT EXISTS fijado boolean NOT NULL DEFAULT false;

-- Reacciones a mensajes de comunidad
CREATE TABLE IF NOT EXISTS public.comunidad_post_reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.comunidad_posts(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, perfil_id, emoji)
);
ALTER TABLE public.comunidad_post_reacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY com_react_pub ON public.comunidad_post_reacciones FOR SELECT USING (true);
CREATE POLICY com_react_self ON public.comunidad_post_reacciones FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- Update / delete propios mensajes de comunidad
CREATE POLICY comunidad_posts_update ON public.comunidad_posts FOR UPDATE USING (auth.uid() = perfil_id);

-- Realtime
ALTER TABLE public.comunidad_post_reacciones REPLICA IDENTITY FULL;
ALTER TABLE public.comunidad_roles REPLICA IDENTITY FULL;
ALTER TABLE public.comunidad_categorias REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comunidad_post_reacciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comunidad_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comunidad_categorias;

-- ============================================================
-- FORO PRO (votos up/down, mejor respuesta)
-- ============================================================

ALTER TABLE public.foro_posts ADD COLUMN IF NOT EXISTS total_votos int NOT NULL DEFAULT 0;
ALTER TABLE public.foro_respuestas ADD COLUMN IF NOT EXISTS total_votos int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.foro_votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL,
  post_id uuid REFERENCES public.foro_posts(id) ON DELETE CASCADE,
  resp_id uuid REFERENCES public.foro_respuestas(id) ON DELETE CASCADE,
  valor smallint NOT NULL CHECK (valor IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((post_id IS NOT NULL) <> (resp_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS foro_votos_post_uniq ON public.foro_votos (perfil_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS foro_votos_resp_uniq ON public.foro_votos (perfil_id, resp_id) WHERE resp_id IS NOT NULL;

ALTER TABLE public.foro_votos ENABLE ROW LEVEL SECURITY;
CREATE POLICY foro_votos_pub ON public.foro_votos FOR SELECT USING (true);
CREATE POLICY foro_votos_self ON public.foro_votos FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE OR REPLACE FUNCTION public.update_foro_votos_count()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE delta int;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := NEW.valor;
    IF NEW.post_id IS NOT NULL THEN UPDATE public.foro_posts SET total_votos = total_votos + delta WHERE id = NEW.post_id;
    ELSE UPDATE public.foro_respuestas SET total_votos = total_votos + delta WHERE id = NEW.resp_id; END IF;
  ELSIF TG_OP = 'DELETE' THEN delta := -OLD.valor;
    IF OLD.post_id IS NOT NULL THEN UPDATE public.foro_posts SET total_votos = total_votos + delta WHERE id = OLD.post_id;
    ELSE UPDATE public.foro_respuestas SET total_votos = total_votos + delta WHERE id = OLD.resp_id; END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.valor <> NEW.valor THEN delta := NEW.valor - OLD.valor;
    IF NEW.post_id IS NOT NULL THEN UPDATE public.foro_posts SET total_votos = total_votos + delta WHERE id = NEW.post_id;
    ELSE UPDATE public.foro_respuestas SET total_votos = total_votos + delta WHERE id = NEW.resp_id; END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_foro_votos ON public.foro_votos;
CREATE TRIGGER trg_foro_votos AFTER INSERT OR UPDATE OR DELETE ON public.foro_votos FOR EACH ROW EXECUTE FUNCTION public.update_foro_votos_count();

-- Permitir update a respuestas (para marcar solución)
CREATE POLICY foro_resp_update ON public.foro_respuestas FOR UPDATE USING (
  auth.uid() = perfil_id OR auth.uid() = (SELECT perfil_id FROM public.foro_posts WHERE id = foro_respuestas.post_id)
);

ALTER TABLE public.foro_votos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.foro_votos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.foro_respuestas;

-- ============================================================
-- PROYECTOS PRO (tareas, archivos, actividad)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.proyecto_tarea_estado AS ENUM ('backlog', 'en_progreso', 'revision', 'completada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.proyecto_tarea_prioridad AS ENUM ('baja', 'media', 'alta', 'urgente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.proyecto_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  estado public.proyecto_tarea_estado NOT NULL DEFAULT 'backlog',
  prioridad public.proyecto_tarea_prioridad NOT NULL DEFAULT 'media',
  asignado_id uuid,
  creado_por uuid NOT NULL,
  fecha_limite date,
  orden int NOT NULL DEFAULT 0,
  etiquetas text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proyecto_tareas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tareas_pub ON public.proyecto_tareas FOR SELECT USING (true);
CREATE POLICY tareas_miembros_insert ON public.proyecto_tareas FOR INSERT WITH CHECK (
  auth.uid() = creado_por AND (
    auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_tareas.proyecto_id)
    OR EXISTS (SELECT 1 FROM public.proyecto_miembros WHERE proyecto_id = proyecto_tareas.proyecto_id AND perfil_id = auth.uid())
  )
);
CREATE POLICY tareas_miembros_update ON public.proyecto_tareas FOR UPDATE USING (
  auth.uid() = creado_por
  OR auth.uid() = asignado_id
  OR auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_tareas.proyecto_id)
  OR EXISTS (SELECT 1 FROM public.proyecto_miembros WHERE proyecto_id = proyecto_tareas.proyecto_id AND perfil_id = auth.uid())
);
CREATE POLICY tareas_owner_delete ON public.proyecto_tareas FOR DELETE USING (
  auth.uid() = creado_por
  OR auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_tareas.proyecto_id)
);
CREATE TRIGGER trg_tareas_updated_at BEFORE UPDATE ON public.proyecto_tareas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.proyecto_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  url text NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  subido_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proyecto_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY archivos_pub ON public.proyecto_archivos FOR SELECT USING (true);
CREATE POLICY archivos_miembros_insert ON public.proyecto_archivos FOR INSERT WITH CHECK (
  auth.uid() = subido_por AND (
    auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_archivos.proyecto_id)
    OR EXISTS (SELECT 1 FROM public.proyecto_miembros WHERE proyecto_id = proyecto_archivos.proyecto_id AND perfil_id = auth.uid())
  )
);
CREATE POLICY archivos_owner_delete ON public.proyecto_archivos FOR DELETE USING (
  auth.uid() = subido_por
  OR auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_archivos.proyecto_id)
);

CREATE TABLE IF NOT EXISTS public.proyecto_actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  accion text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proyecto_actividad ENABLE ROW LEVEL SECURITY;
CREATE POLICY actividad_pub ON public.proyecto_actividad FOR SELECT USING (true);
CREATE POLICY actividad_insert ON public.proyecto_actividad FOR INSERT WITH CHECK (auth.uid() = perfil_id);

ALTER TABLE public.proyecto_tareas REPLICA IDENTITY FULL;
ALTER TABLE public.proyecto_archivos REPLICA IDENTITY FULL;
ALTER TABLE public.proyecto_actividad REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proyecto_tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proyecto_archivos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proyecto_actividad;

-- Storage bucket para archivos de proyectos
INSERT INTO storage.buckets (id, name, public) VALUES ('proyectos-archivos', 'proyectos-archivos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "proy_archivos_read" ON storage.objects FOR SELECT USING (bucket_id = 'proyectos-archivos');
CREATE POLICY "proy_archivos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proyectos-archivos' AND auth.uid() IS NOT NULL);
CREATE POLICY "proy_archivos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'proyectos-archivos' AND auth.uid()::text = (storage.foldername(name))[1]);
