-- PRUEBAS DE DESPACHO Y RED (Fase 7, paso 1). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid(); rc uuid := gen_random_uuid(); rd uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  cat delivery_categoria; c1 uuid; ped uuid; env uuid; via uuid; fallos text := ''; v jsonb; x jsonb;
begin
  select categoria into cat from delivery_comercios limit 1;
  alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', y.id, 'authenticated', 'authenticated', y.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-ds-d@example.com'), (cli, 'qa-ds-c@example.com'), (ra, 'qa-ds-a@example.com'), (rb, 'qa-ds-b@example.com'), (rc, 'qa-ds-cc@example.com'), (rd, 'qa-ds-dd@example.com'), (otro, 'qa-ds-o@example.com'), (adm, 'qa-ds-adm@example.com')) as y(id, mail);
  insert into user_roles (user_id, role) values (adm, 'admin');
  update perfiles set nombre = 'Ana Cercana' where id = ra; update perfiles set nombre = 'Beto Lejano' where id = rb; update perfiles set nombre = 'Carla Desconectada' where id = rc; update perfiles set nombre = 'Dario Remis' where id = rd;
  -- A y B conectados y verificados (A cerca, B lejos); C desconectada; D conductor de remís aprobado.
  insert into delivery_repartidores (perfil_id, vehiculo, disponible, verificado) values (ra, 'moto', true, true), (rb, 'auto', true, true), (rc, 'moto', false, true), (rd, 'auto', true, true);
  update delivery_repartidores set remis_estado = 'aprobado', acepta_remis = true where perfil_id = rd;
  insert into delivery_ubicaciones (repartidor_id, latitud, longitud) values (ra, -34.8605, -61.5305), (rb, -34.90, -61.60), (rc, -34.8601, -61.5301), (rd, -34.8610, -61.5310);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, latitud, longitud) values ('QA Ds', 'qa-ds-1', cat, 'Calle Comercio', dueno, true, true, true, -34.86, -61.53) returning id into c1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, costo_envio, metodo_pago, estado, tipo_entrega) values (cli, c1, 'Calle Cliente', 1000, 1400, 400, 'efectivo', 'confirmado', 'delivery') returning id into ped;
  insert into delivery_envios (cliente_id, origen_direccion, origen_lat, origen_lng, origen_contacto, origen_telefono, destino_direccion, destino_lat, destino_lng, destino_contacto, destino_telefono, descripcion, tamano, quien_paga, distancia_km, costo, total, comision_pct, ganancia_repartidor)
    values (cli, 'Calle A 123', -34.8600, -61.5300, 'Juan Perez', '2355123456', 'Calle B 456', -34.9, -61.6, 'Ana Gomez', '2355654321', 'Paquete', 'chico', 'origen', 3, 2000, 2000, 10, 1500) returning id into env;
  insert into delivery_viajes (cliente_id, origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, pasajeros, telefono, distancia_km, tarifa, total, comision_pct, ganancia_conductor)
    values (cli, 'Calle A 123', -34.8600, -61.5300, 'Calle B 456', -34.9, -61.6, 2, '2355123456', 5, 3000, 3000, 10, 2500) returning id into via;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- Pedido: A (cerca) primero; C no es elegible por estar desconectada; el desglose coincide con el puntaje real.
  v := despacho_candidatos('pedido', ped, 10);
  if v->0->>'nombre' <> 'Ana Cercana' then fallos := fallos || format(E'- el primero para el pedido debería ser Ana (cerca): %s\n', v->0->>'nombre'); end if;
  if (select (e->>'motivo_no') from jsonb_array_elements(v) e where e->>'nombre' = 'Carla Desconectada') is distinct from 'Desconectado' then fallos := fallos || E'- Carla debería figurar como desconectada\n'; end if;
  for x in select * from jsonb_array_elements(v) loop
    if abs((x->'componentes'->>'total')::numeric - (x->>'puntaje')::numeric) > 0.001 then fallos := fallos || format(E'- el desglose no coincide con el puntaje real de %s: %s vs %s\n', x->>'nombre', x->'componentes'->>'total', x->>'puntaje'); end if;
  end loop;

  -- Envío: ordena por cercanía al retiro; viaje: solo conductores de remís
  v := despacho_candidatos('envio', env, 10);
  if v->0->>'nombre' not in ('Ana Cercana', 'Dario Remis') then fallos := fallos || E'- el primero para el envío debería ser quien está más cerca del retiro\n'; end if;
  v := despacho_candidatos('viaje', via, 10);
  if jsonb_array_length(v) <> 1 or v->0->>'nombre' <> 'Dario Remis' then fallos := fallos || format(E'- para el viaje solo debería aparecer Dario (remís): %s\n', v); end if;

  -- Asignación manual
  begin perform delivery_admin_asignar_trabajo('envio', env, rc); fallos := fallos || E'- asignó a alguien desconectada\n'; exception when others then null; end;
  perform delivery_admin_asignar_trabajo('envio', env, ra);
  perform set_config('role', 'postgres', true);
  if (select estado || ':' || repartidor_id::text from delivery_envios where id = env) <> 'asignado:' || ra::text then fallos := fallos || E'- el envío no quedó asignado a Ana\n'; end if;
  if (select estado || ':' || proveedor_id::text from trabajos where origen_id = env) <> 'asignado:' || ra::text then fallos := fallos || E'- la capa de trabajos no reflejó la asignación\n'; end if;
  if not exists (select 1 from delivery_auditoria where accion = 'envio.asignar' and entidad_id = env::text) then fallos := fallos || E'- la asignación manual no quedó auditada\n'; end if;
  perform set_config('role', 'authenticated', true);
  begin perform delivery_admin_asignar_trabajo('envio', env, rb); fallos := fallos || E'- reasignó un envío ya asignado\n'; exception when others then null; end;
  begin perform delivery_admin_asignar_trabajo('viaje', via, ra); fallos := fallos || E'- asignó un viaje a alguien sin remís\n'; exception when others then null; end;
  perform delivery_admin_asignar_trabajo('viaje', via, rd);
  perform delivery_admin_asignar_trabajo('pedido', ped, rb);
  perform set_config('role', 'postgres', true);
  if (select repartidor_id from delivery_pedidos where id = ped) <> rb then fallos := fallos || E'- la asignación del pedido (función existente) no se aplicó\n'; end if;

  -- Red
  update trabajos set estado = 'completado', completado_at = now(), ganancia_proveedor = 1500 where origen_id = env;
  perform set_config('role', 'authenticated', true);
  v := delivery_admin_red_proveedores(30);
  if (v->'resumen'->>'total')::int < 4 then fallos := fallos || E'- la red no cuenta a los 4 proveedores\n'; end if;
  if (select (e->>'completados')::int from jsonb_array_elements(v->'items') e where e->>'nombre' = 'Ana Cercana') <> 1 then fallos := fallos || E'- Ana debería tener 1 trabajo completado\n'; end if;
  if (select (e->>'ganancia')::numeric from jsonb_array_elements(v->'items') e where e->>'nombre' = 'Ana Cercana') <> 1500 then fallos := fallos || E'- la ganancia de Ana debería ser 1500\n'; end if;

  -- Permisos
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  begin perform despacho_candidatos('pedido', ped); fallos := fallos || E'- un usuario común ve candidatos\n'; exception when others then null; end;
  begin perform delivery_admin_asignar_trabajo('envio', env, ra); fallos := fallos || E'- un usuario común asigna\n'; exception when others then null; end;
  begin perform delivery_admin_red_proveedores(); fallos := fallos || E'- un usuario común ve la red\n'; exception when others then null; end;
  begin perform despacho_motivo_no_elegible(ra, 'envio'); fallos := fallos || E'- un usuario común ejecuta la regla interna\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform despacho_candidatos('pedido', ped); fallos := fallos || E'- anon ve candidatos\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE DESPACHO Y RED: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE DESPACHO Y RED: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
