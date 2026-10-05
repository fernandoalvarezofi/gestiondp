-- FASE 6 (Logística), paso 1: capa común de TRABAJOS (JOB) para toda operación física: entrega de un pedido, mensajería entre personas y viaje.
-- Es un modelo de lectura ADITIVO: los pedidos, envíos y viajes siguen siendo la fuente de verdad y no cambian; unos disparadores copian su estado
-- a `trabajos` (normalizado: pendiente / asignado / en_curso / completado / cancelado) y dejan una línea de tiempo en `trabajos_eventos`.
-- Los disparadores NUNCA bloquean la operación original: si fallan, avisan con WARNING y siguen.
-- Sobre esta capa se construyen el seguimiento común, el tablero de administración y, en la Fase 7, el motor de despacho.
-- Revertir: drop trigger trabajo_sync_* ...; drop function trabajo_*, delivery_admin_trabajos; drop table trabajos_eventos, trabajos.

create table if not exists public.trabajos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('delivery', 'envio', 'viaje', 'retiro', 'servicio', 'otro')),
  origen_tipo text not null check (origen_tipo in ('pedido', 'envio', 'viaje')),
  origen_id uuid not null,
  estado text not null check (estado in ('pendiente', 'asignado', 'en_curso', 'completado', 'cancelado')),
  estado_origen text not null,
  cliente_id uuid,
  comercio_id uuid,
  proveedor_id uuid,
  recogida_direccion text, recogida_lat numeric, recogida_lng numeric,
  entrega_direccion text, entrega_lat numeric, entrega_lng numeric,
  distancia_km numeric,
  monto numeric(12, 2),
  ganancia_proveedor numeric(12, 2),
  asignado_at timestamptz, iniciado_at timestamptz, completado_at timestamptz, cancelado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origen_tipo, origen_id)
);
create index if not exists trabajos_estado_idx on public.trabajos (estado, created_at desc);
create index if not exists trabajos_proveedor_idx on public.trabajos (proveedor_id) where proveedor_id is not null;
create index if not exists trabajos_cliente_idx on public.trabajos (cliente_id) where cliente_id is not null;
create index if not exists trabajos_comercio_idx on public.trabajos (comercio_id) where comercio_id is not null;

