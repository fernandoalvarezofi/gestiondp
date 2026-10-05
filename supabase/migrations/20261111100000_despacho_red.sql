-- FASE 7 (Red + Despacho), paso 1. El despacho de pedidos ya vive en la base (delivery_puntaje_despacho + ofertas por turnos); esto lo hace TRANSPARENTE y COMÚN a los tres tipos de trabajo:
--  * despacho_motivo_no_elegible(): una sola regla de elegibilidad (activo, verificado, conectado, libre; remís habilitado para viajes).
--  * despacho_componentes_pedido(): desglose del puntaje de un pedido (distancia, carga, rechazos, velocidad, ocupado). Su total tiene que coincidir con delivery_puntaje_despacho (hay una prueba que lo vigila).
--  * despacho_candidatos(): ranking de proveedores para un trabajo sin asignar (pedido, envío o viaje), con el porqué de cada uno. Solo administración.
--  * delivery_admin_asignar_trabajo(): asignación manual unificada (pedido → función existente; envío y viaje con las mismas reglas que "tomar"), auditada.
--  * delivery_admin_red_proveedores(): la red de repartidores/conductores con indicadores de los últimos N días (sale de `trabajos`).
-- No cambia el reparto automático de pedidos ni lo que ven los repartidores. Revertir: drop function despacho_*, delivery_admin_asignar_trabajo, delivery_admin_red_proveedores.

