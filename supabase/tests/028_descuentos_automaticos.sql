-- Descuentos automáticos: se aplican solos, eligen el mejor, no se combinan con un código y el libro los carga al comercio.
-- Se autodescarta: termina con una excepción que muestra el resultado y revierte todo.
do $$
declare
  duenio uuid := '77777777-cccc-4aaa-8aaa-000000000001'; cliente uuid := '77777777-cccc-4aaa-8aaa-000000000002';
  c uuid; p1 uuid; ped uuid; r text := ''; x jsonb; v_desc numeric; v_cup text;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', duenio, 'authenticated', 'authenticated', 'qa-028-a@example.com', '', now(), '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', cliente, 'authenticated', 'authenticated', 'qa-028-b@example.com', '', now(), '{}', '{}', now(), now());
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado, propietario_id, acepta_retiro, esta_abierto, horarios, pedido_minimo)
    values ('QA 028', 'qa-028', 'tiendas', 'Calle 1', true, true, duenio, true, true, null, 0) returning id into c;
  insert into delivery_productos (comercio_id, nombre, precio, categoria, estado) values (c, 'Uno', 1000, 'A', 'publicado') returning id into p1;
  insert into delivery_cupones (codigo, descripcion, tipo, valor, minimo, comercio_id, automatico) values
    ('AUTO10', '10% automático', 'porcentaje', 10, 0, c, true),
    ('AUTO400', '$400 desde $2000', 'monto', 400, 2000, c, true),
    ('AUTOENVIO', 'Envío gratis', 'envio_gratis', 0, 0, c, true),
    ('MANUAL50', '50% con código', 'porcentaje', 50, 0, c, false);
  begin insert into delivery_cupones (codigo, descripcion, tipo, valor, automatico) values ('GLOBALAUTO', 'x', 'porcentaje', 5, true); r := r || 'FALLA automático sin comercio; '; exception when others then null; end;

  x := delivery_cupon_automatico(c, 1000, jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 1)), true);
  if x->>'codigo' <> 'AUTO10' then r := r || 'FALLA elige 10% con $1000: ' || coalesce(x->>'codigo', 'null') || '; '; end if;
  x := delivery_cupon_automatico(c, 3000, jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 3)), true);
  if x->>'codigo' <> 'AUTO400' then r := r || 'FALLA elige el de mayor descuento: ' || coalesce(x->>'codigo', 'null') || '; '; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ped := delivery_crear_pedido(c, jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 3)), null, null, 'efectivo', 0, null, null, '2346555000', null, null, 'retiro');
  select descuento, cupon_codigo into v_desc, v_cup from delivery_pedidos where id = ped;
  if v_cup <> 'AUTO400' or v_desc <> 400 then r := r || 'FALLA pedido sin código: ' || coalesce(v_cup, 'null') || ' ' || v_desc || '; '; end if;
  ped := delivery_crear_pedido(c, jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 1)), null, null, 'efectivo', 0, 'manual50', null, '2346555000', null, null, 'retiro');
  select descuento, cupon_codigo into v_desc, v_cup from delivery_pedidos where id = ped;
  if v_cup <> 'MANUAL50' or v_desc <> 500 then r := r || 'FALLA el código escrito no manda: ' || coalesce(v_cup, 'null') || '; '; end if;
  reset role;

  if (select usos from delivery_cupones where codigo = 'AUTO400') <> 1 then r := r || 'FALLA usos del automático; '; end if;
  -- El libro carga el descuento automático al comercio (no a la plataforma).
  select id into ped from delivery_pedidos where comercio_id = c and cupon_codigo = 'AUTO400';
  -- Solo para la prueba: se salta la máquina de estados del pedido (los disparadores) para llegar a 'entregado'.
  set local session_replication_role = replica;
  update delivery_pedidos set estado = 'entregado', entregado_at = now() where id = ped;
  set local session_replication_role = origin;
  perform delivery_libro_pedido(ped);
  if not exists (select 1 from delivery_libro where pedido_id = ped and titular_tipo = 'comercio' and tipo = 'descuento' and monto = -400) then r := r || 'FALLA libro: descuento no cargado al comercio; '; end if;
  if exists (select 1 from delivery_libro where pedido_id = ped and tipo = 'descuento_plataforma') then r := r || 'FALLA libro: lo pagó la plataforma; '; end if;

  raise exception '%', case when r = '' then 'DESCUENTOS AUTOMÁTICOS: TODAS PASARON' else r end;
end $$;
