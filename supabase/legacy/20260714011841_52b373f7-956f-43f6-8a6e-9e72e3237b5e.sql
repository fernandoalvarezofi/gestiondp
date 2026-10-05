
CREATE POLICY "video_editor_own_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'video-editor' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "video_editor_own_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-editor' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "video_editor_own_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'video-editor' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "video_editor_own_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'video-editor' AND (storage.foldername(name))[1] = auth.uid()::text);
