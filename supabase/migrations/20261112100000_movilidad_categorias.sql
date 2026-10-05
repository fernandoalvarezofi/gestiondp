-- FASE 8 (Movilidad), paso 1. Los viajes (delivery_viajes) ya tienen estados validados en el servidor, código de abordaje, tarifa por zona, recargo nocturno y reservas.
-- Esto suma lo que faltaba:
--  * Categorías de vehículo (estándar / confort / familiar) con capacidad y multiplicador de tarifa configurables, y conductores habilitados por categoría (solo administración las asigna).
--  * Datos del vehículo del conductor (marca, modelo, color, año) que ve el pasajero junto con la patente.
--  * Privacidad: el pasajero ve el teléfono del conductor SOLO mientras el viaje está en curso (antes lo veía para siempre) y los datos del conductor hasta 24 h después de terminado.
-- Equivalencia de estados con el esquema general: buscando=SEARCHING, asignado=DRIVER_ASSIGNED, en_origen=DRIVER_ARRIVED, a_bordo=IN_PROGRESS, completado=COMPLETED, cancelado=CANCELLED. Sin tarifa dinámica por demanda.
-- Revertir: ver cada bloque (columnas, funciones y filas de delivery_ajustes son aditivas; las funciones con firma nueva conservan las llamadas anteriores porque el parámetro nuevo tiene valor por defecto).

create or replace function public.remis_categorias_validas(a text[]) returns boolean
language sql immutable set search_path = public as $$
  select a is not null and coalesce(array_length(a, 1), 0) between 1 and 3 and a <@ array['estandar', 'confort', 'familiar']::text[] $$;
create or replace function public.remis_capacidad(p_categoria text) returns integer
language sql immutable set search_path = public as $$ select case p_categoria when 'estandar' then 4 when 'confort' then 4 when 'familiar' then 6 end $$;

alter table public.delivery_repartidores
  add column if not exists vehiculo_marca text check (vehiculo_marca is null or char_length(vehiculo_marca) between 2 and 40),
  add column if not exists vehiculo_modelo text check (vehiculo_modelo is null or char_length(vehiculo_modelo) between 1 and 40),
  add column if not exists vehiculo_color text check (vehiculo_color is null or char_length(vehiculo_color) between 3 and 30),
  add column if not exists vehiculo_anio integer check (vehiculo_anio is null or vehiculo_anio between 1990 and 2100),
  add column if not exists remis_categorias text[] not null default array['estandar']::text[] check (public.remis_categorias_validas(remis_categorias));
alter table public.delivery_viajes add column if not exists categoria text not null default 'estandar' check (categoria in ('estandar', 'confort', 'familiar'));

insert into public.delivery_ajustes (clave, valor, etiqueta, ayuda, unidad, minimo, maximo) values
  ('remis_mult_confort', 1.25, 'Remís confort: multiplicador de tarifa', 'Cuánto más cuesta un viaje confort que uno estándar (1,25 = 25% más).', 'x', 1, 3),
  ('remis_mult_familiar', 1.5, 'Remís familiar: multiplicador de tarifa', 'Cuánto más cuesta un viaje familiar (hasta 6 pasajeros) que uno estándar.', 'x', 1, 3)
on conflict (clave) do nothing;

-- El conductor NO puede cambiarse las categorías habilitadas (igual que no puede aprobarse a sí mismo).
do $m$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'delivery_proteger_repartidor';
  if v_def is null then raise exception 'delivery_proteger_repartidor no existe'; end if;
  if position('remis_categorias' in v_def) > 0 then return; end if;
  if position('NEW.remis_estado := NULL; NEW.remis_motivo := NULL; NEW.acepta_remis := false;' in v_def) = 0 or position('NEW.remis_estado := OLD.remis_estado; NEW.remis_motivo := OLD.remis_motivo;' in v_def) = 0 then raise exception 'delivery_proteger_repartidor no tiene la forma esperada'; end if;
  v_def := replace(v_def, 'NEW.remis_estado := NULL; NEW.remis_motivo := NULL; NEW.acepta_remis := false;', 'NEW.remis_estado := NULL; NEW.remis_motivo := NULL; NEW.acepta_remis := false; NEW.remis_categorias := ARRAY[''estandar'']::text[];');
  v_def := replace(v_def, 'NEW.remis_estado := OLD.remis_estado; NEW.remis_motivo := OLD.remis_motivo;', 'NEW.remis_estado := OLD.remis_estado; NEW.remis_motivo := OLD.remis_motivo; NEW.remis_categorias := OLD.remis_categorias;');
  execute v_def;
