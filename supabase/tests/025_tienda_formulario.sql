-- Bloques nuevos de la tienda y consultas por formulario que entran al CRM.
-- Se autodescarta: termina con una excepción que muestra el resultado y revierte todo.
-- Crea su propio comercio de prueba dentro de la transacción (se revierte al final).
do $$
declare c uuid; r text := ''; n int; b jsonb;
begin
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado)
    values ('QA formulario', 'qa-formulario-025', 'tiendas', 'Calle 1', true, true) returning id into c;

  b := public._ts_bloque('{"tipo":"testimonios","id":"t1","items":[{"nombre":"Ana","texto":"Excelente","foto_url":"javascript:alert(1)"},{"nombre":"","texto":"x"}]}'::jsonb, 1);
  if jsonb_array_length(b->'items') <> 1 or b->'items'->0 ? 'foto_url' then r := r || 'FALLA testimonios; '; end if;
  b := public._ts_bloque('{"tipo":"cta","enlace_tipo":"reservar","fondo":"rojo"}'::jsonb, 2);
  if b->>'enlace_tipo' <> 'reservar' or b->>'fondo' <> 'color' then r := r || 'FALLA cta; '; end if;
  if public._ts_bloque('{"tipo":"texto","titulo":"Hola"}'::jsonb, 3)->>'titulo' <> 'Hola' then r := r || 'FALLA bloques anteriores; '; end if;
  if public._ts_bloque('{"tipo":"desconocido"}'::jsonb, 4) is not null then r := r || 'FALLA tipo desconocido; '; end if;

  begin perform tienda_consulta_enviar(c, 'Juan', 'juan@example.com', null, 'Hola, quiero saber'); r := r || 'FALLA acepta sin formulario; '; exception when others then null; end;
  update delivery_comercios set tienda_tema = jsonb_build_object('bloques', jsonb_build_array(jsonb_build_object('tipo', 'formulario', 'id', 'f1'))) where id = c;

  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  perform tienda_consulta_enviar(c, 'Juan Prueba', 'juan@example.com', '2346 555000', 'Hola, quiero saber precios');
  begin perform tienda_consulta_enviar(c, 'J', 'x', null, 'a'); r := r || 'FALLA acepta datos inválidos; '; exception when others then null; end;
  perform tienda_consulta_enviar(c, 'Juan Prueba', 'juan@example.com', null, 'segunda consulta');
  perform tienda_consulta_enviar(c, 'Juan Prueba', 'juan@example.com', null, 'tercera consulta');
  begin perform tienda_consulta_enviar(c, 'Juan Prueba', 'juan@example.com', null, 'cuarta consulta'); r := r || 'FALLA sin límite diario; '; exception when others then null; end;
  begin perform 1 from crm_actividades limit 1; r := r || 'FALLA anon lee el CRM; '; exception when others then null; end;
  reset role;

  select count(*) into n from crm_actividades a join crm_contactos k on k.id = a.contacto_id where a.comercio_id = c and k.email = 'juan@example.com' and k.origen = 'tienda' and a.tipo = 'tarea';
  if n <> 3 then r := r || 'FALLA tareas en CRM: ' || n || '; '; end if;

  raise exception '%', case when r = '' then 'TIENDA FORMULARIO: TODAS PASARON' else r end;
end $$;
