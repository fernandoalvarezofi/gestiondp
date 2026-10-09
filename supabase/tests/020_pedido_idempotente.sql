-- Confirmar pedido idempotente: repetir con la misma clave devuelve el mismo pedido; otra clave crea otro;
-- la clave de otra persona no sirve. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated, anon;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', '{}'::jsonb
from (values ('99999999-bbbb-4bbb-8bbb-000000000001'::uuid, 'qa-idem-d@example.com'), ('99999999-bbbb-4bbb-8bbb-000000000002'::uuid, 'qa-idem-c@example.com'),
             ('99999999-bbbb-4bbb-8bbb-000000000003'::uuid, 'qa-idem-x@example.com')) as u(id, email);
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, acepta_retiro)
values ('99999999-bbbb-4bbb-8bbb-0000000000c1', 'QA Idem', 'qa-idem', 'comida', 'x', '99999999-bbbb-4bbb-8bbb-000000000001', true, true, true, true);
insert into delivery_productos (id, comercio_id, nombre, categoria, precio, stock) values ('99999999-bbbb-4bbb-8bbb-0000000000a1', '99999999-bbbb-4bbb-8bbb-0000000000c1', 'Pan', 'Panadería', 1000, 10);
create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
do $$
declare c uuid := '99999999-bbbb-4bbb-8bbb-000000000002'; x uuid := '99999999-bbbb-4bbb-8bbb-000000000003';
  loc uuid := '99999999-bbbb-4bbb-8bbb-0000000000c1'; clave uuid := gen_random_uuid(); items jsonb := '[{"producto_id":"99999999-bbbb-4bbb-8bbb-0000000000a1","cantidad":2}]';
  a uuid; b uuid; d uuid; n int;
begin
  perform pg_temp.como(c); set local role authenticated;
  a := delivery_confirmar_pedido(clave, false, loc, items, '', null, 'efectivo', 0, null, null, '2355 400300', null, null, 'retiro');
  b := delivery_confirmar_pedido(clave, false, loc, items, '', null, 'efectivo', 0, null, null, '2355 400300', null, null, 'retiro');
  reset role;
  select count(*) into n from delivery_pedidos where comercio_id = loc;
  insert into t_res values ('misma clave, mismo pedido', a = b and n = 1, format('a=%s b=%s n=%s', a, b, n));
  insert into t_res values ('el stock se descuenta una sola vez', (select stock from delivery_productos where id = '99999999-bbbb-4bbb-8bbb-0000000000a1') = 8, null);
  perform pg_temp.como(c); set local role authenticated;
  d := delivery_confirmar_pedido(gen_random_uuid(), false, loc, items, '', null, 'efectivo', 0, null, null, '2355 400300', null, null, 'retiro');
  reset role;
  insert into t_res values ('otra clave, otro pedido', d <> a, null);
  perform pg_temp.como(x); set local role authenticated;
  begin perform delivery_confirmar_pedido(clave, false, loc, items, '', null, 'efectivo', 0, null, null, '2355 400300', null, null, 'retiro'); insert into t_res values ('la clave de otro no sirve', false, 'sin error');
  exception when others then insert into t_res values ('la clave de otro no sirve', true, sqlerrm); end;
  reset role;
  set local role anon;
  begin perform delivery_confirmar_pedido(gen_random_uuid(), false, loc, items, ''); insert into t_res values ('sin sesión no se ejecuta', false, 'sin error');
  exception when others then insert into t_res values ('sin sesión no se ejecuta', true, sqlerrm); end;
  reset role;
end $$;
select * from t_res;
rollback;
