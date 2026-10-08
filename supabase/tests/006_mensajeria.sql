-- Prueba de la mensajería: quién puede leer y escribir en cada contexto. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', jsonb_build_object('full_name', nombre)
from (values ('33333333-cccc-4ccc-8ccc-000000000001'::uuid, 'qa-msg-cliente@example.com', 'Carla Cliente'),
             ('33333333-cccc-4ccc-8ccc-000000000002'::uuid, 'qa-msg-dueno@example.com', 'Diego Dueño'),
             ('33333333-cccc-4ccc-8ccc-000000000003'::uuid, 'qa-msg-rep@example.com', 'Rita Repartidora'),
             ('33333333-cccc-4ccc-8ccc-000000000004'::uuid, 'qa-msg-intruso@example.com', 'Iván Intruso'),
             ('33333333-cccc-4ccc-8ccc-000000000005'::uuid, 'qa-msg-admin@example.com', 'Ana Admin')) as u(id, email, nombre);
insert into user_roles (user_id, role) values ('33333333-cccc-4ccc-8ccc-000000000005', 'admin');
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo)
values ('33333333-cccc-4ccc-8ccc-0000000000c1', 'QA Local Mensajes', 'qa-local-mensajes', 'comida', 'Lincoln', '33333333-cccc-4ccc-8ccc-000000000002', true, true);
insert into delivery_pedidos (id, cliente_id, comercio_id, direccion_entrega, estado, pago_estado, repartidor_id, total, subtotal)
values ('33333333-cccc-4ccc-8ccc-0000000000e1', '33333333-cccc-4ccc-8ccc-000000000001', '33333333-cccc-4ccc-8ccc-0000000000c1', 'Calle 1', 'en_camino', 'aprobado', '33333333-cccc-4ccc-8ccc-000000000003', 1000, 1000);
insert into delivery_viajes (id, cliente_id, estado, origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, pasajeros, telefono, distancia_km, tarifa, total, comision_pct, ganancia_conductor, conductor_id)
values ('33333333-cccc-4ccc-8ccc-0000000000f1', '33333333-cccc-4ccc-8ccc-000000000001', 'asignado', 'Av. Massey 100, Lincoln', -34.86, -61.53, 'Calle Alem 250, Lincoln', -34.87, -61.54, 1, '1111', 2, 1000, 1000, 12, 880, '33333333-cccc-4ccc-8ccc-000000000003');

create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

do $$
declare h uuid; hr uuid; hv uuid; hc uuid; n int;
  c uuid := '33333333-cccc-4ccc-8ccc-000000000001'; d uuid := '33333333-cccc-4ccc-8ccc-000000000002';
  r uuid := '33333333-cccc-4ccc-8ccc-000000000003'; x uuid := '33333333-cccc-4ccc-8ccc-000000000004'; a uuid := '33333333-cccc-4ccc-8ccc-000000000005';
  ped uuid := '33333333-cccc-4ccc-8ccc-0000000000e1'; via uuid := '33333333-cccc-4ccc-8ccc-0000000000f1'; loc uuid := '33333333-cccc-4ccc-8ccc-0000000000c1';
