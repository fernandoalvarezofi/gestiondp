-- RESERVAS PRO (1/4): estructura. Amplía el sistema de turnos de la Fase 9 sin romper lo existente.
--  * Servicios: tiempo de preparación y de limpieza, intervalo entre horarios, reserva hasta N días, cupo (grupales),
--    confirmación manual (los turnos nacen "pendientes"), sala o recurso que ocupa, color en la agenda.
--  * Recursos (salas, boxes, camillas, canchas): un recurso no puede usarse por dos turnos a la vez.
--  * Cierres del local (feriados, vacaciones, inventario): ese rango no se ofrece a nadie del equipo.
--  * Turnos: estados pendiente / confirmado / en_curso / completado / cancelado / ausente; turnos cargados desde el panel
--    (también para quien no tiene cuenta: nombre y teléfono), cantidad de personas, nota interna, reprogramaciones.
--  * Ocupación real = inicio - preparación … fin + limpieza. Las restricciones de exclusión impiden, aun con reservas
--    simultáneas, que un profesional o un recurso tengan dos turnos individuales que se pisen. Los grupales se serializan
--    con un candado por profesional dentro de las funciones (ver parte 2).
--  * Historial de cada turno (turno_eventos), lista de espera (turnos_espera) y notas del local sobre cada cliente.
-- Revertir: drop table turno_eventos, turnos_espera, comercio_cliente_notas, agenda_cierres cascade; alter table turnos drop
--   las columnas nuevas y restaurar las dos exclusiones originales (estado = 'confirmado' sobre inicio/fin); alter table servicios
--   drop las columnas nuevas; drop table recursos.

create table if not exists public.recursos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  descripcion text check (descripcion is null or char_length(descripcion) <= 200),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recursos_comercio_idx on public.recursos (comercio_id, orden);

alter table public.servicios
  add column if not exists buffer_antes_min integer not null default 0 check (buffer_antes_min between 0 and 120 and buffer_antes_min % 5 = 0),
  add column if not exists buffer_despues_min integer not null default 0 check (buffer_despues_min between 0 and 120 and buffer_despues_min % 5 = 0),
  add column if not exists intervalo_min integer not null default 15 check (intervalo_min in (5, 10, 15, 20, 30, 45, 60, 90, 120)),
  add column if not exists reserva_max_dias integer not null default 60 check (reserva_max_dias between 1 and 365),
  add column if not exists capacidad integer not null default 1 check (capacidad between 1 and 100),
  add column if not exists requiere_confirmacion boolean not null default false,
  add column if not exists recurso_id uuid references public.recursos (id) on delete set null,
  add column if not exists color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

-- El recurso de un servicio tiene que ser del mismo local.
create or replace function public.servicio_recurso_mismo_comercio() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.recurso_id is not null and not exists (select 1 from public.recursos r where r.id = new.recurso_id and r.comercio_id = new.comercio_id) then
    raise exception 'La sala o recurso tiene que ser del mismo local';
  end if;
  return new;
end $$;
drop trigger if exists servicio_recurso_mismo_comercio on public.servicios;
create trigger servicio_recurso_mismo_comercio before insert or update of recurso_id, comercio_id on public.servicios for each row execute function public.servicio_recurso_mismo_comercio();

create table if not exists public.agenda_cierres (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  desde date not null,
  hasta date not null,
  motivo text check (motivo is null or char_length(motivo) <= 120),
  created_at timestamptz not null default now(),
  check (desde <= hasta and hasta - desde <= 366)
);
create index if not exists agenda_cierres_comercio_idx on public.agenda_cierres (comercio_id, hasta);

