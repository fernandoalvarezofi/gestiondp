-- Visitas a la tienda online: contador anónimo por comercio y día (no guarda quién entra).
create table if not exists public.delivery_tienda_visitas (
  comercio_id uuid not null references public.delivery_comercios(id) on delete cascade,
  dia date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  visitas integer not null default 0,
  primary key (comercio_id, dia)
);
alter table public.delivery_tienda_visitas enable row level security;
-- Sin políticas: nadie lee ni escribe la tabla directamente; solo las funciones de abajo.

create or replace function public.delivery_tienda_visita(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,80}$' then return; end if;
  select id into cid from public.delivery_comercios where slug = p_slug and activo;
  if cid is null then return; end if;
  insert into public.delivery_tienda_visitas (comercio_id, dia, visitas)
  values (cid, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1)
  on conflict (comercio_id, dia) do update set visitas = public.delivery_tienda_visitas.visitas + 1;
end;
$$;

create or replace function public.delivery_tienda_estadisticas(p_comercio uuid)
returns table (dia date, visitas integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(public.delivery_permiso(p_comercio, 'estadisticas'), false) then
    raise exception 'No tenés permiso para ver las estadísticas';
  end if;
  return query
    select d::date, coalesce(v.visitas, 0)
    from generate_series(((now() at time zone 'America/Argentina/Buenos_Aires')::date - 29), (now() at time zone 'America/Argentina/Buenos_Aires')::date, interval '1 day') d
    left join public.delivery_tienda_visitas v on v.comercio_id = p_comercio and v.dia = d::date
    order by d;
end;
$$;

revoke all on function public.delivery_tienda_visita(text) from public;
grant execute on function public.delivery_tienda_visita(text) to anon, authenticated;
revoke all on function public.delivery_tienda_estadisticas(uuid) from public, anon;
grant execute on function public.delivery_tienda_estadisticas(uuid) to authenticated;
