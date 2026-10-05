-- PRUEBAS DE MOVILIDAD: categorías, capacidad, habilitación y privacidad (Fase 8, paso 1). Transacción que se deshace sola.
do $t$
declare cli uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  q_est jsonb; q_con jsonb; q_fam jsonb; v_est uuid; v_con uuid; v_fam uuid; fallos text := ''; r jsonb; n int;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', y.id, 'authenticated', 'authenticated', y.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (cli, 'qa-mo-c@example.com'), (d1, 'qa-mo-1@example.com'), (d2, 'qa-mo-2@example.com'), (otro, 'qa-mo-o@example.com'), (adm, 'qa-mo-a@example.com')) as y(id, mail);
  insert into user_roles (user_id, role) values (adm, 'admin');
  update perfiles set nombre = 'Pablo Estandar' where id = d1; update perfiles set nombre = 'Carlos Confort' where id = d2;
  insert into delivery_repartidores (perfil_id, vehiculo, disponible, verificado, telefono, patente, remis_estado, acepta_remis) values (d1, 'auto', true, true, '2355111111', 'AB123CD', 'aprobado', true), (d2, 'auto', true, true, '2355222222', 'EF456GH', 'aprobado', true);
  update delivery_repartidores set remis_categorias = array['estandar', 'confort'] where perfil_id = d2;

  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- Cotización: confort > estándar, familiar > confort; llamadas anteriores (5 argumentos) siguen funcionando; categoría inválida se rechaza
  q_est := delivery_cotizar_viaje(-34.8667, -61.5333, -34.88, -61.55);
  q_con := delivery_cotizar_viaje(-34.8667, -61.5333, -34.88, -61.55, null, 'confort');
  q_fam := delivery_cotizar_viaje(-34.8667, -61.5333, -34.88, -61.55, null, 'familiar');
  if not (q_est->>'ok')::boolean or q_est->>'categoria' <> 'estandar' then fallos := fallos || format(E'- la cotización sin categoría debería ser estándar: %s\n', q_est); end if;
  if (q_con->>'costo')::numeric <= (q_est->>'costo')::numeric or (q_fam->>'costo')::numeric <= (q_con->>'costo')::numeric then fallos := fallos || format(E'- los precios no suben por categoría: %s / %s / %s\n', q_est->>'costo', q_con->>'costo', q_fam->>'costo'); end if;
  if (select (delivery_cotizar_viaje(-34.8667, -61.5333, -34.88, -61.55, null, 'lujo')->>'ok')::boolean) then fallos := fallos || E'- aceptó una categoría inventada\n'; end if;

  -- Crear viaje: la capacidad se valida en el servidor
  begin perform delivery_crear_viaje('Calle A 1', -34.8667, -61.5333, 'Calle B 2', -34.88, -61.55, 5, null, '2355123456', null, 0, 'estandar'); fallos := fallos || E'- permitió 5 pasajeros en estándar\n'; exception when others then null; end;
  v_est := delivery_crear_viaje('Calle A 1', -34.8667, -61.5333, 'Calle B 2', -34.88, -61.55, 2, null, '2355123456', null, 0);
  v_con := delivery_crear_viaje('Calle A 1', -34.8667, -61.5333, 'Calle B 2', -34.88, -61.55, 3, null, '2355123456', null, 0, 'confort');
  begin perform delivery_crear_viaje('Calle A 1', -34.8667, -61.5333, 'Calle B 2', -34.88, -61.55, 1, null, '2355123456', null, 0, 'inventada'); fallos := fallos || E'- permitió una categoría inventada\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  select count(*) into n from delivery_viajes where cliente_id = cli and categoria = 'estandar'; if n <> 1 then fallos := fallos || E'- el viaje sin categoría debería quedar estándar\n'; end if;
  if (select total from delivery_viajes where id = v_con) <= (select total from delivery_viajes where id = v_est) then fallos := fallos || E'- el viaje confort no cuesta más que el estándar\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform delivery_cancelar_viaje(v_est, 'prueba'); -- libera el cupo de viajes en curso del cliente
  v_fam := delivery_crear_viaje('Calle A 1', -34.8667, -61.5333, 'Calle B 2', -34.88, -61.55, 6, null, '2355123456', null, 0, 'familiar');

  -- Quién ve qué viajes
  perform set_config('request.jwt.claims', json_build_object('sub', d1, 'role', 'authenticated')::text, true);
  if (select count(*) from delivery_viajes_disponibles() where categoria = 'confort') <> 0 or (select count(*) from delivery_viajes_disponibles() where categoria = 'familiar') <> 0 then fallos := fallos || E'- un conductor estándar ve viajes de otras categorías\n'; end if;
  begin perform delivery_tomar_viaje(v_con); fallos := fallos || E'- un conductor estándar tomó un viaje confort\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', d2, 'role', 'authenticated')::text, true);
  if (select count(*) from delivery_viajes_disponibles() where categoria = 'confort') <> 1 then fallos := fallos || E'- el conductor confort no ve el viaje confort\n'; end if;
  begin perform delivery_tomar_viaje(v_fam); fallos := fallos || E'- tomó un viaje familiar sin estar habilitado\n'; exception when others then null; end;
  perform delivery_tomar_viaje(v_con);

  -- Un conductor no puede habilitarse categorías ni aprobarse solo
  perform set_config('request.jwt.claims', json_build_object('sub', d1, 'role', 'authenticated')::text, true);
  update delivery_repartidores set remis_categorias = array['familiar', 'confort', 'estandar'] where perfil_id = d1;
  perform set_config('role', 'postgres', true);
  if (select remis_categorias from delivery_repartidores where perfil_id = d1) <> array['estandar'] then fallos := fallos || E'- un conductor se habilitó categorías por su cuenta\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform delivery_admin_remis_categorias(d1, array['confort']); fallos := fallos || E'- un usuario común cambió categorías\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform delivery_admin_remis_categorias(d1, array['lujo']); fallos := fallos || E'- administración guardó una categoría inválida\n'; exception when others then null; end;
  perform delivery_admin_remis_categorias(d1, array['familiar', 'estandar', 'familiar']);
  perform set_config('role', 'postgres', true);
  if (select remis_categorias from delivery_repartidores where perfil_id = d1) <> array['estandar', 'familiar'] then fallos := fallos || E'- administración no pudo asignar categorías\n'; end if;
  if not exists (select 1 from delivery_auditoria where accion = 'remis.categorias' and entidad_id = d1::text) then fallos := fallos || E'- el cambio de categorías no quedó auditado\n'; end if;

  -- Datos del vehículo
  perform set_config('request.jwt.claims', json_build_object('sub', d2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform delivery_conductor_vehiculo('', 'Cronos', 'Gris', 2020); fallos := fallos || E'- aceptó una marca vacía\n'; exception when others then null; end;
  begin perform delivery_conductor_vehiculo('Fiat', 'Cronos', 'Gris', 1950); fallos := fallos || E'- aceptó un año imposible\n'; exception when others then null; end;
  perform delivery_conductor_vehiculo('Fiat', 'Cronos', 'Gris', 2020);

  -- Privacidad: el pasajero ve el vehículo y el teléfono mientras el viaje está en curso; después, solo 24 h y sin teléfono
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  r := delivery_viaje_conductor(v_con);
  if r->>'marca' <> 'Fiat' or r->>'patente' <> 'EF456GH' or r->>'color' <> 'Gris' or r->>'telefono' <> '2355222222' or r->>'categoria' <> 'confort' then fallos := fallos || format(E'- el pasajero no ve el vehículo y el teléfono con el viaje en curso: %s\n', r); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  if delivery_viaje_conductor(v_con) is not null then fallos := fallos || E'- otra persona ve los datos del conductor\n'; end if;
  perform set_config('role', 'postgres', true);
  update delivery_viajes set estado = 'completado', completado_at = now(), updated_at = now() where id = v_con;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r := delivery_viaje_conductor(v_con);
  if r is null or r->>'telefono' is not null or r->>'patente' <> 'EF456GH' then fallos := fallos || format(E'- terminado el viaje, el teléfono debería ocultarse y la patente seguir: %s\n', r); end if;
  perform set_config('role', 'postgres', true);
  update delivery_viajes set completado_at = now() - interval '25 hours', updated_at = now() - interval '25 hours' where id = v_con;
  perform set_config('role', 'authenticated', true);
  if delivery_viaje_conductor(v_con) is not null then fallos := fallos || E'- 25 horas después todavía se ven los datos del conductor\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  if delivery_viaje_conductor(v_con) is null then fallos := fallos || E'- administración no ve los datos del conductor\n'; end if;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform delivery_cotizar_viaje(-34.8667, -61.5333, -34.88, -61.55); fallos := fallos || E'- anon cotiza\n'; exception when others then null; end;
  begin perform delivery_viajes_disponibles(); fallos := fallos || E'- anon ve viajes disponibles\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE MOVILIDAD: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE MOVILIDAD: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
