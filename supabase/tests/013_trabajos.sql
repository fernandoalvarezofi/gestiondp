-- PRUEBAS DE LA CAPA DE TRABAJOS (Fase 6, paso 1). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid;
  ped uuid; ped2 uuid; env uuid; via uuid; fallos text := ''; v jsonb; n int;
begin
  select categoria into cat from delivery_comercios limit 1;
  alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-tr-d@example.com'), (cli, 'qa-tr-c@example.com'), (rep, 'qa-tr-r@example.com'), (otro, 'qa-tr-o@example.com'), (adm, 'qa-tr-a@example.com')) as x(id, mail);
  update perfiles set nombre = 'Ramiro Díaz' where id = rep;
  insert into user_roles (user_id, role) values (adm, 'admin');
  insert into delivery_repartidores (perfil_id, vehiculo) values (rep, 'moto');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, latitud, longitud) values ('QA Tr', 'qa-tr-1', cat, 'Calle Comercio 1', dueno, true, true, true, -34.86, -61.53) returning id into c1;

  -- Entrega de un pedido: pendiente -> asignado -> en curso -> completado, con su línea de tiempo.
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, costo_envio, propina, metodo_pago, estado, tipo_entrega) values (cli, c1, 'Calle Cliente 2', 1000, 1500, 400, 100, 'efectivo', 'pendiente', 'delivery') returning id into ped;
  select count(*) into n from trabajos where origen_tipo = 'pedido' and origen_id = ped and tipo = 'delivery' and estado = 'pendiente' and monto = 500;
  if n <> 1 then fallos := fallos || E'- el pedido con envío no generó su trabajo pendiente (monto 500)\n'; end if;
  update delivery_pedidos set repartidor_id = rep, estado = 'confirmado', asignado_at = now() where id = ped;
  if (select estado from trabajos where origen_id = ped) <> 'asignado' then fallos := fallos || E'- asignar un repartidor no pasa el trabajo a asignado\n'; end if;
  update delivery_pedidos set estado = 'en_camino', en_camino_at = now() where id = ped;
  if (select estado from trabajos where origen_id = ped) <> 'en_curso' then fallos := fallos || E'- en camino no es en curso\n'; end if;
  update delivery_pedidos set estado = 'entregado', entregado_at = now() where id = ped;
  if (select estado from trabajos where origen_id = ped) <> 'completado' or (select completado_at from trabajos where origen_id = ped) is null then fallos := fallos || E'- entregado no completa el trabajo\n'; end if;
  if (select count(*) from trabajos_eventos e join trabajos t on t.id = e.trabajo_id where t.origen_id = ped) <> 4 then fallos := fallos || format(E'- la línea de tiempo debería tener 4 eventos, tiene %s\n', (select count(*) from trabajos_eventos e join trabajos t on t.id = e.trabajo_id where t.origen_id = ped)); end if;

  -- Retiro en el local: no es un trabajo de logística
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado, tipo_entrega) values (cli, c1, 'x', 500, 500, 'efectivo', 'pendiente', 'retiro') returning id into ped2;
  if exists (select 1 from trabajos where origen_id = ped2) then fallos := fallos || E'- un retiro en el local generó un trabajo\n'; end if;

  -- Mensajería entre personas y viaje
  insert into delivery_envios (cliente_id, origen_direccion, origen_lat, origen_lng, origen_contacto, origen_telefono, destino_direccion, destino_lat, destino_lng, destino_contacto, destino_telefono, descripcion, tamano, quien_paga, distancia_km, costo, total, comision_pct, ganancia_repartidor)
    values (cli, 'Calle A 123', -34.8, -61.5, 'Juan Perez', '2355123456', 'Calle B 456', -34.9, -61.6, 'Ana Gomez', '2355654321', 'Paquete', 'chico', 'origen', 3, 2000, 2000, 10, 1500) returning id into env;
  if (select tipo || ':' || estado from trabajos where origen_id = env) <> 'envio:pendiente' then fallos := fallos || E'- el envío no generó su trabajo\n'; end if;
  update delivery_envios set estado = 'retirado', repartidor_id = rep, asignado_at = now(), retirado_at = now() where id = env;
  if (select estado from trabajos where origen_id = env) <> 'en_curso' then fallos := fallos || E'- envío retirado no es en curso\n'; end if;
  insert into delivery_viajes (cliente_id, origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, pasajeros, telefono, distancia_km, tarifa, total, comision_pct, ganancia_conductor)
    values (cli, 'Calle A 123', -34.8, -61.5, 'Calle B 456', -34.9, -61.6, 2, '2355123456', 5, 3000, 3000, 10, 2500) returning id into via;
  update delivery_viajes set estado = 'a_bordo', conductor_id = rep, abordo_at = now() where id = via;
  if (select tipo || ':' || estado from trabajos where origen_id = via) <> 'viaje:en_curso' then fallos := fallos || E'- viaje a bordo no es en curso\n'; end if;
  update delivery_viajes set estado = 'cancelado', cancelado_at = now() where id = via;
  if (select estado from trabajos where origen_id = via) <> 'cancelado' then fallos := fallos || E'- viaje cancelado no se refleja\n'; end if;

  -- Seguimiento: el cliente y el comercio sí; otra persona no; sin sesión no
  insert into delivery_ubicaciones (repartidor_id, latitud, longitud) values (rep, -34.85, -61.52) on conflict (repartidor_id) do update set updated_at = now();
  update delivery_pedidos set estado = 'en_camino' where id = ped; -- (vuelve atrás solo en la prueba, para ver la ubicación)
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := trabajo_seguimiento('pedido', ped);
  if v->>'estado' <> 'en_curso' or (v->'proveedor'->>'nombre') <> 'Ramiro' or (v->'ubicacion'->>'lat') is null then fallos := fallos || format(E'- el cliente no ve el seguimiento completo: %s\n', v); end if;
  if v::text like '%' || rep::text || '%' then fallos := fallos || E'- el seguimiento expone el identificador del repartidor\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  if (trabajo_seguimiento('pedido', ped)->>'estado') is null then fallos := fallos || E'- el comercio no ve el seguimiento de su pedido\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  begin perform trabajo_seguimiento('pedido', ped); fallos := fallos || E'- otra persona ve el seguimiento\n'; exception when others then null; end;
  begin perform delivery_admin_trabajos(); fallos := fallos || E'- un usuario común ve el tablero de administración\n'; exception when others then null; end;
  begin perform 1 from trabajos limit 1; fallos := fallos || E'- un usuario lee la tabla de trabajos\n'; exception when others then null; end;
  begin perform 1 from trabajos_eventos limit 1; fallos := fallos || E'- un usuario lee los eventos\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform trabajo_seguimiento('pedido', ped); fallos := fallos || E'- anon ve el seguimiento\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Administración
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := delivery_admin_trabajos(null, null, 50);
  if (v->'por_tipo'->>'delivery')::int < 1 or (v->'por_tipo'->>'envio')::int <> 1 or (v->'por_tipo'->>'viaje')::int <> 1 then fallos := fallos || format(E'- el tablero no cuenta por tipo: %s\n', v->'por_tipo'); end if;
  if jsonb_array_length(delivery_admin_trabajos('cancelado', 'viaje')->'items') <> 1 then fallos := fallos || E'- el filtro del tablero falla\n'; end if;
  perform set_config('role', 'postgres', true);

  -- La operación original NO se frena si la capa de trabajos falla
  create or replace function public.trabajo_registrar(p_tipo text, p_origen_tipo text, p_origen_id uuid, p_estado text, p_estado_origen text, p_cliente uuid, p_comercio uuid, p_proveedor uuid,
    p_rec_dir text, p_rec_lat numeric, p_rec_lng numeric, p_ent_dir text, p_ent_lat numeric, p_ent_lng numeric, p_km numeric, p_monto numeric, p_ganancia numeric,
    p_asignado timestamptz, p_iniciado timestamptz, p_completado timestamptz, p_cancelado timestamptz) returns void language plpgsql as $f$ begin raise exception 'falla simulada'; end $f$;
  begin
    insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado, tipo_entrega) values (otro, c1, 'x', 500, 500, 'efectivo', 'pendiente', 'delivery');
  exception when others then fallos := fallos || format(E'- un fallo de la capa de trabajos frenó la creación del pedido: %s\n', sqlerrm);
  end;

  if fallos <> '' then raise exception E'PRUEBAS DE TRABAJOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE TRABAJOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
