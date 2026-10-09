-- Eliminar / dar de baja una tienda. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated, anon;
alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', '{}'::jsonb
from (values ('99999999-dddd-4ddd-8ddd-000000000001'::uuid, 'qa-del-dueno@example.com'), ('99999999-dddd-4ddd-8ddd-000000000002'::uuid, 'qa-del-encargado@example.com'),
             ('99999999-dddd-4ddd-8ddd-000000000003'::uuid, 'qa-del-cliente@example.com'), ('99999999-dddd-4ddd-8ddd-000000000004'::uuid, 'qa-del-admin@example.com')) as u(id, email);
insert into user_roles (user_id, role) values ('99999999-dddd-4ddd-8ddd-000000000004', 'admin');
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values
  ('99999999-dddd-4ddd-8ddd-0000000000c1', 'Tienda Vacía', 'qa-del-vacia', 'comida', 'x', '99999999-dddd-4ddd-8ddd-000000000001', true, true),
  ('99999999-dddd-4ddd-8ddd-0000000000c2', 'Tienda Con Historia', 'qa-del-historia', 'comida', 'x', '99999999-dddd-4ddd-8ddd-000000000001', true, true);
insert into delivery_productos (comercio_id, nombre, categoria, precio, stock) values
  ('99999999-dddd-4ddd-8ddd-0000000000c1', 'Pan', 'Panadería', 100, 5),
  ('99999999-dddd-4ddd-8ddd-0000000000c2', 'Torta', 'Panadería', 900, 3);
insert into delivery_comercio_equipo (comercio_id, user_id, email, rol, estado) values ('99999999-dddd-4ddd-8ddd-0000000000c2', '99999999-dddd-4ddd-8ddd-000000000002', 'qa-del-encargado@example.com', 'encargado', 'activo');
insert into delivery_pedidos (id, cliente_id, comercio_id, direccion_entrega, subtotal, total, estado) values
  ('99999999-dddd-4ddd-8ddd-0000000000e1', '99999999-dddd-4ddd-8ddd-000000000003', '99999999-dddd-4ddd-8ddd-0000000000c2', 'x', 900, 900, 'confirmado');
create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
do $$
declare d uuid := '99999999-dddd-4ddd-8ddd-000000000001'; e uuid := '99999999-dddd-4ddd-8ddd-000000000002'; adm uuid := '99999999-dddd-4ddd-8ddd-000000000004';
  vacia uuid := '99999999-dddd-4ddd-8ddd-0000000000c1'; hist uuid := '99999999-dddd-4ddd-8ddd-0000000000c2'; v jsonb;
begin
  perform pg_temp.como(d); set local role authenticated;
  v := delivery_tienda_eliminacion_resumen(vacia);
  insert into t_res values ('tienda sin historial: se elimina de verdad', v->>'modo' = 'eliminar', v::text);
  begin perform delivery_eliminar_tienda(vacia, 'otro nombre'); insert into t_res values ('confirmación con nombre equivocado', false, 'sin error');
  exception when others then insert into t_res values ('confirmación con nombre equivocado', true, sqlerrm); end;
  v := delivery_eliminar_tienda(vacia, '  tienda vacía ');
  reset role;
  insert into t_res values ('eliminada con todo lo suyo', v->>'resultado' = 'eliminada' and not exists (select 1 from delivery_comercios where id = vacia) and not exists (select 1 from delivery_productos where comercio_id = vacia), v::text);

  perform pg_temp.como(e); set local role authenticated;
  begin perform delivery_eliminar_tienda(hist, 'Tienda Con Historia'); insert into t_res values ('un encargado no puede eliminar', false, 'sin error');
  exception when others then insert into t_res values ('un encargado no puede eliminar', true, sqlerrm); end;
  reset role;

  perform pg_temp.como(d); set local role authenticated;
  begin perform delivery_eliminar_tienda(hist, 'Tienda Con Historia'); insert into t_res values ('pedido en curso bloquea', false, 'sin error');
  exception when others then insert into t_res values ('pedido en curso bloquea', sqlerrm like '%en curso%', sqlerrm); end;
  reset role;
  update delivery_pedidos set estado = 'cancelado' where id = '99999999-dddd-4ddd-8ddd-0000000000e1';
  perform pg_temp.como(d); set local role authenticated;
  v := delivery_eliminar_tienda(hist, 'Tienda Con Historia');
  reset role;
  insert into t_res values ('con historial: se da de baja', v->>'resultado' = 'baja'
    and (select eliminado_at is not null and not activo and slug like 'qa-del-historia-baja-%' and slug_anterior = 'qa-del-historia' from delivery_comercios where id = hist), v::text);
  insert into t_res values ('el pedido histórico queda intacto', exists (select 1 from delivery_pedidos where id = '99999999-dddd-4ddd-8ddd-0000000000e1'), null);
  insert into t_res values ('productos archivados', (select bool_and(estado = 'archivado') from delivery_productos where comercio_id = hist), null);
  perform pg_temp.como(d); set local role authenticated;
  insert into t_res values ('ya no aparece en el panel del dueño', not exists (select 1 from jsonb_array_elements(delivery_mis_comercios()) x where x->>'id' = hist::text) and delivery_mi_acceso(hist) = 'null'::jsonb, null);
  begin update delivery_comercios set nombre = 'Revivida' where id = hist; insert into t_res values ('el dueño no puede editarla', false, 'sin error');
  exception when others then insert into t_res values ('el dueño no puede editarla', true, sqlerrm); end;
  begin perform delivery_admin_restaurar_tienda(hist); insert into t_res values ('el dueño no restaura', false, 'sin error');
  exception when others then insert into t_res values ('el dueño no restaura', true, sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claims', '', true); set local role anon;
  insert into t_res values ('invisible para el público', not exists (select 1 from delivery_comercios where id = hist), null);
  reset role;
  perform pg_temp.como(adm); set local role authenticated;
  v := delivery_admin_restaurar_tienda(hist);
  reset role;
  insert into t_res values ('administración la restaura oculta y con su dirección', (select eliminado_at is null and not activo and slug = 'qa-del-historia' from delivery_comercios where id = hist), v::text);
end $$;
select * from t_res;
rollback;
