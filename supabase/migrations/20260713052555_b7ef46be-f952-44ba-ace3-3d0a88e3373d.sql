
-- ============================================================
-- 1) STORAGE POLICIES for bucket 'proyectos-archivos'
--    Path convention used by the app: {user_id}/{proyecto_id}/{filename}
--    Restrict access to project members / owners.
-- ============================================================

DROP POLICY IF EXISTS "proy_archivos_authed_list" ON storage.objects;
DROP POLICY IF EXISTS "proy_archivos_insert" ON storage.objects;
DROP POLICY IF EXISTS "proy_archivos_select_miembros" ON storage.objects;
DROP POLICY IF EXISTS "proy_archivos_insert_miembros" ON storage.objects;
DROP POLICY IF EXISTS "proy_archivos_delete_owner" ON storage.objects;

CREATE POLICY "proy_archivos_select_miembros"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proyectos-archivos'
  AND (
    -- uploader (folder[1] = user_id) can always see own uploads
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.perfil_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.proyecto_miembros pm
      WHERE pm.proyecto_id::text = (storage.foldername(name))[2]
        AND pm.perfil_id = auth.uid()
    )
  )
);

CREATE POLICY "proy_archivos_insert_miembros"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proyectos-archivos'
  -- path must start with the user's own id
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.perfil_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.proyecto_miembros pm
      WHERE pm.proyecto_id::text = (storage.foldername(name))[2]
        AND pm.perfil_id = auth.uid()
    )
  )
);

CREATE POLICY "proy_archivos_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proyectos-archivos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 2) SECURITY DEFINER function hardening
--    Revoke EXECUTE from PUBLIC/anon/authenticated on all
--    SECURITY DEFINER functions in public schema, then re-grant
--    only to the ones the client legitimately needs to call
--    (RPCs and RLS helper functions).
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name, r.func_name, r.args
    );
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated for client-callable RPCs
GRANT EXECUTE ON FUNCTION public.get_or_create_conversacion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_conversacion_leida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_grupo_leido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_llamada(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_conexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_community_as_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_vistas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_vista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_pipeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_feed_ranked(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mis_conversaciones(uuid) TO authenticated;

-- RLS helper functions (must be executable by anon+authenticated for RLS to evaluate)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.es_miembro_grupo(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO anon, authenticated;
