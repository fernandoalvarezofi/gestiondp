-- PRUEBAS DE DEVOLUCIONES (Fase 2, paso 2). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; prod uuid; ped uuid; ped2 uuid; ia uuid; ib uuid; ia2 uuid; ib2 uuid; d1 uuid; d2 uuid; d3 uuid;
  fallos text := ''; n numeric; stock_antes int;
begin
  select categoria into cat from delivery_comercios limit 1;
  -- La prueba lleva el pedido a 'entregado' sin pasar por el repartidor: se desactiva la máquina de estados SOLO dentro de esta transacción.
  alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-dv-d@example.com'), (cli, 'qa-dv-c@example.com'), (otro, 'qa-dv-o@example.com')) as x(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, comision_pct) values ('QA Dev', 'qa-dev-1', cat, 'x', dueno, true, true, true, 10) returning id into c1;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, stock, disponible) values (c1, 'Remera', 'Ropa', 1000, 5, true) returning id into prod;

  -- Pedido 1: efectivo, 2 x A ($1000) + 1 x B ($1000), entregado.
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (cli, c1, 'x', 3000, 3000, 'efectivo', 'pendiente') returning id into ped;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped, prod, 'Remera A', 1000, 2) returning id into ia;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped, prod, 'Remera B', 1000, 1) returning id into ib;
  update delivery_pedidos set estado = 'entregado', entregado_at = now() where id = ped;
  if not exists (select 1 from delivery_libro where pedido_id = ped and tipo = 'comision') then fallos := fallos || E'- el pedido entregado no generó su libro (el resto de la prueba no es confiable)\n'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  d1 := devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 1)), 'danado', 'Llegó roto');
  perform set_config('role', 'postgres', true);
  if (select monto from devoluciones where id = d1) <> 1000 then fallos := fallos || E'- el monto de la devolución no es 1000\n'; end if;
  perform set_config('role', 'authenticated', true);
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 2)), 'danado'); fallos := fallos || E'- permitió devolver más unidades de las compradas\n'; exception when others then null; end;
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 1), jsonb_build_object('item_id', ia, 'cantidad', 1)), 'danado'); fallos := fallos || E'- permitió un producto repetido\n'; exception when others then null; end;
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 1)), 'danado', null, 'medio_original'); fallos := fallos || E'- permitió medio original en un pedido en efectivo\n'; exception when others then null; end;
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 1)), 'inventado'); fallos := fallos || E'- aceptó un motivo inválido\n'; exception when others then null; end;
  -- otra persona no puede pedir devolución de un pedido ajeno
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 1)), 'danado'); fallos := fallos || E'- otra persona pidió la devolución de un pedido ajeno\n'; exception when others then null; end;
  if jsonb_array_length(delivery_mis_devoluciones()) <> 0 then fallos := fallos || E'- otra persona ve devoluciones ajenas\n'; end if;
  -- el cliente no puede aprobar su propia devolución ni reintegrarla
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  begin perform devolucion_responder(d1, true); fallos := fallos || E'- el cliente aprobó su propia devolución\n'; exception when others then null; end;
  begin perform devolucion_reintegrar(d1); fallos := fallos || E'- el cliente reintegró su propia devolución\n'; exception when others then null; end;

  -- el comercio: no puede reintegrar sin aprobar; rechazar exige motivo
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin perform devolucion_reintegrar(d1); fallos := fallos || E'- reintegró sin aprobar\n'; exception when others then null; end;
  if jsonb_array_length(delivery_devoluciones_comercio(c1)) <> 1 then fallos := fallos || E'- el comercio no ve su devolución\n'; end if;
  perform devolucion_responder(d1, true, 'Ok, mandanos el producto');
  begin perform devolucion_responder(d1, false, 'tarde'); fallos := fallos || E'- respondió dos veces\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  stock_antes := (select stock from delivery_productos where id = prod);
  perform set_config('role', 'authenticated', true);
  perform devolucion_reintegrar(d1, true);
  perform set_config('role', 'postgres', true);
  begin perform devolucion_reintegrar(d1); fallos := fallos || E'- reintegró dos veces\n'; exception when others then null; end;

  -- libro: -1000 al comercio, +100 de comisión devuelta (10%), -100 a la plataforma, +1000 a la billetera del cliente
  select coalesce(sum(monto), 0) into n from delivery_libro where referencia = d1::text and titular_tipo = 'comercio';
  if n <> -900 then fallos := fallos || format(E'- neto del comercio esperado -900, fue %s\n', n); end if;
  select coalesce(sum(monto), 0) into n from delivery_libro where referencia = d1::text and titular_tipo = 'plataforma';
  if n >= 0 or n < -100 then fallos := fallos || format(E'- la plataforma debería revertir comisión (e IVA) por debajo de 100, fue %s\n', n); end if;
  if delivery_saldo_cliente(cli) <> 1000 then fallos := fallos || format(E'- la billetera del cliente debería tener 1000, tiene %s\n', delivery_saldo_cliente(cli)); end if;
  if (select stock from delivery_productos where id = prod) <> stock_antes + 1 then fallos := fallos || E'- no repuso el stock\n'; end if;
  if not exists (select 1 from inventario_movimientos where producto_id = prod and motivo = 'devolucion' and delta = 1) then fallos := fallos || E'- la reposición no dejó asiento de inventario\n'; end if;

  -- otra devolución de la misma unidad restante + ya no queda de A (2 compradas, 1 devuelta): pedir 2 más falla
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ia, 'cantidad', 2)), 'otro'); fallos := fallos || E'- permitió devolver más de lo que queda\n'; exception when others then null; end;
  d2 := devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ib, 'cantidad', 1)), 'arrepentimiento');
  perform devolucion_cancelar(d2);
  perform set_config('role', 'postgres', true);
  if (select estado from devoluciones where id = d2) <> 'cancelada' then fallos := fallos || E'- no se pudo cancelar\n'; end if;

  -- plazo vencido
  update delivery_pedidos set entregado_at = now() - interval '30 days' where id = ped;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform devolucion_solicitar(ped, jsonb_build_array(jsonb_build_object('item_id', ib, 'cantidad', 1)), 'otro'); fallos := fallos || E'- aceptó una devolución fuera de plazo\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Pedido 2: pagado online, devolución del pedido completo al medio original => queda a reintegrar por Mercado Pago
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado, pago_estado) values (cli, c1, 'x', 2000, 2000, 'mercadopago', 'pendiente', 'aprobado') returning id into ped2;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped2, prod, 'Remera A', 1000, 1) returning id into ia2;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped2, prod, 'Remera B', 1000, 1) returning id into ib2;
  update delivery_pedidos set estado = 'entregado', entregado_at = now() where id = ped2;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform devolucion_solicitar(ped2, jsonb_build_array(jsonb_build_object('item_id', ia2, 'cantidad', 1)), 'danado', null, 'medio_original'); fallos := fallos || E'- permitió medio original en una devolución parcial\n'; exception when others then null; end;
  d3 := devolucion_solicitar(ped2, jsonb_build_array(jsonb_build_object('item_id', ia2, 'cantidad', 1), jsonb_build_object('item_id', ib2, 'cantidad', 1)), 'incorrecto', 'No era lo que pedí', 'medio_original');
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform devolucion_responder(d3, true);
  perform devolucion_reintegrar(d3);
  perform set_config('role', 'postgres', true);
  if (select pago_estado from delivery_pedidos where id = ped2) <> 'a_reintegrar' then fallos := fallos || E'- el pedido pagado online no quedó a reintegrar por Mercado Pago\n'; end if;
  if delivery_saldo_cliente(cli) <> 1000 then fallos := fallos || E'- el medio original no debería sumar a la billetera\n'; end if;

  -- exposición
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform 1 from devoluciones limit 1; fallos := fallos || E'- un usuario lee la tabla de devoluciones\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform devolucion_solicitar(ped, '[]'::jsonb, 'otro'); fallos := fallos || E'- anon ejecuta devolucion_solicitar\n'; exception when others then null; end;
  begin perform delivery_mis_devoluciones(); fallos := fallos || E'- anon lee devoluciones\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE DEVOLUCIONES: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE DEVOLUCIONES: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
