-- PRUEBAS DEL SELECTOR Y DEL RESUMEN POR NEGOCIO (Fase 1, paso 4). Transacción que se deshace sola.
-- Dos dueños con negocios distintos; el primero además es ADMIN en el negocio del segundo y un tercero es GERENTE del primero.
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); g uuid := gen_random_uuid(); cat delivery_categoria; ca1 uuid; ca2 uuid; cb1 uuid; na uuid; nb uuid;
  fallos text := ''; v jsonb; n int;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (a, 'qa-a@example.com'), (b, 'qa-b@example.com'), (g, 'qa-g@example.com')) as x(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA A1', 'qa-res-a1', cat, 'x', a, true, true) returning id, business_id into ca1, na;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA A2', 'qa-res-a2', cat, 'x', a, true, true) returning id into ca2;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA B1', 'qa-res-b1', cat, 'x', b, true, true) returning id, business_id into cb1, nb;
  insert into core_business_members (business_id, user_id, rol, estado) values (nb, a, 'admin', 'activo'), (na, g, 'manager', 'activo');
  -- un pedido entregado en A1 para que haya números
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, metodo_pago, estado, entregado_at) values (g, ca1, 'x', 1000, 1000, 'efectivo', 'entregado', now());

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := delivery_resumen_negocios();
  if jsonb_array_length(v) <> 2 then fallos := fallos || format(E'- A debería ver 2 negocios (propio y como admin), ve %s\n', jsonb_array_length(v)); end if;
  if (select count(*) from jsonb_array_elements(v) x where x->>'id' = na::text and jsonb_array_length(x->'tiendas') = 2) <> 1 then fallos := fallos || E'- el negocio de A debería tener 2 tiendas\n'; end if;
  if (select (t->>'ventas')::numeric from jsonb_array_elements(v) x, jsonb_array_elements(x->'tiendas') t where t->>'id' = ca1::text) <> 1000 then fallos := fallos || E'- las ventas de A1 no coinciden\n'; end if;
  v := delivery_mis_comercios();
  if jsonb_array_length(v) <> 3 then fallos := fallos || format(E'- mis_comercios de A debería traer 3 tiendas, trae %s\n', jsonb_array_length(v)); end if;
  if (select count(distinct t->>'negocio_id') from jsonb_array_elements(v) t) <> 2 then fallos := fallos || E'- mis_comercios debería distinguir 2 negocios\n'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v := delivery_resumen_negocios();
  if jsonb_array_length(v) <> 1 or (select count(*) from jsonb_array_elements(v) x where x->>'id' = na::text) <> 0 then fallos := fallos || E'- B ve datos del negocio de A\n'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  v := delivery_resumen_negocios();
  if jsonb_array_length(v) <> 0 then fallos := fallos || E'- un gerente ve el resumen de ventas del negocio\n'; end if;
  if jsonb_array_length(delivery_mis_comercios()) <> 2 then fallos := fallos || E'- el gerente debería ver las 2 tiendas de A en el selector\n'; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform delivery_resumen_negocios(); fallos := fallos || E'- anon ejecuta el resumen\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE RESUMEN: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE RESUMEN: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
