-- PRUEBAS DE NOTIFICACIONES (Fase 10). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); cat delivery_categoria; loc uuid; sv uuid; pa uuid; t1 uuid; d date; ts timestamptz;
  fallos text := ''; v jsonb; n int; id1 bigint; id2 bigint; tz constant text := 'America/Argentina/Buenos_Aires';
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', y.id, 'authenticated', 'authenticated', y.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-nt-d@example.com'), (cli, 'qa-nt-c@example.com'), (otro, 'qa-nt-o@example.com')) as y(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Notif', 'qa-nt-1', cat, 'Calle 1', dueno, true, true, true) returning id into loc;
  insert into servicios (comercio_id, nombre, duracion_min, precio, anticipacion_horas, cancelar_hasta_horas) values (loc, 'Corte', 30, 5000, 2, 12) returning id into sv;
  insert into profesionales (comercio_id, nombre) values (loc, 'Ana') returning id into pa;
  insert into profesional_servicios (profesional_id, servicio_id) values (pa, sv);
  insert into disponibilidad (profesional_id, dia_semana, desde, hasta) select pa, g, '09:00', '13:00' from generate_series(0, 6) g;
  d := (now() at time zone tz)::date + 5;
  ts := ((d + time '10:00') at time zone tz);

  -- Un turno reservado avisa al cliente y al dueño del local
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  t1 := turno_reservar(sv, ts, pa);
  perform set_config('role', 'postgres', true);
  if (select count(*) from notificaciones where usuario_id = cli and tipo = 'TURNO_CONFIRMADO') <> 1 then fallos := fallos || E'- el cliente no recibió la confirmación del turno\n'; end if;
  if (select count(*) from notificaciones where usuario_id = dueno and tipo = 'TURNO_NUEVO') <> 1 then fallos := fallos || E'- el dueño no recibió el aviso de turno nuevo\n'; end if;
  if exists (select 1 from notificaciones where usuario_id = otro) then fallos := fallos || E'- una persona ajena recibió avisos\n'; end if;

  -- Cada persona ve solo lo suyo
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := mis_notificaciones();
  if jsonb_array_length(v) <> 1 then fallos := fallos || format(E'- el cliente debería ver 1 aviso, ve %s\n', jsonb_array_length(v)); end if;
  if notificaciones_no_leidas() <> 1 then fallos := fallos || E'- contador de no leídas incorrecto\n'; end if;
  select count(*) into n from notificaciones; -- RLS: solo las propias
  if n <> 1 then fallos := fallos || format(E'- RLS: el cliente lee %s filas (debería 1)\n', n); end if;
  begin insert into notificaciones (usuario_id, categoria, tipo, titulo) values (cli, 'sistema', 'FALSA', 'x'); fallos := fallos || E'- un usuario insertó una notificación directo\n'; exception when others then null; end;
  begin update notificaciones set titulo = 'hack'; fallos := fallos || E'- un usuario editó notificaciones\n'; exception when others then null; end;
  begin perform notificar(cli, 'sistema', 'FALSA', 'Hack'); fallos := fallos || E'- un usuario ejecutó notificar()\n'; exception when others then null; end;
  if notificaciones_marcar_leidas() <> 1 then fallos := fallos || E'- marcar como leídas falló\n'; end if;
  if notificaciones_no_leidas() <> 0 then fallos := fallos || E'- quedaron avisos sin leer\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  if notificaciones_marcar_leidas() <> 0 then fallos := fallos || E'- marcó como leídas las de otra persona\n'; end if;
  if jsonb_array_length(mis_notificaciones()) <> 0 then fallos := fallos || E'- una persona ajena ve avisos\n'; end if;

  -- Preferencias
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  if (mis_preferencias_notificaciones()->>'turnos')::boolean is not true then fallos := fallos || E'- por defecto el push debería estar activo\n'; end if;
  perform guardar_preferencia_notificacion('turnos', false);
  if (mis_preferencias_notificaciones()->>'turnos')::boolean is not false then fallos := fallos || E'- no guardó la preferencia\n'; end if;
  begin perform guardar_preferencia_notificacion('inventada', true); fallos := fallos || E'- aceptó una categoría inventada\n'; exception when others then null; end;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform mis_notificaciones(); fallos := fallos || E'- anon leyó notificaciones\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Duplicados, enlaces y límites (llamadas internas)
  id1 := notificar(cli, 'sistema', 'PRUEBA', 'Hola', 'cuerpo', '/app', 'clave-1', false);
  id2 := notificar(cli, 'sistema', 'PRUEBA', 'Hola', 'cuerpo', '/app', 'clave-1', false);
  if id1 is null or id2 is not null then fallos := fallos || E'- la clave de duplicado no evitó la repetición\n'; end if;
  begin perform notificar(cli, 'sistema', 'PRUEBA', 'Link malo', null, 'https://malo.example/x', null, false); fallos := fallos || E'- aceptó un enlace externo\n'; exception when check_violation then null; end;
  begin perform notificar(cli, 'sistema', 'PRUEBA', 'Link malo 2', null, '//malo.example', null, false); fallos := fallos || E'- aceptó un enlace con doble barra\n'; exception when check_violation then null; end;
  begin perform notificar(cli, 'inventada', 'PRUEBA', 'x', null, null, null, false); fallos := fallos || E'- aceptó una categoría inventada\n'; exception when check_violation then null; end;
  if notificar(null, 'sistema', 'PRUEBA', 'x') is not null then fallos := fallos || E'- notificó a nadie\n'; end if;

  -- Cancelación: el local cancela y avisa al cliente; el cliente cancela y avisa al local
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform turno_cancelar(t1, 'Estoy enfermo');
  perform set_config('role', 'postgres', true);
  if (select count(*) from notificaciones where usuario_id = cli and tipo = 'TURNO_CANCELADO') <> 1 then fallos := fallos || E'- el cliente no se enteró de la cancelación del local\n'; end if;

  -- El aviso nunca rompe la operación: aun con la tabla de avisos rechazando todo, la reserva se crea
  alter table notificaciones add constraint nt_romper check (false) not valid;
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform turno_reservar(sv, ts + interval '1 day', pa);
  exception when others then fallos := fallos || format(E'- un fallo en los avisos rompió la reserva: %s\n', sqlerrm);
  end;
  perform set_config('role', 'postgres', true);
  alter table notificaciones drop constraint nt_romper;

  -- Recordatorios: turno en 20 h → aviso de 24 h, una sola vez
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, estado) values (loc, sv, pa, otro, now() + interval '20 hours', now() + interval '20 hours 30 minutes', 'confirmado') returning id into t1;
  perform turnos_recordatorios();
  perform turnos_recordatorios();
  if (select count(*) from notificaciones where usuario_id = otro and tipo = 'TURNO_RECORDATORIO') <> 1 then fallos := fallos || E'- el recordatorio no se envió exactamente una vez\n'; end if;

  if fallos <> '' then raise exception E'FALLARON:\n%', fallos; end if;
  raise exception 'TODAS PASARON';
end $t$;
