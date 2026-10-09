-- Prueba de reservas pro: disponibilidad real, doble reserva, preparación/limpieza, grupales, recursos, confirmación manual,
-- cierres, reprogramación, turnos del panel, lista de espera, permisos entre locales y métricas. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', jsonb_build_object('full_name', nombre)
from (values ('44444444-dddd-4ddd-8ddd-000000000001'::uuid, 'qa-tur-c1@example.com', 'Clara Uno'),
             ('44444444-dddd-4ddd-8ddd-000000000002'::uuid, 'qa-tur-c2@example.com', 'Carlos Dos'),
             ('44444444-dddd-4ddd-8ddd-000000000003'::uuid, 'qa-tur-c3@example.com', 'Cecilia Tres'),
             ('44444444-dddd-4ddd-8ddd-000000000004'::uuid, 'qa-tur-c4@example.com', 'Ciro Cuatro'),
             ('44444444-dddd-4ddd-8ddd-000000000005'::uuid, 'qa-tur-dueno@example.com', 'Dora Dueña'),
             ('44444444-dddd-4ddd-8ddd-000000000006'::uuid, 'qa-tur-intruso@example.com', 'Iván Intruso')) as u(id, email, nombre);
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo)
values ('44444444-dddd-4ddd-8ddd-0000000000c1', 'QA Estudio Turnos', 'qa-estudio-turnos', 'comida', 'Lincoln', '44444444-dddd-4ddd-8ddd-000000000005', true, true);
insert into recursos (id, comercio_id, nombre) values ('44444444-dddd-4ddd-8ddd-0000000000a1', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Sala 1');
insert into servicios (id, comercio_id, nombre, duracion_min, precio, anticipacion_horas, cancelar_hasta_horas, buffer_despues_min, capacidad, requiere_confirmacion, recurso_id) values
  ('44444444-dddd-4ddd-8ddd-0000000000b1', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Corte', 60, 1000, 1, 2, 15, 1, false, null),
  ('44444444-dddd-4ddd-8ddd-0000000000b2', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Yoga grupal', 60, 500, 1, 2, 0, 3, false, null),
  ('44444444-dddd-4ddd-8ddd-0000000000b3', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Masaje', 30, 2000, 1, 2, 0, 1, false, '44444444-dddd-4ddd-8ddd-0000000000a1'),
  ('44444444-dddd-4ddd-8ddd-0000000000b4', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Consulta', 30, 0, 1, 2, 0, 1, true, null);
insert into profesionales (id, comercio_id, nombre) values
  ('44444444-dddd-4ddd-8ddd-0000000000d1', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Pablo'),
  ('44444444-dddd-4ddd-8ddd-0000000000d2', '44444444-dddd-4ddd-8ddd-0000000000c1', 'Paula');
insert into profesional_servicios (profesional_id, servicio_id)
select p, s from unnest(array['44444444-dddd-4ddd-8ddd-0000000000d1'::uuid]) p, unnest(array['44444444-dddd-4ddd-8ddd-0000000000b1'::uuid, '44444444-dddd-4ddd-8ddd-0000000000b2', '44444444-dddd-4ddd-8ddd-0000000000b3', '44444444-dddd-4ddd-8ddd-0000000000b4']) s
union all select '44444444-dddd-4ddd-8ddd-0000000000d2', '44444444-dddd-4ddd-8ddd-0000000000b3';
insert into disponibilidad (profesional_id, dia_semana, desde, hasta)
select p, d, '09:00', '19:00' from unnest(array['44444444-dddd-4ddd-8ddd-0000000000d1'::uuid, '44444444-dddd-4ddd-8ddd-0000000000d2']) p, generate_series(0, 6) d;

create or replace function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
-- Hora local de Argentina, dentro de 3 días.
create or replace function pg_temp.h(hhmm text, dias int default 3) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Argentina/Buenos_Aires')::date + dias)::text || ' ' || hhmm)::timestamp at time zone 'America/Argentina/Buenos_Aires';
$$;

do $$
declare
  c1 uuid := '44444444-dddd-4ddd-8ddd-000000000001'; c2 uuid := '44444444-dddd-4ddd-8ddd-000000000002'; c3 uuid := '44444444-dddd-4ddd-8ddd-000000000003';
  c4 uuid := '44444444-dddd-4ddd-8ddd-000000000004'; d uuid := '44444444-dddd-4ddd-8ddd-000000000005'; x uuid := '44444444-dddd-4ddd-8ddd-000000000006';
  loc uuid := '44444444-dddd-4ddd-8ddd-0000000000c1'; corte uuid := '44444444-dddd-4ddd-8ddd-0000000000b1'; yoga uuid := '44444444-dddd-4ddd-8ddd-0000000000b2';
  masaje uuid := '44444444-dddd-4ddd-8ddd-0000000000b3'; consulta uuid := '44444444-dddd-4ddd-8ddd-0000000000b4';
  pablo uuid := '44444444-dddd-4ddd-8ddd-0000000000d1'; paula uuid := '44444444-dddd-4ddd-8ddd-0000000000d2';
  t1 uuid; t2 uuid; tp uuid; tw uuid; v jsonb; n int; txt text;
begin
  -- 1. Reserva normal.
  perform pg_temp.como(c1); set local role authenticated;
  t1 := turno_reservar(corte, pg_temp.h('10:00'), pablo);
  reset role;
  insert into t_res values ('reserva online confirmada', (select estado = 'confirmado' from turnos where id = t1), null);
  insert into t_res values ('ocupación incluye la limpieza', (select ocupa_hasta = fin + interval '15 minutes' from turnos where id = t1), null);
  insert into t_res values ('CRM: la reserva creó el contacto', (select contacto_id is not null from turnos where id = t1), null);

  -- 2. Doble reserva del mismo horario.
  perform pg_temp.como(c2); set local role authenticated;
  begin perform turno_reservar(corte, pg_temp.h('10:00'), pablo); insert into t_res values ('no hay doble reserva', false, 'sin error');
  exception when others then insert into t_res values ('no hay doble reserva', true, sqlerrm); end;
  -- 3. La limpieza bloquea el turno siguiente pegado; 15 min después sí entra.
  begin perform turno_reservar(corte, pg_temp.h('11:00'), pablo); insert into t_res values ('limpieza respeta el hueco', false, 'sin error');
  exception when others then insert into t_res values ('limpieza respeta el hueco', true, sqlerrm); end;
  t2 := turno_reservar(corte, pg_temp.h('11:15'), pablo);
  insert into t_res values ('después de la limpieza se puede reservar', t2 is not null, null);
  -- 4. Los horarios libres no ofrecen lo ocupado.
  v := servicio_horarios_libres(corte, pablo, ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 3), 1);
  insert into t_res values ('horarios libres excluyen ocupados',
    not exists (select 1 from jsonb_array_elements(v->0->'horarios') h where (h->>'inicio')::timestamptz in (pg_temp.h('10:00'), pg_temp.h('10:30'), pg_temp.h('11:00')))
    and exists (select 1 from jsonb_array_elements(v->0->'horarios') h where (h->>'inicio')::timestamptz = pg_temp.h('12:30')), jsonb_array_length(v->0->'horarios')::text);
  reset role;

  -- 5. Aun saltando las funciones, la base rechaza la superposición.
  begin
    insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin) values (loc, corte, pablo, c4, pg_temp.h('10:30'), pg_temp.h('11:30'));
    insert into t_res values ('restricción de la base impide superposición', false, 'sin error');
  exception when exclusion_violation then insert into t_res values ('restricción de la base impide superposición', true, sqlerrm); end;

  -- 6. Grupal con cupo 3.
  perform pg_temp.como(c3); set local role authenticated; perform turno_reservar(yoga, pg_temp.h('15:00'), pablo, null, null, 2); reset role;
  perform pg_temp.como(c4); set local role authenticated; perform turno_reservar(yoga, pg_temp.h('15:00'), pablo); reset role;
  insert into t_res values ('grupal: entran 3 personas', (select sum(personas) from turnos where servicio_id = yoga) = 3, null);
  perform pg_temp.como(x); set local role authenticated;
  begin perform turno_reservar(yoga, pg_temp.h('15:00'), pablo); insert into t_res values ('grupal: sin lugar no entra', false, 'sin error');
  exception when others then insert into t_res values ('grupal: sin lugar no entra', true, sqlerrm); end;
  reset role;

  -- 7. Recurso compartido: dos profesionales no usan la misma sala a la vez.
  perform pg_temp.como(c1); set local role authenticated; perform turno_reservar(masaje, pg_temp.h('17:00'), pablo); reset role;
  perform pg_temp.como(c2); set local role authenticated;
  begin perform turno_reservar(masaje, pg_temp.h('17:00'), paula); insert into t_res values ('sala ocupada no se reserva', false, 'sin error');
  exception when others then insert into t_res values ('sala ocupada no se reserva', true, sqlerrm); end;
  reset role;

  -- 8. Confirmación manual.
  perform pg_temp.como(c3); set local role authenticated; tp := turno_reservar(consulta, pg_temp.h('09:00', 4), pablo); reset role;
  insert into t_res values ('servicio con confirmación nace pendiente', (select estado = 'pendiente' from turnos where id = tp), null);
  perform pg_temp.como(x); set local role authenticated;
  begin perform turno_cambiar_estado(tp, 'confirmado'); insert into t_res values ('otro no confirma turnos ajenos', false, 'sin error');
  exception when others then insert into t_res values ('otro no confirma turnos ajenos', true, sqlerrm); end;
  begin perform delivery_turnos_agenda(loc, current_date, current_date + 7); insert into t_res values ('otro no ve la agenda', false, 'sin error');
  exception when others then insert into t_res values ('otro no ve la agenda', true, sqlerrm); end;
  begin perform turno_crear_panel(corte, pablo, pg_temp.h('13:00'), null, 'Falso'); insert into t_res values ('otro no carga turnos', false, 'sin error');
  exception when others then insert into t_res values ('otro no carga turnos', true, sqlerrm); end;
  begin perform agenda_lista_espera(loc); insert into t_res values ('otro no ve la lista de espera', false, 'sin error');
  exception when others then insert into t_res values ('otro no ve la lista de espera', true, sqlerrm); end;
  reset role;
  perform pg_temp.como(d); set local role authenticated; perform turno_cambiar_estado(tp, 'confirmado'); reset role;
  insert into t_res values ('el local confirma y avisa', (select estado = 'confirmado' from turnos where id = tp) and exists (select 1 from notificaciones where usuario_id = c3 and tipo = 'TURNO_CONFIRMADO'), null);

  -- 9. Cierre del local.
  insert into agenda_cierres (comercio_id, desde, hasta, motivo) values (loc, (now() at time zone 'America/Argentina/Buenos_Aires')::date + 5, (now() at time zone 'America/Argentina/Buenos_Aires')::date + 5, 'Feriado');
  perform pg_temp.como(c4); set local role authenticated;
  v := servicio_horarios_libres(corte, null, ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 5), 1);
  insert into t_res values ('día cerrado sin horarios', jsonb_array_length(v) = 0, v::text);
  begin perform turno_reservar(corte, pg_temp.h('10:00', 5)); insert into t_res values ('día cerrado no se reserva', false, 'sin error');
  exception when others then insert into t_res values ('día cerrado no se reserva', true, sqlerrm); end;
  reset role;

  -- 10. Reprogramación por el cliente, con historial y aviso al local.
  perform pg_temp.como(c1); set local role authenticated; perform turno_reprogramar(t1, pg_temp.h('13:00')); reset role;
  insert into t_res values ('cliente reprograma', (select inicio = pg_temp.h('13:00') and reprogramaciones = 1 from turnos where id = t1), null);
  insert into t_res values ('historial registra el cambio', exists (select 1 from turno_eventos where turno_id = t1 and evento = 'reprogramado'), null);
  perform pg_temp.como(c2); set local role authenticated;
  begin perform turno_reprogramar(t1, pg_temp.h('14:00')); insert into t_res values ('otro cliente no reprograma', false, 'sin error');
  exception when others then insert into t_res values ('otro cliente no reprograma', true, sqlerrm); end;
  -- Lista de espera para ese día.
  perform turno_espera_unirse(corte, (now() at time zone 'America/Argentina/Buenos_Aires')::date + 3);
  reset role;

  -- 11. Turno desde el panel para alguien sin cuenta, en el horario que se liberó.
  perform pg_temp.como(d); set local role authenticated;
  insert into t_res values ('el local ve la lista de espera', jsonb_array_length(agenda_lista_espera(loc)) = 1, null);
  tw := turno_crear_panel(corte, pablo, pg_temp.h('10:00'), null, 'Marta Mostrador', '2355 456789', null, 1, 'Prefiere tijera');
  insert into t_res values ('turno del panel sin cuenta', tw is not null, null);
  v := turno_cliente_ficha(tw);
  insert into t_res values ('ficha del cliente', v->>'nombre' = 'Marta Mostrador' and (v->>'total')::int = 1 and (v->>'contacto_id') is not null, v::text);
  -- 12. El local cancela: se avisa a la lista de espera.
  perform turno_cancelar(tw, 'Se enfermó');
  -- 12b. Turno del panel para un contacto del CRM (sin cuenta): queda en la misma ficha.
  tp := turno_crear_panel(corte, pablo, pg_temp.h('16:00', 6), null, null, null, null, 1, null, (v->>'contacto_id')::uuid);
  reset role;
  insert into t_res values ('turno para un contacto del CRM', (select contacto_id::text = v->>'contacto_id' and cliente_nombre = 'Marta Mostrador' from turnos where id = tp), null);
  insert into t_res values ('lista de espera avisada', exists (select 1 from turnos_espera where cliente_id = c2 and avisado_at is not null)
    and exists (select 1 from notificaciones where usuario_id = c2 and tipo = 'TURNO_LIBERADO'), null);

  -- 13. Acciones masivas y métricas.
  perform pg_temp.como(d); set local role authenticated;
  v := turno_masivo(array[t1, t2], 'cancelar', 'Cierre imprevisto');
  insert into t_res values ('acción masiva', (v->>'aplicados')::int = 2, v::text);
  v := turnos_metricas(loc, (now() at time zone 'America/Argentina/Buenos_Aires')::date, (now() at time zone 'America/Argentina/Buenos_Aires')::date + 7);
  insert into t_res values ('métricas', (v->>'total')::int >= 6 and (v->>'minutos_disponibles')::numeric > 0 and jsonb_array_length(v->'por_servicio') >= 3, v->>'total');
  reset role;
  perform pg_temp.como(x); set local role authenticated;
  begin perform turnos_metricas(loc, current_date, current_date + 7); insert into t_res values ('otro no ve métricas', false, 'sin error');
  exception when others then insert into t_res values ('otro no ve métricas', true, sqlerrm); end;
  reset role;
end $$;

select * from t_res;
rollback;
