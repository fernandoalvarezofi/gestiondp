-- FASE 9 (Servicios): catálogo de servicios, profesionales, agenda semanal, bloqueos y TURNOS con reserva en línea.
-- Usa el Core (cada servicio pertenece a un comercio/negocio y respeta sus permisos) y NO reutiliza las tablas de pedidos.
--  * servicios / profesionales / profesional_servicios / disponibilidad / bloqueos: los administra quien tiene permiso "ajustes" del local (RLS). Lectura pública solo de lo activo.
--  * turnos: sin acceso directo. Se reservan, cancelan y cierran con funciones que validan TODO en el servidor (horario libre, anticipación, límites del cliente).
--    Una restricción de exclusión impide, aun con pedidos simultáneos, que dos turnos se pisen para el mismo profesional (o para la misma persona).
--  * Horario de Argentina (America/Argentina/Buenos_Aires). Cobro: en el lugar (el pago de señas por Mercado Pago queda para cuando se pida, sobre la interfaz de pagos de la Fase 5).
-- Revertir: drop table turnos, bloqueos, disponibilidad, profesional_servicios, profesionales, servicios cascade; drop function servicio_*, turno_*, delivery_turnos_agenda, mis_turnos.

create extension if not exists btree_gist with schema extensions;

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),
  duracion_min integer not null check (duracion_min between 10 and 480 and duracion_min % 5 = 0),
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  modalidad text not null default 'en_local' check (modalidad in ('en_local', 'a_domicilio', 'online')),
  categoria_id uuid references public.categorias (id) on delete set null,
  imagen_url text,
  anticipacion_horas integer not null default 2 check (anticipacion_horas between 0 and 720),
  cancelar_hasta_horas integer not null default 12 check (cancelar_hasta_horas between 0 and 720),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists servicios_comercio_idx on public.servicios (comercio_id, orden) where activo;

create table if not exists public.profesionales (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  bio text check (bio is null or char_length(bio) <= 300),
  avatar_url text,
  usuario_id uuid references auth.users (id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists profesionales_comercio_idx on public.profesionales (comercio_id) where activo;

create table if not exists public.profesional_servicios (
  profesional_id uuid not null references public.profesionales (id) on delete cascade,
  servicio_id uuid not null references public.servicios (id) on delete cascade,
  primary key (profesional_id, servicio_id)
);

-- Agenda semanal (0 = domingo ... 6 = sábado). Varios tramos por día (por ejemplo, mañana y tarde).
create table if not exists public.disponibilidad (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  desde time not null,
  hasta time not null,
  check (desde < hasta)
);
create index if not exists disponibilidad_prof_idx on public.disponibilidad (profesional_id, dia_semana);

create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales (id) on delete cascade,
  desde timestamptz not null,
  hasta timestamptz not null,
  motivo text check (motivo is null or char_length(motivo) <= 120),
  check (desde < hasta)
);
create index if not exists bloqueos_prof_idx on public.bloqueos (profesional_id, desde);

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete restrict,
  servicio_id uuid not null references public.servicios (id) on delete restrict,
  profesional_id uuid not null references public.profesionales (id) on delete restrict,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null,
  estado text not null default 'confirmado' check (estado in ('confirmado', 'completado', 'cancelado', 'ausente')),
  precio numeric(12, 2) not null default 0,
  telefono text,
  notas text check (notas is null or char_length(notas) <= 300),
  cancelado_por text check (cancelado_por in ('cliente', 'comercio')),
  motivo_cancelacion text check (motivo_cancelacion is null or char_length(motivo_cancelacion) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio < fin),
  -- Nadie puede tener dos turnos confirmados a la vez, ni el profesional ni la persona que reserva.
  exclude using gist (profesional_id with =, tstzrange(inicio, fin) with &&) where (estado = 'confirmado'),
  exclude using gist (cliente_id with =, tstzrange(inicio, fin) with &&) where (estado = 'confirmado')
);
create index if not exists turnos_comercio_idx on public.turnos (comercio_id, inicio);
create index if not exists turnos_cliente_idx on public.turnos (cliente_id, inicio desc);

