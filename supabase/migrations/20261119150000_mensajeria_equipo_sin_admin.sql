-- Corrección de seguridad de la mensajería: delivery_permiso() también es verdadero para administración,
-- así que un admin quedaba como "el local" en los chats y podía escribir haciéndose pasar por el comercio.
-- Para mensajes, "ser el local" exige ser dueño o parte del equipo; administración solo lee (moderación).
create or replace function public.msg_es_equipo(p_comercio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    exists (select 1 from public.delivery_comercios c where c.id = p_comercio and c.propietario_id = auth.uid())
    or exists (select 1 from public.delivery_comercio_equipo e where e.comercio_id = p_comercio and e.user_id = auth.uid() and e.estado = 'activo' and e.rol in ('operador', 'encargado'))
    or exists (select 1 from public.delivery_comercios c join public.core_business_members m on m.business_id = c.business_id
               where c.id = p_comercio and m.user_id = auth.uid() and m.estado = 'activo' and m.rol in ('owner', 'admin', 'manager', 'operator', 'seller')), false)
$$;
revoke all on function public.msg_es_equipo(uuid) from public, anon, authenticated;

create or replace function public.msg_rol(p_hilo uuid) returns text
language sql stable security definer set search_path = public as $$
  select case h.contexto
    when 'consulta' then case when h.cliente_id = auth.uid() then 'cliente' when public.msg_es_equipo(h.comercio_id) then 'comercio' end
    when 'pedido' then (select case
        when h.canal in ('cliente_comercio', 'cliente_repartidor') and p.cliente_id = auth.uid() then 'cliente'
        when h.canal in ('cliente_comercio', 'comercio_repartidor') and public.msg_es_equipo(p.comercio_id) then 'comercio'
        when h.canal in ('cliente_repartidor', 'comercio_repartidor') and p.repartidor_id = auth.uid() then 'repartidor' end
      from public.delivery_pedidos p where p.id = h.contexto_id)
    when 'envio' then (select case when e.cliente_id = auth.uid() then 'cliente' when e.repartidor_id = auth.uid() then 'repartidor' end
      from public.delivery_envios e where e.id = h.contexto_id)
    when 'viaje' then (select case when v.cliente_id = auth.uid() then 'pasajero' when v.conductor_id = auth.uid() then 'conductor' end
      from public.delivery_viajes v where v.id = h.contexto_id)
  end
  from public.msg_hilos h where h.id = p_hilo
$$;

-- Consulta a un local: solo se impide escribirle al local propio (no a cualquiera por ser admin).
create or replace function public.msg_consulta_iniciar(p_comercio uuid, p_texto text, p_producto uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prod uuid;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if not exists (select 1 from public.delivery_comercios where id = p_comercio and activo and aprobado) then raise exception 'Local no disponible'; end if;
  if public.msg_es_equipo(p_comercio) then raise exception 'No podés escribirte a tu propio local'; end if;
  select id into v_prod from public.delivery_productos where id = p_producto and comercio_id = p_comercio;
  insert into public.msg_hilos (contexto, canal, comercio_id, cliente_id, producto_id) values ('consulta', 'consulta', p_comercio, auth.uid(), v_prod)
    on conflict (comercio_id, cliente_id) where contexto = 'consulta' do update set producto_id = coalesce(excluded.producto_id, public.msg_hilos.producto_id)
    returning id into v_id;
  perform public.msg_enviar(v_id, 'texto', p_texto);
  return v_id;
end $$;
