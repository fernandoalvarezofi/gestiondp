-- PRUEBAS DEL BUSCADOR DEL MARKETPLACE (Fase 4, paso 2). Transacción que se deshace sola.
do $t$
declare fallos text := ''; r jsonb; n int; cat delivery_categoria; dueno uuid := gen_random_uuid(); c1 uuid; p1 uuid; p2 uuid; raiz uuid; hija uuid;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated', 'qa-bus@example.com', 'x', now(), '{}', '{}', now(), now(), '', '', '', '');
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Bus', 'qa-bus-1', cat, 'x', dueno, true, true, true) returning id into c1;
  select id into raiz from categorias where parent_id is null and slug = 'moda';
  select id into hija from categorias where parent_id = raiz and slug like '%calzado' limit 1;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, precio_anterior, stock, disponible, marca, categoria_id, atributos) values (c1, 'Zapatillas Térmicas', 'Calzado', 50000, 70000, 5, true, 'Nikkon', hija, '{"color":"Turquesaxyz"}') returning id into p1;
  insert into delivery_productos (comercio_id, nombre, categoria, precio, stock, disponible, en_market) values (c1, 'Zapatillas ocultas del market', 'Calzado', 100, 5, true, false) returning id into p2;

  perform set_config('role', 'anon', true);
  r := market_buscar('zapatillas termicas');
  if (r->>'total')::int <> 1 or (r->'items'->0->>'id') <> p1::text then fallos := fallos || format(E'- no encontró el producto sin tildes: %s\n', r); end if;
  if (market_buscar('zapatilas'))->>'total' <> '1' then fallos := fallos || E'- no tolera un error de tipeo\n'; end if;
  if (market_buscar('turquesaxyz'))->>'total' <> '1' then fallos := fallos || E'- no busca en los atributos\n'; end if;
  if (market_buscar('nikkon'))->>'total' <> '1' then fallos := fallos || E'- no busca por marca\n'; end if;
  if (market_buscar('calzado'))->>'total' <> '1' then fallos := fallos || E'- no busca por categoría\n'; end if;
  if (market_buscar('zapatillas ocultas'))->>'total' <> '0' then fallos := fallos || E'- muestra un producto que no está en el Market\n'; end if;
  if (market_buscar(null, hija))->>'total' <> '1' or (market_buscar(null, raiz))->>'total' <> '1' then fallos := fallos || E'- el filtro por categoría (hija o raíz) falla\n'; end if;
  if (market_buscar(null, null, 'NIKKON'))->>'total' <> '1' then fallos := fallos || E'- el filtro por marca no ignora mayúsculas\n'; end if;
  if (market_buscar('zapatillas', null, null, 60000))->>'total' <> '0' or (market_buscar('zapatillas', null, null, null, 60000))->>'total' <> '1' then fallos := fallos || E'- el filtro por precio falla\n'; end if;
  if (market_buscar('zapatillas', null, null, null, null, true, true))->>'total' <> '1' then fallos := fallos || E'- el filtro de ofertas falla\n'; end if;
  perform set_config('role', 'postgres', true);
  update delivery_productos set stock = 0 where id = p1;
  perform set_config('role', 'anon', true);
  if (market_buscar('zapatillas'))->>'total' <> '0' or (market_buscar('zapatillas', null, null, null, null, false))->>'total' <> '1' then fallos := fallos || E'- el filtro de stock falla\n'; end if;
  perform set_config('role', 'postgres', true);
  update delivery_comercios set activo = false where id = c1;
  perform set_config('role', 'anon', true);
  if (market_buscar('zapatillas', null, null, null, null, false))->>'total' <> '0' then fallos := fallos || E'- muestra productos de un comercio inactivo\n'; end if;
  -- topes y entradas hostiles
  if jsonb_array_length((market_buscar(null, null, null, null, null, true, false, null, null, 'relevancia', 9999))->'items') > 48 then fallos := fallos || E'- no aplica el tope de 48 por página\n'; end if;
  begin perform market_buscar(repeat('a', 5000) || ' ' || repeat('b ', 100)); exception when others then fallos := fallos || format(E'- falla con un texto enorme: %s\n', sqlerrm); end;
  begin perform market_buscar('%_\ '' ; drop table x; --'); exception when others then fallos := fallos || format(E'- falla con caracteres especiales: %s\n', sqlerrm); end;
  begin perform market_buscar('x', null, null, null, null, true, false, 999, 999, 'inventado'); exception when others then fallos := fallos || format(E'- falla con coordenadas u orden inválidos: %s\n', sqlerrm); end;
  begin perform market_filtrados(null, null, null, null, null, true, false); fallos := fallos || E'- anon ejecuta la función interna\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  if fallos <> '' then raise exception E'PRUEBAS DEL BUSCADOR: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DEL BUSCADOR: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
