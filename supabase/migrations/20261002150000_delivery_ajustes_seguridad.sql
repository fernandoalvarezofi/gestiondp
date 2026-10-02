-- Ajustes sugeridos por el asesor de seguridad de Supabase.
ALTER FUNCTION public.delivery_distancia_km(numeric, numeric, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.delivery_costo_envio(numeric, numeric, numeric) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.delivery_es_duenio_producto(uuid) FROM PUBLIC, anon;
