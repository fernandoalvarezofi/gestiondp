-- 1) Move payout_methods to private table
CREATE TABLE IF NOT EXISTS public.vendedor_payouts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts_owner_all" ON public.vendedor_payouts;
CREATE POLICY "payouts_owner_all" ON public.vendedor_payouts
  FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Migrate existing payout data
INSERT INTO public.vendedor_payouts (id, payout_methods)
SELECT id, payout_methods FROM public.vendedor_perfiles
WHERE payout_methods IS NOT NULL AND payout_methods <> '[]'::jsonb
ON CONFLICT (id) DO NOTHING;

-- Clear sensitive col on public table (keep column to avoid breaking older code; reset to empty)
UPDATE public.vendedor_perfiles SET payout_methods = '[]'::jsonb WHERE payout_methods <> '[]'::jsonb;

-- Replace public read policy to exclude sensitive column at app level via view
DROP VIEW IF EXISTS public.vendedor_perfiles_publico;
CREATE VIEW public.vendedor_perfiles_publico
WITH (security_invoker = true) AS
SELECT id, bio_comercial, entrega_automatica, total_ventas, total_productos,
       rating_promedio, total_reviews, verificado, activo, created_at, updated_at
FROM public.vendedor_perfiles;

GRANT SELECT ON public.vendedor_perfiles_publico TO anon, authenticated;

-- 2) Tighten proyecto_tareas SELECT (members + owner only)
DROP POLICY IF EXISTS "tareas_pub" ON public.proyecto_tareas;
CREATE POLICY "tareas_select_miembros" ON public.proyecto_tareas
  FOR SELECT TO authenticated
  USING (
    auth.uid() = creado_por
    OR auth.uid() = asignado_id
    OR auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_id)
    OR EXISTS (SELECT 1 FROM public.proyecto_miembros pm
               WHERE pm.proyecto_id = proyecto_tareas.proyecto_id AND pm.perfil_id = auth.uid())
  );

-- 3) Tighten proyecto_archivos SELECT
DROP POLICY IF EXISTS "archivos_pub" ON public.proyecto_archivos;
CREATE POLICY "archivos_select_miembros" ON public.proyecto_archivos
  FOR SELECT TO authenticated
  USING (
    auth.uid() = subido_por
    OR auth.uid() = (SELECT perfil_id FROM public.proyectos WHERE id = proyecto_id)
    OR EXISTS (SELECT 1 FROM public.proyecto_miembros pm
               WHERE pm.proyecto_id = proyecto_archivos.proyecto_id AND pm.perfil_id = auth.uid())
  );