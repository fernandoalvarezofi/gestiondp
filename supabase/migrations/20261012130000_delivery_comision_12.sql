-- Comisión definida con el dueño: 12 % por defecto para los comercios (antes un 10 % provisorio).
UPDATE public.delivery_ajustes SET valor = 12, updated_at = now() WHERE clave = 'comision_default_pct';
UPDATE public.delivery_comercios SET comision_pct = 12 WHERE comision_pct = 10;
