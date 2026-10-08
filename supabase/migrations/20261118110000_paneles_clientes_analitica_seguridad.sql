-- Datos para tres pantallas nuevas de los paneles. Todo es solo lectura, agregado y con permiso validado en el servidor.

-- 1) Comercio → Clientes: quiénes le compran y con qué frecuencia.
--    Privacidad: solo nombre de pila + inicial (lo mismo que ya ve en cada pedido), sin teléfono, email ni id.
create or replace function public.delivery_comercio_clientes(p_comercio uuid, p_dias integer default 90)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_dias integer := greatest(7, least(coalesce(p_dias, 90), 365));
  v_desde timestamptz := now() - make_interval(days => v_dias);
  v_out jsonb;
begin
  if not (public.delivery_permiso(p_comercio, 'estadisticas') or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'No tenés permiso sobre este comercio';
  end if;
  with ok as (
    select p.cliente_id, p.subtotal, p.created_at
    from public.delivery_pedidos p
    where p.comercio_id = p_comercio and p.estado <> 'cancelado' and p.pago_estado not in ('pendiente', 'rechazado')
  ), por_cliente as (
    select o.cliente_id,
      count(*) filter (where o.created_at >= v_desde) as pedidos,
      coalesce(sum(o.subtotal) filter (where o.created_at >= v_desde), 0) as gastado,
      max(o.created_at) as ultimo,
      min(o.created_at) as primero
    from ok o group by o.cliente_id
  ), activos as (select * from por_cliente where pedidos > 0)
  select jsonb_build_object(
    'dias', v_dias,
    'clientes', (select count(*) from activos),
    'recurrentes', (select count(*) from activos where pedidos >= 2),
    'nuevos', (select count(*) from activos where primero >= v_desde),
    'gasto_promedio', (select coalesce(round(avg(gastado)), 0) from activos),
    'lista', (select coalesce(jsonb_agg(x order by x.pedidos desc, x.gastado desc), '[]'::jsonb) from (
      select
        trim(split_part(coalesce(nullif(trim(pf.nombre), ''), 'Cliente'), ' ', 1) || ' ' ||
             coalesce(nullif(left(split_part(trim(pf.nombre), ' ', 2), 1), '') || '.', '')) as nombre,
        a.pedidos, a.gastado, a.ultimo, (a.primero >= v_desde) as nuevo
      from activos a left join public.perfiles pf on pf.id = a.cliente_id
      order by a.pedidos desc, a.gastado desc limit 100) x)
  ) into v_out;
  return v_out;
end $$;

-- 2) Administración → Analytics: evolución del negocio en el período (sin datos personales).
create or replace function public.delivery_admin_analitica(p_dias integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_dias integer := greatest(7, least(coalesce(p_dias, 30), 180));
  v_desde timestamptz := (date_trunc('day', now() at time zone v_tz) - make_interval(days => v_dias - 1)) at time zone v_tz;
  v_out jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  with ped as (
    select p.*, (p.created_at at time zone v_tz)::date as dia
    from public.delivery_pedidos p
    where p.created_at >= v_desde and p.pago_estado not in ('pendiente', 'rechazado')
  ), ok as (select * from ped where estado <> 'cancelado'),
  dias as (select d::date as dia from generate_series((v_desde at time zone v_tz)::date, (now() at time zone v_tz)::date, interval '1 day') d),
  primeros as (select cliente_id, min(created_at) as primero from public.delivery_pedidos where estado <> 'cancelado' group by cliente_id)
  select jsonb_build_object(
    'dias', v_dias,
    'pedidos', (select count(*) from ok),
    'gmv', (select coalesce(sum(total), 0) from ok),
    'ticket_promedio', (select coalesce(round(avg(total)), 0) from ok),
    'tarifa_servicio', (select coalesce(sum(tarifa_servicio), 0) from ok),
    'cancelados', (select count(*) from ped where estado = 'cancelado'),
    'tasa_cancelacion', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where estado = 'cancelado') / count(*), 1) end from ped),
    'entrega_min', (select round((avg(extract(epoch from (entregado_at - created_at)) / 60))::numeric, 1) from ok where entregado_at is not null and tipo_entrega = 'delivery'),
    'clientes_activos', (select count(distinct cliente_id) from ok),
    'clientes_nuevos', (select count(*) from primeros where primero >= v_desde),
    'comercios_con_ventas', (select count(distinct comercio_id) from ok),
    'envios', (select jsonb_build_object('total', count(*), 'entregados', count(*) filter (where estado = 'entregado'), 'facturado', coalesce(sum(total) filter (where estado = 'entregado'), 0)) from public.delivery_envios where created_at >= v_desde),
    'viajes', (select jsonb_build_object('total', count(*), 'completados', count(*) filter (where estado = 'completado'), 'facturado', coalesce(sum(total) filter (where estado = 'completado'), 0)) from public.delivery_viajes where created_at >= v_desde),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'pedidos', coalesce(x.pedidos, 0), 'gmv', coalesce(x.gmv, 0)) order by d.dia), '[]'::jsonb)
                from dias d left join (select dia, count(*) as pedidos, sum(total) as gmv from ok group by dia) x on x.dia = d.dia),
    'top_comercios', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select c.nombre, count(*)::integer as pedidos, sum(o.total) as gmv
                       from ok o join public.delivery_comercios c on c.id = o.comercio_id
                       group by c.nombre order by sum(o.total) desc limit 8) t),
    'metodo_pago', (select coalesce(jsonb_object_agg(metodo_pago, n), '{}'::jsonb) from (select metodo_pago, count(*) as n from ok group by metodo_pago) q),
    'tipo_entrega', (select coalesce(jsonb_object_agg(tipo_entrega, n), '{}'::jsonb) from (select tipo_entrega, count(*) as n from ok group by tipo_entrega) q)
  ) into v_out;
  return v_out;
