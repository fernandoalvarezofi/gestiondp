-- PRUEBAS DE OPINIONES POR PRODUCTO Y FAVORITOS (Fase 4, paso 3). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); cat delivery_categoria; c1 uuid; prod uuid; prod2 uuid;
  ped uuid; ped2 uuid; i1 uuid; i2 uuid; i3 uuid; r1 uuid; fallos text := ''; n int; v jsonb;
begin
  select categoria into cat from delivery_comercios limit 1;
  alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-op-d@example.com'), (cli, 'qa-op-c@example.com'), (otro, 'qa-op-o@example.com'), (adm, 'qa-op-a@example.com')) as x(id, mail);
  update perfiles set nombre = 'María Gómez' where id = cli;
  insert into user_roles (user_id, role) values (adm, 'admin');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Op', 'qa-op-1', cat, 'x', dueno, true, true, true) returning id into c1;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, stock, disponible) values (c1, 'Campera QA', 'Ropa', 1000, 5, true) returning id into prod;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, stock, disponible) values (c1, 'Gorra QA', 'Ropa', 500, 5, true) returning id into prod2;

  -- Pedido 1 entregado (2 líneas); pedido 2 sin entregar.
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (cli, c1, 'x', 1500, 1500, 'efectivo', 'pendiente') returning id into ped;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped, prod, 'Campera QA', 1000, 1) returning id into i1;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped, prod2, 'Gorra QA', 500, 1) returning id into i2;
  update delivery_pedidos set estado = 'entregado', entregado_at = now() where id = ped;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado) values (cli, c1, 'x', 1000, 1000, 'efectivo', 'pendiente') returning id into ped2;
  insert into delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad) values (ped2, prod, 'Campera QA', 1000, 1) returning id into i3;

  -- El cliente: opina; no puede dos veces, ni de un pedido sin entregar, ni fuera de rango.
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if jsonb_array_length(delivery_mis_productos_sin_opinar()) <> 2 then fallos := fallos || E'- debería tener 2 productos para opinar\n'; end if;
  r1 := producto_resena_crear(i1, 5, 'Excelente, muy abrigada');
  begin perform producto_resena_crear(i1, 4); fallos := fallos || E'- opinó dos veces del mismo producto\n'; exception when others then null; end;
  begin perform producto_resena_crear(i3, 5); fallos := fallos || E'- opinó de un pedido que todavía no recibió\n'; exception when others then null; end;
  begin perform producto_resena_crear(i2, 6); fallos := fallos || E'- aceptó un puntaje de 6\n'; exception when others then null; end;
  begin perform producto_resena_crear(i2, 0); fallos := fallos || E'- aceptó un puntaje de 0\n'; exception when others then null; end;
  begin perform producto_resena_crear(i2, 3, repeat('x', 501)); fallos := fallos || E'- aceptó un comentario de 501 caracteres\n'; exception when others then null; end;
  if jsonb_array_length(delivery_mis_productos_sin_opinar()) <> 1 then fallos := fallos || E'- después de opinar debería quedar 1 pendiente\n'; end if;
  begin perform 1 from delivery_resenas_producto limit 1; fallos := fallos || E'- un usuario lee la tabla de opiniones\n'; exception when others then null; end;
  -- otra persona no puede opinar con mis productos
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  begin perform producto_resena_crear(i2, 5); fallos := fallos || E'- otra persona opinó con un producto ajeno\n'; exception when others then null; end;
  begin perform producto_resena_responder(r1, 'hola'); fallos := fallos || E'- otra persona respondió una opinión\n'; exception when others then null; end;
  begin perform delivery_resenas_producto_comercio(c1); fallos := fallos || E'- otra persona ve las opiniones del comercio\n'; exception when others then null; end;
  begin perform producto_resena_reportar(r1, 'es spam seguro'); fallos := fallos || E'- otra persona reportó una opinión\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Promedio y cantidad en el producto
  if (select rating_count from delivery_productos where id = prod) <> 1 or (select rating_avg from delivery_productos where id = prod) <> 5 then fallos := fallos || E'- el promedio del producto no se actualizó\n'; end if;

  -- Lectura pública: autor abreviado, sin identificadores
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  v := producto_resenas(prod);
  if (v->'items'->0->>'autor') <> 'María G.' then fallos := fallos || format(E'- el autor debería ser "María G.", fue %s\n', v->'items'->0->>'autor'); end if;
  if v::text like '%cliente_id%' or v::text like '%' || cli::text || '%' then fallos := fallos || E'- la lectura pública expone el identificador del cliente\n'; end if;
  if (v->'resumen'->>'cantidad')::int <> 1 or (v->'resumen'->'distribucion'->>'5')::int <> 1 then fallos := fallos || E'- el resumen público no coincide\n'; end if;
  begin perform delivery_resenas_producto_comercio(c1); fallos := fallos || E'- anon ve las opiniones del comercio\n'; exception when others then null; end;
  begin perform producto_resena_crear(i2, 5); fallos := fallos || E'- anon opinó\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- El comercio responde y reporta
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform producto_resena_responder(r1, '¡Gracias por tu compra!');
  begin perform producto_resena_responder(r1, repeat('y', 501)); fallos := fallos || E'- aceptó una respuesta de 501 caracteres\n'; exception when others then null; end;
  if jsonb_array_length(delivery_resenas_producto_comercio(c1)) <> 1 then fallos := fallos || E'- el comercio no ve su opinión\n'; end if;
  perform producto_resena_reportar(r1, 'Es un insulto');
  begin perform delivery_admin_resenas_reportadas(); fallos := fallos || E'- el comercio ve la lista de reportes de administración\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Administración: ve el reporte y la oculta; el promedio se recalcula
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if jsonb_array_length(delivery_admin_resenas_reportadas()) <> 1 then fallos := fallos || E'- administración no ve el reporte\n'; end if;
  perform delivery_admin_resena_moderar(r1, false);
  perform set_config('role', 'postgres', true);
  if (select rating_count from delivery_productos where id = prod) <> 0 or (select rating_avg from delivery_productos where id = prod) is not null then fallos := fallos || E'- al ocultarla, el promedio no se recalculó\n'; end if;
  if jsonb_array_length(producto_resenas(prod)->'items') <> 0 then fallos := fallos || E'- una opinión oculta sigue visible\n'; end if;
  if (select count(*) from delivery_resenas_producto_reportes where resena_id = r1 and resuelto_at is not null) <> 1 then fallos := fallos || E'- el reporte no quedó resuelto\n'; end if;

  -- Orden por calificación en el buscador (sin errores) y favoritos
  update delivery_resenas_producto set visible = true where id = r1;
  if (market_buscar('campera qa', null, null, null, null, true, false, null, null, 'rating')->'items'->0->>'id') <> prod::text then fallos := fallos || E'- el orden por calificación falla\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into delivery_favoritos_producto (perfil_id, producto_id) values (cli, prod);
  if favoritos_producto_importar(array[prod, prod2, gen_random_uuid()]) <> 1 then fallos := fallos || E'- la importación debería sumar solo 1 (uno ya estaba, otro no existe)\n'; end if;
  begin insert into delivery_favoritos_producto (perfil_id, producto_id) values (otro, prod2); fallos := fallos || E'- guardó un favorito a nombre de otra persona\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  if (select count(*) from delivery_favoritos_producto) <> 0 then fallos := fallos || E'- ve favoritos de otra persona\n'; end if;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform favoritos_producto_importar(array[prod]); fallos := fallos || E'- anon importó favoritos\n'; exception when others then null; end;
  begin perform 1 from delivery_favoritos_producto limit 1; fallos := fallos || E'- anon lee favoritos\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE OPINIONES: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE OPINIONES: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
