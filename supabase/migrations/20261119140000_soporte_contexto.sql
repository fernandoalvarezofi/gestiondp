-- Soporte con contexto: al abrir un ticket, el agente ve todo lo del pedido sin salir de la pantalla
-- (productos, dirección, repartidor, pago, historial de estados y cantidad de mensajes por chat). Solo administración.
create or replace function public.delivery_soporte_contexto(p_reclamo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.delivery_reclamos; p public.delivery_pedidos;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  select * into r from public.delivery_reclamos where id = p_reclamo;
  if r.id is null then raise exception 'Ticket no encontrado'; end if;
  if r.pedido_id is null then return jsonb_build_object('pedido', null); end if;
  select * into p from public.delivery_pedidos where id = r.pedido_id;
  return jsonb_build_object(
    'pedido', jsonb_build_object('id', p.id, 'estado', p.estado, 'tipo_entrega', p.tipo_entrega, 'direccion', p.direccion_entrega,
      'metodo_pago', p.metodo_pago, 'pago_estado', p.pago_estado, 'subtotal', p.subtotal, 'costo_envio', p.costo_envio, 'propina', p.propina, 'total', p.total,
      'creado', p.created_at, 'entregado', p.entregado_at, 'cancelado', p.cancelado_at, 'motivo_cancelacion', p.motivo_cancelacion, 'notas', p.notas),
    'repartidor', case when p.repartidor_id is null then null else (select jsonb_build_object('nombre', pf.nombre, 'telefono', rp.telefono, 'vehiculo', rp.vehiculo)
      from public.delivery_repartidores rp left join public.perfiles pf on pf.id = rp.perfil_id where rp.perfil_id = p.repartidor_id) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'precio', i.precio_unitario, 'notas', i.notas) order by i.nombre)
      from public.delivery_pedido_items i where i.pedido_id = p.id), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('evento', e.evento, 'de', e.estado_anterior, 'a', e.estado_nuevo, 'rol', e.actor_rol, 'at', e.created_at) order by e.created_at)
      from public.delivery_pedido_eventos e where e.pedido_id = p.id), '[]'::jsonb),
    'chats', coalesce((select jsonb_object_agg(h.canal, (select count(*) from public.msg_mensajes m where m.hilo_id = h.id))
      from public.msg_hilos h where h.contexto = 'pedido' and h.contexto_id = p.id), '{}'::jsonb)
  );
end $$;
revoke all on function public.delivery_soporte_contexto(uuid) from public, anon;
grant execute on function public.delivery_soporte_contexto(uuid) to authenticated;