-- Regla única: ¿por qué NO se le puede dar este trabajo? (null = elegible)
create or replace function public.despacho_motivo_no_elegible(p_proveedor uuid, p_origen_tipo text, p_origen_id uuid default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare r public.delivery_repartidores; v_ocupado boolean;
begin
  select * into r from public.delivery_repartidores where perfil_id = p_proveedor;
  if not found or not r.activo then return 'Perfil inactivo'; end if;
  if not r.verificado then return 'Perfil en revisión'; end if;
  if not r.disponible then return 'Desconectado'; end if;
  if p_origen_tipo = 'viaje' then
    if r.remis_estado is distinct from 'aprobado' or not r.acepta_remis then return 'Sin habilitación de remís'; end if;
    if r.control_estado is not null then return 'Control de identidad pendiente'; end if;
  end if;
  v_ocupado := public.delivery_repartidor_ocupado(p_proveedor);
  if v_ocupado then
    -- Un pedido puede sumarse a lo que ya lleva si el reparto en lote lo permite.
    if not (p_origen_tipo = 'pedido' and p_origen_id is not null and public.delivery_batch_ok(p_proveedor, p_origen_id)) then return 'Ocupado'; end if;
  end if;
  if p_origen_tipo = 'pedido' and p_origen_id is not null and not public.delivery_capacidad_ok(p_proveedor, p_origen_id) then return 'Sin capacidad para este pedido'; end if;
  if p_origen_tipo = 'pedido' and p_origen_id is not null and exists (select 1 from public.delivery_ofertas_rechazos j where j.pedido_id = p_origen_id and j.repartidor_id = p_proveedor) then return 'Ya rechazó este pedido'; end if;
  return null;
end $$;

-- Desglose del puntaje de un pedido (menor puntaje = mejor candidato). Espeja delivery_puntaje_despacho.
create or replace function public.despacho_componentes_pedido(p_rep uuid, p_pedido uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_dist numeric := 9999; r public.delivery_repartidores; v_loc public.delivery_ubicaciones; c public.delivery_comercios; v_recent integer; v_speed numeric;
  v_base numeric := public.delivery_ajuste('velocidad_base_kmh', 18); v_rech numeric; v_vel numeric; v_ocu numeric;
begin
  select * into r from public.delivery_repartidores where perfil_id = p_rep;
  select cc.* into c from public.delivery_pedidos p join public.delivery_comercios cc on cc.id = p.comercio_id where p.id = p_pedido;
  select * into v_loc from public.delivery_ubicaciones where repartidor_id = p_rep and updated_at > now() - interval '15 minutes';
  if found and c.latitud is not null then v_dist := public.delivery_distancia_km(v_loc.latitud, v_loc.longitud, c.latitud, c.longitud); end if;
  select count(*) into v_recent from public.delivery_pedidos x where x.repartidor_id = p_rep and x.asignado_at > now() - interval '3 hours';
  v_speed := public.delivery_velocidad_repartidor(p_rep);
  v_rech := coalesce(r.rechazadas, 0)::numeric / greatest(coalesce(r.aceptadas, 0) + coalesce(r.rechazadas, 0), 1) * 1.5;
  v_vel := - least(1, greatest(-1, (v_speed - v_base) / v_base)) * 0.5;
  v_ocu := - case when public.delivery_repartidor_ocupado(p_rep) then 1 else 0 end;
  return jsonb_build_object('distancia', v_dist, 'carga', v_recent * 0.25, 'rechazos', round(v_rech, 3), 'velocidad', round(v_vel, 3), 'ocupado', v_ocu,
                            'total', round(v_dist + v_recent * 0.25 + v_rech + v_vel + v_ocu, 3));
end $$;

-- Ranking de candidatos para un trabajo sin asignar. Solo administración.
create or replace function public.despacho_candidatos(p_origen_tipo text, p_origen_id uuid, p_limite integer default 10) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_lat numeric; v_lng numeric; v_estado text;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  if p_origen_tipo not in ('pedido', 'envio', 'viaje') then raise exception 'Tipo de trabajo inválido'; end if;
  select recogida_lat, recogida_lng, estado into v_lat, v_lng, v_estado from public.trabajos where origen_tipo = p_origen_tipo and origen_id = p_origen_id;
  if not found then raise exception 'Trabajo no encontrado'; end if;
  if v_estado <> 'pendiente' and not (p_origen_tipo = 'pedido' and v_estado = 'asignado') then raise exception 'Este trabajo ya no está sin asignar'; end if;
  return coalesce((
    select jsonb_agg(q.obj order by q.elegible desc, q.puntaje, q.pid) from (
      select r.perfil_id as pid, (m.motivo is null) as elegible, s.puntaje,
        jsonb_build_object(
          'proveedor_id', r.perfil_id, 'nombre', coalesce(nullif(trim(pf.nombre), ''), 'Sin nombre'), 'vehiculo', r.vehiculo,
          'elegible', m.motivo is null, 'motivo_no', m.motivo, 'ocupado', public.delivery_repartidor_ocupado(r.perfil_id),
          'distancia_km', case when u.latitud is not null and v_lat is not null then round(public.delivery_distancia_km(u.latitud, u.longitud, v_lat, v_lng), 2) end,
          'ubicacion_hace_min', case when u.updated_at is not null then (extract(epoch from now() - u.updated_at) / 60)::integer end,
          'componentes', case when p_origen_tipo = 'pedido' then public.despacho_componentes_pedido(r.perfil_id, p_origen_id) end,
          'puntaje', s.puntaje) as obj
      from public.delivery_repartidores r
      left join public.perfiles pf on pf.id = r.perfil_id
      left join public.delivery_ubicaciones u on u.repartidor_id = r.perfil_id and u.updated_at > now() - interval '15 minutes'
      cross join lateral (select public.despacho_motivo_no_elegible(r.perfil_id, p_origen_tipo, p_origen_id) as motivo) m
      cross join lateral (select case when p_origen_tipo = 'pedido' then public.delivery_puntaje_despacho(r.perfil_id, p_origen_id)
                        else round(coalesce(case when u.latitud is not null and v_lat is not null then public.delivery_distancia_km(u.latitud, u.longitud, v_lat, v_lng) end, 9999)
                          + (select count(*) from public.trabajos t where t.proveedor_id = r.perfil_id and t.asignado_at > now() - interval '3 hours') * 0.25
                          + coalesce(r.rechazadas, 0)::numeric / greatest(coalesce(r.aceptadas, 0) + coalesce(r.rechazadas, 0), 1) * 1.5, 3) end as puntaje) s
      where r.activo and (p_origen_tipo <> 'viaje' or r.acepta_remis)
      order by (m.motivo is null) desc, s.puntaje, r.perfil_id
      limit least(greatest(coalesce(p_limite, 10), 1), 30)) q), '[]'::jsonb);
end $$;

-- Asignación manual unificada, con las mismas reglas que cuando el proveedor toma el trabajo. Queda en la auditoría.
create or replace function public.delivery_admin_asignar_trabajo(p_origen_tipo text, p_origen_id uuid, p_proveedor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_motivo text;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  if p_origen_tipo = 'pedido' then
    perform public.delivery_admin_asignar_pedido(p_origen_id, p_proveedor);
    return;
  end if;
  v_motivo := public.despacho_motivo_no_elegible(p_proveedor, p_origen_tipo, p_origen_id);
  if v_motivo is not null then raise exception 'No se puede asignar a esta persona: %', lower(v_motivo); end if;
  if p_origen_tipo = 'envio' then
    update public.delivery_envios set repartidor_id = p_proveedor, estado = 'asignado', asignado_at = now(), updated_at = now() where id = p_origen_id and estado = 'buscando' and repartidor_id is null;
    if not found then raise exception 'El envío ya no está disponible'; end if;
  elsif p_origen_tipo = 'viaje' then
    update public.delivery_viajes set conductor_id = p_proveedor, estado = 'asignado', asignado_at = now(), updated_at = now() where id = p_origen_id and estado = 'buscando' and conductor_id is null;
    if not found then raise exception 'El viaje ya no está disponible'; end if;
  else
    raise exception 'Tipo de trabajo inválido';
  end if;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle) values (auth.uid(), p_origen_tipo || '.asignar', 'delivery_' || p_origen_tipo || 's', p_origen_id::text, jsonb_build_object('proveedor', p_proveedor, 'manual', true));
end $$;

-- La red: cada repartidor/conductor con sus indicadores de los últimos N días.
create or replace function public.delivery_admin_red_proveedores(p_dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_dias integer := least(greatest(coalesce(p_dias, 30), 1), 365);
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return jsonb_build_object(
    'dias', v_dias,
    'resumen', jsonb_build_object(
      'total', (select count(*) from public.delivery_repartidores where activo),
      'conectados', (select count(*) from public.delivery_repartidores where activo and verificado and disponible),
      'en_revision', (select count(*) from public.delivery_repartidores where activo and not verificado)),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'proveedor_id', r.perfil_id, 'nombre', coalesce(nullif(trim(pf.nombre), ''), 'Sin nombre'), 'vehiculo', r.vehiculo, 'activo', r.activo, 'verificado', r.verificado, 'conectado', r.disponible,
        'conductor_remis', coalesce(r.remis_estado = 'aprobado' and r.acepta_remis, false), 'ocupado', public.delivery_repartidor_ocupado(r.perfil_id),
        'ubicacion_hace_min', (select (extract(epoch from now() - u.updated_at) / 60)::integer from public.delivery_ubicaciones u where u.repartidor_id = r.perfil_id),
        'completados', coalesce(k.completados, 0), 'cancelados', coalesce(k.cancelados, 0), 'ganancia', coalesce(k.ganancia, 0), 'minutos_promedio', k.minutos,
        'aceptacion_pct', case when coalesce(r.aceptadas, 0) + coalesce(r.rechazadas, 0) > 0 then round(coalesce(r.aceptadas, 0)::numeric * 100 / (coalesce(r.aceptadas, 0) + coalesce(r.rechazadas, 0))) end,
        'soltados', r.soltados) order by coalesce(k.completados, 0) desc, r.created_at)
      from public.delivery_repartidores r
      left join public.perfiles pf on pf.id = r.perfil_id
      left join lateral (select count(*) filter (where t.estado = 'completado') completados, count(*) filter (where t.estado = 'cancelado') cancelados,
                                sum(t.ganancia_proveedor) filter (where t.estado = 'completado') ganancia,
                                round(avg(extract(epoch from t.completado_at - t.asignado_at) / 60) filter (where t.estado = 'completado' and t.asignado_at is not null and t.completado_at is not null)) minutos
                           from public.trabajos t where t.proveedor_id = r.perfil_id and t.created_at > now() - make_interval(days => v_dias)) k on true
      where r.activo), '[]'::jsonb));
end $$;

revoke all on function public.despacho_motivo_no_elegible(uuid, text, uuid), public.despacho_componentes_pedido(uuid, uuid) from public, anon, authenticated;
revoke all on function public.despacho_candidatos(text, uuid, integer), public.delivery_admin_asignar_trabajo(text, uuid, uuid), public.delivery_admin_red_proveedores(integer) from public, anon;
grant execute on function public.despacho_candidatos(text, uuid, integer), public.delivery_admin_asignar_trabajo(text, uuid, uuid), public.delivery_admin_red_proveedores(integer) to authenticated;
