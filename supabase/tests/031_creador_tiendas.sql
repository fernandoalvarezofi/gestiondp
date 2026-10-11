-- CREADOR UNIFICADO: tienda online independiente con envío propio, carta digital y servicios con turnos.
-- Transacción que se deshace sola (termina con una excepción a propósito).
do $t$
declare
  dueno uuid := gen_random_uuid(); cliente uuid := gen_random_uuid(); t uuid := gen_random_uuid(); k uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  r jsonb; fallos text := ''; n int; v_prod uuid; v_ped uuid; v_tot numeric; v_serv uuid;
  tema jsonb := '{"plantilla":"boutique","titulo":"QA","bloques":[{"tipo":"portada","id":"portada"}]}';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-031-dueno@example.com'), (cliente, 'qa-031-cliente@example.com')) as x(id, mail);

  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  -- Tienda sin forma de entrega: se rechaza.
  begin perform negocio_crear(gen_random_uuid(), 'tienda', '{"nombre":"QA Tienda","slug":"qa-031-x"}', tema); fallos := fallos || E'- tienda sin entrega aceptada\n'; exception when others then null; end;
  -- Tienda independiente con envío propio y 2 productos.
  r := negocio_crear(t, 'tienda', '{"nombre":"QA Tienda 031","slug":"qa-031-tienda","envio_propio":true,"costo_envio":3000,"envio_detalle":"Correo, 3 a 5 días"}', tema, '[]',
    '[{"nombre":"Remera","precio":10000,"categoria":"Ropa"},{"nombre":"Gorra","precio":5000,"categoria":"Accesorios","descripcion":"Talle único"}]');
  if (r->>'creado')::boolean is not true then fallos := fallos || '- alta tienda: ' || r::text || E'\n'; end if;
  -- Carta digital sin pedidos.
  r := negocio_crear(k, 'carta', '{"nombre":"QA Carta 031","slug":"qa-031-carta","pedidos_online":false,"categoria":"comida"}', tema, '[]',
    '[{"nombre":"Milanesa","precio":9000,"categoria":"Platos","descripcion":"Con papas"}]');
  -- Servicios con turnos.
  r := negocio_crear(s, 'servicios', '{"nombre":"QA Turnos 031","slug":"qa-031-turnos"}', tema, '[]', '[]',
    '[{"nombre":"Corte","duracion_min":30,"precio":8000},{"nombre":"Color","duracion_min":90,"precio":20000}]', '{"profesional":"Ana","dias":[1,2,3,4,5],"desde":"09:00","hasta":"18:00"}');
  begin perform negocio_crear(gen_random_uuid(), 'sitio', '{"nombre":"QA Sitio","slug":"qa-031-sitio"}', tema, '[]', '[{"nombre":"x","precio":1}]'); fallos := fallos || E'- sitio con productos aceptado\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if (select count(*) from delivery_comercios where propietario_id = dueno and en_market = false and not verificado) <> 3 then fallos := fallos || E'- los negocios no nacieron fuera del Market y sin verificar\n'; end if;
  -- La tienda que vende queda en revisión; la carta sin pedidos y la agenda (no cobran por Woref) son públicas.
  if (select aprobado from delivery_comercios where id = t) or not (select aprobado from delivery_comercios where id = k) or not (select aprobado from delivery_comercios where id = s) then fallos := fallos || E'- publicación sin verificación incorrecta\n'; end if;
  -- Si la carta activa pedidos sin estar verificada, vuelve a revisión.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update delivery_comercios set pedidos_online = true where id = k;
  perform set_config('role', 'postgres', true);
  if (select aprobado from delivery_comercios where id = k) then fallos := fallos || E'- una carta con pedidos y sin verificar quedó pública\n'; end if;
  update delivery_comercios set pedidos_online = false where id = k;
  if (select tipo_sitio from delivery_comercios where id = t) <> 'tienda' or (select tipo_sitio from delivery_comercios where id = s) <> 'sitio' then fallos := fallos || E'- tipos incorrectos\n'; end if;
  if (select count(*) from delivery_productos where comercio_id = t) <> 2 or (select count(*) from delivery_productos where comercio_id = k and descripcion = 'Con papas') <> 1 then fallos := fallos || E'- productos no creados\n'; end if;
  if (select count(*) from servicios where comercio_id = s) <> 2 or (select count(*) from disponibilidad d join profesionales p on p.id = d.profesional_id where p.comercio_id = s) <> 5 then fallos := fallos || E'- agenda no armada\n'; end if;

  update delivery_comercios set aprobado = true where propietario_id = dueno;
  -- La agenda solo ofrece horarios de negocios aprobados.
  select id into v_serv from servicios where comercio_id = s and nombre = 'Corte';
  if jsonb_array_length(servicio_horarios_libres(v_serv, null, null, 14)) = 0 then fallos := fallos || E'- los servicios no tienen horarios libres\n'; end if;
  select id into v_prod from delivery_productos where comercio_id = t and nombre = 'Remera';

  -- Cliente compra con envío propio, aunque la tienda no tenga horarios ni ubicación.
  perform set_config('request.jwt.claims', json_build_object('sub', cliente, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform delivery_crear_pedido(t, jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)), 'Calle 1, Rosario', null, 'transferencia', 0, null, null, '3415551234', null, null, 'delivery');
    fallos := fallos || E'- tienda independiente aceptó delivery de Woref\n'; exception when others then null; end;
  v_ped := delivery_crear_pedido(t, jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 2)), 'Calle 1, Rosario', null, 'transferencia', 500, null, null, '3415551234', null, null, 'envio');
  begin perform delivery_crear_pedido(k, jsonb_build_array(jsonb_build_object('producto_id', (select id from delivery_productos where comercio_id = k limit 1), 'cantidad', 1)), 'x', null, 'efectivo', 0, null, null, '3415551234', null, null, 'envio');
    fallos := fallos || E'- una carta sin pedidos aceptó un pedido\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  select total into v_tot from delivery_pedidos where id = v_ped;
  if (select costo_envio from delivery_pedidos where id = v_ped) <> 3000 or (select propina from delivery_pedidos where id = v_ped) <> 0 then fallos := fallos || E'- costo de envío o propina incorrectos\n'; end if;

  -- El comercio acepta, despacha con seguimiento y entrega.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform delivery_aceptar_pedido(v_ped, null);
  begin perform pedido_despachar(v_ped, 'javascript:alert(1)'); fallos := fallos || E'- seguimiento con enlace peligroso aceptado\n'; exception when others then null; end;
  perform pedido_despachar(v_ped, 'CA123456789AR');
  perform delivery_actualizar_estado(v_ped, 'entregado');
  perform set_config('role', 'postgres', true);
  if (select estado::text || '/' || coalesce(envio_seguimiento, '') from delivery_pedidos where id = v_ped) <> 'entregado/CA123456789AR' then fallos := fallos || E'- despacho/entrega no quedó registrado\n'; end if;
  if exists (select 1 from delivery_pedidos where id = v_ped and repartidor_id is not null) then fallos := fallos || E'- se asignó repartidor\n'; end if;
  -- Libro: el envío es del comercio, sin margen de Woref, cobrado por el comercio.
  perform delivery_libro_pedido(v_ped);
  if coalesce((select sum(monto) from delivery_libro where pedido_id = v_ped and titular_tipo = 'comercio' and tipo = 'envio_propio'), 0) <> 3000 then fallos := fallos || E'- el envío no se acreditó al comercio\n'; end if;
  if coalesce((select sum(monto) from delivery_libro where pedido_id = v_ped and tipo = 'margen_envio'), 0) <> 0 then fallos := fallos || E'- Woref se quedó con el envío\n'; end if;
  if coalesce((select sum(monto) from delivery_libro where pedido_id = v_ped and tipo = 'cobrado_directo'), 0) <> -v_tot then fallos := fallos || E'- el cobro directo no coincide\n'; end if;

  raise exception '%', case when fallos = '' then 'CREADOR TIENDAS: TODAS PASARON' else E'FALLAS:\n' || fallos end;
end $t$;