end $m$;

-- Cotización con categoría (el parámetro nuevo es opcional: las llamadas anteriores siguen funcionando).
drop function if exists public.delivery_cotizar_viaje(numeric, numeric, numeric, numeric, timestamptz);
create or replace function public.delivery_cotizar_viaje(p_olat numeric, p_olng numeric, p_dlat numeric, p_dlng numeric, p_programado timestamptz default null, p_categoria text default 'estandar') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_km numeric; v_base numeric; v_costo numeric; v_comision numeric := public.delivery_ajuste('remis_comision_pct', 15);
  c_lat constant numeric := -34.8667; c_lng constant numeric := -61.5333;
  v_to jsonb; v_td jsonb; v_t jsonb; v_hora integer; v_noct boolean; v_min integer; v_mult numeric;
begin
  if p_categoria is null or p_categoria not in ('estandar', 'confort', 'familiar') then return jsonb_build_object('ok', false, 'motivo', 'Elegí una categoría de vehículo válida'); end if;
  v_mult := case p_categoria when 'confort' then public.delivery_ajuste('remis_mult_confort', 1.25) when 'familiar' then public.delivery_ajuste('remis_mult_familiar', 1.5) else 1 end;
  if p_olat is null or p_olng is null or p_dlat is null or p_dlng is null
     or p_olat not between -90 and 90 or p_dlat not between -90 and 90 or p_olng not between -180 and 180 or p_dlng not between -180 and 180 then
    return jsonb_build_object('ok', false, 'motivo', 'Marcá el origen y el destino en el mapa');
  end if;
  if public.delivery_distancia_km(p_olat, p_olng, c_lat, c_lng) > public.delivery_ajuste('remis_radio_km', 25)
     or public.delivery_distancia_km(p_dlat, p_dlng, c_lat, c_lng) > public.delivery_ajuste('remis_radio_km', 25) then
    return jsonb_build_object('ok', false, 'motivo', 'Por ahora los viajes son dentro de Lincoln y alrededores');
  end if;
  v_km := public.delivery_ruta_km(p_olat, p_olng, p_dlat, p_dlng);
  if v_km < 0.2 then return jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'El origen y el destino son el mismo lugar'); end if;
  if v_km > public.delivery_ajuste('remis_max_km', 40) then
    return jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'La distancia máxima por viaje es de ' || public.delivery_ajuste('remis_max_km', 40) || ' km');
  end if;
  v_to := public.delivery_tarifa_zona(p_olat, p_olng); v_td := public.delivery_tarifa_zona(p_dlat, p_dlng);
  if (v_to->>'cerrada')::boolean then return jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no buscamos pasajeros en ' || (v_to->>'zona')); end if;
  if (v_td->>'cerrada')::boolean then return jsonb_build_object('ok', false, 'km', v_km, 'motivo', 'Por ahora no llevamos pasajeros a ' || (v_td->>'zona')); end if;
  v_t := case when (v_to->>'multiplicador')::numeric >= (v_td->>'multiplicador')::numeric then v_to else v_td end;
  v_t := jsonb_set(v_t, '{recargo}', to_jsonb(greatest((v_to->>'recargo')::numeric, (v_td->>'recargo')::numeric)));
  v_base := greatest(public.delivery_ajuste('remis_minima', 2800), public.delivery_ajuste('remis_base', 1800) + public.delivery_ajuste('remis_por_km', 700) * v_km) * v_mult;
  v_costo := public.delivery_aplicar_tarifa(v_base, v_t);
  v_hora := extract(hour from coalesce(p_programado, now()) at time zone 'America/Argentina/Buenos_Aires')::int;
  v_noct := v_hora >= 22 or v_hora < 6;
  if v_noct then v_costo := v_costo * (1 + public.delivery_ajuste('remis_nocturno_pct', 20) / 100); end if;
  v_costo := round(v_costo / 50) * 50;
  v_min := ceil(v_km / 35 * 60)::int + 3;
  return jsonb_build_object('ok', true, 'km', v_km, 'minutos', v_min, 'costo', v_costo, 'costo_base', v_base, 'tarifa', v_t, 'nocturno', v_noct, 'comision_pct', v_comision,
    'categoria', p_categoria, 'multiplicador', v_mult, 'capacidad', public.remis_capacidad(p_categoria), 'ganancia', round(v_costo * (1 - v_comision / 100) / 10) * 10);
