-- Productos (nivel profesional): opciones de variante con nombre y ventas por producto para la tabla del catálogo.

-- 1) Opciones de variante (como en Shopify): hasta 3, cada una con nombre y hasta 30 valores. Las variantes siguen siendo
--    filas propias (nombre "M / Negro"); estas opciones guardan cómo se llaman los ejes para generarlas y editarlas.
alter table public.delivery_productos add column if not exists variantes_ejes jsonb not null default '[]'::jsonb;
alter table public.delivery_productos drop constraint if exists delivery_productos_variantes_ejes_check;
alter table public.delivery_productos add constraint delivery_productos_variantes_ejes_check check (
  jsonb_typeof(variantes_ejes) = 'array' and jsonb_array_length(variantes_ejes) <= 3 and length(variantes_ejes::text) <= 4000);

-- 2) Ventas por producto en un período (pedidos no cancelados), para ordenar y mostrar en la tabla.
create or replace function public.catalogo_ventas(p_comercio uuid, p_dias integer default 30)
returns table (producto_id uuid, unidades bigint, ingresos numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso para ver el catálogo'; end if;
  return query
    select i.producto_id, sum(i.cantidad)::bigint, sum(i.cantidad * i.precio_unitario)
      from public.delivery_pedido_items i join public.delivery_pedidos p on p.id = i.pedido_id
     where p.comercio_id = p_comercio and p.estado <> 'cancelado' and p.created_at >= now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))
     group by i.producto_id;
end $$;
revoke all on function public.catalogo_ventas(uuid, integer) from public, anon;
grant execute on function public.catalogo_ventas(uuid, integer) to authenticated;
