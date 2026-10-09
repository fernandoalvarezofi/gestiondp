-- Prueba del catálogo pro: visibilidad por estado, venta solo de lo publicado, SKU único, slugs, ofertas programadas,
-- historial, duplicado, acciones masivas, colecciones y aislamiento entre locales. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', jsonb_build_object('full_name', nombre)
from (values ('55555555-eeee-4eee-8eee-000000000001'::uuid, 'qa-cat-dueno@example.com', 'Delia Dueña'),
             ('55555555-eeee-4eee-8eee-000000000002'::uuid, 'qa-cat-otro@example.com', 'Omar Otro'),
             ('55555555-eeee-4eee-8eee-000000000003'::uuid, 'qa-cat-cliente@example.com', 'Celia Cliente')) as u(id, email, nombre);
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values
  ('55555555-eeee-4eee-8eee-0000000000c1', 'QA Tienda Catálogo', 'qa-tienda-catalogo', 'comida', 'Lincoln', '55555555-eeee-4eee-8eee-000000000001', true, true),
  ('55555555-eeee-4eee-8eee-0000000000c2', 'QA Otra Tienda', 'qa-otra-tienda', 'comida', 'Lincoln', '55555555-eeee-4eee-8eee-000000000002', true, true);
insert into delivery_productos (id, comercio_id, nombre, categoria, precio, estado, sku) values
  ('55555555-eeee-4eee-8eee-0000000000a1', '55555555-eeee-4eee-8eee-0000000000c1', 'Remera Básica', 'Ropa', 10000, 'publicado', 'REM-001'),
  ('55555555-eeee-4eee-8eee-0000000000a2', '55555555-eeee-4eee-8eee-0000000000c1', 'Buzo Nuevo', 'Ropa', 30000, 'borrador', null),
  ('55555555-eeee-4eee-8eee-0000000000a3', '55555555-eeee-4eee-8eee-0000000000c1', 'Remera Básica', 'Ropa', 12000, 'publicado', null),
  ('55555555-eeee-4eee-8eee-0000000000b1', '55555555-eeee-4eee-8eee-0000000000c2', 'Gorra', 'Accesorios', 5000, 'publicado', 'REM-001');
insert into delivery_producto_variantes (producto_id, nombre, sku, stock) values ('55555555-eeee-4eee-8eee-0000000000a1', 'Talle M', 'REM-001-M', 5);

create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

do $$
declare
  d uuid := '55555555-eeee-4eee-8eee-000000000001'; o uuid := '55555555-eeee-4eee-8eee-000000000002'; cl uuid := '55555555-eeee-4eee-8eee-000000000003';
  loc uuid := '55555555-eeee-4eee-8eee-0000000000c1'; loc2 uuid := '55555555-eeee-4eee-8eee-0000000000c2';
  remera uuid := '55555555-eeee-4eee-8eee-0000000000a1'; buzo uuid := '55555555-eeee-4eee-8eee-0000000000a2'; remera2 uuid := '55555555-eeee-4eee-8eee-0000000000a3';
  gorra uuid := '55555555-eeee-4eee-8eee-0000000000b1'; v_copia uuid; v_col uuid; v_col2 uuid; n int; v jsonb; ped uuid;
