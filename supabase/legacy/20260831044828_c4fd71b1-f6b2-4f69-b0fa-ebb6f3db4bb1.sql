DROP FUNCTION IF EXISTS public.seed_default_pipeline(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_deal_insert() CASCADE;

DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.pipelines CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;