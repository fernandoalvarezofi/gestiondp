-- PRUEBAS DE LA MÁQUINA DE ESTADOS DEL PAGO (Fase 5, paso 1). Transacción que se deshace sola.
do $t$
declare u uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; p1 uuid; p2 uuid; r jsonb; fallos text := ''; n int;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'qa-pago@example.com', 'x', now(), '{}', '{}', now(), now(), '', '', '', '');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA Pago', 'qa-pago-1', cat, 'x', u, true, true) returning id into c1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (u, c1, 'x', 1000, 1000, 'mercadopago', 'pendiente') returning id into p1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (u, c1, 'x', 500, 500, 'mercadopago', 'cancelado') returning id into p2;

  -- pendiente -> aprobado
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'in_process', 1000);
  if (select count(*) from pagos where external_id = 'T1') <> 1 then fallos := fallos || E'- el primer aviso pendiente no crea el pago\n'; end if;
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'approved', 1000);
  if r->>'estado' <> 'aprobado' or (select pago_estado from delivery_pedidos where id = p1) <> 'aprobado' then fallos := fallos || E'- aprobado no actualiza el pedido\n'; end if;
  -- duplicado
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'approved', 1000);
  if r->>'motivo' <> 'duplicado' then fallos := fallos || E'- el aviso repetido no se detecta\n'; end if;
  -- un pendiente tardío no deshace el aprobado
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'in_process', 1000);
  if r->>'motivo' <> 'transicion_ignorada' or (select estado from pagos where external_id = 'T1') <> 'aprobado' then fallos := fallos || E'- un pendiente tardío revirtió el aprobado\n'; end if;
  -- reintegro
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'refunded', 1000);
  if (select pago_estado from delivery_pedidos where id = p1) <> 'reintegrado' then fallos := fallos || E'- el reintegro no llega al pedido\n'; end if;
  -- reintegrado es final
  r := pago_aplicar_notificacion('mercadopago', 'T1', p1, 'approved', 1000);
  if r->>'aplicado' = 'true' then fallos := fallos || E'- un pago reintegrado volvió a aprobarse\n'; end if;

  -- monto distinto
  r := pago_aplicar_notificacion('mercadopago', 'T2', p2, 'approved', 10);
  if r->>'motivo' <> 'monto_distinto' then fallos := fallos || E'- monto distinto no se frena\n'; end if;
  -- aprobado sobre pedido cancelado -> a_reintegrar
  r := pago_aplicar_notificacion('mercadopago', 'T3', p2, 'approved', 500);
  if (select pago_estado from delivery_pedidos where id = p2) <> 'a_reintegrar' then fallos := fallos || E'- cobro sobre pedido cancelado no queda a reintegrar\n'; end if;
  -- mismo pago, otro pedido
  r := pago_aplicar_notificacion('mercadopago', 'T3', p1, 'refunded', 500);
  if r->>'motivo' <> 'pedido_distinto' then fallos := fallos || E'- pago asociado a otro pedido no se frena\n'; end if;
  -- estados y pedidos inválidos
  r := pago_aplicar_notificacion('mercadopago', 'T4', p1, 'raro', 1);
  if r->>'motivo' <> 'estado_desconocido' then fallos := fallos || E'- estado desconocido\n'; end if;
  r := pago_aplicar_notificacion('mercadopago', 'T5', gen_random_uuid(), 'approved', 1);
  if r->>'motivo' <> 'pedido_inexistente' then fallos := fallos || E'- pedido inexistente\n'; end if;
  -- historial inmutable
  begin update pagos_eventos set tipo = 'aplicado'; fallos := fallos || E'- el historial se pudo editar\n'; exception when others then null; end;
  begin delete from pagos_eventos; fallos := fallos || E'- el historial se pudo borrar\n'; exception when others then null; end;

  -- exposición: ni anon ni usuarios
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform 1 from pagos limit 1; fallos := fallos || E'- un usuario lee pagos\n'; exception when others then null; end;
  begin perform pago_aplicar_notificacion('mercadopago', 'X', p1, 'approved', 1000); fallos := fallos || E'- un usuario ejecuta pago_aplicar_notificacion\n'; exception when others then null; end;
  begin perform delivery_admin_pagos(); fallos := fallos || E'- un no-admin ve pagos\n'; exception when others then null; end;
  begin perform delivery_admin_guardar_mp_firma('abcdefghijklmnop1234'); fallos := fallos || E'- un no-admin guarda la firma\n'; exception when others then null; end;
  perform set_config('role', 'anon', true);
  begin perform pago_registrar_incidente('mercadopago', 'x', 'firma_invalida'); fallos := fallos || E'- anon registra incidentes\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE PAGOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE PAGOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
