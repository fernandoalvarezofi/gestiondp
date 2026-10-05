-- PRUEBAS DEL LIBRO DE PAGOS (Fase 5, paso 2). Transacción que se deshace sola.
do $t$
declare u uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; p1 uuid; p2 uuid; r jsonb; fallos text := ''; libro_antes bigint;
begin
  select count(*) into libro_antes from delivery_libro;
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'qa-pl@example.com', 'x', now(), '{}', '{}', now(), now(), '', '', '', '');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA PL', 'qa-pl-1', cat, 'x', u, true, true) returning id into c1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (u, c1, 'x', 1000, 1000, 'mercadopago', 'pendiente') returning id into p1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (u, c1, 'x', 500, 500, 'mercadopago', 'pendiente') returning id into p2;

  perform pago_aplicar_notificacion('mercadopago', 'L1', p1, 'in_process', 1000);
  if (select count(*) from pagos_libro) <> 0 then fallos := fallos || E'- un pago pendiente generó asiento\n'; end if;
  perform pago_aplicar_notificacion('mercadopago', 'L1', p1, 'approved', 1000);
  perform pago_aplicar_notificacion('mercadopago', 'L1', p1, 'approved', 1000);
  if (select coalesce(sum(monto), 0) from pagos_libro where pedido_id = p1) <> 1000 or (select count(*) from pagos_libro where pedido_id = p1) <> 1 then fallos := fallos || E'- el cobro no se asentó una sola vez\n'; end if;
  perform pago_aplicar_notificacion('mercadopago', 'L1', p1, 'refunded', 1000);
  if (select coalesce(sum(monto), 0) from pagos_libro where pedido_id = p1) <> 0 or (select count(*) from pagos_libro where pedido_id = p1) <> 2 then fallos := fallos || E'- el reintegro no deja el saldo en 0\n'; end if;

  perform pago_aplicar_notificacion('mercadopago', 'L2', p2, 'approved', 500);
  perform pago_aplicar_notificacion('mercadopago', 'L2', p2, 'charged_back', 500);
  perform pago_aplicar_notificacion('mercadopago', 'L2', p2, 'refunded', 500);
  if (select coalesce(sum(monto), 0) from pagos_libro where pedido_id = p2) <> 0 or (select count(*) from pagos_libro where pedido_id = p2) <> 2 then fallos := fallos || E'- cobro + contracargo (+ reintegro posterior) no cuadra\n'; end if;
  -- monto distinto no asienta
  perform pago_aplicar_notificacion('mercadopago', 'L3', p1, 'approved', 7);
  if exists (select 1 from pagos_libro l join pagos p on p.id = l.pago_id where p.external_id = 'L3') then fallos := fallos || E'- un monto distinto generó asiento\n'; end if;

  begin update pagos_libro set monto = 1; fallos := fallos || E'- el libro de pagos se pudo editar\n'; exception when others then null; end;
  begin delete from pagos_libro; fallos := fallos || E'- el libro de pagos se pudo borrar\n'; exception when others then null; end;
  if (select count(*) from delivery_libro) <> libro_antes then fallos := fallos || E'- se modificó delivery_libro\n'; end if;

  -- conciliación como administrador / como usuario común
  insert into user_roles (user_id, role) values (u, 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r := delivery_admin_conciliacion_pagos();
  if jsonb_array_length(r->'diferencias') <> 0 or (r->>'cobrado')::numeric <> 1500 or (r->>'neto')::numeric <> 0 then fallos := fallos || format(E'- conciliación inesperada: %s\n', r); end if;
  perform set_config('role', 'postgres', true);
  delete from user_roles where user_id = u;
  perform set_config('role', 'authenticated', true);
  begin perform delivery_admin_conciliacion_pagos(); fallos := fallos || E'- un no-admin ve la conciliación\n'; exception when others then null; end;
  begin perform 1 from pagos_libro limit 1; fallos := fallos || E'- un usuario lee el libro de pagos\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE LIBRO DE PAGOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE LIBRO DE PAGOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
