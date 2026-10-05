-- PRUEBAS DE CONVERSACIONES COMPRADOR-VENDEDOR (Fase 10). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); intruso uuid := gen_random_uuid(); staff uuid := gen_random_uuid(); cat delivery_categoria; loc uuid; loc2 uuid; conv uuid; v jsonb; fallos text := ''; i int;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', y.id, 'authenticated', 'authenticated', y.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-cv-d@example.com'), (cli, 'qa-cv-c@example.com'), (intruso, 'qa-cv-i@example.com'), (staff, 'qa-cv-s@example.com')) as y(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Local Chat', 'qa-cv-1', cat, 'Calle 1', dueno, true, true, true) returning id into loc;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Local Pendiente', 'qa-cv-2', cat, 'Calle 2', intruso, false, true, true) returning id into loc2;
  insert into delivery_comercio_equipo (comercio_id, email, user_id, rol, estado) values (loc, 'qa-cv-s@example.com', staff, 'operador', 'activo');

  -- El cliente escribe
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  conv := conversacion_iniciar(loc, 'Hola, ¿tienen stock?');
  if conversacion_iniciar(loc, 'Otra pregunta') <> conv then fallos := fallos || E'- creó dos conversaciones con el mismo local\n'; end if;
  begin perform conversacion_iniciar(loc2, 'hola'); fallos := fallos || E'- escribió a un local no aprobado\n'; exception when others then null; end;
  begin perform conversacion_enviar(conv, '   '); fallos := fallos || E'- aceptó un mensaje vacío\n'; exception when others then null; end;
  begin perform conversacion_enviar(conv, repeat('a', 1001)); fallos := fallos || E'- aceptó un mensaje de más de 1.000 caracteres\n'; exception when others then null; end;
  if jsonb_array_length(conversacion_mensajes(conv)) <> 2 then fallos := fallos || E'- el cliente debería ver 2 mensajes\n'; end if;
  begin insert into conv_mensajes (conversacion_id, autor_id, de_comercio, texto) values (conv, cli, true, 'me hago pasar por el local'); fallos := fallos || E'- insertó un mensaje directo en la tabla\n'; exception when others then null; end;
  if jsonb_array_length(mis_conversaciones()) <> 1 then fallos := fallos || E'- el cliente debería ver 1 conversación\n'; end if;
  begin perform conversaciones_comercio(loc); fallos := fallos || E'- el cliente listó las conversaciones del local\n'; exception when others then null; end;

  -- Un intruso no entra
  perform set_config('request.jwt.claims', json_build_object('sub', intruso, 'role', 'authenticated')::text, true);
  begin perform conversacion_mensajes(conv); fallos := fallos || E'- un ajeno leyó la conversación\n'; exception when others then null; end;
  begin perform conversacion_enviar(conv, 'intruso'); fallos := fallos || E'- un ajeno escribió en la conversación\n'; exception when others then null; end;
  begin perform conversacion_marcar_leida(conv); fallos := fallos || E'- un ajeno marcó la conversación como leída\n'; exception when others then null; end;
  begin perform conversaciones_comercio(loc); fallos := fallos || E'- un ajeno listó las conversaciones de un local\n'; exception when others then null; end;
  if jsonb_array_length(mis_conversaciones()) <> 0 then fallos := fallos || E'- un ajeno ve conversaciones\n'; end if;

  -- El local y su equipo responden
  perform set_config('role', 'postgres', true);
  if (select count(*) from notificaciones where usuario_id = dueno and tipo = 'MENSAJE_RECIBIDO') <> 1 then fallos := fallos || format(E'- el dueño debería tener 1 aviso de mensaje seguido (agrupado), tiene %s\n', (select count(*) from notificaciones where usuario_id = dueno and tipo = 'MENSAJE_RECIBIDO')); end if;
  if (select count(*) from notificaciones where usuario_id = staff and tipo = 'MENSAJE_RECIBIDO') <> 1 then fallos := fallos || E'- el operador del local no recibió el aviso\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := conversaciones_comercio(loc);
  if jsonb_array_length(v) <> 1 or (v->0->>'sin_leer')::boolean is not true then fallos := fallos || E'- el local debería ver 1 conversación sin leer\n'; end if;
  perform conversacion_enviar(conv, 'Sí, quedan 3');
  v := conversaciones_comercio(loc);
  if (v->0->>'sin_leer')::boolean is not false then fallos := fallos || E'- tras responder debería quedar leída para el local\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  if (mis_conversaciones()->0->>'sin_leer')::boolean is not true then fallos := fallos || E'- el cliente debería ver la respuesta como no leída\n'; end if;
  perform conversacion_marcar_leida(conv);
  if (mis_conversaciones()->0->>'sin_leer')::boolean is not false then fallos := fallos || E'- marcar leída no funcionó\n'; end if;
  if (select de_comercio from jsonb_to_recordset(conversacion_mensajes(conv)) as x(id bigint, de_comercio boolean) order by id desc limit 1) is not true then fallos := fallos || E'- la respuesta del local debería figurar como del local\n'; end if;
  begin update conv_mensajes set texto = 'editado'; fallos := fallos || E'- editó un mensaje\n'; exception when others then null; end;

  -- Tope por minuto
  perform set_config('role', 'postgres', true);
  insert into conv_mensajes (conversacion_id, autor_id, de_comercio, texto) select conv, cli, false, 'spam ' || g from generate_series(1, 20) g;
  perform set_config('role', 'authenticated', true);
  begin perform conversacion_enviar(conv, 'uno más'); fallos := fallos || E'- no frenó el exceso de mensajes por minuto\n'; exception when others then null; end;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform conversacion_iniciar(loc, 'anon'); fallos := fallos || E'- anon inició una conversación\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'FALLARON:\n%', fallos; end if;
  raise exception 'TODAS PASARON';
end $t$;