create table if not exists public.trabajos_eventos (
  id bigint generated always as identity primary key,
  trabajo_id uuid not null references public.trabajos (id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  estado_origen text,
  proveedor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists trabajos_eventos_idx on public.trabajos_eventos (trabajo_id, id);

-- Sin acceso directo: tienen direcciones y datos de clientes. Se lee con funciones que validan quién pregunta.
alter table public.trabajos enable row level security;
alter table public.trabajos_eventos enable row level security;
revoke all on public.trabajos, public.trabajos_eventos from anon, authenticated;
grant all on public.trabajos, public.trabajos_eventos to service_role;

create or replace function public.trabajos_eventos_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and (current_setting('woref.trabajos_mantenimiento', true) = '1' or pg_trigger_depth() > 1) then return old; end if;
  raise exception 'La línea de tiempo de un trabajo no se puede modificar';
end $$;
drop trigger if exists trabajos_eventos_inmutable on public.trabajos_eventos;
create trigger trabajos_eventos_inmutable before update or delete on public.trabajos_eventos for each row execute function public.trabajos_eventos_inmutable();

-- Estados normalizados ------------------------------------------------------------------------------------------------------
create or replace function public.trabajo_estado_pedido(p_estado text, p_repartidor uuid) returns text
language sql immutable set search_path = public as $$
  select case when p_estado = 'cancelado' then 'cancelado' when p_estado = 'entregado' then 'completado' when p_estado = 'en_camino' then 'en_curso'
              when p_repartidor is not null then 'asignado' else 'pendiente' end $$;
create or replace function public.trabajo_estado_envio(p_estado text) returns text
language sql immutable set search_path = public as $$
  select case p_estado when 'asignado' then 'asignado' when 'retirado' then 'en_curso' when 'entregado' then 'completado' when 'cancelado' then 'cancelado' else 'pendiente' end $$;
create or replace function public.trabajo_estado_viaje(p_estado text) returns text
language sql immutable set search_path = public as $$
  select case p_estado when 'asignado' then 'asignado' when 'en_origen' then 'en_curso' when 'a_bordo' then 'en_curso' when 'completado' then 'completado' when 'cancelado' then 'cancelado' else 'pendiente' end $$;

-- Copia el estado y deja la línea de tiempo. Nunca rompe la operación original.
create or replace function public.trabajo_registrar(p_tipo text, p_origen_tipo text, p_origen_id uuid, p_estado text, p_estado_origen text, p_cliente uuid, p_comercio uuid, p_proveedor uuid,
  p_rec_dir text, p_rec_lat numeric, p_rec_lng numeric, p_ent_dir text, p_ent_lat numeric, p_ent_lng numeric, p_km numeric, p_monto numeric, p_ganancia numeric,
  p_asignado timestamptz, p_iniciado timestamptz, p_completado timestamptz, p_cancelado timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare v_ant text; v_id uuid; v_prov_ant uuid;
begin
  select id, estado, proveedor_id into v_id, v_ant, v_prov_ant from public.trabajos where origen_tipo = p_origen_tipo and origen_id = p_origen_id;
  if v_id is null then
    insert into public.trabajos (tipo, origen_tipo, origen_id, estado, estado_origen, cliente_id, comercio_id, proveedor_id, recogida_direccion, recogida_lat, recogida_lng, entrega_direccion, entrega_lat, entrega_lng, distancia_km, monto, ganancia_proveedor, asignado_at, iniciado_at, completado_at, cancelado_at)
      values (p_tipo, p_origen_tipo, p_origen_id, p_estado, p_estado_origen, p_cliente, p_comercio, p_proveedor, p_rec_dir, p_rec_lat, p_rec_lng, p_ent_dir, p_ent_lat, p_ent_lng, p_km, p_monto, p_ganancia, p_asignado, p_iniciado, p_completado, p_cancelado) returning id into v_id;
    insert into public.trabajos_eventos (trabajo_id, estado_anterior, estado_nuevo, estado_origen, proveedor_id) values (v_id, null, p_estado, p_estado_origen, p_proveedor);
  else
    update public.trabajos set estado = p_estado, estado_origen = p_estado_origen, cliente_id = p_cliente, comercio_id = p_comercio, proveedor_id = p_proveedor,
        recogida_direccion = p_rec_dir, recogida_lat = p_rec_lat, recogida_lng = p_rec_lng, entrega_direccion = p_ent_dir, entrega_lat = p_ent_lat, entrega_lng = p_ent_lng,
        distancia_km = p_km, monto = p_monto, ganancia_proveedor = p_ganancia, asignado_at = p_asignado, iniciado_at = p_iniciado, completado_at = p_completado, cancelado_at = p_cancelado, updated_at = now()
     where id = v_id;
    -- Evento cuando cambia el estado o quién lo lleva (reasignación).
    if v_ant is distinct from p_estado or v_prov_ant is distinct from p_proveedor then
      insert into public.trabajos_eventos (trabajo_id, estado_anterior, estado_nuevo, estado_origen, proveedor_id) values (v_id, v_ant, p_estado, p_estado_origen, p_proveedor);
    end if;
  end if;
end $$;
revoke all on function public.trabajo_registrar(text, text, uuid, text, text, uuid, uuid, uuid, text, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.trabajo_sync_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_com public.delivery_comercios;
begin
  begin
    if new.tipo_entrega is distinct from 'delivery' then return null; end if;
    select * into v_com from public.delivery_comercios where id = new.comercio_id;
    perform public.trabajo_registrar('delivery', 'pedido', new.id, public.trabajo_estado_pedido(new.estado::text, new.repartidor_id), new.estado::text, new.cliente_id, new.comercio_id, new.repartidor_id,
      v_com.direccion, v_com.latitud, v_com.longitud, new.direccion_entrega, new.latitud, new.longitud, new.distancia_km, coalesce(new.costo_envio, 0) + coalesce(new.propina, 0), new.ganancia_repartidor,
      new.asignado_at, new.en_camino_at, new.entregado_at, new.cancelado_at);
  exception when others then raise warning 'trabajo_sync_pedido % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
create or replace function public.trabajo_sync_envio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.trabajo_registrar('envio', 'envio', new.id, public.trabajo_estado_envio(new.estado), new.estado, new.cliente_id, null, new.repartidor_id,
      new.origen_direccion, new.origen_lat, new.origen_lng, new.destino_direccion, new.destino_lat, new.destino_lng, new.distancia_km, new.total, new.ganancia_repartidor,
      new.asignado_at, new.retirado_at, new.entregado_at, new.cancelado_at);
  exception when others then raise warning 'trabajo_sync_envio % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
create or replace function public.trabajo_sync_viaje() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.trabajo_registrar('viaje', 'viaje', new.id, public.trabajo_estado_viaje(new.estado), new.estado, new.cliente_id, null, new.conductor_id,
      new.origen_direccion, new.origen_lat, new.origen_lng, new.destino_direccion, new.destino_lat, new.destino_lng, new.distancia_km, new.total, new.ganancia_conductor,
      new.asignado_at, new.abordo_at, new.completado_at, new.cancelado_at);
  exception when others then raise warning 'trabajo_sync_viaje % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trabajo_sync_pedido on public.delivery_pedidos;
create trigger trabajo_sync_pedido after insert or update of estado, repartidor_id, tipo_entrega, asignado_at, en_camino_at, entregado_at, cancelado_at, ganancia_repartidor, latitud, longitud on public.delivery_pedidos for each row execute function public.trabajo_sync_pedido();
drop trigger if exists trabajo_sync_envio on public.delivery_envios;
create trigger trabajo_sync_envio after insert or update on public.delivery_envios for each row execute function public.trabajo_sync_envio();
drop trigger if exists trabajo_sync_viaje on public.delivery_viajes;
create trigger trabajo_sync_viaje after insert or update on public.delivery_viajes for each row execute function public.trabajo_sync_viaje();

-- Relleno de lo que ya existe (una vez; sin eventos históricos más que el estado actual).
insert into public.trabajos (tipo, origen_tipo, origen_id, estado, estado_origen, cliente_id, comercio_id, proveedor_id, recogida_direccion, recogida_lat, recogida_lng, entrega_direccion, entrega_lat, entrega_lng, distancia_km, monto, ganancia_proveedor, asignado_at, iniciado_at, completado_at, cancelado_at, created_at)
  select 'delivery', 'pedido', p.id, public.trabajo_estado_pedido(p.estado::text, p.repartidor_id), p.estado::text, p.cliente_id, p.comercio_id, p.repartidor_id, c.direccion, c.latitud, c.longitud, p.direccion_entrega, p.latitud, p.longitud, p.distancia_km,
         coalesce(p.costo_envio, 0) + coalesce(p.propina, 0), p.ganancia_repartidor, p.asignado_at, p.en_camino_at, p.entregado_at, p.cancelado_at, p.created_at
    from public.delivery_pedidos p join public.delivery_comercios c on c.id = p.comercio_id where p.tipo_entrega = 'delivery'
  on conflict (origen_tipo, origen_id) do nothing;
insert into public.trabajos (tipo, origen_tipo, origen_id, estado, estado_origen, cliente_id, proveedor_id, recogida_direccion, recogida_lat, recogida_lng, entrega_direccion, entrega_lat, entrega_lng, distancia_km, monto, ganancia_proveedor, asignado_at, iniciado_at, completado_at, cancelado_at, created_at)
  select 'envio', 'envio', e.id, public.trabajo_estado_envio(e.estado), e.estado, e.cliente_id, e.repartidor_id, e.origen_direccion, e.origen_lat, e.origen_lng, e.destino_direccion, e.destino_lat, e.destino_lng, e.distancia_km, e.total, e.ganancia_repartidor, e.asignado_at, e.retirado_at, e.entregado_at, e.cancelado_at, e.created_at
    from public.delivery_envios e on conflict (origen_tipo, origen_id) do nothing;
insert into public.trabajos (tipo, origen_tipo, origen_id, estado, estado_origen, cliente_id, proveedor_id, recogida_direccion, recogida_lat, recogida_lng, entrega_direccion, entrega_lat, entrega_lng, distancia_km, monto, ganancia_proveedor, asignado_at, iniciado_at, completado_at, cancelado_at, created_at)
  select 'viaje', 'viaje', v.id, public.trabajo_estado_viaje(v.estado), v.estado, v.cliente_id, v.conductor_id, v.origen_direccion, v.origen_lat, v.origen_lng, v.destino_direccion, v.destino_lat, v.destino_lng, v.distancia_km, v.total, v.ganancia_conductor, v.asignado_at, v.abordo_at, v.completado_at, v.cancelado_at, v.created_at
    from public.delivery_viajes v on conflict (origen_tipo, origen_id) do nothing;

-- Seguimiento común: estado, línea de tiempo, quién lo lleva y, mientras está en marcha, su ubicación. Solo para quien corresponde.
create or replace function public.trabajo_seguimiento(p_origen_tipo text, p_origen_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.trabajos; v_es_admin boolean := coalesce(public.has_role(auth.uid(), 'admin'::app_role), false); v_lat numeric; v_lng numeric; v_upd timestamptz; v_nombre text; v_vehiculo text; v_eta timestamptz; v_ve_ubicacion boolean;
begin
  if auth.uid() is null then raise exception 'Ingresá para ver el seguimiento'; end if;
  select * into t from public.trabajos where origen_tipo = p_origen_tipo and origen_id = p_origen_id;
  if not found then raise exception 'Seguimiento no encontrado'; end if;
  if not (v_es_admin or t.cliente_id = auth.uid() or t.proveedor_id = auth.uid() or (t.comercio_id is not null and public.delivery_permiso(t.comercio_id, 'pedidos'))) then raise exception 'Seguimiento no encontrado'; end if;
  v_ve_ubicacion := t.estado in ('asignado', 'en_curso') and t.proveedor_id is not null and (v_es_admin or t.cliente_id = auth.uid() or t.comercio_id is not null);
  if v_ve_ubicacion then
    select latitud, longitud, updated_at into v_lat, v_lng, v_upd from public.delivery_ubicaciones where repartidor_id = t.proveedor_id and updated_at > now() - interval '5 minutes';
  end if;
  select nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), r.vehiculo into v_nombre, v_vehiculo from public.delivery_repartidores r left join public.perfiles pf on pf.id = r.perfil_id where r.perfil_id = t.proveedor_id;
  if t.origen_tipo = 'pedido' then select entrega_estimada into v_eta from public.delivery_pedidos where id = t.origen_id; end if;
  return jsonb_build_object(
    'tipo', t.tipo, 'estado', t.estado, 'estado_origen', t.estado_origen, 'creado', t.created_at, 'actualizado', t.updated_at,
    'recogida', jsonb_build_object('direccion', t.recogida_direccion, 'lat', t.recogida_lat, 'lng', t.recogida_lng),
    'entrega', jsonb_build_object('direccion', t.entrega_direccion, 'lat', t.entrega_lat, 'lng', t.entrega_lng),
    'proveedor', case when t.proveedor_id is not null then jsonb_build_object('nombre', v_nombre, 'vehiculo', v_vehiculo) end,
    'ubicacion', case when v_lat is not null then jsonb_build_object('lat', v_lat, 'lng', v_lng, 'hace_seg', greatest(0, extract(epoch from now() - v_upd)::integer)) end,
    'eta_min', case when v_eta is not null and t.estado in ('asignado', 'en_curso') then greatest(0, ceil(extract(epoch from v_eta - now()) / 60)::integer) end,
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('estado', e.estado_nuevo, 'desde', e.estado_anterior, 'cuando', e.created_at) order by e.id) from public.trabajos_eventos e where e.trabajo_id = t.id), '[]'::jsonb));
end $$;

-- Tablero de administración: conteos y últimos trabajos, con filtros.
create or replace function public.delivery_admin_trabajos(p_estado text default null, p_tipo text default null, p_limite integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return jsonb_build_object(
    'por_estado', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from public.trabajos where (p_tipo is null or tipo = p_tipo) group by 1) x), '{}'::jsonb),
    'por_tipo', coalesce((select jsonb_object_agg(tipo, n) from (select tipo, count(*) n from public.trabajos where (p_estado is null or estado = p_estado) group by 1) x), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'origen_tipo', t.origen_tipo, 'origen_id', t.origen_id, 'tipo', t.tipo, 'estado', t.estado, 'estado_origen', t.estado_origen,
          'proveedor', nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), 'recogida', t.recogida_direccion, 'entrega', t.entrega_direccion, 'distancia_km', t.distancia_km, 'monto', t.monto,
          'creado', t.created_at, 'minutos_sin_asignar', case when t.estado = 'pendiente' then (extract(epoch from now() - t.created_at) / 60)::integer end) order by t.created_at desc)
        from (select * from public.trabajos where (p_estado is null or estado = p_estado) and (p_tipo is null or tipo = p_tipo) order by created_at desc limit least(greatest(coalesce(p_limite, 100), 1), 300)) t
        left join public.perfiles pf on pf.id = t.proveedor_id), '[]'::jsonb));
end $$;

revoke all on function public.trabajo_seguimiento(text, uuid), public.delivery_admin_trabajos(text, text, integer) from public, anon;
grant execute on function public.trabajo_seguimiento(text, uuid), public.delivery_admin_trabajos(text, text, integer) to authenticated;
