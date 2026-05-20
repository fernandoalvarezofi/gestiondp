
-- ============================================================
-- GRUPOS Y CHATS GRUPALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  avatar_url text,
  descripcion text,
  creador_id uuid NOT NULL,
  ultimo_mensaje text,
  ultimo_mensaje_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grupo_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'miembro',
  no_leidos integer NOT NULL DEFAULT 0,
  ultima_lectura_at timestamptz DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grupo_id, perfil_id)
);

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_miembros ENABLE ROW LEVEL SECURITY;

-- helper: ¿soy miembro de este grupo?
CREATE OR REPLACE FUNCTION public.es_miembro_grupo(_grupo_id uuid, _perfil_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.grupo_miembros WHERE grupo_id=_grupo_id AND perfil_id=_perfil_id)
$$;

CREATE POLICY grupos_select ON public.grupos FOR SELECT USING (public.es_miembro_grupo(id, auth.uid()));
CREATE POLICY grupos_insert ON public.grupos FOR INSERT WITH CHECK (auth.uid() = creador_id);
CREATE POLICY grupos_update ON public.grupos FOR UPDATE USING (auth.uid() = creador_id);
CREATE POLICY grupos_delete ON public.grupos FOR DELETE USING (auth.uid() = creador_id);

CREATE POLICY gm_select ON public.grupo_miembros FOR SELECT USING (public.es_miembro_grupo(grupo_id, auth.uid()));
CREATE POLICY gm_insert ON public.grupo_miembros FOR INSERT WITH CHECK (
  auth.uid() = perfil_id OR auth.uid() = (SELECT creador_id FROM public.grupos WHERE id = grupo_id)
);
CREATE POLICY gm_update ON public.grupo_miembros FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY gm_delete ON public.grupo_miembros FOR DELETE USING (
  auth.uid() = perfil_id OR auth.uid() = (SELECT creador_id FROM public.grupos WHERE id = grupo_id)
);

-- ============================================================
-- EXTENSIONES A MENSAJES
-- ============================================================
ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duracion integer,
  ADD COLUMN IF NOT EXISTS respuesta_a uuid REFERENCES public.mensajes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reenviado_de uuid REFERENCES public.mensajes(id) ON DELETE SET NULL;

-- conversacion_id opcional ahora (puede ser grupo)
ALTER TABLE public.mensajes ALTER COLUMN conversacion_id DROP NOT NULL;

-- RLS de mensajes: permitir mensajes de grupo
DROP POLICY IF EXISTS mensajes_ver ON public.mensajes;
CREATE POLICY mensajes_ver ON public.mensajes FOR SELECT USING (
  auth.uid() = remitente_id
  OR (grupo_id IS NOT NULL AND public.es_miembro_grupo(grupo_id, auth.uid()))
  OR (conversacion_id IS NOT NULL AND auth.uid() IN (
        SELECT perfil_a_id FROM public.conversaciones WHERE id = mensajes.conversacion_id
        UNION ALL
        SELECT perfil_b_id FROM public.conversaciones WHERE id = mensajes.conversacion_id))
);

DROP POLICY IF EXISTS mensajes_insert ON public.mensajes;
CREATE POLICY mensajes_insert ON public.mensajes FOR INSERT WITH CHECK (
  auth.uid() = remitente_id
  AND (
    (grupo_id IS NOT NULL AND public.es_miembro_grupo(grupo_id, auth.uid()))
    OR (conversacion_id IS NOT NULL AND auth.uid() IN (
          SELECT perfil_a_id FROM public.conversaciones WHERE id = mensajes.conversacion_id
          UNION ALL
          SELECT perfil_b_id FROM public.conversaciones WHERE id = mensajes.conversacion_id))
  )
);

CREATE POLICY mensajes_update ON public.mensajes FOR UPDATE USING (auth.uid() = remitente_id);
CREATE POLICY mensajes_delete ON public.mensajes FOR DELETE USING (auth.uid() = remitente_id);

-- ============================================================
-- REACCIONES A MENSAJES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mensaje_reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id uuid NOT NULL REFERENCES public.mensajes(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mensaje_id, perfil_id, emoji)
);

ALTER TABLE public.mensaje_reacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_select ON public.mensaje_reacciones FOR SELECT USING (true);
CREATE POLICY mr_insert ON public.mensaje_reacciones FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY mr_delete ON public.mensaje_reacciones FOR DELETE USING (auth.uid() = perfil_id);

