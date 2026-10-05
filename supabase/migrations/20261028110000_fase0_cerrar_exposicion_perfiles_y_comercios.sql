-- FASE 0 (2/3): cierre de la exposición pública de datos. Se aplicó DESPUÉS de publicar el front (que ya lee por RPC y con columnas explícitas).
-- Hallazgos que cierra: T1 (teléfonos de `perfiles` legibles por cualquier visitante) y T2 (comisión y frecuencia de liquidación de cada comercio).
-- Revertir (si hiciera falta): grant select on public.perfiles to anon, authenticated; grant select on public.delivery_comercios to anon, authenticated;
-- IMPORTANTE: toda columna nueva y pública de estas tablas necesita su propio GRANT SELECT (columna), y agregarse a COMERCIO_COLS (src/lib/delivery.ts).

-- perfiles: nadie lee el teléfono por la API (cada uno lo ve con delivery_mi_perfil; las funciones privilegiadas lo siguen leyendo).
revoke select on public.perfiles from anon, authenticated;
grant select (id, nombre, username, avatar_url, created_at, updated_at) on public.perfiles to anon, authenticated;

-- comercios: la comisión y la frecuencia de liquidación dejan de ser públicas (administración las lee con delivery_admin_comercios).
do $mig$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'delivery_comercios' and column_name not in ('comision_pct', 'liquidacion_frecuencia');
  revoke select on public.delivery_comercios from anon, authenticated;
  execute format('grant select (%s) on public.delivery_comercios to anon, authenticated', cols);
end $mig$;