-- Permisos de tablas ---------------------------------------------------------------------------------------------------
alter table public.servicios enable row level security;
alter table public.profesionales enable row level security;
alter table public.profesional_servicios enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.bloqueos enable row level security;
alter table public.turnos enable row level security;

revoke all on public.servicios, public.profesionales, public.profesional_servicios, public.disponibilidad, public.bloqueos, public.turnos from anon, authenticated;
grant select on public.servicios, public.profesionales, public.profesional_servicios to anon, authenticated;
grant insert, update, delete on public.servicios, public.profesionales, public.profesional_servicios, public.disponibilidad, public.bloqueos to authenticated;
grant select on public.disponibilidad, public.bloqueos to authenticated;
grant all on public.servicios, public.profesionales, public.profesional_servicios, public.disponibilidad, public.bloqueos, public.turnos to service_role;

drop policy if exists "Servicios visibles" on public.servicios;
create policy "Servicios visibles" on public.servicios for select to anon, authenticated
  using ((activo and exists (select 1 from public.delivery_comercios c where c.id = comercio_id and c.activo and c.aprobado)) or public.delivery_permiso(comercio_id, 'ajustes'));
drop policy if exists "Servicios administrados" on public.servicios;
create policy "Servicios administrados" on public.servicios for all to authenticated using (public.delivery_permiso(comercio_id, 'ajustes')) with check (public.delivery_permiso(comercio_id, 'ajustes'));

drop policy if exists "Profesionales visibles" on public.profesionales;
create policy "Profesionales visibles" on public.profesionales for select to anon, authenticated
  using ((activo and exists (select 1 from public.delivery_comercios c where c.id = comercio_id and c.activo and c.aprobado)) or public.delivery_permiso(comercio_id, 'ajustes'));
drop policy if exists "Profesionales administrados" on public.profesionales;
create policy "Profesionales administrados" on public.profesionales for all to authenticated using (public.delivery_permiso(comercio_id, 'ajustes')) with check (public.delivery_permiso(comercio_id, 'ajustes'));

drop policy if exists "Servicios de cada profesional visibles" on public.profesional_servicios;
create policy "Servicios de cada profesional visibles" on public.profesional_servicios for select to anon, authenticated using (exists (select 1 from public.profesionales p where p.id = profesional_id));
drop policy if exists "Servicios de cada profesional administrados" on public.profesional_servicios;
create policy "Servicios de cada profesional administrados" on public.profesional_servicios for all to authenticated
  using (exists (select 1 from public.profesionales p where p.id = profesional_id and public.delivery_permiso(p.comercio_id, 'ajustes')))
  with check (exists (select 1 from public.profesionales p join public.servicios s on s.comercio_id = p.comercio_id where p.id = profesional_id and s.id = servicio_id and public.delivery_permiso(p.comercio_id, 'ajustes')));

drop policy if exists "Agenda administrada" on public.disponibilidad;
create policy "Agenda administrada" on public.disponibilidad for all to authenticated
  using (exists (select 1 from public.profesionales p where p.id = profesional_id and public.delivery_permiso(p.comercio_id, 'ajustes')))
  with check (exists (select 1 from public.profesionales p where p.id = profesional_id and public.delivery_permiso(p.comercio_id, 'ajustes')));
drop policy if exists "Bloqueos administrados" on public.bloqueos;
create policy "Bloqueos administrados" on public.bloqueos for all to authenticated
  using (exists (select 1 from public.profesionales p where p.id = profesional_id and public.delivery_permiso(p.comercio_id, 'ajustes')))
  with check (exists (select 1 from public.profesionales p where p.id = profesional_id and public.delivery_permiso(p.comercio_id, 'ajustes')));