end $$;
revoke all on function public.delivery_cotizar_viaje(numeric, numeric, numeric, numeric, timestamptz, text) from public, anon;
grant execute on function public.delivery_cotizar_viaje(numeric, numeric, numeric, numeric, timestamptz, text) to authenticated;

-- Crear viaje con categoría (valida la capacidad).
drop function if exists public.delivery_crear_viaje(text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric);
create or replace function public.delivery_crear_viaje(p_origen text, p_olat numeric, p_olng numeric, p_destino text, p_dlat numeric, p_dlng numeric, p_pasajeros integer, p_notas text, p_telefono text, p_programado timestamptz, p_propina numeric, p_categoria text default 'estandar') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_q jsonb; v_id uuid; v_propina numeric := coalesce(p_propina, 0); v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g');
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para pedir un remís'; end if;
  if exists (select 1 from public.delivery_clientes_control where perfil_id = auth.uid() and bloqueado) then raise exception 'Tu cuenta está bloqueada. Escribinos desde Ayuda'; end if;
  if p_categoria is null or p_categoria not in ('estandar', 'confort', 'familiar') then raise exception 'Elegí una categoría de vehículo válida'; end if;
  if p_pasajeros is null or p_pasajeros not between 1 and 6 then raise exception 'Los pasajeros van de 1 a 6'; end if;
  if p_pasajeros > public.remis_capacidad(p_categoria) then raise exception 'Esa categoría lleva hasta % pasajeros. Elegí la familiar para más personas', public.remis_capacidad(p_categoria); end if;
  if char_length(regexp_replace(v_tel, '\D', '', 'g')) < 8 then raise exception 'Dejanos un teléfono para que el conductor te contacte'; end if;
  if v_propina < 0 or v_propina > 10000 or v_propina <> floor(v_propina) then raise exception 'La propina tiene que ser un monto entero hasta $10.000'; end if;
  if p_programado is not null and (p_programado < now() + interval '30 minutes' or p_programado > now() + interval '7 days') then raise exception 'Reservá con al menos 30 minutos de anticipación y hasta 7 días'; end if;
  if (select count(*) from public.delivery_viajes where cliente_id = auth.uid() and estado in ('buscando', 'asignado', 'en_origen', 'a_bordo')) >= 2 then raise exception 'Ya tenés 2 viajes en curso. Esperá a que termine alguno.'; end if;
  v_q := public.delivery_cotizar_viaje(p_olat, p_olng, p_dlat, p_dlng, p_programado, p_categoria);
  if not (v_q->>'ok')::boolean then raise exception '%', v_q->>'motivo'; end if;
  insert into public.delivery_viajes (cliente_id, origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, pasajeros, notas, telefono, programado_para,
      distancia_km, minutos_estimados, tarifa, propina, total, comision_pct, ganancia_conductor, categoria)
    values (auth.uid(), trim(p_origen), p_olat, p_olng, trim(p_destino), p_dlat, p_dlng, p_pasajeros, nullif(left(trim(coalesce(p_notas, '')), 200), ''), left(trim(v_tel), 30), p_programado,
      (v_q->>'km')::numeric, (v_q->>'minutos')::int, (v_q->>'costo')::numeric, v_propina, (v_q->>'costo')::numeric + v_propina, (v_q->>'comision_pct')::numeric, (v_q->>'ganancia')::numeric + v_propina, p_categoria)
    returning id into v_id;
  insert into public.delivery_viaje_codigos (viaje_id, codigo) values (v_id, lpad(floor(random() * 10000)::int::text, 4, '0'));
  return v_id;
