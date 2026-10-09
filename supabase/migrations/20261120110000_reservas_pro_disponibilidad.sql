-- RESERVAS PRO (2/4): ajustes de agenda, regla única de disponibilidad y reservas (online y desde el panel).
--  * agenda_ajustes: recordatorios 24 h / 2 h, si el cliente puede reprogramar (y cuántas veces) y si hay lista de espera.
--  * turno_disponible(): ÚNICA regla para listar y para reservar. Devuelve null si el horario se puede tomar, o el motivo.
--    Respeta agenda semanal, cierres del local, bloqueos del profesional, preparación/limpieza, cupo de grupales,
--    recurso ocupado, anticipación mínima y máxima (salvo en el panel, que solo exige que no haya pasado).
--  * Todas las escrituras toman un candado por profesional (y por recurso) antes de verificar: dos reservas simultáneas
--    del mismo horario no pueden pasar las dos. Para turnos individuales además lo garantiza la exclusión de la tabla.
-- Revertir: drop function turno_disponible, turno_crear_panel, turno_bloquear_agenda; restaurar turno_reservar(uuid,timestamptz,uuid,text,text),
--   turno_slot_libre y servicio_horarios_libres de 20261113100000; drop table agenda_ajustes.

create table if not exists public.agenda_ajustes (
  comercio_id uuid primary key references public.delivery_comercios (id) on delete cascade,
  recordatorio_24h boolean not null default true,
  recordatorio_2h boolean not null default true,
  cliente_reprograma boolean not null default true,
  max_reprogramaciones integer not null default 2 check (max_reprogramaciones between 0 and 10),
  lista_espera boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.agenda_ajustes enable row level security;
revoke all on public.agenda_ajustes from anon, authenticated;
grant select on public.agenda_ajustes to anon, authenticated;
grant insert, update on public.agenda_ajustes to authenticated;
grant all on public.agenda_ajustes to service_role;
drop policy if exists "Ajustes de agenda visibles" on public.agenda_ajustes;
create policy "Ajustes de agenda visibles" on public.agenda_ajustes for select to anon, authenticated using (true);
drop policy if exists "Ajustes de agenda administrados" on public.agenda_ajustes;
create policy "Ajustes de agenda administrados" on public.agenda_ajustes for all to authenticated
  using (public.delivery_permiso(comercio_id, 'ajustes')) with check (public.delivery_permiso(comercio_id, 'ajustes'));

create or replace function public.agenda_ajuste(p_comercio uuid) returns public.agenda_ajustes
language sql stable security definer set search_path = public as $$
  select coalesce((select a from public.agenda_ajustes a where a.comercio_id = p_comercio), row(p_comercio, true, true, true, 2, true, now())::public.agenda_ajustes)
$$;
revoke all on function public.agenda_ajuste(uuid) from public, anon, authenticated;

create or replace function public.turno_disponible(p_servicio uuid, p_profesional uuid, p_inicio timestamptz, p_personas integer default 1, p_excluir uuid default null, p_panel boolean default false) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  s public.servicios; tz constant text := 'America/Argentina/Buenos_Aires';
  v_fin timestamptz; v_desde timestamptz; v_hasta timestamptz; v_local timestamp; v_fin_local timestamp; v_ocupados integer;
begin
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then return 'Ese servicio no está disponible'; end if;
  if not exists (select 1 from public.delivery_comercios c where c.id = s.comercio_id and c.activo and (c.aprobado or p_panel)) then return 'El local no está tomando turnos'; end if;
  if not exists (select 1 from public.profesionales p join public.profesional_servicios ps on ps.profesional_id = p.id
                  where p.id = p_profesional and p.activo and p.comercio_id = s.comercio_id and ps.servicio_id = s.id) then return 'Ese profesional no hace este servicio'; end if;
  if coalesce(p_personas, 1) < 1 then return 'Cantidad de personas inválida'; end if;
  if s.capacidad = 1 and p_personas > 1 then return 'Este servicio es individual'; end if;
  if p_personas > s.capacidad then return format('Este servicio admite hasta %s personas por horario', s.capacidad); end if;

  if p_panel then
    if p_inicio < now() - interval '5 minutes' then return 'Ese horario ya pasó'; end if;
    if p_inicio > now() + interval '366 days' then return 'Elegí una fecha dentro del próximo año'; end if;
  else
    if p_inicio < now() + make_interval(hours => s.anticipacion_horas) then return format('Se reserva con al menos %s h de anticipación', s.anticipacion_horas); end if;
    if p_inicio > now() + make_interval(days => s.reserva_max_dias) then return format('Se puede reservar hasta %s días antes', s.reserva_max_dias); end if;
  end if;

  v_fin := p_inicio + make_interval(mins => s.duracion_min);
  v_desde := p_inicio - make_interval(mins => s.buffer_antes_min);
  v_hasta := v_fin + make_interval(mins => s.buffer_despues_min);
  v_local := p_inicio at time zone tz; v_fin_local := v_fin at time zone tz;
  if v_local::date <> v_fin_local::date then return 'El turno tiene que terminar el mismo día'; end if;
  if not exists (select 1 from public.disponibilidad d where d.profesional_id = p_profesional and d.dia_semana = extract(dow from v_local)::int
                  and d.desde <= v_local::time and d.hasta >= v_fin_local::time) then return 'Fuera del horario de atención'; end if;
  if exists (select 1 from public.agenda_cierres ci where ci.comercio_id = s.comercio_id and v_local::date between ci.desde and ci.hasta) then return 'El local está cerrado ese día'; end if;
  if exists (select 1 from public.bloqueos b where b.profesional_id = p_profesional and tstzrange(b.desde, b.hasta) && tstzrange(v_desde, v_hasta)) then return 'El profesional no atiende en ese horario'; end if;

  -- Otro turno del profesional que se pisa (salvo los del mismo grupo: mismo servicio grupal a la misma hora).
  if exists (select 1 from public.turnos t where t.profesional_id = p_profesional and t.estado in ('pendiente', 'confirmado', 'en_curso')
              and t.id is distinct from p_excluir and tstzrange(t.ocupa_desde, t.ocupa_hasta) && tstzrange(v_desde, v_hasta)
              and not (s.capacidad > 1 and t.servicio_id = s.id and t.inicio = p_inicio)) then return 'Ese horario ya está ocupado'; end if;
  if s.capacidad > 1 then
    select coalesce(sum(t.personas), 0) into v_ocupados from public.turnos t
     where t.profesional_id = p_profesional and t.servicio_id = s.id and t.inicio = p_inicio and t.estado in ('pendiente', 'confirmado', 'en_curso') and t.id is distinct from p_excluir;
    if v_ocupados + p_personas > s.capacidad then return case when v_ocupados >= s.capacidad then 'No quedan lugares en ese horario' else format('Quedan %s lugares en ese horario', s.capacidad - v_ocupados) end; end if;
  end if;
  if s.recurso_id is not null and exists (
       select 1 from public.turnos t where t.recurso_id = s.recurso_id and t.estado in ('pendiente', 'confirmado', 'en_curso') and t.id is distinct from p_excluir
          and tstzrange(t.ocupa_desde, t.ocupa_hasta) && tstzrange(v_desde, v_hasta) and not (s.capacidad > 1 and t.servicio_id = s.id and t.inicio = p_inicio)) then
    return 'La sala o recurso ya está ocupado en ese horario';
  end if;
  return null;
end $$;

-- Compatibilidad: la función anterior sigue existiendo y usa la regla nueva.
create or replace function public.turno_slot_libre(p_servicio uuid, p_profesional uuid, p_inicio timestamptz) returns boolean
language sql stable security definer set search_path = public as $$ select public.turno_disponible(p_servicio, p_profesional, p_inicio) is null $$;

-- Candado de agenda: serializa las escrituras sobre un mismo profesional y recurso (siempre en este orden: profesional, recurso).
create or replace function public.turno_candado(p_profesional uuid, p_servicio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rec uuid;
begin
  perform pg_advisory_xact_lock(hashtext('agenda:' || p_profesional::text));
  select recurso_id into v_rec from public.servicios where id = p_servicio;
  if v_rec is not null then perform pg_advisory_xact_lock(hashtext('recurso:' || v_rec::text)); end if;
end $$;

-- Horarios libres de un servicio, de uno o de todos los profesionales. Público. En grupales informa los lugares que quedan.
create or replace function public.servicio_horarios_libres(p_servicio uuid, p_profesional uuid default null, p_desde date default null, p_dias integer default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.servicios; tz constant text := 'America/Argentina/Buenos_Aires'; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; v_desde date; v_hasta date;
begin
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then return '[]'::jsonb; end if;
  v_desde := greatest(coalesce(p_desde, v_hoy), v_hoy);
  v_hasta := least(v_desde + least(greatest(coalesce(p_dias, 14), 1), 31), v_hoy + s.reserva_max_dias + 1);
  if v_hasta <= v_desde then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('fecha', d, 'horarios', hs) order by d) from (
      select (x.local_ts)::date as d,
             jsonb_agg(jsonb_build_object('inicio', x.ts, 'profesional_id', x.pid,
               'lugares', case when s.capacidad > 1 then s.capacidad - coalesce((select sum(t.personas) from public.turnos t where t.profesional_id = x.pid and t.servicio_id = s.id and t.inicio = x.ts and t.estado in ('pendiente', 'confirmado', 'en_curso')), 0) end)
               order by x.ts, x.pid) as hs
        from (
          select p.id as pid, g.local_ts, (g.local_ts at time zone tz) as ts
            from public.profesionales p
            join public.profesional_servicios ps on ps.profesional_id = p.id and ps.servicio_id = s.id
            join lateral generate_series(v_desde::timestamp, (v_hasta - 1)::timestamp, interval '1 day') dias(dia) on true
            join public.disponibilidad dsp on dsp.profesional_id = p.id and dsp.dia_semana = extract(dow from dias.dia)::int
            join lateral generate_series(dias.dia + dsp.desde, dias.dia + dsp.hasta - make_interval(mins => s.duracion_min), make_interval(mins => s.intervalo_min)) g(local_ts) on true
           where p.activo and p.comercio_id = s.comercio_id and (p_profesional is null or p.id = p_profesional)
             and not exists (select 1 from public.agenda_cierres ci where ci.comercio_id = s.comercio_id and dias.dia::date between ci.desde and ci.hasta)
        ) x
       where public.turno_disponible(s.id, x.pid, x.ts) is null
       group by 1) q), '[]'::jsonb);
