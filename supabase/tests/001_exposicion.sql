-- PRUEBAS DE EXPOSICIÓN DE DATOS (Fase 0). Se ejecutan contra la base en una transacción que se deshace sola:
--   psql / SQL editor de Supabase: pegar el archivo completo. Si algo falla, lanza una excepción con el detalle.
-- Qué comprueba:
--   1) un visitante (anon) no lee teléfonos de perfiles ni la comisión de los comercios;
--   2) un usuario común no lee el teléfono de otro ni ejecuta funciones de administración;
--   3) delivery_mi_perfil devuelve solo el perfil propio;
--   4) las tablas privadas no devuelven filas a anon;
--   5) las tablas con RLS sin políticas siguen cerradas.
do $t$
declare
  fallos text := '';
  n bigint; u uuid; otro uuid; rel text; v jsonb;
  privadas text[] := array['delivery_pedidos','delivery_pedido_items','delivery_envios','delivery_viajes','delivery_libro','delivery_liquidaciones','delivery_repartidores','delivery_identidad','delivery_documentos','delivery_direcciones','delivery_datos_cobro','delivery_mensajes','delivery_reclamos','delivery_comercio_legal','delivery_push_suscripciones','user_roles','core_businesses','core_business_members'];
  cerradas text[] := array['app_config','delivery_auditoria','delivery_errores','delivery_comercio_equipo','delivery_clientes_control','delivery_campana_envios','delivery_ofertas_rechazos','delivery_rutas','delivery_tienda_visitas'];
begin
  select id into u from perfiles where telefono is not null limit 1;
  select id into otro from perfiles where id <> u limit 1;
  if u is null or otro is null then raise exception 'La prueba necesita al menos 2 perfiles (uno con teléfono)'; end if;

  -- 1) anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform telefono from perfiles limit 1; fallos := fallos || E'- anon lee perfiles.telefono\n'; exception when others then null; end;
  begin perform comision_pct from delivery_comercios limit 1; fallos := fallos || E'- anon lee delivery_comercios.comision_pct\n'; exception when others then null; end;
  begin perform liquidacion_frecuencia from delivery_comercios limit 1; fallos := fallos || E'- anon lee delivery_comercios.liquidacion_frecuencia\n'; exception when others then null; end;
  begin perform delivery_mi_perfil(); fallos := fallos || E'- anon ejecuta delivery_mi_perfil\n'; exception when others then null; end;
  foreach rel in array privadas loop
    begin execute format('select count(*) from public.%I', rel) into n; if n > 0 then fallos := fallos || format(E'- anon ve %s filas de %s\n', n, rel); end if; exception when others then null; end;
  end loop;
  foreach rel in array cerradas loop
    begin execute format('select count(*) from public.%I', rel) into n; if n > 0 then fallos := fallos || format(E'- anon ve %s filas de %s (debería estar cerrada)\n', n, rel); end if; exception when others then null; end;
  end loop;

  -- 2) y 3) usuario común
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform telefono from perfiles where id = u; fallos := fallos || E'- un usuario lee el teléfono de otro\n'; exception when others then null; end;
  begin perform * from delivery_admin_comercios(); fallos := fallos || E'- un no-admin ejecuta delivery_admin_comercios\n'; exception when others then null; end;
  v := delivery_mi_perfil();
  if (v->>'nombre') is distinct from (select nombre from perfiles where id = otro) then fallos := fallos || E'- delivery_mi_perfil no devuelve el perfil propio\n'; end if;
  foreach rel in array cerradas loop
    begin execute format('select count(*) from public.%I', rel) into n; if n > 0 then fallos := fallos || format(E'- un usuario ve %s filas de %s (debería estar cerrada)\n', n, rel); end if; exception when others then null; end;
  end loop;

  perform set_config('role', 'postgres', true);
  if fallos <> '' then raise exception E'PRUEBAS DE EXPOSICIÓN: FALLARON\n%', fallos; end if;
  raise notice 'PRUEBAS DE EXPOSICIÓN: todas pasaron';
end $t$;
