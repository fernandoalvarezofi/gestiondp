-- FASE 5, paso 3: el reintegro manual (hecho en el panel de Mercado Pago) también queda registrado en el pago y en el libro de pagos.
-- Antes solo cambiaba el estado del pedido. Ahora, si el pedido tiene un pago aprobado, pasa por pago_aplicar_notificacion (misma máquina de estados).
create or replace function public.delivery_admin_marcar_reintegrado(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pago public.pagos;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  if not exists (select 1 from public.delivery_pedidos where id = p_pedido and pago_estado = 'a_reintegrar') then
    raise exception 'Ese pedido no tiene un reintegro pendiente';
  end if;
  select * into v_pago from public.pagos where referencia_tipo = 'pedido' and referencia_id = p_pedido and estado = 'aprobado' order by actualizado_at desc limit 1;
  if found then
    perform public.pago_aplicar_notificacion(v_pago.proveedor, v_pago.external_id, p_pedido, 'refunded', v_pago.monto, 'reintegro marcado por administración', null);
  end if;
  update public.delivery_pedidos set pago_estado = 'reintegrado' where id = p_pedido and pago_estado = 'a_reintegrar';
end $$;