end $$;
revoke all on function public.delivery_crear_viaje(text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric, text) from public, anon;
grant execute on function public.delivery_crear_viaje(text, numeric, numeric, text, numeric, numeric, integer, text, text, timestamptz, numeric, text) to authenticated;

-- Tomar un viaje: el vehículo tiene que estar habilitado para la categoría.
create or replace function public.delivery_tomar_viaje(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.delivery_repartidores;
begin
  select * into r from public.delivery_repartidores where perfil_id = v_uid;
  if not found or not r.activo then raise exception 'Primero activá tu perfil de repartidor'; end if;
  if not r.verificado then raise exception 'Tu perfil todavía está en revisión'; end if;
  if r.remis_estado is distinct from 'aprobado' or not r.acepta_remis then raise exception 'No tenés habilitados los viajes de remís'; end if;
  if not r.disponible then raise exception 'Conectate para tomar viajes'; end if;
  if r.control_estado is not null then raise exception 'Primero completá la selfie de control'; end if;
  if public.delivery_repartidor_ocupado(v_uid) then raise exception 'Ya tenés un pedido, envío o viaje en curso'; end if;
  perform 1 from public.delivery_viajes where id = p_id and not (categoria = any (r.remis_categorias));
  if found then raise exception 'Tu vehículo no está habilitado para esta categoría de viaje'; end if;
  update public.delivery_viajes set conductor_id = v_uid, estado = 'asignado', asignado_at = now(), updated_at = now() where id = p_id and estado = 'buscando' and conductor_id is null;
  if not found then raise exception 'Otro conductor ya tomó este viaje'; end if;
  update public.delivery_repartidores set aceptadas = aceptadas + 1 where perfil_id = v_uid;
end $$;

-- Viajes disponibles: solo los de las categorías del conductor, y cada oferta informa su categoría.
drop function if exists public.delivery_viajes_disponibles();
create or replace function public.delivery_viajes_disponibles() returns table (id uuid, origen_zona text, destino_zona text, pasajeros integer, distancia_km numeric, dist_recogida_km numeric, ganancia numeric, programado_para timestamptz, created_at timestamptz, categoria text)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_lat numeric; v_lng numeric; v_cats text[];
begin
  select r.remis_categorias into v_cats from public.delivery_repartidores r
   where r.perfil_id = v_uid and r.activo and r.verificado and r.disponible and r.acepta_remis and r.remis_estado = 'aprobado' and r.control_estado is null;
  if v_uid is null or v_cats is null or public.delivery_repartidor_ocupado(v_uid) then return; end if;
  select u.latitud, u.longitud into v_lat, v_lng from public.delivery_ubicaciones u where u.repartidor_id = v_uid and u.updated_at > now() - interval '15 minutes';
  return query
    select v.id,
      coalesce(nullif(trim(split_part(v.origen_direccion, ',', 2)), ''), v.origen_direccion),
      coalesce(nullif(trim(split_part(v.destino_direccion, ',', 2)), ''), v.destino_direccion),
      v.pasajeros, v.distancia_km,
      case when v_lat is not null then public.delivery_distancia_km(v_lat, v_lng, v.origen_lat, v.origen_lng) end,
      v.ganancia_conductor, v.programado_para, v.created_at, v.categoria
    from public.delivery_viajes v
    where v.estado = 'buscando' and v.categoria = any (v_cats) and (v.programado_para is null or v.programado_para <= now() + interval '30 minutes')
      and (v_lat is null or public.delivery_distancia_km(v_lat, v_lng, v.origen_lat, v.origen_lng) <= 10)
    order by coalesce(v.programado_para, v.created_at);
end $$;
revoke all on function public.delivery_viajes_disponibles() from public, anon;
grant execute on function public.delivery_viajes_disponibles() to authenticated;

-- Datos del conductor para el pasajero: vehículo completo; teléfono solo con el viaje en curso; nada de 24 h después de terminado.
create or replace function public.delivery_viaje_conductor(p_viaje uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.delivery_viajes; r jsonb; v_activo boolean;
begin
  select * into v from public.delivery_viajes where id = p_viaje;
  if not found or v.conductor_id is null or not (v.cliente_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role)) then return null; end if;
  v_activo := v.estado in ('asignado', 'en_origen', 'a_bordo');
  if not v_activo and not public.has_role(auth.uid(), 'admin'::app_role) and coalesce(v.completado_at, v.cancelado_at, v.updated_at) < now() - interval '24 hours' then return null; end if;
  select jsonb_build_object('nombre', p.nombre, 'patente', d.patente, 'telefono', case when v_activo or public.has_role(auth.uid(), 'admin'::app_role) then d.telefono end,
      'marca', d.vehiculo_marca, 'modelo', d.vehiculo_modelo, 'color', d.vehiculo_color, 'anio', d.vehiculo_anio, 'categoria', v.categoria,
      'viajes', (select count(*) from public.delivery_viajes x where x.conductor_id = v.conductor_id and x.estado = 'completado'),
      'calificacion', (select round(avg(x.calificacion)::numeric, 1) from public.delivery_viajes x where x.conductor_id = v.conductor_id and x.calificacion is not null))
    into r from public.delivery_repartidores d left join public.perfiles p on p.id = d.perfil_id where d.perfil_id = v.conductor_id;
  return r;
end $$;

-- Administración: qué categorías puede llevar cada conductor (queda auditado).
create or replace function public.delivery_admin_remis_categorias(p_perfil uuid, p_categorias text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  if not public.remis_categorias_validas(p_categorias) then raise exception 'Categorías inválidas (estandar, confort, familiar)'; end if;
  update public.delivery_repartidores set remis_categorias = (select array_agg(distinct c order by c) from unnest(p_categorias) c) where perfil_id = p_perfil;
  if not found then raise exception 'Conductor no encontrado'; end if;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle) values (auth.uid(), 'remis.categorias', 'delivery_repartidores', p_perfil::text, jsonb_build_object('categorias', p_categorias));
end $$;

-- El conductor carga los datos de su vehículo (validados).
create or replace function public.delivery_conductor_vehiculo(p_marca text, p_modelo text, p_color text, p_anio integer) returns void
language plpgsql security definer set search_path = public as $$
declare v_marca text := nullif(trim(coalesce(p_marca, '')), ''); v_modelo text := nullif(trim(coalesce(p_modelo, '')), ''); v_color text := nullif(trim(coalesce(p_color, '')), '');
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if v_marca is null or char_length(v_marca) not between 2 and 40 then raise exception 'Escribí la marca del vehículo'; end if;
  if v_modelo is null or char_length(v_modelo) > 40 then raise exception 'Escribí el modelo del vehículo'; end if;
  if v_color is null or char_length(v_color) not between 3 and 30 then raise exception 'Escribí el color del vehículo'; end if;
  if p_anio is null or p_anio not between 1990 and extract(year from now())::int + 1 then raise exception 'El año del vehículo no es válido'; end if;
  update public.delivery_repartidores set vehiculo_marca = v_marca, vehiculo_modelo = v_modelo, vehiculo_color = v_color, vehiculo_anio = p_anio where perfil_id = auth.uid();
  if not found then raise exception 'No tenés perfil de conductor'; end if;
end $$;
revoke all on function public.delivery_viaje_conductor(uuid), public.delivery_admin_remis_categorias(uuid, text[]), public.delivery_conductor_vehiculo(text, text, text, integer), public.delivery_tomar_viaje(uuid) from public, anon;
grant execute on function public.delivery_viaje_conductor(uuid), public.delivery_admin_remis_categorias(uuid, text[]), public.delivery_conductor_vehiculo(text, text, text, integer), public.delivery_tomar_viaje(uuid) to authenticated;
revoke all on function public.remis_categorias_validas(text[]), public.remis_capacidad(text) from public;
grant execute on function public.remis_categorias_validas(text[]), public.remis_capacidad(text) to authenticated;