-- ============================================================
-- LLAMADAS Y SEÑALIZACIÓN WEBRTC
-- ============================================================
CREATE TABLE IF NOT EXISTS public.llamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'audio',
  estado text NOT NULL DEFAULT 'sonando',
  iniciada_at timestamptz NOT NULL DEFAULT now(),
  contestada_at timestamptz,
  finalizada_at timestamptz,
  duracion integer DEFAULT 0
);

ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY llamadas_select ON public.llamadas FOR SELECT USING (auth.uid() IN (caller_id, callee_id));
CREATE POLICY llamadas_insert ON public.llamadas FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY llamadas_update ON public.llamadas FOR UPDATE USING (auth.uid() IN (caller_id, callee_id));

CREATE TABLE IF NOT EXISTS public.senales_webrtc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  llamada_id uuid NOT NULL REFERENCES public.llamadas(id) ON DELETE CASCADE,
  emisor_id uuid NOT NULL,
  receptor_id uuid NOT NULL,
  tipo text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.senales_webrtc ENABLE ROW LEVEL SECURITY;
CREATE POLICY senales_select ON public.senales_webrtc FOR SELECT USING (auth.uid() IN (emisor_id, receptor_id));
CREATE POLICY senales_insert ON public.senales_webrtc FOR INSERT WITH CHECK (auth.uid() = emisor_id);