end $$;

-- 3) Administración → Seguridad: estado de los accesos privilegiados y señales de riesgo.
--    El email de cada admin se muestra enmascarado; el estado de 2FA sale de auth.mfa_factors (solo lectura).
create or replace function public.delivery_admin_seguridad()
returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return jsonb_build_object(
    'admins', (select coalesce(jsonb_agg(a order by a.nombre), '[]'::jsonb) from (
      select coalesce(nullif(trim(pf.nombre), ''), 'Sin nombre') as nombre,
        regexp_replace(u.email, '^(.)[^@]*(@.*)$', '\1•••\2') as email,
        exists (select 1 from auth.mfa_factors f where f.user_id = r.user_id and f.status = 'verified') as mfa,
        u.last_sign_in_at as ultimo_ingreso,
        (r.user_id = auth.uid()) as soy_yo
      from public.user_roles r
      join auth.users u on u.id = r.user_id
      left join public.perfiles pf on pf.id = r.user_id
      where r.role = 'admin') a),
    'suspendidos', (select count(*) from public.delivery_clientes_control where bloqueado),
    'repartidores_pausados', (select count(*) from public.delivery_repartidores where not activo),
    'controles_pendientes', (select count(*) from public.delivery_repartidores where control_estado is not null),
    'acciones_admin_24h', (select count(*) from public.delivery_auditoria where created_at > now() - interval '24 hours'),
    'errores_24h', (select count(*) from public.delivery_errores where created_at > now() - interval '24 hours')
  );
end $$;

revoke all on function public.delivery_comercio_clientes(uuid, integer) from public, anon;
revoke all on function public.delivery_admin_analitica(integer) from public, anon;
revoke all on function public.delivery_admin_seguridad() from public, anon;
grant execute on function public.delivery_comercio_clientes(uuid, integer) to authenticated;
grant execute on function public.delivery_admin_analitica(integer) to authenticated;
grant execute on function public.delivery_admin_seguridad() to authenticated;
