-- FASE 9: descubrir locales que ofrecen turnos en línea (con al menos un servicio activo y un profesional con agenda). Público.
-- Revertir: drop function locales_con_servicios.
create or replace function public.locales_con_servicios(p_limite integer default 40) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb) from (
    select jsonb_build_object('id', c.id, 'slug', c.slug, 'nombre', c.nombre, 'logo_url', c.logo_url, 'direccion', c.direccion,
      'total', s.total, 'desde_precio', s.desde, 'servicios', s.lista) as x
    from public.delivery_comercios c
    cross join lateral (
      select count(*)::integer as total, min(v.precio) as desde,
             coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'nombre', v.nombre, 'duracion_min', v.duracion_min, 'precio', v.precio) order by v.orden, v.nombre) filter (where v.rn <= 3), '[]'::jsonb) as lista
        from (select sv.*, row_number() over (order by sv.orden, sv.nombre) as rn from public.servicios sv
               where sv.comercio_id = c.id and sv.activo
                 and exists (select 1 from public.profesional_servicios ps join public.profesionales p on p.id = ps.profesional_id and p.activo
                               join public.disponibilidad d on d.profesional_id = p.id where ps.servicio_id = sv.id)) v) s
    where c.activo and c.aprobado and s.total > 0
    order by c.nombre limit least(greatest(coalesce(p_limite, 40), 1), 100)) q
$$;
revoke all on function public.locales_con_servicios(integer) from public;
grant execute on function public.locales_con_servicios(integer) to anon, authenticated;