-- ============================================================
-- PRESENCIA (online/last seen)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.presencia (
  perfil_id uuid PRIMARY KEY,
  online boolean NOT NULL DEFAULT false,
  ultimo_visto timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.presencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY presencia_select ON public.presencia FOR SELECT USING (true);
CREATE POLICY presencia_upsert ON public.presencia FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY presencia_update ON public.presencia FOR UPDATE USING (auth.uid() = perfil_id);

-- ============================================================
-- EVENTOS PARA ALGORITMO DE RANKING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feed_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL,
  publicacion_id uuid REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  autor_id uuid,
  accion text NOT NULL,
  peso real NOT NULL DEFAULT 1,
  dwell_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fe_insert ON public.feed_eventos FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY fe_select_owner ON public.feed_eventos FOR SELECT USING (auth.uid() = perfil_id OR auth.uid() = autor_id);

CREATE INDEX IF NOT EXISTS idx_feed_eventos_perfil ON public.feed_eventos(perfil_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_eventos_autor ON public.feed_eventos(autor_id, created_at DESC);

-- ============================================================
-- REELS (campo en publicaciones)
-- ============================================================
ALTER TABLE public.publicaciones
  ADD COLUMN IF NOT EXISTS es_reel boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_pub_reels ON public.publicaciones(created_at DESC) WHERE es_reel = true AND estado = 'activa';

-- ============================================================
-- FUNCIONES
-- ============================================================
CREATE OR REPLACE FUNCTION public.marcar_conversacion_leida(p_conversacion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a_id uuid; b_id uuid;
BEGIN
  SELECT perfil_a_id, perfil_b_id INTO a_id, b_id FROM public.conversaciones WHERE id=p_conversacion_id;
  IF auth.uid() = a_id THEN
    UPDATE public.conversaciones SET no_leidos_a = 0 WHERE id = p_conversacion_id;
  ELSIF auth.uid() = b_id THEN
    UPDATE public.conversaciones SET no_leidos_b = 0 WHERE id = p_conversacion_id;
  END IF;
  UPDATE public.mensajes SET leido = true, leido_at = now()
    WHERE conversacion_id = p_conversacion_id AND remitente_id <> auth.uid() AND leido = false;
END $$;

CREATE OR REPLACE FUNCTION public.marcar_grupo_leido(p_grupo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.grupo_miembros SET no_leidos = 0, ultima_lectura_at = now()
    WHERE grupo_id = p_grupo_id AND perfil_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.iniciar_llamada(p_callee_id uuid, p_tipo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.llamadas (caller_id, callee_id, tipo)
  VALUES (auth.uid(), p_callee_id, p_tipo) RETURNING id INTO v_id;
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, texto)
  VALUES (p_callee_id, auth.uid(), 'nuevo_mensaje', 'Te está llamando');
  RETURN v_id;
END $$;

-- Feed ranked: combina recencia + interacciones + afinidad básica
CREATE OR REPLACE FUNCTION public.obtener_feed_ranked(p_perfil_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, score real) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH base AS (
    SELECT p.id,
           EXTRACT(EPOCH FROM (now() - p.created_at))/3600.0 AS horas,
           p.total_likes, p.total_comentarios, p.total_repostes, p.total_guardados, p.vistas,
           p.destacada, p.perfil_id
    FROM public.publicaciones p
    WHERE p.estado = 'activa'
      AND p.created_at > now() - interval '14 days'
  ),
  afin AS (
    SELECT autor_id, sum(peso) AS afinidad
    FROM public.feed_eventos
    WHERE perfil_id = p_perfil_id AND created_at > now() - interval '30 days'
    GROUP BY autor_id
  ),
  sigo AS (
    SELECT seguido_id FROM public.seguidos WHERE seguidor_id = p_perfil_id
  )
  SELECT b.id,
    (
      (b.total_likes * 1.0 + b.total_comentarios * 2.0 + b.total_repostes * 3.0 + b.total_guardados * 2.5)
      / GREATEST(b.horas + 2, 1) ^ 1.2
      + COALESCE(a.afinidad, 0) * 0.5
      + CASE WHEN b.perfil_id IN (SELECT seguido_id FROM sigo) THEN 5 ELSE 0 END
      + CASE WHEN b.destacada THEN 3 ELSE 0 END
    )::real AS score
  FROM base b
  LEFT JOIN afin a ON a.autor_id = b.perfil_id
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- TRIGGERS para grupos
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_grupo_ultimo_mensaje()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.grupo_id IS NOT NULL THEN
    UPDATE public.grupos SET
      ultimo_mensaje = substring(COALESCE(NEW.contenido, '[media]'), 1, 80),
      ultimo_mensaje_at = NEW.created_at
    WHERE id = NEW.grupo_id;
    UPDATE public.grupo_miembros SET no_leidos = no_leidos + 1
    WHERE grupo_id = NEW.grupo_id AND perfil_id <> NEW.remitente_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grupo_ultimo_mensaje ON public.mensajes;
CREATE TRIGGER trg_grupo_ultimo_mensaje AFTER INSERT ON public.mensajes
FOR EACH ROW EXECUTE FUNCTION public.update_grupo_ultimo_mensaje();

-- Auto-añadir creador como admin al crear grupo
CREATE OR REPLACE FUNCTION public.auto_add_grupo_creador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.grupo_miembros (grupo_id, perfil_id, rol) VALUES (NEW.id, NEW.creador_id, 'admin');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_grupo_creador ON public.grupos;
CREATE TRIGGER trg_grupo_creador AFTER INSERT ON public.grupos
FOR EACH ROW EXECUTE FUNCTION public.auto_add_grupo_creador();

-- ============================================================
-- STORAGE
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-mensajes', 'audio-mensajes', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('grupos-avatares', 'grupos-avatares', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true)
  ON CONFLICT (id) DO NOTHING;

-- Policies storage
CREATE POLICY audio_msg_select ON storage.objects FOR SELECT USING (
  bucket_id = 'audio-mensajes' AND auth.role() = 'authenticated'
);
CREATE POLICY audio_msg_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'audio-mensajes' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY grupos_av_select ON storage.objects FOR SELECT USING (bucket_id = 'grupos-avatares');
CREATE POLICY grupos_av_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'grupos-avatares' AND auth.role() = 'authenticated'
);
CREATE POLICY grupos_av_update ON storage.objects FOR UPDATE USING (
  bucket_id = 'grupos-avatares' AND auth.role() = 'authenticated'
);

CREATE POLICY reels_select ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY reels_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY reels_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.grupos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.grupo_miembros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.llamadas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senales_webrtc;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presencia;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensaje_reacciones;

ALTER TABLE public.grupos REPLICA IDENTITY FULL;
ALTER TABLE public.grupo_miembros REPLICA IDENTITY FULL;
ALTER TABLE public.llamadas REPLICA IDENTITY FULL;
ALTER TABLE public.senales_webrtc REPLICA IDENTITY FULL;
ALTER TABLE public.presencia REPLICA IDENTITY FULL;
ALTER TABLE public.mensaje_reacciones REPLICA IDENTITY FULL;