begin
  insert into t_res values ('slugs únicos dentro del local', (select slug from delivery_productos where id = remera) = 'remera-basica' and (select slug from delivery_productos where id = remera2) = 'remera-basica-2', null);

  -- Visibilidad: un cliente no ve el borrador; la dueña sí.
  perform pg_temp.como(cl); set local role authenticated;
  select count(*) into n from delivery_productos where comercio_id = loc;
  insert into t_res values ('cliente no ve borradores', n = 2, n::text);
  reset role;
  set local role anon;
  select count(*) into n from delivery_productos where comercio_id = loc;
  insert into t_res values ('visitante no ve borradores', n = 2, n::text);
  reset role;
  perform pg_temp.como(d); set local role authenticated;
  select count(*) into n from delivery_productos where comercio_id = loc;
  insert into t_res values ('la dueña ve todo su catálogo', n = 3, n::text);
  reset role;

  -- Un borrador no se puede vender aunque se salte la pantalla.
  insert into delivery_pedidos (id, cliente_id, comercio_id, direccion_entrega, total, subtotal) values (gen_random_uuid(), cl, loc, 'Calle 1', 1, 1) returning id into ped;
  begin insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped, buzo, 'Buzo', 30000, 1); insert into t_res values ('borrador no se vende', false, 'sin error');
  exception when others then insert into t_res values ('borrador no se vende', true, sqlerrm); end;

  -- SKU único en el local (productos y variantes), pero puede repetirse en otro local.
  perform pg_temp.como(d); set local role authenticated;
  begin update delivery_productos set sku = 'rem-001-m' where id = remera2; insert into t_res values ('SKU repetido (variante) rechazado', false, 'sin error');
  exception when others then insert into t_res values ('SKU repetido (variante) rechazado', true, sqlerrm); end;
  insert into t_res values ('mismo SKU en otro local está permitido', (select sku from delivery_productos where id = gorra) = 'REM-001', null);

  -- Oferta programada: ya empezó, se aplica y guarda el precio regular.
  perform catalogo_oferta(remera, 8000, now() - interval '1 minute', now() + interval '2 days');
  insert into t_res values ('oferta aplicada al instante', (select precio = 8000 and precio_anterior = 10000 and promo_activa from delivery_productos where id = remera), null);
  -- Cambiar el precio durante la oferta cambia el regular, no el de oferta.
  update delivery_productos set precio = 11000 where id = remera;
  insert into t_res values ('editar precio en oferta cambia el regular', (select precio = 8000 and precio_anterior = 11000 and (promo_respaldo->>'precio')::numeric = 11000 from delivery_productos where id = remera), null);
  -- Quitar la oferta vuelve al precio regular.
  perform catalogo_oferta(remera, null);
  insert into t_res values ('quitar oferta restaura el precio', (select precio = 11000 and precio_anterior is null and not promo_activa from delivery_productos where id = remera), null);
  begin perform catalogo_oferta(remera, 20000); insert into t_res values ('oferta mayor al precio rechazada', false, 'sin error');
  exception when others then insert into t_res values ('oferta mayor al precio rechazada', true, sqlerrm); end;
  insert into t_res values ('historial de precios con autor', exists (select 1 from delivery_producto_cambios where producto_id = remera and campo = 'precio' and usuario_id = d), null);

  -- Duplicar copia variantes y queda en borrador sin SKU.
  v_copia := producto_duplicar(remera);
  insert into t_res values ('duplicado completo en borrador', (select estado = 'borrador' and sku is null from delivery_productos where id = v_copia)
    and (select count(*) from delivery_producto_variantes where producto_id = v_copia) = 1, null);

  -- Acciones masivas: publicar y no tocar productos de otro local.
  n := catalogo_masivo(loc, array[buzo, v_copia, gorra], 'publicar');
  insert into t_res values ('publicación masiva solo en mi local', n = 2 and (select estado from delivery_productos where id = gorra) = 'publicado', n::text);

  -- Colecciones: no se mezclan productos de otro local.
  insert into delivery_colecciones (comercio_id, nombre, slug) values (loc, 'Verano', 'verano') returning id into v_col;
  insert into delivery_coleccion_productos (coleccion_id, producto_id) values (v_col, remera);
  begin insert into delivery_coleccion_productos (coleccion_id, producto_id) values (v_col, gorra); insert into t_res values ('colección no mezcla locales', false, 'sin error');
  exception when others then insert into t_res values ('colección no mezcla locales', true, sqlerrm); end;
  v := catalogo_resumen(loc);
  insert into t_res values ('resumen del catálogo', (v->>'total')::int = 4, v::text);
  reset role;

  -- Otro comerciante no puede tocar mi catálogo.
  perform pg_temp.como(o); set local role authenticated;
  begin perform catalogo_masivo(loc, array[remera], 'archivar'); insert into t_res values ('otro local no hace acciones masivas', false, 'sin error');
  exception when others then insert into t_res values ('otro local no hace acciones masivas', true, sqlerrm); end;
  begin perform producto_duplicar(remera); insert into t_res values ('otro local no duplica', false, 'sin error');
  exception when others then insert into t_res values ('otro local no duplica', true, sqlerrm); end;
  update delivery_productos set precio = 1 where id = remera;
  insert into t_res values ('otro local no edita precios (RLS)', (select precio from delivery_productos where id = remera) = 11000, null);
  select count(*) into n from delivery_producto_cambios where comercio_id = loc;
  insert into t_res values ('otro local no ve el historial', n = 0, n::text);
  reset role;
end $$;

select * from t_res;
rollback;
