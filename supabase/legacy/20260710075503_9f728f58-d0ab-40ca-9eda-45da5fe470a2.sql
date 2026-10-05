
-- 1. Fix get_or_create_conversacion to respect mensajes_privados
CREATE OR REPLACE FUNCTION public.get_or_create_conversacion(user_a uuid, user_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare conv_id uuid; a_id uuid := least(user_a,user_b); b_id uuid := greatest(user_a,user_b); other uuid; other_allow boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if auth.uid() <> user_a and auth.uid() <> user_b then raise exception 'Not authorized'; end if;
  other := case when auth.uid() = user_a then user_b else user_a end;
  select mensajes_privados into other_allow from public.perfiles where id = other;
  if other_allow is distinct from true then
    raise exception 'Este usuario no acepta mensajes privados';
  end if;
  select id into conv_id from public.conversaciones where perfil_a_id=a_id and perfil_b_id=b_id;
  if conv_id is null then
    insert into public.conversaciones (perfil_a_id, perfil_b_id) values (a_id,b_id) returning id into conv_id;
  end if;
  return conv_id;
end; $$;

-- 2. registrar_vista: block anon
REVOKE EXECUTE ON FUNCTION public.registrar_vista(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_vista(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_vista(p_publicacion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.publicaciones set vistas=vistas+1 where id=p_publicacion_id;
  insert into public.estadisticas_publicacion (publicacion_id, fecha, vistas)
  values (p_publicacion_id, current_date, 1)
  on conflict (publicacion_id, fecha) do update set vistas=estadisticas_publicacion.vistas+1;
end; $$;

-- 3. Remove conflicting propiedades storage policies
DROP POLICY IF EXISTS "propiedades_insertar" ON storage.objects;
DROP POLICY IF EXISTS "propiedades_lectura" ON storage.objects;
DROP POLICY IF EXISTS "propiedades_borrar" ON storage.objects;

-- 4. Audio messages: only sender (folder owner) can read
DROP POLICY IF EXISTS "audio_msg_select" ON storage.objects;
CREATE POLICY "audio_msg_select" ON storage.objects FOR SELECT
USING (bucket_id='audio-mensajes' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 5. Group avatars: only group creator can update, keyed by group id folder
DROP POLICY IF EXISTS "grupos_av_update" ON storage.objects;
CREATE POLICY "grupos_av_update" ON storage.objects FOR UPDATE
USING (
  bucket_id='grupos-avatares' AND EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.creador_id = auth.uid()
      AND (storage.foldername(name))[1] = g.id::text
  )
);
DROP POLICY IF EXISTS "grupos_av_insert" ON storage.objects;
CREATE POLICY "grupos_av_insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id='grupos-avatares' AND EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.creador_id = auth.uid()
      AND (storage.foldername(name))[1] = g.id::text
  )
);

-- 6. Marketplace-archivos: allow buyers with paid orders to read the file bytes
DROP POLICY IF EXISTS "mp_archivos_comprador_read" ON storage.objects;
CREATE POLICY "mp_archivos_comprador_read" ON storage.objects FOR SELECT
USING (
  bucket_id='marketplace-archivos' AND EXISTS (
    SELECT 1 FROM public.marketplace_archivos a
    JOIN public.marketplace_ordenes o ON o.producto_id = a.producto_id
    WHERE a.storage_path = storage.objects.name
      AND o.comprador_id = auth.uid()
      AND o.estado = 'pagada'
  )
);

-- 7. proyecto_actividad: restrict SELECT to project members / creator
DROP POLICY IF EXISTS "actividad_pub" ON public.proyecto_actividad;
CREATE POLICY "actividad_members_select" ON public.proyecto_actividad FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proyectos p
    WHERE p.id = proyecto_actividad.proyecto_id
      AND (p.perfil_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.proyecto_miembros m
                   WHERE m.proyecto_id = p.id AND m.perfil_id = auth.uid()))
  )
);

-- 8. Drop payout_methods column from vendedor_perfiles (data lives in vendedor_payouts)
ALTER TABLE public.vendedor_perfiles DROP COLUMN IF EXISTS payout_methods;
-- Recreate public view without payout_methods (already the case; recreate for safety)
DROP VIEW IF EXISTS public.vendedor_perfiles_publico;
CREATE VIEW public.vendedor_perfiles_publico WITH (security_invoker=true) AS
SELECT id, bio_comercial, entrega_automatica, total_ventas, total_productos,
       rating_promedio, total_reviews, verificado, activo, created_at, updated_at
FROM public.vendedor_perfiles;

-- 9. feed_woref view: use security_invoker so RLS of caller applies
DROP VIEW IF EXISTS public.feed_woref;
CREATE VIEW public.feed_woref WITH (security_invoker=true) AS
SELECT p.id, p.tipo, p.formato, p.titulo, p.cuerpo, p.cuerpo_largo, p.imagen_url,
       p.video_url, p.video_duracion, p.thumbnail_url, p.tags, p.encuesta_opciones,
       p.rol_buscado, p.modalidad, p.vistas, p.total_likes, p.total_comentarios,
       p.total_repostes, p.total_guardados, p.destacada, p.created_at,
       pf.nombre AS autor_nombre, pf.username AS autor_username,
       pf.avatar_url AS autor_avatar, pf.tipo AS autor_tipo,
       pf.verificado AS autor_verificado, pf.score AS autor_score
