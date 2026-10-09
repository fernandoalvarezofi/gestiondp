-- La comisión de un comercio nuevo sale del ajuste de la plataforma (comision_default_pct, hoy 12 %).
-- Antes la columna tenía un 10 fijo, así que los comercios dados de alta desde la app quedaban en 10 % aunque el ajuste dijera otra cosa.
-- No modifica comercios existentes: cambiar la comisión de uno ya creado es una decisión de administración.
alter table public.delivery_comercios alter column comision_pct set default public.delivery_ajuste('comision_default_pct', 12);