begin
  -- Cliente abre el chat con el local y escribe.
  perform pg_temp.como(c); set local role authenticated;
  h := msg_abrir('pedido', ped, 'cliente_comercio');
  perform msg_enviar(h, 'texto', 'Estoy en la puerta azul');
  insert into t_res values ('cliente escribe al local', true, null);
  reset role;
  -- El local lo ve y responde; el aviso le llegó al dueño.
  insert into t_res values ('aviso al local', exists (select 1 from notificaciones where usuario_id = d and categoria = 'mensajes'), null);
  perform pg_temp.como(d); set local role authenticated;
  perform msg_enviar(h, 'rapido', 'Tu pedido está listo');
  select jsonb_array_length(msg_mensajes(h)->'mensajes') into n;
  insert into t_res values ('local ve los 2 mensajes', n = 2, n::text);
  reset role;
  insert into t_res values ('aviso al cliente', exists (select 1 from notificaciones where usuario_id = c and categoria = 'mensajes'), null);
  -- El repartidor NO participa del chat cliente ↔ local.
  perform pg_temp.como(r); set local role authenticated;
  begin perform msg_enviar(h, 'texto', 'hola'); insert into t_res values ('repartidor no escribe en chat cliente-local', false, 'sin error');
  exception when others then insert into t_res values ('repartidor no escribe en chat cliente-local', true, sqlerrm); end;
  select count(*) into n from msg_mensajes where hilo_id = h;
  insert into t_res values ('repartidor no lee chat cliente-local (RLS)', n = 0, n::text);
  -- Pero sí habla con el local por el canal comercio ↔ repartidor, y comparte ubicación.
  hr := msg_abrir('pedido', ped, 'comercio_repartidor');
  perform msg_enviar(hr, 'ubicacion', null, -34.8667, -61.5333);
  insert into t_res values ('repartidor comparte ubicación con el local', true, null);
  reset role;
  -- Un intruso no puede abrir, leer ni escribir.
  perform pg_temp.como(x); set local role authenticated;
  begin perform msg_abrir('pedido', ped, 'cliente_comercio'); insert into t_res values ('intruso no abre el chat', false, 'sin error');
  exception when others then insert into t_res values ('intruso no abre el chat', true, sqlerrm); end;
  begin perform msg_mensajes(h); insert into t_res values ('intruso no lee mensajes', false, 'sin error');
  exception when others then insert into t_res values ('intruso no lee mensajes', true, sqlerrm); end;
  select count(*) into n from msg_hilos;
  insert into t_res values ('intruso no ve hilos ajenos (RLS)', n = 0, n::text);
  select count(*) into n from jsonb_array_elements(msg_bandeja(null, null));
  insert into t_res values ('bandeja del intruso vacía', n = 0, n::text);
  reset role;
  -- Viaje: pasajero ↔ conductor.
  perform pg_temp.como(c); set local role authenticated;
  hv := msg_abrir('viaje', via, 'pasajero_conductor');
  perform msg_enviar(hv, 'rapido', 'Ya salgo');
  select count(*) into n from jsonb_array_elements(msg_bandeja(null, 'cliente'));
  insert into t_res values ('bandeja del cliente: pedido + viaje', n = 2, n::text);
  reset role;
  perform pg_temp.como(r); set local role authenticated;
  select msg_sin_leer(null, 'conductor') into n;
  insert into t_res values ('conductor tiene 1 conversación sin leer', n = 1, n::text);
  perform msg_marcar_leido(hv);
  select msg_sin_leer(null, 'conductor') into n;
  insert into t_res values ('al leer, queda en 0', n = 0, n::text);
  reset role;
  -- Consulta y bloqueo.
  perform pg_temp.como(x); set local role authenticated;
  hc := msg_consulta_iniciar(loc, '¿Tienen sin TACC?');
  insert into t_res values ('cualquiera puede consultar a un local', true, null);
  reset role;
  perform pg_temp.como(d); set local role authenticated;
  perform msg_bloquear(hc, true);
  reset role;
  perform pg_temp.como(x); set local role authenticated;
  begin perform msg_enviar(hc, 'texto', 'otra vez'); insert into t_res values ('bloqueado no puede escribir', false, 'sin error');
  exception when others then insert into t_res values ('bloqueado no puede escribir', true, sqlerrm); end;
  -- Reporte de un mensaje.
  reset role;
  perform pg_temp.como(c); set local role authenticated;
  perform msg_reportar((select id from msg_mensajes where hilo_id = h and autor_rol = 'comercio' limit 1), 'Prueba de reporte');
  reset role;
  insert into t_res values ('reporte avisa a administración', exists (select 1 from notificaciones where usuario_id = a and tipo = 'MENSAJE_REPORTADO'), null);
  -- Administración ve (moderación) pero no escribe.
  perform pg_temp.como(a); set local role authenticated;
  select jsonb_array_length(msg_mensajes(h)->'mensajes') into n;
  insert into t_res values ('admin puede leer para moderar', n = 2, n::text);
  begin perform msg_enviar(h, 'texto', 'soy admin'); insert into t_res values ('admin no escribe en chats ajenos', false, 'sin error');
  exception when others then insert into t_res values ('admin no escribe en chats ajenos', true, sqlerrm); end;
  select jsonb_array_length(msg_admin_reportes()) into n;
  insert into t_res values ('admin ve el reporte', n = 1, n::text);
  reset role;
  -- Pedido terminado hace más de 24 h: la conversación cierra.
  update delivery_pedidos set estado = 'entregado', entregado_at = now() - interval '25 hours' where id = ped;
  perform pg_temp.como(c); set local role authenticated;
  begin perform msg_enviar(h, 'texto', 'tarde'); insert into t_res values ('chat cerrado 24 h después', false, 'sin error');
  exception when others then insert into t_res values ('chat cerrado 24 h después', true, sqlerrm); end;
  reset role;
end $$;

select * from t_res;
rollback;
