-- PRUEBAS DE NEGOCIOS (Fase 1). Se ejecutan en una transacción que se deshace sola (termina con una excepción a propósito).
-- Comprueba: un comercio nuevo queda en el negocio de su dueño, dos dueños no se ven entre sí, nadie escribe directo en las tablas del Core
-- y las sucursales quedan enlazadas a su tienda de origen.
do $t$
declare a uuid; b uuid; cat delivery_categoria; c1 uuid; c2 uuid; c3 uuid; neg1 uuid; neg2 uuid; n int; fallos text := ''; suc uuid;
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users where id <> a order by created_at limit 1;
  if a is null or b is null then raise exception 'La prueba necesita al menos 2 usuarios'; end if;
  select categoria into cat from delivery_comercios limit 1;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA Uno', 'qa-core-1', cat, 'x', a, true, true) returning id into c1;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA Dos', 'qa-core-2', cat, 'x', a, true, true) returning id into c2;
  select business_id into neg1 from delivery_comercios where id = c1;
  if neg1 is distinct from (select business_id from delivery_comercios where id = c2) then fallos := fallos || E'- los comercios de un mismo dueño no comparten negocio\n'; end if;
  if (select m.rol from core_business_members m where m.business_id = neg1 and m.user_id = a) is distinct from 'owner' then fallos := fallos || E'- el dueño no quedó como owner\n'; end if;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA Tres', 'qa-core-3', cat, 'x', b, true, true) returning id into c3;
  select business_id into neg2 from delivery_comercios where id = c3;
  if neg2 is null or neg2 = neg1 then fallos := fallos || E'- otro dueño no tiene su propio negocio\n'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from core_businesses where id = neg1; if n > 0 then fallos := fallos || E'- un usuario ve el negocio de otro\n'; end if;
  select count(*) into n from core_business_members where business_id = neg1; if n > 0 then fallos := fallos || E'- un usuario ve integrantes de otro negocio\n'; end if;
  begin insert into core_businesses (owner_user_id, nombre) values (b, 'Directo'); fallos := fallos || E'- un usuario creó un negocio directo\n'; exception when others then null; end;
  begin update core_business_members set rol = 'owner' where business_id = neg1; get diagnostics n = row_count; if n > 0 then fallos := fallos || E'- un usuario cambió roles ajenos\n'; end if; exception when others then null; end;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform business_id from delivery_comercios limit 1; fallos := fallos || E'- anon lee business_id\n'; exception when others then null; end;
  begin select count(*) into n from core_businesses; fallos := fallos || E'- anon accede a core_businesses\n'; exception when others then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  suc := delivery_crear_sucursal(c1, 'QA Sucursal', 'Calle 1', -34.8, -61.5, '1155550000', false);
  perform set_config('role', 'postgres', true);
  if (select parent_store_id from delivery_comercios where id = suc) is distinct from c1 then fallos := fallos || E'- la sucursal no quedó enlazada a su origen\n'; end if;
  if (select business_id from delivery_comercios where id = suc) is distinct from neg1 then fallos := fallos || E'- la sucursal no quedó en el negocio del dueño\n'; end if;

  if fallos <> '' then raise exception E'PRUEBAS DE NEGOCIOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE NEGOCIOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
