-- PRUEBAS DE CATEGORÍAS, ATRIBUTOS Y CANALES (Fase 4, paso 1). Transacción que se deshace sola.
do $t$
declare fallos text := ''; r uuid; h uuid;
begin
  select id into r from categorias where parent_id is null limit 1;
  select id into h from categorias where parent_id = r limit 1;
  begin insert into categorias (parent_id, slug, nombre) values (h, 'nieta-prueba', 'Nieta'); fallos := fallos || E'- permitió un tercer nivel\n'; exception when others then null; end;
  begin insert into categorias (slug, nombre) values ('Mal Slug', 'x'); fallos := fallos || E'- aceptó un slug inválido\n'; exception when others then null; end;
  begin update categorias set parent_id = h where id = r; fallos := fallos || E'- permitió que una raíz con hijas pase a ser hija\n'; exception when others then null; end;
  if producto_atributos_validos('{"color":"rojo","talle":"M"}'::jsonb) is not true then fallos := fallos || E'- rechazó atributos válidos\n'; end if;
  if producto_atributos_validos('{"color":1}'::jsonb) then fallos := fallos || E'- aceptó un valor que no es texto\n'; end if;
  if producto_atributos_validos('[]'::jsonb) then fallos := fallos || E'- aceptó un array\n'; end if;
  if producto_atributos_validos((select jsonb_object_agg('k' || g, 'v') from generate_series(1, 13) g)) then fallos := fallos || E'- aceptó más de 12 atributos\n'; end if;
  perform set_config('role', 'anon', true);
  if (select count(*) from categorias) < 50 then fallos := fallos || E'- anon no ve las categorías\n'; end if;
  begin insert into categorias (slug, nombre) values ('hack-anon', 'Hack'); fallos := fallos || E'- anon creó una categoría\n'; exception when others then null; end;
  begin perform delivery_admin_guardar_categoria(null, null, 'hack', 'Hack'); fallos := fallos || E'- anon ejecuta la función de administración\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  if fallos <> '' then raise exception E'PRUEBAS DE CATEGORÍAS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE CATEGORÍAS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
