
CREATE POLICY "Pipeline creator can update stages"
  ON public.pipeline_stages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_stages.pipeline_id
      AND pipelines.created_by = auth.uid()
  ));

CREATE POLICY "Pipeline creator can delete stages"
  ON public.pipeline_stages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_stages.pipeline_id
      AND pipelines.created_by = auth.uid()
  ));
