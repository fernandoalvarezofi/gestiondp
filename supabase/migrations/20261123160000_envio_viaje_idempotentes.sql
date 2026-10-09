-- Pedir un remís o un envío también es idempotente (como confirmar un pedido): con la misma clave de intento se devuelve
-- el mismo viaje/envío. Antes, un doble toque o una respuesta perdida podían despachar dos conductores o dos repartidores.
-- Envuelve delivery_crear_viaje / delivery_crear_envio sin modificarlas.
create table if not exists public.delivery_operacion_claves (
  clave uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('viaje', 'envio')),
  recurso_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists delivery_operacion_claves_usuario_idx on public.delivery_operacion_claves (usuario_id, created_at desc);
alter table public.delivery_operacion_claves enable row level security;
revoke all on public.delivery_operacion_claves from anon, authenticated;

create or replace function public._operacion_clave_previa(p_clave uuid, p_tipo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para continuar'; end if;
  if p_clave is null then raise exception 'Falta la clave de la operación'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_clave::text, 0));
  select recurso_id into v_id from public.delivery_operacion_claves where clave = p_clave and usuario_id = auth.uid() and tipo = p_tipo;
  if v_id is null and exists (select 1 from public.delivery_operacion_claves where clave = p_clave) then raise exception 'Clave de operación inválida'; end if;
  return v_id;
end $$;
revoke all on function public._operacion_clave_previa(uuid, text) from public, anon, authenticated;

create or replace function public.delivery_solicitar_viaje(
  p_clave uuid, p_origen text, p_olat numeric, p_olng numeric, p_destino text, p_dlat numeric, p_dlng numeric,
  p_pasajeros integer, p_notas text, p_telefono text, p_programado timestamptz, p_propina numeric, p_categoria text default 'estandar')
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  v_id := public._operacion_clave_previa(p_clave, 'viaje');
  if v_id is not null then return v_id; end if;
  v_id := public.delivery_crear_viaje(p_origen, p_olat, p_olng, p_destino, p_dlat, p_dlng, p_pasajeros, p_notas, p_telefono, p_programado, p_propina, p_categoria);
  insert into public.delivery_operacion_claves (clave, usuario_id, tipo, recurso_id) values (p_clave, auth.uid(), 'viaje', v_id);
  return v_id;
end $$;

create or replace function public.delivery_solicitar_envio(
  p_clave uuid, p_origen text, p_olat numeric, p_olng numeric, p_ocontacto text, p_otel text, p_onotas text,
  p_destino text, p_dlat numeric, p_dlng numeric, p_dcontacto text, p_dtel text, p_dnotas text,
  p_descripcion text, p_tamano text, p_quien_paga text, p_propina numeric)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  v_id := public._operacion_clave_previa(p_clave, 'envio');
  if v_id is not null then return v_id; end if;
  v_id := public.delivery_crear_envio(p_origen, p_olat, p_olng, p_ocontacto, p_otel, p_onotas, p_destino, p_dlat, p_dlng, p_dcontacto, p_dtel, p_dnotas, p_descripcion, p_tamano, p_quien_paga, p_propina);
  insert into public.delivery_operacion_claves (clave, usuario_id, tipo, recurso_id) values (p_clave, auth.uid(), 'envio', v_id);
  return v_id;
end $$;

revoke all on function public.delivery_solicitar_viaje(uuid, text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric, text) from public, anon;
grant execute on function public.delivery_solicitar_viaje(uuid, text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric, text) to authenticated;
revoke all on function public.delivery_solicitar_envio(uuid, text, numeric, numeric, text, text, text, text, numeric, numeric, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.delivery_solicitar_envio(uuid, text, numeric, numeric, text, text, text, text, numeric, numeric, text, text, text, text, text, text, numeric) to authenticated;
