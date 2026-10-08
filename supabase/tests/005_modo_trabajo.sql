-- Prueba: un repartidor/conductor solo recibe y toma trabajos de su modo de trabajo.
-- Se corre dentro de una transacción y se deshace al final (no deja datos).
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '22222222-bbbb-4bbb-8bbb-000000000001', 'authenticated', 'authenticated', 'qa-modo@example.com', '', now(), now(), now(), '{}', '{"full_name":"QA Modo"}');
insert into delivery_repartidores (perfil_id, vehiculo, activo, verificado, disponible, remis_estado, acepta_remis, modo_trabajo)
values ('22222222-bbbb-4bbb-8bbb-000000000001', 'auto', true, true, true, 'aprobado', true, 'viajes');

do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-bbbb-4bbb-8bbb-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  -- En modo viajes: no ve envíos y no puede tomarlos.
  select count(*) into n from delivery_envios_disponibles();
  insert into t_res values ('modo viajes no lista envíos', n = 0, n::text);
  begin perform delivery_tomar_envio(gen_random_uuid()); insert into t_res values ('modo viajes no toma envíos', false, 'sin error');
  exception when others then insert into t_res values ('modo viajes no toma envíos', sqlerrm like 'Estás conectado como conductor%', sqlerrm); end;
  begin perform delivery_tomar_pedido(gen_random_uuid()); insert into t_res values ('modo viajes no toma pedidos', false, 'sin error');
  exception when others then insert into t_res values ('modo viajes no toma pedidos', sqlerrm like 'Estás conectado como conductor%', sqlerrm); end;
  reset role;
  update delivery_repartidores set modo_trabajo = 'entregas' where perfil_id = '22222222-bbbb-4bbb-8bbb-000000000001';
  perform set_config('request.jwt.claims', '{"sub":"22222222-bbbb-4bbb-8bbb-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  -- En modo entregas: no ve viajes y no puede tomarlos.
  select count(*) into n from delivery_viajes_disponibles();
  insert into t_res values ('modo entregas no lista viajes', n = 0, n::text);
  begin perform delivery_tomar_viaje(gen_random_uuid()); insert into t_res values ('modo entregas no toma viajes', false, 'sin error');
  exception when others then insert into t_res values ('modo entregas no toma viajes', sqlerrm like 'Estás conectado como repartidor%', sqlerrm); end;
  -- La persona puede cambiar su propio modo.
  update delivery_repartidores set modo_trabajo = 'viajes' where perfil_id = '22222222-bbbb-4bbb-8bbb-000000000001';
  get diagnostics n = row_count;
  insert into t_res values ('puede cambiar su modo', n = 1, n::text);
  reset role;
  -- El despacho manual explica por qué no es elegible.
  insert into t_res values ('despacho: conductor no elegible para pedido',
    despacho_motivo_no_elegible('22222222-bbbb-4bbb-8bbb-000000000001', 'envio', null) = 'Conectado como conductor',
    despacho_motivo_no_elegible('22222222-bbbb-4bbb-8bbb-000000000001', 'envio', null));
end $$;

select * from t_res;
rollback;
