-- BASE DE ADMINISTRACIÓN (proyecto Supabase "woref-admin"), separada de la base de los usuarios.
-- Aquí viven la auditoría y los errores de Woref. La base principal solo puede ENVIAR eventos (función `ingest`
-- firmada); nadie puede leer ni modificar desde allí. Solo las cuentas listadas en `admins`, con 2FA, pueden leer.

create extension if not exists pgcrypto with schema extensions;

-- ---- Configuración interna (secreto de firma, código de primer uso). Sin políticas: solo la función de ingesta la lee.
create table public.config (clave text primary key, valor text not null);
alter table public.config enable row level security;

-- ---- Quiénes administran. Sin políticas: se consulta solo por funciones.
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade, creado_at timestamptz not null default now());
alter table public.admins enable row level security;

-- ---- Auditoría: cada acción de administración, con hash encadenado (si alguien altera o borra un registro, la cadena se rompe).
create table public.auditoria_eventos (
  id bigint generated always as identity primary key,
  origen_id bigint not null unique,
  ocurrio_at timestamptz not null,
  recibido_at timestamptz not null default now(),
  actor_id uuid,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb not null default '{}'::jsonb,
  hash_prev text,
  hash text not null
);
create index on public.auditoria_eventos (ocurrio_at desc);
create index on public.auditoria_eventos (actor_id);
create index on public.auditoria_eventos (entidad, entidad_id);
alter table public.auditoria_eventos enable row level security;

-- ---- Errores de la app
create table public.errores_app (
  id bigint generated always as identity primary key,
  origen_id bigint not null unique,
  ocurrio_at timestamptz not null,
  recibido_at timestamptz not null default now(),
  huella text not null,
  mensaje text not null,
  stack text,
  url text,
  agente text,
  usuario_id uuid
);
create index on public.errores_app (ocurrio_at desc);
create index on public.errores_app (huella);
alter table public.errores_app enable row level security;

-- ---- Hash de cada evento (mismo cálculo para encadenar y para verificar). Fecha en UTC para que no dependa de la zona horaria de la sesión.
create or replace function public.auditoria_hash(prev text, p_origen_id bigint, p_ocurrio timestamptz, p_actor uuid, p_accion text, p_entidad text, p_entidad_id text, p_detalle jsonb)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(
    coalesce(prev, '') || '|' || p_origen_id::text || '|' || to_char(p_ocurrio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    coalesce(p_actor::text, '') || '|' || p_accion || '|' || p_entidad || '|' || coalesce(p_entidad_id, '') || '|' || p_detalle::text, 'sha256'), 'hex')
$$;

create or replace function public.auditoria_encadenar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare prev text;
begin
  perform pg_advisory_xact_lock(7260001);
  select hash into prev from public.auditoria_eventos order by id desc limit 1;
  new.hash_prev := prev;
  new.hash := public.auditoria_hash(prev, new.origen_id, new.ocurrio_at, new.actor_id, new.accion, new.entidad, new.entidad_id, new.detalle);
  return new;
end $$;
create trigger auditoria_encadenar before insert on public.auditoria_eventos for each row execute function public.auditoria_encadenar();

-- ---- Solo agregar: no se puede cambiar, borrar ni vaciar.
create or replace function public.bloquear_modificacion() returns trigger language plpgsql as $$
begin raise exception 'Este registro es de solo lectura'; end $$;
create trigger auditoria_sin_cambios before update or delete on public.auditoria_eventos for each row execute function public.bloquear_modificacion();
create trigger auditoria_sin_vaciar before truncate on public.auditoria_eventos for each statement execute function public.bloquear_modificacion();

-- ---- Permisos: nadie de la API toca las tablas salvo lectura de administradores con 2FA.
revoke all on public.config, public.admins, public.auditoria_eventos, public.errores_app from anon, authenticated;
grant select on public.auditoria_eventos, public.errores_app to authenticated;

create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

create policy "Auditoría: solo administradores con 2FA" on public.auditoria_eventos for select to authenticated using (public.es_admin());
create policy "Errores: solo administradores con 2FA" on public.errores_app for select to authenticated using (public.es_admin());

-- ---- Estado de la sesión, para guiar el ingreso (¿ya es administrador? ¿con qué nivel de verificación?)
create or replace function public.mi_estado() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'admin', exists (select 1 from public.admins a where a.user_id = (select auth.uid())),
    'aal', coalesce((select auth.jwt() ->> 'aal'), 'aal1'),
    'configuracion_inicial', exists (select 1 from public.config where clave = 'bootstrap_hash'))
