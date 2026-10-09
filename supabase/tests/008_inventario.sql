-- PRUEBAS DEL INVENTARIO CON MOVIMIENTOS (Fase 2, paso 1). Transacción que se deshace sola.
-- Una venta real (delivery_crear_pedido), su cancelación y una edición manual: cada una deja su asiento con el motivo correcto.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; prod uuid; var uuid; ped uuid; fallos text := ''; n int; msg text;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-inv-d@example.com'), (cli, 'qa-inv-c@example.com')) as x(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, acepta_retiro) values ('QA Inv', 'qa-inv-1', cat, 'x', dueno, true, true, true, true) returning id into c1;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, stock, disponible) values (c1, 'Remera', 'Ropa', 1000, 10, true) returning id into prod;
  if (select count(*) from inventario_movimientos where producto_id = prod and motivo = 'alta' and stock_despues = 10) <> 1 then fallos := fallos || E'- el alta del producto no dejó asiento\n'; end if;

  -- venta como cliente
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ped := delivery_crear_pedido(c1, jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 3)), '', null, 'efectivo', 0, null, null, '11 5555 5555', null, null, 'retiro', null, null, false);
  -- pedir más de lo que hay (quedan 7) falla con un mensaje claro y no toca el stock
  begin
    perform delivery_crear_pedido(c1, jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 8)), '', null, 'efectivo', 0, null, null, '11 5555 5555', null, null, 'retiro', null, null, false);
    fallos := fallos || E'- se pudo vender más que el stock
';
  exception when others then msg := sqlerrm; end;
  perform set_config('role', 'postgres', true);
  if (select stock from delivery_productos where id = prod) <> 7 or msg not like 'No hay stock suficiente%' then fallos := fallos || E'- la sobreventa no se rechazó bien
'; end if;
  select count(*) into n from inventario_movimientos where producto_id = prod and motivo = 'venta' and delta = -3 and stock_antes = 10 and stock_despues = 7;
  if n <> 1 then fallos := fallos || format(E'- la venta no dejó su asiento (venta -3): %s\n', n); end if;

  -- cancelación como dueño: devuelve el stock con motivo "cancelacion"
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform delivery_actualizar_estado(ped, 'cancelado', 'Sin stock real', null);
  perform set_config('role', 'postgres', true);
  select count(*) into n from inventario_movimientos where producto_id = prod and motivo = 'cancelacion' and delta = 3 and stock_despues = 10;
  if n <> 1 then fallos := fallos || format(E'- la cancelación no devolvió el stock con su asiento: %s\n', n); end if;

  -- edición manual del comercio
  -- (en la app cada pedido al servidor es su propia transacción: el motivo de la anterior no se arrastra; acá se limpia a mano)
  perform set_config('woref.stock_motivo', '', true);
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update delivery_productos set stock = 25 where id = prod;
  perform set_config('role', 'postgres', true);
  if (select count(*) from inventario_movimientos where producto_id = prod and motivo = 'ajuste' and delta = 15 and usuario_id = dueno) <> 1 then fallos := fallos || E'- el ajuste manual no quedó registrado a nombre del dueño\n'; end if;

  -- variante
  insert into delivery_producto_variantes (producto_id, nombre, stock, disponible, orden) values (prod, 'M', 4, true, 1) returning id into var;
  update delivery_producto_variantes set stock = 6 where id = var;
  if (select count(*) from inventario_movimientos where variante_id = var) <> 2 then fallos := fallos || E'- la variante no registra alta y ajuste\n'; end if;

  -- historial inmutable
  begin update inventario_movimientos set delta = 0; fallos := fallos || E'- el historial de inventario se pudo editar\n'; exception when others then null; end;
  begin delete from inventario_movimientos; fallos := fallos || E'- el historial de inventario se pudo borrar\n'; exception when others then null; end;

  -- lectura: el dueño ve; el cliente no; anon no
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if jsonb_array_length(delivery_inventario_movimientos(c1, prod)) < 4 then fallos := fallos || E'- el dueño no ve los movimientos de su producto\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  begin perform delivery_inventario_movimientos(c1); fallos := fallos || E'- un cliente ve el inventario de un local ajeno\n'; exception when others then null; end;
  begin perform 1 from inventario_movimientos limit 1; fallos := fallos || E'- un usuario lee la tabla de movimientos\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform delivery_inventario_movimientos(c1); fallos := fallos || E'- anon ve el inventario\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE INVENTARIO: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE INVENTARIO: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
