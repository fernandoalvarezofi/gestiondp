-- PRUEBA DEL REINTEGRO MANUAL (Fase 5, paso 3): queda en el pago y en el libro de pagos, sin descontar dos veces. Se deshace sola.
do $t$
declare u uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; p1 uuid; fallos text := '';
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'qa-rm@example.com', 'x', now(), '{}', '{}', now(), now(), '', '', '', '');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA RM', 'qa-rm-1', cat, 'x', u, true, true) returning id into c1;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (u, c1, 'x', 800, 800, 'mercadopago', 'cancelado') returning id into p1;
  perform pago_aplicar_notificacion('mercadopago', 'M1', p1, 'approved', 800);
  if (select pago_estado from delivery_pedidos where id = p1) <> 'a_reintegrar' then fallos := fallos || E'- no quedó a reintegrar\n'; end if;
  insert into user_roles (user_id, role) values (u, 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform delivery_admin_marcar_reintegrado(p1);
  perform set_config('role', 'postgres', true);
  if (select pago_estado from delivery_pedidos where id = p1) <> 'reintegrado' then fallos := fallos || E'- pedido no reintegrado\n'; end if;
  if (select estado from pagos where external_id = 'M1') <> 'reintegrado' then fallos := fallos || E'- pago no reintegrado\n'; end if;
  if (select coalesce(sum(monto),0) from pagos_libro where pedido_id = p1) <> 0 or (select count(*) from pagos_libro where pedido_id = p1) <> 2 then fallos := fallos || E'- libro no cuadra\n'; end if;
  perform pago_aplicar_notificacion('mercadopago', 'M1', p1, 'refunded', 800);
  if (select count(*) from pagos_libro where pedido_id = p1) <> 2 then fallos := fallos || E'- el aviso posterior duplicó el asiento\n'; end if;
  if fallos <> '' then raise exception E'REINTEGRO MANUAL: FALLARON\n%', fallos; end if;
  raise exception 'REINTEGRO MANUAL: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
