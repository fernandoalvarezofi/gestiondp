-- MÉTRICAS DEL NEGOCIO: números agregados por día (sin datos personales) que la base de usuarios envía firmados.
-- Solo las cuentas de `admins` con 2FA las leen (función `metricas`); la ingesta usa la clave de servicio.

create table if not exists public.metricas_diarias (
  dia date not null,
  clave text not null check (length(clave) between 1 and 60),
  valor numeric not null,
  actualizado_at timestamptz not null default now(),
  primary key (dia, clave)
);
alter table public.metricas_diarias enable row level security;

create or replace function public.ingest_metricas(p_metricas jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if jsonb_typeof(p_metricas) <> 'array' or jsonb_array_length(p_metricas) = 0 then return 0; end if;
  with up as (
    insert into public.metricas_diarias (dia, clave, valor, actualizado_at)
    select x.dia, x.clave, x.valor, now()
    from jsonb_to_recordset(p_metricas) as x(dia date, clave text, valor numeric)
    where x.dia is not null and x.clave is not null and x.valor is not null
    on conflict (dia, clave) do update set valor = excluded.valor, actualizado_at = now()
    returning 1)
  select count(*) into n from up;
  return n;
end $$;
revoke all on function public.ingest_metricas(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_metricas(jsonb) to service_role;

create or replace function public.metricas(p_dias integer default 30) returns table (dia date, clave text, valor numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  return query select m.dia, m.clave, m.valor from public.metricas_diarias m
    where m.dia >= current_date - least(greatest(p_dias, 1), 365) order by m.dia, m.clave;
end $$;
revoke all on function public.metricas(integer) from public, anon;
grant execute on function public.metricas(integer) to authenticated;