FROM publicaciones p
JOIN perfiles pf ON pf.id = p.perfil_id
WHERE p.estado = 'activa'::estado_publicacion
ORDER BY p.destacada DESC, p.created_at DESC;

-- 10. Fix search_path on trigger functions
CREATE OR REPLACE FUNCTION public.notif_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare autor_id uuid;
begin
  select perfil_id into autor_id from public.publicaciones where id = NEW.publicacion_id;
  if autor_id is not null and autor_id != NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    values (autor_id, NEW.perfil_id, 'like', NEW.publicacion_id);
  end if;
  return NEW;
end; $$;

CREATE OR REPLACE FUNCTION public.notif_seguidor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
begin
  insert into public.notificaciones (perfil_id, origen_id, tipo)
  values (NEW.seguido_id, NEW.seguidor_id, 'nuevo_seguidor');
  return NEW;
end; $$;

CREATE OR REPLACE FUNCTION public.notif_reposteo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare autor_id uuid;
begin
  select perfil_id into autor_id from public.publicaciones where id = NEW.publicacion_id;
  if autor_id is not null and autor_id != NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    values (autor_id, NEW.perfil_id, 'reposteo', NEW.publicacion_id);
  end if;
  return NEW;
end; $$;

CREATE OR REPLACE FUNCTION public.notif_comentario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare autor_id uuid;
begin
  select perfil_id into autor_id from public.publicaciones where id = NEW.publicacion_id;
  if autor_id is not null and autor_id != NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id, comentario_id)
    values (autor_id, NEW.perfil_id, 'comentario', NEW.publicacion_id, NEW.id);
  end if;
  return NEW;
end; $$;

CREATE OR REPLACE FUNCTION public.notif_mensaje() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare destinatario_id uuid;
begin
  select case when perfil_a_id = NEW.remitente_id then perfil_b_id else perfil_a_id end
  into destinatario_id from public.conversaciones where id = NEW.conversacion_id;
  if destinatario_id is not null then
    insert into public.notificaciones (perfil_id, origen_id, tipo)
    values (destinatario_id, NEW.remitente_id, 'nuevo_mensaje');
  end if;
  return NEW;
end; $$;

-- 11. Revoke EXECUTE from anon/public on all SECURITY DEFINER functions,
--     then grant to authenticated only where needed for RPCs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Grant authenticated EXECUTE for RPCs the client legitimately calls
GRANT EXECUTE ON FUNCTION public.get_or_create_conversacion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mis_conversaciones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_llamada(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_conversacion_leida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_grupo_leido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_vistas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_vista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_community_as_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_feed_ranked(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_pipeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_miembro_grupo(uuid, uuid) TO authenticated;

-- 12. Restrict listing on public buckets: require authenticated user for storage.objects SELECT.
--     Public URLs continue to work because they bypass RLS via the CDN endpoint.
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "avatars_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "avatares_inmo_lectura" ON storage.objects;
CREATE POLICY "avatares_inmo_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='avatares-inmo' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comunidades-media_read" ON storage.objects;
CREATE POLICY "comunidades_media_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='comunidades-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "grupos_av_select" ON storage.objects;
CREATE POLICY "grupos_av_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='grupos-avatares' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "historias_storage_select" ON storage.objects;
CREATE POLICY "historias_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='historias' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mp_portadas_read" ON storage.objects;
CREATE POLICY "mp_portadas_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='marketplace-portadas' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "portadas_inmo_lectura" ON storage.objects;
CREATE POLICY "portadas_inmo_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='portadas-inmo' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "storage_propiedades_lectura" ON storage.objects;
CREATE POLICY "propiedades_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='propiedades' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proy_archivos_read" ON storage.objects;
CREATE POLICY "proy_archivos_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='proyectos-archivos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proyectos-media_read" ON storage.objects;
CREATE POLICY "proyectos_media_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='proyectos-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proyectos_logos_read" ON storage.objects;
CREATE POLICY "proyectos_logos_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='proyectos-logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proyectos_portadas_read" ON storage.objects;
CREATE POLICY "proyectos_portadas_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='proyectos-portadas' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "publicaciones_read" ON storage.objects;
CREATE POLICY "publicaciones_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='publicaciones' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "reels_select" ON storage.objects;
CREATE POLICY "reels_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='reels' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "storage_avatares_lectura" ON storage.objects;
CREATE POLICY "avatares_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='avatares' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "storage_highlights_lectura" ON storage.objects;
CREATE POLICY "highlights_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='highlights' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "storage_portadas_lectura" ON storage.objects;
CREATE POLICY "portadas_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='portadas' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "videos_read" ON storage.objects;
CREATE POLICY "videos_authed_list" ON storage.objects FOR SELECT
USING (bucket_id='videos' AND auth.uid() IS NOT NULL);
