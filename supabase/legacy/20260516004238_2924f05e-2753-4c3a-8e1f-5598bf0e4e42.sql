CREATE OR REPLACE FUNCTION public.get_mis_conversaciones(user_id uuid)
RETURNS SETOF public.conversaciones
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.conversaciones
  WHERE perfil_a_id = user_id OR perfil_b_id = user_id
  ORDER BY ultimo_mensaje_at DESC NULLS LAST, created_at DESC;
$$;