end $$;

-- Reservar online. Sin profesional elegido se asigna uno libre (el que tenga menos turnos ese día).
drop function if exists public.turno_reservar(uuid, timestamptz, uuid, text, text);
create or replace function public.turno_reservar(p_servicio uuid, p_inicio timestamptz, p_profesional uuid default null, p_telefono text default null, p_notas text default null, p_personas integer default 1) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios; v_prof uuid; v_cand uuid; v_id uuid; v_motivo text; v_personas integer := coalesce(p_personas, 1);
  v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g'), ''); v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  if auth.uid() is null then raise exception 'Ingresá para reservar tu turno'; end if;
  if exists (select 1 from public.delivery_clientes_control where perfil_id = auth.uid() and bloqueado) then raise exception 'Tu cuenta está bloqueada. Escribinos desde Ayuda'; end if;
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then raise exception 'Ese servicio no está disponible'; end if;
  if nullif(btrim(coalesce(p_telefono, '')), '') is not null and char_length(regexp_replace(coalesce(v_tel, ''), '\D', '', 'g')) < 8 then raise exception 'El teléfono no es válido'; end if;
  if char_length(coalesce(v_notas, '')) > 300 then raise exception 'La nota es demasiado larga (máximo 300 caracteres)'; end if;
  if (select count(*) from public.turnos where cliente_id = auth.uid() and comercio_id = s.comercio_id and estado in ('pendiente', 'confirmado') and inicio > now()) >= 3 then raise exception 'Ya tenés 3 turnos próximos en este local'; end if;
  if (select count(*) from public.turnos where cliente_id = auth.uid() and estado in ('pendiente', 'confirmado') and inicio > now()) >= 10 then raise exception 'Ya tenés muchos turnos próximos. Cancelá alguno para reservar otro'; end if;

  for v_cand in
    select p.id from public.profesionales p join public.profesional_servicios ps on ps.profesional_id = p.id and ps.servicio_id = s.id
     where p.activo and p.comercio_id = s.comercio_id and (p_profesional is null or p.id = p_profesional)
     order by (select count(*) from public.turnos t where t.profesional_id = p.id and t.estado in ('pendiente', 'confirmado') and (t.inicio at time zone 'America/Argentina/Buenos_Aires')::date = (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date), p.id
  loop
    perform public.turno_candado(v_cand, s.id);
    v_motivo := public.turno_disponible(s.id, v_cand, p_inicio, v_personas);
    if v_motivo is null then v_prof := v_cand; exit; end if;
  end loop;
  if v_prof is null then raise exception '%', coalesce(case when p_profesional is not null then v_motivo end, 'Ese horario ya no está disponible. Elegí otro'); end if;

  begin
    insert into public.turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, precio, telefono, notas, personas, estado, confirmado_at, origen, creado_por)
      values (s.comercio_id, s.id, v_prof, auth.uid(), p_inicio, p_inicio + make_interval(mins => s.duracion_min), s.precio * v_personas, v_tel, v_notas, v_personas,
              case when s.requiere_confirmacion then 'pendiente' else 'confirmado' end, case when s.requiere_confirmacion then null else now() end, 'online', auth.uid())
      returning id into v_id;
  exception when exclusion_violation then raise exception 'Ese horario ya fue tomado, o ya tenés otro turno a esa hora';
  end;
  delete from public.turnos_espera where cliente_id = auth.uid() and servicio_id = s.id and fecha = (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date;
  return v_id;
end $$;

-- Turno cargado por el local (teléfono, mostrador, WhatsApp). Puede ser de un cliente con cuenta que ya tiene relación con el
-- local (pedidos o turnos previos) o de alguien sin cuenta (nombre + teléfono). Nace confirmado.
create or replace function public.turno_crear_panel(p_servicio uuid, p_profesional uuid, p_inicio timestamptz, p_cliente uuid default null, p_cliente_nombre text default null,
  p_telefono text default null, p_notas text default null, p_personas integer default 1, p_nota_interna text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios; v_id uuid; v_motivo text; v_personas integer := coalesce(p_personas, 1);
  v_nombre text := nullif(btrim(coalesce(p_cliente_nombre, '')), ''); v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g'), '');
begin
  select * into s from public.servicios where id = p_servicio;
  if not found or not public.delivery_permiso(s.comercio_id, 'pedidos') then raise exception 'Servicio no encontrado'; end if;
  if p_cliente is null and v_nombre is null then raise exception 'Indicá el nombre de la persona'; end if;
  if v_nombre is not null and char_length(v_nombre) not between 2 and 80 then raise exception 'El nombre tiene que tener entre 2 y 80 letras'; end if;
  if v_tel is not null and char_length(regexp_replace(v_tel, '\D', '', 'g')) < 8 then raise exception 'El teléfono no es válido'; end if;
  if char_length(coalesce(p_notas, '')) > 300 or char_length(coalesce(p_nota_interna, '')) > 1000 then raise exception 'La nota es demasiado larga'; end if;
  if p_cliente is not null and not exists (select 1 from public.delivery_pedidos where comercio_id = s.comercio_id and cliente_id = p_cliente)
     and not exists (select 1 from public.turnos where comercio_id = s.comercio_id and cliente_id = p_cliente) then
    raise exception 'Esa persona todavía no es cliente del local. Cargala con nombre y teléfono';
  end if;
  perform public.turno_candado(p_profesional, s.id);
  v_motivo := public.turno_disponible(s.id, p_profesional, p_inicio, v_personas, null, true);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  begin
    insert into public.turnos (comercio_id, servicio_id, profesional_id, cliente_id, cliente_nombre, inicio, fin, precio, telefono, notas, nota_interna, personas, estado, confirmado_at, origen, creado_por)
      values (s.comercio_id, s.id, p_profesional, p_cliente, v_nombre, p_inicio, p_inicio + make_interval(mins => s.duracion_min), s.precio * v_personas, v_tel,
              nullif(btrim(coalesce(p_notas, '')), ''), nullif(btrim(coalesce(p_nota_interna, '')), ''), v_personas, 'confirmado', now(), 'panel', auth.uid())
      returning id into v_id;
  exception when exclusion_violation then raise exception 'Ese horario ya fue tomado, o esa persona ya tiene otro turno a esa hora';
  end;
  return v_id;
end $$;

revoke all on function public.turno_disponible(uuid, uuid, timestamptz, integer, uuid, boolean), public.turno_candado(uuid, uuid), public.turno_slot_libre(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.servicio_horarios_libres(uuid, uuid, date, integer) from public;
grant execute on function public.servicio_horarios_libres(uuid, uuid, date, integer) to anon, authenticated;
revoke all on function public.turno_reservar(uuid, timestamptz, uuid, text, text, integer), public.turno_crear_panel(uuid, uuid, timestamptz, uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.turno_reservar(uuid, timestamptz, uuid, text, text, integer), public.turno_crear_panel(uuid, uuid, timestamptz, uuid, text, text, text, integer, text) to authenticated;