$$;
revoke all on function public.mi_estado() from public, anon;
grant execute on function public.mi_estado() to authenticated;

-- ---- Primer uso: quien tenga el código único se convierte en administrador (una sola vez; el código se borra).
create or replace function public.reclamar_admin(p_codigo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
  select valor into h from public.config where clave = 'bootstrap_hash';
  if h is null or exists (select 1 from public.admins) then raise exception 'La configuración inicial ya se completó'; end if;
  if encode(digest(coalesce(p_codigo, ''), 'sha256'), 'hex') <> h then raise exception 'Código incorrecto'; end if;
  insert into public.admins (user_id) values ((select auth.uid()));
  delete from public.config where clave = 'bootstrap_hash';
end $$;
revoke all on function public.reclamar_admin(text) from public, anon;
grant execute on function public.reclamar_admin(text) to authenticated;

-- ---- Verificación de la cadena: recalcula todo y avisa si algo no coincide.
create or replace function public.verificar_cadena() returns table (total bigint, rotos bigint, primer_roto bigint)
language plpgsql stable security definer set search_path = public as $$
declare r record; prev text := null; n bigint := 0; bad bigint := 0; first_bad bigint := null;
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  for r in select * from public.auditoria_eventos order by id loop
    n := n + 1;
    if r.hash_prev is distinct from prev or r.hash <> public.auditoria_hash(prev, r.origen_id, r.ocurrio_at, r.actor_id, r.accion, r.entidad, r.entidad_id, r.detalle) then
      bad := bad + 1;
      if first_bad is null then first_bad := r.id; end if;
    end if;
    prev := r.hash;
  end loop;
  return query select n, bad, first_bad;
end $$;
revoke all on function public.verificar_cadena() from public, anon;
grant execute on function public.verificar_cadena() to authenticated;

-- ---- Resumen para el tablero.
create or replace function public.resumen() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'auditoria_total', (select count(*) from public.auditoria_eventos),
    'ultimo_evento_recibido', (select max(recibido_at) from public.auditoria_eventos),
    'errores_24h', (select count(*) from public.errores_app where ocurrio_at > now() - interval '24 hours'),
    'errores_total', (select count(*) from public.errores_app),
    'ultimo_error_recibido', (select max(recibido_at) from public.errores_app));
end $$;
revoke all on function public.resumen() from public, anon;
grant execute on function public.resumen() to authenticated;

-- ---- Ingesta: la usa SOLO la función `ingest` (clave de servicio). Idempotente: reenviar el mismo evento no lo duplica.
create or replace function public.ingest_lote(p_auditoria jsonb, p_errores jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int := 0; e int := 0;
begin
  if jsonb_typeof(p_auditoria) = 'array' and jsonb_array_length(p_auditoria) > 0 then
    with ins as (
      insert into public.auditoria_eventos (origen_id, ocurrio_at, actor_id, accion, entidad, entidad_id, detalle)
      select x.id, x.created_at, x.actor_id, x.accion, x.entidad, x.entidad_id, coalesce(x.detalle, '{}'::jsonb)
      from jsonb_to_recordset(p_auditoria) as x(id bigint, created_at timestamptz, actor_id uuid, accion text, entidad text, entidad_id text, detalle jsonb)
      order by x.id
      on conflict (origen_id) do nothing returning 1)
    select count(*) into a from ins;
  end if;
  if jsonb_typeof(p_errores) = 'array' and jsonb_array_length(p_errores) > 0 then
    with ins as (
      insert into public.errores_app (origen_id, ocurrio_at, huella, mensaje, stack, url, agente, usuario_id)
      select x.id, x.created_at, x.huella, left(x.mensaje, 2000), left(x.stack, 8000), left(x.url, 500), left(x.agente, 300), x.usuario_id
      from jsonb_to_recordset(p_errores) as x(id bigint, created_at timestamptz, huella text, mensaje text, stack text, url text, agente text, usuario_id uuid)
      order by x.id
      on conflict (origen_id) do nothing returning 1)
    select count(*) into e from ins;
  end if;
  return jsonb_build_object('auditoria', a, 'errores', e);
end $$;
revoke all on function public.ingest_lote(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_lote(jsonb, jsonb) to service_role;
