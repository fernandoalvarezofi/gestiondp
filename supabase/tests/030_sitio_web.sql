-- CREADOR DE SITIOS WEB. Transacción que se deshace sola (termina con una excepción a propósito).
-- Verifica: alta atómica e idempotente (sin duplicados por reintento), que nace "en revisión" aunque se pida otra cosa,
-- que el visitante no lo ve hasta la aprobación, que no recibe pedidos, que no fuerza el catálogo, que las consultas del
-- formulario entran al CRM, que otra persona no puede tomar el id, que el visitante no puede crear sitios y que
-- las tiendas existentes no cambian.
do $t$
declare
  dueno uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); sid uuid := gen_random_uuid(); r jsonb; fallos text := ''; n int; v_tipo text; v_aprob boolean;
  tema jsonb := '{"plantilla":"galeria","color":"#1F2A44","titulo":"QA Estudio","bloques":[{"tipo":"portada","id":"portada","estilo":"galeria"},{"tipo":"formulario","id":"consulta"}],"menu":[{"texto":"Inicio","tipo":"inicio"}]}';
  paginas jsonb := '[{"titulo":"Servicios","slug":"servicios","clase":"otra","tipo":"landing","bloques":[{"tipo":"columnas","id":"lista","items":[{"titulo":"A"}]}]},{"titulo":"Contacto","slug":"contacto","clase":"contacto","tipo":"landing","bloques":[{"tipo":"formulario","id":"formulario"}]}]';
  datos jsonb := '{"nombre":"QA Estudio Sitio","slug":"qa-sitio-030","categoria":"tiendas","rubro":"Consultoría","telefono":"2355 000000","direccion":""}';
