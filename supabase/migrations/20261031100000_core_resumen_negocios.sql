-- FASE 1 (Core), paso 4: selector de negocio y vista agregada.
--  * delivery_mis_comercios() ahora informa a qué negocio pertenece cada tienda (campos nuevos, aditivos) para poder agrupar el selector.
--  * delivery_resumen_negocios(): por cada negocio donde la persona es dueña o administradora, sus tiendas con los números de los últimos 30 días.
-- No cambia ningún permiso. delivery_resumen_sucursales() queda como estaba (compatibilidad).

create or replace function public.delivery_mis_comercios() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'nombre', x.nombre, 'logo_url', x.logo_url, 'direccion', x.direccion, 'rol', x.rol, 'aprobado', x.aprobado, 'esta_abierto', x.esta_abierto,
      'negocio_id', x.business_id, 'negocio', b.nombre, 'parent_store_id', x.parent_store_id
    ) order by x.orden, b.nombre, x.created_at), '[]'::jsonb)
  from (
    select c.id, c.nombre, c.logo_url, c.direccion, 'dueno'::text as rol, 0 as orden, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.delivery_comercios c where c.propietario_id = auth.uid()
    union all
    select c.id, c.nombre, c.logo_url, c.direccion, e.rol, 1, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.delivery_comercio_equipo e join public.delivery_comercios c on c.id = e.comercio_id
     where e.user_id = auth.uid() and e.estado = 'activo' and c.propietario_id is distinct from auth.uid()
    union all
    select c.id, c.nombre, c.logo_url, c.direccion,
           case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end,
           2, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
     where m.user_id = auth.uid() and m.estado = 'activo' and c.propietario_id is distinct from auth.uid()
       and not exists (select 1 from public.delivery_comercio_equipo e where e.comercio_id = c.id and e.user_id = auth.uid() and e.estado = 'activo')
  ) x
  left join public.core_businesses b on b.id = x.business_id
$$;

create or replace function public.delivery_resumen_negocios() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'nombre', b.nombre, 'rol', m.rol,
      'tiendas', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', c.id, 'nombre', c.nombre, 'direccion', c.direccion, 'aprobado', c.aprobado, 'esta_abierto', c.esta_abierto,
            'rating', c.rating, 'resenas', c.total_resenas, 'parent_store_id', c.parent_store_id,
            'pedidos', coalesce(p.pedidos, 0), 'ventas', coalesce(p.ventas, 0),
            'ticket', case when coalesce(p.pedidos, 0) > 0 then round(p.ventas / p.pedidos) else 0 end,
            'pendientes', (select count(*) from public.delivery_pedidos x where x.comercio_id = c.id and x.estado = 'pendiente')
          ) order by c.created_at)
          from public.delivery_comercios c
          left join lateral (select count(*) as pedidos, sum(subtotal) as ventas from public.delivery_pedidos x
                              where x.comercio_id = c.id and x.estado = 'entregado' and x.entregado_at > now() - interval '30 days') p on true
         where c.business_id = b.id), '[]'::jsonb)
    ) order by b.created_at), '[]'::jsonb)
  from public.core_business_members m
  join public.core_businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.estado = 'activo' and m.rol in ('owner', 'admin')
$$;
revoke all on function public.delivery_resumen_negocios() from public, anon;
grant execute on function public.delivery_resumen_negocios() to authenticated;
