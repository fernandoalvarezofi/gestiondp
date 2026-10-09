-- Prueba del historial de pedidos del comercio (búsqueda en el servidor): filtros, resumen, paginación,
-- comodines tratados como texto y aislamiento entre locales. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated, anon;
alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', jsonb_build_object('full_name', nombre)
from (values ('77777777-aaaa-4aaa-8aaa-000000000001'::uuid, 'qa-his-dueno@example.com', 'Hugo Dueño'),
             ('77777777-aaaa-4aaa-8aaa-000000000002'::uuid, 'qa-his-otro@example.com', 'Olga Otra'),
             ('77777777-aaaa-4aaa-8aaa-000000000003'::uuid, 'qa-his-cli@example.com', 'Ramona Cliente')) as u(id, email, nombre);
update perfiles set nombre = 'Ramona Cliente' where id = '77777777-aaaa-4aaa-8aaa-000000000003';
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values
  ('77777777-aaaa-4aaa-8aaa-0000000000c1', 'QA Historial', 'qa-historial', 'comida', 'Lincoln', '77777777-aaaa-4aaa-8aaa-000000000001', true, true);
insert into delivery_pedidos (id, cliente_id, comercio_id, direccion_entrega, subtotal, total, estado, telefono_contacto, created_at) values
  ('abc12300-0000-4000-8000-000000000001', '77777777-aaaa-4aaa-8aaa-000000000003', '77777777-aaaa-4aaa-8aaa-0000000000c1', 'x', 1000, 1200, 'entregado', '2355 111222', now() - interval '60 days'),
  ('abc12300-0000-4000-8000-000000000002', '77777777-aaaa-4aaa-8aaa-000000000003', '77777777-aaaa-4aaa-8aaa-0000000000c1', 'x', 2000, 2200, 'entregado', null, now() - interval '2 days'),
  ('def45600-0000-4000-8000-000000000003', '77777777-aaaa-4aaa-8aaa-000000000003', '77777777-aaaa-4aaa-8aaa-0000000000c1', 'x', 500, 700, 'cancelado', null, now() - interval '1 day'),
  ('def45600-0000-4000-8000-000000000004', '77777777-aaaa-4aaa-8aaa-000000000003', '77777777-aaaa-4aaa-8aaa-0000000000c1', 'x', 800, 900, 'entregado', null, now() - interval '500 days');
create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
do $$
declare d uuid := '77777777-aaaa-4aaa-8aaa-000000000001'; o uuid := '77777777-aaaa-4aaa-8aaa-000000000002'; loc uuid := '77777777-aaaa-4aaa-8aaa-0000000000c1';
  v jsonb; hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform pg_temp.como(d); set local role authenticated;
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy);
  insert into t_res values ('rango de 90 días ve pedidos de más de 30 días', (v->>'total')::int = 3, v::text);
  insert into t_res values ('resumen del período', (v->>'entregados')::int = 2 and (v->>'cancelados')::int = 1 and (v->>'ventas')::numeric = 3000, v::text);
  insert into t_res values ('orden: más reciente primero', v->'ids'->>0 = 'def45600-0000-4000-8000-000000000003', v->>'ids');
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, 'entregado');
  insert into t_res values ('filtro por estado', (v->>'total')::int = 2, v::text);
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, null, '#ABC123');
  insert into t_res values ('busca por número corto', (v->>'total')::int = 2, v::text);
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, null, 'ramona');
  insert into t_res values ('busca por cliente', (v->>'total')::int = 3, v::text);
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, null, '111-222');
  insert into t_res values ('busca por teléfono sin importar el formato', (v->>'total')::int = 1, v::text);
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, null, '%');
  insert into t_res values ('el comodín se busca literal', (v->>'total')::int = 0, v::text);
  v := delivery_comercio_pedidos_buscar(loc, hoy - 90, hoy, null, null, 1, 1);
  insert into t_res values ('paginación', jsonb_array_length(v->'ids') = 1 and v->'ids'->>0 = 'abc12300-0000-4000-8000-000000000002', v->>'ids');
  begin perform delivery_comercio_pedidos_buscar(loc, hoy - 600, hoy); insert into t_res values ('rango máximo', false, 'sin error');
  exception when others then insert into t_res values ('rango máximo', true, sqlerrm); end;
  begin perform delivery_comercio_pedidos_buscar(loc, hoy - 30, hoy, 'inventado'); insert into t_res values ('estado inválido rechazado', false, 'sin error');
  exception when others then insert into t_res values ('estado inválido rechazado', true, sqlerrm); end;
  reset role;
  perform pg_temp.como(o); set local role authenticated;
  begin perform delivery_comercio_pedidos_buscar(loc, hoy - 30, hoy); insert into t_res values ('otro comercio no ve el historial', false, 'sin error');
  exception when others then insert into t_res values ('otro comercio no ve el historial', true, sqlerrm); end;
  reset role;
  set local role anon;
  begin perform delivery_comercio_pedidos_buscar(loc, hoy - 30, hoy); insert into t_res values ('sin sesión no se ejecuta', false, 'sin error');
  exception when others then insert into t_res values ('sin sesión no se ejecuta', true, sqlerrm); end;
  reset role;
end $$;
select * from t_res;
rollback;
