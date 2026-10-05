-- PRUEBAS DE SERVICIOS Y TURNOS (Fase 9). Transacción que se deshace sola.
do $t$
declare dueno uuid := gen_random_uuid(); dueno2 uuid := gen_random_uuid(); c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); cli2 uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); cat delivery_categoria;
  sv uuid; sv2 uuid; sv_otro uuid; pa uuid; pb uuid; d date; ts timestamptz; ts2 timestamptz; t1 uuid; t2 uuid; t3 uuid; fallos text := ''; v jsonb; n int; tz constant text := 'America/Argentina/Buenos_Aires';
  loc uuid; loc2 uuid;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', y.id, 'authenticated', 'authenticated', y.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-sv-d@example.com'), (dueno2, 'qa-sv-d2@example.com'), (otro, 'qa-sv-o@example.com'), (cli, 'qa-sv-c@example.com'), (cli2, 'qa-sv-c2@example.com')) as y(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Peluquería', 'qa-sv-1', cat, 'Calle 1', dueno, true, true, true) returning id into loc;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto) values ('QA Otro Local', 'qa-sv-2', cat, 'Calle 2', dueno2, true, true, true) returning id into loc2;
  insert into servicios (comercio_id, nombre, duracion_min, precio, anticipacion_horas, cancelar_hasta_horas) values (loc, 'Corte', 30, 5000, 2, 12) returning id into sv;
  insert into servicios (comercio_id, nombre, duracion_min, precio, anticipacion_horas, cancelar_hasta_horas) values (loc, 'Tintura', 90, 15000, 2, 200) returning id into sv2;
  insert into servicios (comercio_id, nombre, duracion_min, precio) values (loc2, 'Servicio ajeno', 30, 1000) returning id into sv_otro;
  insert into profesionales (comercio_id, nombre) values (loc, 'Ana') returning id into pa;
  insert into profesionales (comercio_id, nombre) values (loc, 'Beto') returning id into pb;
  insert into profesional_servicios (profesional_id, servicio_id) values (pa, sv), (pa, sv2), (pb, sv);
  insert into disponibilidad (profesional_id, dia_semana, desde, hasta) select pa, g, '09:00', '13:00' from generate_series(0, 6) g;
  insert into disponibilidad (profesional_id, dia_semana, desde, hasta) select pb, g, '10:00', '14:00' from generate_series(0, 6) g;
  d := (now() at time zone tz)::date + 5;
  ts := ((d + time '10:00') at time zone tz);

  -- Un servicio no se puede asignar a un profesional de otro local
  begin insert into profesional_servicios (profesional_id, servicio_id) values (pa, sv_otro); fallos := fallos || E'- asignó un servicio de otro local\n'; exception when others then null; end;

  -- Horarios libres (público)
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  v := servicio_horarios_libres(sv, null, d, 1);
  n := jsonb_array_length(v->0->'horarios');
  if jsonb_array_length(v) <> 1 or n <> 30 then fallos := fallos || format(E'- Corte debería tener 30 horarios ese día (15 de Ana + 15 de Beto), tiene %s\n', n); end if;
  v := servicio_horarios_libres(sv2, null, d, 1);
  if jsonb_array_length(v->0->'horarios') <> 11 then fallos := fallos || format(E'- Tintura (90 min, solo Ana) debería tener 11 horarios, tiene %s\n', jsonb_array_length(v->0->'horarios')); end if;
  begin perform turno_reservar(sv, ts, pa); fallos := fallos || E'- anon reservó\n'; exception when others then null; end;
  begin insert into servicios (comercio_id, nombre, duracion_min) values (loc, 'Hack', 30); fallos := fallos || E'- anon creó un servicio\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  -- Reservas
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  t1 := turno_reservar(sv, ts, pa, '2355123456', 'Corte corto');
  begin perform turno_reservar(sv, ts, pa); fallos := fallos || E'- reservó dos veces el mismo horario\n'; exception when others then null; end;
  begin perform turno_reservar(sv, ts + interval '15 minutes', pa); fallos := fallos || E'- permitió un turno que se pisa con otro (10:15)\n'; exception when others then null; end;
  begin perform turno_reservar(sv, ts, pb); fallos := fallos || E'- la misma persona reservó dos turnos a la misma hora\n'; exception when others then null; end;
  begin perform turno_reservar(sv, ((d + time '08:00') at time zone tz), pa); fallos := fallos || E'- permitió un horario fuera de la agenda (08:00)\n'; exception when others then null; end;
  begin perform turno_reservar(sv, ((d + time '12:45') at time zone tz), pa); fallos := fallos || E'- permitió un turno que termina después de la agenda\n'; exception when others then null; end;
  begin perform turno_reservar(sv, now() + interval '30 minutes', pa); fallos := fallos || E'- permitió reservar sin la anticipación mínima\n'; exception when others then null; end;
  begin perform turno_reservar(sv, now() - interval '1 day', pa); fallos := fallos || E'- permitió reservar en el pasado\n'; exception when others then null; end;
  begin perform turno_reservar(sv, now() + interval '90 days', pa); fallos := fallos || E'- permitió reservar a más de 60 días\n'; exception when others then null; end;
  begin perform turno_reservar(sv_otro, ts, pa); fallos := fallos || E'- reservó un servicio con un profesional de otro local\n'; exception when others then null; end;
  begin perform turno_reservar(sv, ts + interval '1 day', pb, 'abc'); fallos := fallos || E'- aceptó un teléfono inválido\n'; exception when others then null; end;
  -- sin elegir profesional: toma uno libre
  perform set_config('request.jwt.claims', json_build_object('sub', cli2, 'role', 'authenticated')::text, true);
  t2 := turno_reservar(sv, ts, null);
  perform set_config('role', 'postgres', true);
  if (select profesional_id from turnos where id = t2) <> pb then fallos := fallos || E'- sin elegir profesional debería asignar a Beto (Ana ya está ocupada a esa hora)\n'; end if;
  if (select precio from turnos where id = t1) <> 5000 then fallos := fallos || E'- el turno no guarda el precio del servicio\n'; end if;
  begin insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin) values (loc, sv, pa, otro, ts + interval '10 minutes', ts + interval '40 minutes'); fallos := fallos || E'- la base permitió dos turnos confirmados que se pisan\n'; exception when exclusion_violation then null; end;

  -- El horario reservado deja de aparecer
  v := servicio_horarios_libres(sv, pa, d, 1);
  if exists (select 1 from jsonb_array_elements(v->0->'horarios') h where (h->>'inicio')::timestamptz = ts) then fallos := fallos || E'- el horario reservado sigue apareciendo libre\n'; end if;

  -- Bloqueo del profesional
  insert into bloqueos (profesional_id, desde, hasta, motivo) values (pb, ((d + time '11:00') at time zone tz), ((d + time '12:00') at time zone tz), 'Trámite');
  v := servicio_horarios_libres(sv, pb, d, 1);
  if exists (select 1 from jsonb_array_elements(v->0->'horarios') h where ((h->>'inicio')::timestamptz at time zone tz)::time between '11:00' and '11:45') then fallos := fallos || E'- se ofrecen horarios dentro del bloqueo\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform turno_reservar(sv, ((d + time '11:30') at time zone tz), pb); fallos := fallos || E'- reservó dentro de un bloqueo\n'; exception when others then null; end;

  -- Límite de 3 turnos próximos por persona y local
  perform turno_reservar(sv, ts + interval '1 day', pa); perform turno_reservar(sv, ts + interval '2 days', pa); perform turno_reservar(sv, ts + interval '3 days', pa);
  begin perform turno_reservar(sv, ts + interval '4 days', pa); fallos := fallos || E'- permitió más de 3 turnos próximos en el mismo local\n'; exception when others then null; end;

  -- Cancelación: la persona puede si falta más que el plazo; la dueña de OTRO local no; el comercio sí
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  t3 := turno_reservar(sv2, ts + interval '30 minutes', pa);
  begin perform turno_cancelar(t3, 'cambio de planes'); fallos := fallos || E'- canceló dentro del plazo no permitido (Tintura exige 200 hs)\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno2, 'role', 'authenticated')::text, true);
  begin perform turno_cancelar(t3); fallos := fallos || E'- el dueño de otro local canceló un turno ajeno\n'; exception when others then null; end;
  begin perform delivery_turnos_agenda(loc, d, d); fallos := fallos || E'- el dueño de otro local ve la agenda\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  v := delivery_turnos_agenda(loc, d, d);
  if jsonb_array_length(v) < 3 then fallos := fallos || format(E'- la agenda del día debería tener al menos 3 turnos, tiene %s\n', jsonb_array_length(v)); end if;
  if v::text like '%' || cli::text || '%' then fallos := fallos || E'- la agenda expone el identificador de la persona\n'; end if;
  perform turno_cancelar(t3, 'Se rompió la máquina');
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  perform turno_cancelar(t1, 'No llego');
  perform set_config('role', 'postgres', true);
  if (select estado || ':' || cancelado_por from turnos where id = t1) <> 'cancelado:cliente' or (select estado || ':' || cancelado_por from turnos where id = t3) <> 'cancelado:comercio' then fallos := fallos || E'- los turnos cancelados no quedan con quién los canceló\n'; end if;
  v := servicio_horarios_libres(sv, pa, d, 1);
  if not exists (select 1 from jsonb_array_elements(v->0->'horarios') h where (h->>'inicio')::timestamptz = ts) then fallos := fallos || E'- el horario cancelado no volvió a estar libre\n'; end if;

  -- Cierre: no antes de empezar; solo el comercio
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform turno_cerrar(t2, 'completado'); fallos := fallos || E'- cerró un turno que todavía no empezó\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  update turnos set inicio = now() - interval '2 hours', fin = now() - interval '90 minutes' where id = t2;
  perform set_config('request.jwt.claims', json_build_object('sub', cli2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform turno_cerrar(t2, 'completado'); fallos := fallos || E'- la persona se cerró su propio turno\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform turno_cerrar(t2, 'completado');
  begin perform turno_cerrar(t2, 'ausente'); fallos := fallos || E'- cerró dos veces\n'; exception when others then null; end;

  -- Privacidad
  perform set_config('request.jwt.claims', json_build_object('sub', cli2, 'role', 'authenticated')::text, true);
  if jsonb_array_length(mis_turnos()) <> 1 then fallos := fallos || E'- mis_turnos de Cli2 debería traer solo el suyo\n'; end if;
  begin perform 1 from turnos limit 1; fallos := fallos || E'- un usuario lee la tabla de turnos\n'; exception when others then null; end;
  begin insert into servicios (comercio_id, nombre, duracion_min) values (loc, 'Hack', 30); fallos := fallos || E'- una persona cualquiera creó un servicio en un local ajeno\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'PRUEBAS DE SERVICIOS Y TURNOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE SERVICIOS Y TURNOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