begin
  if exists (select 1 from delivery_comercios where tipo_sitio is null) then fallos := fallos || E'- hay comercios sin tipo\n'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-sitio-dueno@example.com'), (otro, 'qa-sitio-otro@example.com')) as x(id, mail);

  -- 1. El visitante sin cuenta no puede crear sitios.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  begin perform sitio_crear(gen_random_uuid(), datos, tema, paginas); fallos := fallos || E'- anon pudo crear un sitio\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- 2. Alta como el dueño: atómica, en revisión, tipo sitio, con páginas publicadas y sin catálogo forzado.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r := sitio_crear(sid, datos || '{"aprobado":true}'::jsonb, tema, paginas);
  if (r->>'creado')::boolean is not true or r->>'slug' <> 'qa-sitio-030' then fallos := fallos || '- alta: ' || r::text || E'\n'; end if;
  -- 3. Reintento con el mismo id (doble clic, recarga): devuelve el mismo, no crea otro.
  r := sitio_crear(sid, datos, tema, paginas);
  if (r->>'creado')::boolean is not false or (r->>'id')::uuid <> sid then fallos := fallos || '- reintento: ' || r::text || E'\n'; end if;
  -- 4. Otro alta con la misma dirección web se rechaza.
  begin perform sitio_crear(gen_random_uuid(), datos, tema, paginas); fallos := fallos || E'- aceptó una dirección web repetida\n'; exception when others then null; end;
  -- 5. Datos inválidos se rechazan.
  begin perform sitio_crear(gen_random_uuid(), '{"nombre":"x","slug":"qa-sitio-030b"}', tema, paginas); fallos := fallos || E'- aceptó un nombre corto\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  select count(*) into n from delivery_comercios where propietario_id = dueno;
  if n <> 1 then fallos := fallos || '- comercios del dueño: ' || n || E'\n'; end if;
  select tipo_sitio, aprobado into v_tipo, v_aprob from delivery_comercios where id = sid;
  if v_tipo <> 'sitio' then fallos := fallos || E'- no quedó como sitio\n'; end if;
  if v_aprob is distinct from false then fallos := fallos || E'- no nació en revisión\n'; end if;
  if exists (select 1 from delivery_comercios c, jsonb_array_elements(c.tienda_tema->'bloques') b where c.id = sid and b->>'tipo' = 'catalogo') then fallos := fallos || E'- el servidor agregó el catálogo a un sitio\n'; end if;
  select count(*) into n from delivery_tienda_paginas where comercio_id = sid and estado = 'publicada' and publicada_at is not null;
  if n <> 2 then fallos := fallos || '- páginas publicadas: ' || n || E'\n'; end if;
  if not exists (select 1 from core_business_members m join delivery_comercios c on c.business_id = m.business_id where c.id = sid and m.user_id = dueno and m.rol = 'owner') then fallos := fallos || E'- sin negocio del dueño\n'; end if;

  -- 6. Otra persona no puede reclamar el mismo id ni editarlo.
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform sitio_crear(sid, datos || '{"slug":"qa-sitio-030c"}', tema, paginas); fallos := fallos || E'- otro usuario tomó el id\n'; exception when others then null; end;
  begin perform delivery_guardar_tienda_tema(sid, tema); fallos := fallos || E'- otro usuario editó el sitio\n'; exception when others then null; end;
  update delivery_comercios set tipo_sitio = 'tienda' where id = sid;
  perform set_config('role', 'postgres', true);
  if (select tipo_sitio from delivery_comercios where id = sid) <> 'sitio' then fallos := fallos || E'- otro usuario cambió el tipo\n'; end if;

  -- 7. Mientras está en revisión, el visitante no lo ve (ni sus páginas).
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  if exists (select 1 from delivery_comercios where id = sid) then fallos := fallos || E'- anon ve el sitio en revisión\n'; end if;
  if exists (select 1 from delivery_tienda_paginas where comercio_id = sid) then fallos := fallos || E'- anon ve páginas del sitio en revisión\n'; end if;
  perform set_config('role', 'postgres', true);

  -- 8. Aprobado: el visitante lo ve y puede enviar una consulta, que entra al CRM.
  update delivery_comercios set aprobado = true where id = sid;
  perform set_config('role', 'anon', true);
  if not exists (select 1 from delivery_comercios where id = sid and tipo_sitio = 'sitio') then fallos := fallos || E'- anon no ve el sitio aprobado\n'; end if;
  select count(*) into n from delivery_tienda_paginas where comercio_id = sid;
  if n <> 2 then fallos := fallos || '- anon ve ' || n || E' páginas\n'; end if;
  perform tienda_consulta_enviar(sid, 'Visitante QA', 'visitante@example.com', null, 'Quiero una reunión');
  perform set_config('role', 'postgres', true);
  if not exists (select 1 from crm_actividades a join crm_contactos k on k.id = a.contacto_id where a.comercio_id = sid and k.email = 'visitante@example.com' and a.titulo = 'Consulta desde la tienda') then fallos := fallos || E'- la consulta no entró al CRM\n'; end if;

  -- 9. Un sitio no recibe pedidos, aunque se inserten a mano.
  begin
    insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega) values (otro, sid, 'x');
    fallos := fallos || E'- un sitio recibió un pedido\n';
  exception when others then
    if sqlerrm not like '%no recibe pedidos%' then fallos := fallos || '- pedido rechazado por otro motivo: ' || sqlerrm || E'\n'; end if;
  end;

  -- 10. El dueño puede pasar a tienda online; entonces sí se le agrega el catálogo al guardar.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update delivery_comercios set tipo_sitio = 'tienda' where id = sid;
  perform delivery_guardar_tienda_tema(sid, tema);
  perform set_config('role', 'postgres', true);
  if (select tipo_sitio from delivery_comercios where id = sid) <> 'tienda' then fallos := fallos || E'- el dueño no pudo activar la tienda\n'; end if;
  if not exists (select 1 from delivery_comercios c, jsonb_array_elements(c.tienda_tema->'bloques') b where c.id = sid and b->>'tipo' = 'catalogo') then fallos := fallos || E'- la tienda activada no tiene catálogo\n'; end if;

  raise exception '%', case when fallos = '' then 'SITIO WEB: TODAS PASARON' else E'FALLAS:\n' || fallos end;
end $t$;
