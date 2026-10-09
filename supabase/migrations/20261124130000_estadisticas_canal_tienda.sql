-- Ventas por la tienda online calculadas en el servidor (antes el panel traía hasta 5.000 pedidos al navegador para sumarlos).
create or replace function public.delivery_ventas_tienda_online(p_comercio uuid, p_dias integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_dias integer := least(greatest(coalesce(p_dias, 30), 1), 400); v jsonb;
begin
  if not coalesce(public.delivery_permiso(p_comercio, 'estadisticas'), false) then raise exception 'No tenés permiso para ver las estadísticas de este local'; end if;
  select jsonb_build_object('pedidos', count(*), 'ventas', coalesce(sum(subtotal), 0)) into v
    from public.delivery_pedidos
   where comercio_id = p_comercio and canal = 'tienda' and estado = 'entregado' and created_at >= now() - make_interval(days => v_dias);
  return v;
end $$;
revoke all on function public.delivery_ventas_tienda_online(uuid, integer) from public, anon;
grant execute on function public.delivery_ventas_tienda_online(uuid, integer) to authenticated;
