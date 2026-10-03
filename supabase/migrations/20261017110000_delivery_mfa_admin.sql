-- Segundo factor (TOTP) con exigencia en el servidor: quien activó el 2FA solo ejerce como administrador con una sesión que lo confirmó (aal2).
-- También se exige para cambiar datos de cobro (delivery_cobro_guardar llama a delivery_mfa_ok).
CREATE OR REPLACE FUNCTION public.delivery_mfa_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified')
$$;
REVOKE ALL ON FUNCTION public.delivery_mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_mfa_ok() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND (_role <> 'admin'::app_role OR _user_id IS DISTINCT FROM auth.uid() OR public.delivery_mfa_ok())
$$;

-- delivery_cobro_guardar: igual que en 20261012120000_delivery_cobros_cierres.sql, con esta línea al principio:
--   IF NOT public.delivery_mfa_ok() THEN RAISE EXCEPTION 'Confirmá tu código de verificación en dos pasos para cambiar los datos de cobro'; END IF;
