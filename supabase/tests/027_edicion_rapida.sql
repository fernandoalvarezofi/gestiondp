-- Catálogo: edición rápida en tabla (todo o nada, permisos, ofertas activas, stock con historial).
-- Se autodescarta: termina con una excepción que muestra el resultado y revierte todo.
do $$
declare
  duenio uuid := '77777777-bbbb-4aaa-8aaa-000000000001'; otro uuid := '77777777-bbbb-4aaa-8aaa-000000000002';
  c uuid; c2 uuid; p1 uuid; p2 uuid; pajeno uuid; r text := ''; n int;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', duenio, 'authenticated', 'authenticated', 'qa-027-a@example.com', '', now(), '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', otro, 'authenticated', 'authenticated', 'qa-027-b@example.com', '', now(), '{}', '{}', now(), now());
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado, propietario_id) values ('QA 027', 'qa-027', 'tiendas', 'Calle 1', true, true, duenio) returning id into c;
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado, propietario_id) values ('QA 027 B', 'qa-027-b', 'tiendas', 'Calle 2', true, true, otro) returning id into c2;
  insert into delivery_productos (comercio_id, nombre, precio, categoria, estado) values (c, 'Uno', 100, 'A', 'publicado') returning id into p1;
  insert into delivery_productos (comercio_id, nombre, precio, categoria, estado) values (c, 'Dos', 200, 'A', 'publicado') returning id into p2;
  insert into delivery_productos (comercio_id, nombre, precio, categoria, estado) values (c2, 'Ajeno', 50, 'A', 'publicado') returning id into pajeno;

  perform set_config('request.jwt.claims', json_build_object('sub', duenio, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', p1, 'precio', 150, 'precio_anterior', 180, 'stock', 9), jsonb_build_object('id', p2, 'estado', 'borrador', 'disponible', false)));
  if n <> 2 then r := r || 'FALLA cantidad; '; end if;
  -- Todo o nada: el segundo cambio es inválido y el primero no debe quedar.
  begin perform catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', p1, 'precio', 999), jsonb_build_object('id', p2, 'precio', 300, 'precio_anterior', 100))); r := r || 'FALLA acepta anterior menor; '; exception when others then null; end;
  begin perform catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', p1, 'stock', -3))); r := r || 'FALLA stock negativo; '; exception when others then null; end;
  begin perform catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', p1, 'estado', 'hackeado'))); r := r || 'FALLA estado inválido; '; exception when others then null; end;
  begin perform catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', pajeno, 'precio', 1))); r := r || 'FALLA producto de otra tienda; '; exception when others then null; end;
  begin perform catalogo_edicion_rapida(c2, jsonb_build_array(jsonb_build_object('id', pajeno, 'precio', 1))); r := r || 'FALLA edita tienda ajena; '; exception when others then null; end;
  reset role;
  update delivery_productos set promo_activa = true, promo_respaldo = jsonb_build_object('precio', 150) where id = p2;
  perform set_config('request.jwt.claims', json_build_object('sub', duenio, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform catalogo_edicion_rapida(c, jsonb_build_array(jsonb_build_object('id', p2, 'precio', 10))); r := r || 'FALLA cambia precio con oferta activa; '; exception when others then null; end;
  reset role;

  if (select precio from delivery_productos where id = p1) <> 150 or (select precio_anterior from delivery_productos where id = p1) <> 180 or (select stock from delivery_productos where id = p1) <> 9 then r := r || 'FALLA valores de Uno; '; end if;
  if (select estado from delivery_productos where id = p2) <> 'borrador' or (select disponible from delivery_productos where id = p2) then r := r || 'FALLA valores de Dos; '; end if;
  if not exists (select 1 from inventario_movimientos where producto_id = p1 and motivo = 'inventario' and nota = 'Edición rápida' and stock_despues = 9 and usuario_id = duenio) then r := r || 'FALLA historial de stock; '; end if;
  if (select precio from delivery_productos where id = pajeno) <> 50 then r := r || 'FALLA tocó la tienda ajena; '; end if;

  raise exception '%', case when r = '' then 'EDICIÓN RÁPIDA: TODAS PASARON' else r end;
end $$;
