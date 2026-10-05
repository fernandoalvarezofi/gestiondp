DROP POLICY IF EXISTS storage_mensajes_lectura ON storage.objects;

CREATE POLICY storage_mensajes_lectura
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'mensajes-media'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (
      array_length(storage.foldername(name), 1) >= 2
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.conversaciones c
        WHERE c.id = ((storage.foldername(name))[2])::uuid
          AND auth.uid() IN (c.perfil_a_id, c.perfil_b_id)
      )
    )
  )
);