-- Turnos ---------------------------------------------------------------------------------------------------------------
alter table public.turnos alter column cliente_id drop not null;
alter table public.turnos
  add column if not exists cliente_nombre text check (cliente_nombre is null or char_length(btrim(cliente_nombre)) between 2 and 80),
  add column if not exists personas integer not null default 1 check (personas between 1 and 100),
  add column if not exists origen text not null default 'online' check (origen in ('online', 'panel')),
  add column if not exists nota_interna text check (nota_interna is null or char_length(nota_interna) <= 1000),
  add column if not exists recurso_id uuid references public.recursos (id) on delete set null,
  add column if not exists grupal boolean not null default false,
  add column if not exists ocupa_desde timestamptz,
  add column if not exists ocupa_hasta timestamptz,
  add column if not exists confirmado_at timestamptz,
  add column if not exists reprogramaciones integer not null default 0,
  add column if not exists creado_por uuid references auth.users (id) on delete set null;

alter table public.turnos drop constraint if exists turnos_quien_reserva;
alter table public.turnos add constraint turnos_quien_reserva check (cliente_id is not null or cliente_nombre is not null);
alter table public.turnos drop constraint if exists turnos_estado_check;
alter table public.turnos add constraint turnos_estado_check check (estado in ('pendiente', 'confirmado', 'en_curso', 'completado', 'cancelado', 'ausente'));

-- Ocupación, cupo y recurso se derivan SIEMPRE del servicio (nadie los puede fijar a mano).
create or replace function public.turnos_derivar() returns trigger
language plpgsql set search_path = public as $$
declare s public.servicios;
begin
  select * into s from public.servicios where id = new.servicio_id;
  new.ocupa_desde := new.inicio - make_interval(mins => coalesce(s.buffer_antes_min, 0));
  new.ocupa_hasta := new.fin + make_interval(mins => coalesce(s.buffer_despues_min, 0));
  new.grupal := coalesce(s.capacidad, 1) > 1;
  if tg_op = 'INSERT' then new.recurso_id := s.recurso_id; end if;
  return new;
end $$;
drop trigger if exists turnos_derivar on public.turnos;
create trigger turnos_derivar before insert or update of inicio, fin, servicio_id on public.turnos for each row execute function public.turnos_derivar();

update public.turnos t set ocupa_desde = t.inicio, ocupa_hasta = t.fin where ocupa_desde is null;
alter table public.turnos alter column ocupa_desde set not null, alter column ocupa_hasta set not null;
alter table public.turnos drop constraint if exists turnos_ocupa_check;
alter table public.turnos add constraint turnos_ocupa_check check (ocupa_desde <= inicio and ocupa_hasta >= fin);

alter table public.turnos drop constraint if exists turnos_profesional_id_tstzrange_excl;
alter table public.turnos drop constraint if exists turnos_cliente_id_tstzrange_excl;
alter table public.turnos drop constraint if exists turnos_profesional_sin_superposicion;
alter table public.turnos drop constraint if exists turnos_recurso_sin_superposicion;
alter table public.turnos drop constraint if exists turnos_cliente_sin_superposicion;
alter table public.turnos add constraint turnos_profesional_sin_superposicion
  exclude using gist (profesional_id with =, tstzrange(ocupa_desde, ocupa_hasta) with &&) where (estado in ('pendiente', 'confirmado', 'en_curso') and not grupal);
alter table public.turnos add constraint turnos_recurso_sin_superposicion
  exclude using gist (recurso_id with =, tstzrange(ocupa_desde, ocupa_hasta) with &&) where (estado in ('pendiente', 'confirmado', 'en_curso') and not grupal and recurso_id is not null);
alter table public.turnos add constraint turnos_cliente_sin_superposicion
  exclude using gist (cliente_id with =, tstzrange(inicio, fin) with &&) where (estado in ('pendiente', 'confirmado', 'en_curso') and cliente_id is not null);

create index if not exists turnos_prof_ocupa_idx on public.turnos (profesional_id, ocupa_desde) where estado in ('pendiente', 'confirmado', 'en_curso');
create index if not exists turnos_comercio_cliente_idx on public.turnos (comercio_id, cliente_id);