-- Un servicio y un profesional solo pueden pertenecer a un mismo comercio (no se puede mezclar entre locales).
create or replace function public.profesional_servicios_mismo_comercio() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select comercio_id from public.profesionales where id = new.profesional_id) is distinct from (select comercio_id from public.servicios where id = new.servicio_id) then
    raise exception 'El profesional y el servicio tienen que ser del mismo local';
  end if;
  return new;
end $$;
drop trigger if exists profesional_servicios_mismo_comercio on public.profesional_servicios;
create trigger profesional_servicios_mismo_comercio before insert or update on public.profesional_servicios for each row execute function public.profesional_servicios_mismo_comercio();

-- ¿Se puede tomar ESTE horario? Única regla para listar y para reservar.
create or replace function public.turno_slot_libre(p_servicio uuid, p_profesional uuid, p_inicio timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s public.servicios; v_local timestamp; v_fin timestamptz; v_fin_local timestamp; tz constant text := 'America/Argentina/Buenos_Aires';
begin
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then return false; end if;
  if not exists (select 1 from public.profesionales p join public.profesional_servicios ps on ps.profesional_id = p.id
                  where p.id = p_profesional and p.activo and p.comercio_id = s.comercio_id and ps.servicio_id = s.id) then return false; end if;
  if not exists (select 1 from public.delivery_comercios c where c.id = s.comercio_id and c.activo and c.aprobado) then return false; end if;
  if p_inicio < now() + make_interval(hours => s.anticipacion_horas) or p_inicio > now() + interval '60 days' then return false; end if;
  v_fin := p_inicio + make_interval(mins => s.duracion_min);
  v_local := p_inicio at time zone tz; v_fin_local := v_fin at time zone tz;
  if v_local::date <> v_fin_local::date then return false; end if;
  if not exists (select 1 from public.disponibilidad d where d.profesional_id = p_profesional and d.dia_semana = extract(dow from v_local)::int
                  and d.desde <= v_local::time and d.hasta >= v_fin_local::time) then return false; end if;
  if exists (select 1 from public.bloqueos b where b.profesional_id = p_profesional and tstzrange(b.desde, b.hasta) && tstzrange(p_inicio, v_fin)) then return false; end if;
  if exists (select 1 from public.turnos t where t.profesional_id = p_profesional and t.estado = 'confirmado' and tstzrange(t.inicio, t.fin) && tstzrange(p_inicio, v_fin)) then return false; end if;
  return true;
end $$;

-- Horarios libres de un servicio (por día), de uno o de todos los profesionales. Público.
create or replace function public.servicio_horarios_libres(p_servicio uuid, p_profesional uuid default null, p_desde date default null, p_dias integer default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.servicios; tz constant text := 'America/Argentina/Buenos_Aires'; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; v_desde date; v_hasta date;
begin
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then return '[]'::jsonb; end if;
  v_desde := greatest(coalesce(p_desde, v_hoy), v_hoy);
  v_hasta := least(v_desde + least(greatest(coalesce(p_dias, 14), 1), 31), v_hoy + 60);
  return coalesce((
    select jsonb_agg(jsonb_build_object('fecha', d, 'horarios', hs) order by d) from (
      select (x.local_ts)::date as d,
             jsonb_agg(jsonb_build_object('inicio', x.ts, 'profesional_id', x.pid) order by x.ts, x.pid) as hs
        from (
          select p.id as pid, g.local_ts, (g.local_ts at time zone tz) as ts
            from public.profesionales p
            join public.profesional_servicios ps on ps.profesional_id = p.id and ps.servicio_id = s.id
            join lateral generate_series(v_desde::timestamp, (v_hasta - 1)::timestamp, interval '1 day') dias(dia) on true
            join public.disponibilidad dsp on dsp.profesional_id = p.id and dsp.dia_semana = extract(dow from dias.dia)::int
            join lateral generate_series(dias.dia + dsp.desde, dias.dia + dsp.hasta - make_interval(mins => s.duracion_min), interval '15 minutes') g(local_ts) on true
           where p.activo and p.comercio_id = s.comercio_id and (p_profesional is null or p.id = p_profesional)
        ) x
       where public.turno_slot_libre(s.id, x.pid, x.ts)
       group by 1) q), '[]'::jsonb);
end $$;

-- Reservar. Si no se indica profesional, se elige uno libre a esa hora (el que tenga menos turnos ese día).
create or replace function public.turno_reservar(p_servicio uuid, p_inicio timestamptz, p_profesional uuid default null, p_telefono text default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.servicios; v_prof uuid := p_profesional; v_id uuid; v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g'), ''); v_notas text := nullif(trim(coalesce(p_notas, '')), '');
begin
  if auth.uid() is null then raise exception 'Ingresá para reservar tu turno'; end if;
  if exists (select 1 from public.delivery_clientes_control where perfil_id = auth.uid() and bloqueado) then raise exception 'Tu cuenta está bloqueada. Escribinos desde Ayuda'; end if;
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then raise exception 'Ese servicio no está disponible'; end if;
  if nullif(trim(coalesce(p_telefono, '')), '') is not null and char_length(regexp_replace(coalesce(v_tel, ''), '\D', '', 'g')) < 8 then raise exception 'El teléfono no es válido'; end if;
  if char_length(coalesce(v_notas, '')) > 300 then raise exception 'La nota es demasiado larga (máximo 300 caracteres)'; end if;
  -- Límites por persona: hasta 3 turnos próximos en el mismo local y 10 en total.
  if (select count(*) from public.turnos where cliente_id = auth.uid() and comercio_id = s.comercio_id and estado = 'confirmado' and inicio > now()) >= 3 then raise exception 'Ya tenés 3 turnos próximos en este local'; end if;
  if (select count(*) from public.turnos where cliente_id = auth.uid() and estado = 'confirmado' and inicio > now()) >= 10 then raise exception 'Ya tenés muchos turnos próximos. Cancelá alguno para reservar otro'; end if;
  if v_prof is null then
    select p.id into v_prof from public.profesionales p join public.profesional_servicios ps on ps.profesional_id = p.id and ps.servicio_id = s.id
     where p.activo and p.comercio_id = s.comercio_id and public.turno_slot_libre(s.id, p.id, p_inicio)
     order by (select count(*) from public.turnos t where t.profesional_id = p.id and t.estado = 'confirmado' and t.inicio::date = p_inicio::date), p.id limit 1;
  end if;
  if v_prof is null or not public.turno_slot_libre(s.id, v_prof, p_inicio) then raise exception 'Ese horario ya no está disponible. Elegí otro'; end if;
  begin
    insert into public.turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, precio, telefono, notas)
      values (s.comercio_id, s.id, v_prof, auth.uid(), p_inicio, p_inicio + make_interval(mins => s.duracion_min), s.precio, v_tel, v_notas) returning id into v_id;
  exception when exclusion_violation then raise exception 'Ese horario ya fue tomado, o ya tenés otro turno a esa hora';
  end;
  return v_id;
end $$;

-- Cancelar: la persona hasta N horas antes; el comercio (permiso de pedidos) en cualquier momento antes de que termine.
create or replace function public.turno_cancelar(p_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.turnos; s public.servicios; v_motivo text := left(nullif(trim(coalesce(p_motivo, '')), ''), 200);
begin
  select * into t from public.turnos where id = p_id for update;
  if not found then raise exception 'Turno no encontrado'; end if;
  if t.estado <> 'confirmado' then raise exception 'Este turno ya no se puede cancelar'; end if;
  select * into s from public.servicios where id = t.servicio_id;
  if t.cliente_id = auth.uid() then
    if t.inicio < now() + make_interval(hours => s.cancelar_hasta_horas) then raise exception 'Solo se puede cancelar hasta % hs antes. Comunicate con el local', s.cancelar_hasta_horas; end if;
    update public.turnos set estado = 'cancelado', cancelado_por = 'cliente', motivo_cancelacion = v_motivo, updated_at = now() where id = p_id;
  elsif public.delivery_permiso(t.comercio_id, 'pedidos') then
    if t.fin < now() then raise exception 'Este turno ya terminó'; end if;
    update public.turnos set estado = 'cancelado', cancelado_por = 'comercio', motivo_cancelacion = v_motivo, updated_at = now() where id = p_id;
  else
    raise exception 'Turno no encontrado';
  end if;
end $$;

-- El comercio cierra el turno una vez empezado: completado o la persona no vino.
create or replace function public.turno_cerrar(p_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.turnos;
begin
  if p_estado not in ('completado', 'ausente') then raise exception 'Estado inválido'; end if;
  select * into t from public.turnos where id = p_id for update;
  if not found or not public.delivery_permiso(t.comercio_id, 'pedidos') then raise exception 'Turno no encontrado'; end if;
  if t.estado <> 'confirmado' then raise exception 'Este turno ya fue cerrado o cancelado'; end if;
  if t.inicio > now() then raise exception 'El turno todavía no empezó'; end if;
  update public.turnos set estado = p_estado, updated_at = now() where id = p_id;
end $$;

-- Mis turnos (con lo necesario para mostrarlos; sin datos de otras personas).
create or replace function public.mis_turnos() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'precio', t.precio, 'notas', t.notas,
           'servicio', s.nombre, 'duracion_min', s.duracion_min, 'modalidad', s.modalidad, 'profesional', p.nombre, 'comercio', c.nombre, 'comercio_slug', c.slug, 'direccion', c.direccion,
           'cancelar_hasta', t.inicio - make_interval(hours => s.cancelar_hasta_horas), 'puede_cancelar', t.estado = 'confirmado' and t.inicio >= now() + make_interval(hours => s.cancelar_hasta_horas),
           'cancelado_por', t.cancelado_por) order by t.inicio desc), '[]'::jsonb)
    from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales p on p.id = t.profesional_id join public.delivery_comercios c on c.id = t.comercio_id
   where t.cliente_id = auth.uid() and t.inicio > now() - interval '90 days'
$$;

-- Agenda del local (quien tiene permiso de pedidos): turnos de un rango, con el contacto de la persona.
create or replace function public.delivery_turnos_agenda(p_comercio uuid, p_desde date, p_hasta date, p_profesional uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver la agenda de este local'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'Rango de fechas inválido (hasta 62 días)'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'precio', t.precio, 'notas', t.notas, 'telefono', t.telefono,
           'servicio', s.nombre, 'profesional_id', t.profesional_id, 'profesional', p.nombre, 'cliente', coalesce(nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), 'Cliente'), 'puede_cerrar', t.estado = 'confirmado' and t.inicio <= now()) order by t.inicio)
      from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales p on p.id = t.profesional_id left join public.perfiles pf on pf.id = t.cliente_id
     where t.comercio_id = p_comercio and (t.inicio at time zone tz)::date between p_desde and p_hasta and (p_profesional is null or t.profesional_id = p_profesional)), '[]'::jsonb);
end $$;

revoke all on function public.turno_slot_libre(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.servicio_horarios_libres(uuid, uuid, date, integer) from public;
grant execute on function public.servicio_horarios_libres(uuid, uuid, date, integer) to anon, authenticated;
revoke all on function public.turno_reservar(uuid, timestamptz, uuid, text, text), public.turno_cancelar(uuid, text), public.turno_cerrar(uuid, text), public.mis_turnos(), public.delivery_turnos_agenda(uuid, date, date, uuid) from public, anon;
grant execute on function public.turno_reservar(uuid, timestamptz, uuid, text, text), public.turno_cancelar(uuid, text), public.turno_cerrar(uuid, text), public.mis_turnos(), public.delivery_turnos_agenda(uuid, date, date, uuid) to authenticated;