-- Historial de cada turno (lo escribe un disparador; nadie lo edita).
create table if not exists public.turno_eventos (
  id bigint generated always as identity primary key,
  turno_id uuid not null references public.turnos (id) on delete cascade,
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  evento text not null,
  detalle jsonb not null default '{}'::jsonb,
  actor uuid,
  fecha timestamptz not null default now()
);
create index if not exists turno_eventos_turno_idx on public.turno_eventos (turno_id, fecha);

-- Lista de espera: aviso cuando se libera un horario de ese servicio en ese día.
create table if not exists public.turnos_espera (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  servicio_id uuid not null references public.servicios (id) on delete cascade,
  profesional_id uuid references public.profesionales (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  avisado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (servicio_id, cliente_id, fecha)
);
create index if not exists turnos_espera_busqueda_idx on public.turnos_espera (servicio_id, fecha) where avisado_at is null;

-- Notas internas del local sobre una persona (solo las ve el equipo del local).
create table if not exists public.comercio_cliente_notas (
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  nota text not null check (char_length(nota) <= 2000),
  actualizado_por uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (comercio_id, cliente_id)
);

-- Permisos ---------------------------------------------------------------------------------------------------------------
alter table public.recursos enable row level security;
alter table public.agenda_cierres enable row level security;
alter table public.turno_eventos enable row level security;
alter table public.turnos_espera enable row level security;
alter table public.comercio_cliente_notas enable row level security;

revoke all on public.recursos, public.agenda_cierres, public.turno_eventos, public.turnos_espera, public.comercio_cliente_notas from anon, authenticated;
grant select on public.recursos, public.agenda_cierres to anon, authenticated;
grant insert, update, delete on public.recursos, public.agenda_cierres to authenticated;
grant select on public.turno_eventos, public.comercio_cliente_notas to authenticated;
grant select, delete on public.turnos_espera to authenticated;
grant all on public.recursos, public.agenda_cierres, public.turno_eventos, public.turnos_espera, public.comercio_cliente_notas to service_role;

drop policy if exists "Recursos visibles" on public.recursos;
create policy "Recursos visibles" on public.recursos for select to anon, authenticated
  using (activo or public.delivery_permiso(comercio_id, 'ajustes'));
drop policy if exists "Recursos administrados" on public.recursos;
create policy "Recursos administrados" on public.recursos for all to authenticated
  using (public.delivery_permiso(comercio_id, 'ajustes')) with check (public.delivery_permiso(comercio_id, 'ajustes'));

drop policy if exists "Cierres visibles" on public.agenda_cierres;
create policy "Cierres visibles" on public.agenda_cierres for select to anon, authenticated using (true);
drop policy if exists "Cierres administrados" on public.agenda_cierres;
create policy "Cierres administrados" on public.agenda_cierres for all to authenticated
  using (public.delivery_permiso(comercio_id, 'ajustes')) with check (public.delivery_permiso(comercio_id, 'ajustes'));

drop policy if exists "Historial del turno para el local" on public.turno_eventos;
create policy "Historial del turno para el local" on public.turno_eventos for select to authenticated using (public.delivery_permiso(comercio_id, 'pedidos'));

drop policy if exists "Mi lista de espera" on public.turnos_espera;
create policy "Mi lista de espera" on public.turnos_espera for select to authenticated using (cliente_id = (select auth.uid()) or public.delivery_permiso(comercio_id, 'pedidos'));
drop policy if exists "Salir de la lista de espera" on public.turnos_espera;
create policy "Salir de la lista de espera" on public.turnos_espera for delete to authenticated using (cliente_id = (select auth.uid()));

drop policy if exists "Notas de clientes para el local" on public.comercio_cliente_notas;
create policy "Notas de clientes para el local" on public.comercio_cliente_notas for select to authenticated using (public.delivery_permiso(comercio_id, 'pedidos'));
