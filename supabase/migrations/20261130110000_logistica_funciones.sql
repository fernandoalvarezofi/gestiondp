-- Woref Logística: toda la lógica en el servidor. Cada cambio de estado pasa por _log_transicion (máquina de estados validada)
-- y deja un evento en la línea de tiempo. Administración opera; el comercio crea, cancela, pide retiros y reclama lo suyo;
-- el repartidor solo resuelve las entregas de su hoja de ruta; cualquiera puede seguir un envío por su número.

-- ---------------------------------------------------------------- utilidades
-- Fecha y hora de Argentina (la base trabaja en UTC).
create or replace function public.log_hoy() returns date language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;
create or replace function public.log_hora() returns time language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::time $$;

create or replace function public.log_zona_de(p_cp integer) returns uuid
language sql stable set search_path to 'public' as $$ select id from public.log_zonas where cps @> p_cp order by orden, nombre limit 1 $$;

create or replace function public.log_sumar_habiles(p_desde date, p_dias integer) returns date
language plpgsql immutable as $$
declare d date := p_desde; n int := 0;
begin
  while n < greatest(p_dias, 0) loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  while extract(isodow from d) >= 6 loop d := d + 1; end loop;
  return d;
end $$;

create or replace function public._log_txt(p jsonb, k text, maxlen integer) returns text
language sql immutable as $$ select nullif(left(btrim(coalesce(p ->> k, '')), maxlen), '') $$;

-- ---------------------------------------------------------------- cotización
-- Precio = franja de peso del tarifario (servicio, zona origen → destino) + kg extra + seguro (% del valor declarado)
-- + comisión por contra reembolso (% del monto) + retiro a domicilio. Peso facturable = mayor entre real y volumétrico.
create or replace function public._log_cotizar(p_tarifario uuid, p_servicio text, p_cp_origen integer, p_cp_destino integer, p_bultos jsonb,
  p_valor numeric, p_reembolso numeric, p_retiro boolean) returns jsonb
language plpgsql stable set search_path to 'public' as $$
declare
  t public.log_tarifarios; zo public.log_zonas; zd public.log_zonas; b jsonb; n int := 0;
  v_real numeric := 0; vol numeric := 0; fact numeric; peso numeric; banda record; maxb record; flete numeric; dias int; fecha date;
  v_valor numeric := greatest(coalesce(p_valor, 0), 0); v_reem numeric := greatest(coalesce(p_reembolso, 0), 0);
begin
  select * into t from public.log_tarifarios where id = p_tarifario and activo;
  if not found then select * into t from public.log_tarifarios where por_defecto; end if;
  if t.id is null then return jsonb_build_object('ok', false, 'motivo', 'No hay un tarifario configurado'); end if;
  if p_servicio not in ('express', 'estandar', 'prioritario') then return jsonb_build_object('ok', false, 'motivo', 'Servicio inválido'); end if;
  if p_cp_origen is null or p_cp_origen not between 1000 and 9999 or p_cp_destino is null or p_cp_destino not between 1000 and 9999 then
    return jsonb_build_object('ok', false, 'motivo', 'Revisá los códigos postales (4 números)');
  end if;
  if jsonb_typeof(p_bultos) is distinct from 'array' or jsonb_array_length(p_bultos) not between 1 and 50 then return jsonb_build_object('ok', false, 'motivo', 'Indicá entre 1 y 50 bultos'); end if;
  for b in select * from jsonb_array_elements(p_bultos) loop
    n := n + 1;
    peso := case when jsonb_typeof(b -> 'peso_kg') = 'number' then (b ->> 'peso_kg')::numeric end;
    if peso is null or peso <= 0 or peso > 1000 then return jsonb_build_object('ok', false, 'motivo', format('Revisá el peso del bulto %s', n)); end if;
    v_real := v_real + peso;
    if jsonb_typeof(b -> 'alto_cm') = 'number' and jsonb_typeof(b -> 'ancho_cm') = 'number' and jsonb_typeof(b -> 'largo_cm') = 'number' then
      if (b ->> 'alto_cm')::numeric not between 0 and 400 or (b ->> 'ancho_cm')::numeric not between 0 and 400 or (b ->> 'largo_cm')::numeric not between 0 and 400 then
        return jsonb_build_object('ok', false, 'motivo', format('Revisá las medidas del bulto %s (hasta 400 cm)', n));
      end if;
      vol := vol + (b ->> 'alto_cm')::numeric * (b ->> 'ancho_cm')::numeric * (b ->> 'largo_cm')::numeric / t.divisor_volumetrico;
    end if;
  end loop;
  fact := round(greatest(v_real, vol), 2);
  select * into zo from public.log_zonas where id = public.log_zona_de(p_cp_origen);
  select * into zd from public.log_zonas where id = public.log_zona_de(p_cp_destino);
  if zo.id is null or zd.id is null then return jsonb_build_object('ok', false, 'motivo', 'Todavía no llegamos a ese código postal'); end if;
  if p_servicio = 'express' and (zo.id <> zd.id or not zo.express) then return jsonb_build_object('ok', false, 'motivo', 'El servicio express es solo dentro de la misma ciudad'); end if;
  select hasta_kg, precio into banda from public.log_tarifas where tarifario_id = t.id and servicio = p_servicio and zona_origen = zo.id and zona_destino = zd.id and hasta_kg >= fact order by hasta_kg limit 1;
  if banda.precio is not null then flete := banda.precio;
  else
    select hasta_kg, precio into maxb from public.log_tarifas where tarifario_id = t.id and servicio = p_servicio and zona_origen = zo.id and zona_destino = zd.id order by hasta_kg desc limit 1;
    if maxb.precio is null then return jsonb_build_object('ok', false, 'motivo', 'Ese servicio no está disponible para ese destino'); end if;
    if t.kg_extra = 0 then return jsonb_build_object('ok', false, 'motivo', format('El peso máximo para este servicio es %s kg', maxb.hasta_kg)); end if;
    flete := maxb.precio + ceil(fact - maxb.hasta_kg) * t.kg_extra;
  end if;
  dias := case p_servicio when 'express' then case when public.log_hora() < time '14:00' then 0 else 1 end when 'prioritario' then t.dias_prioritario else case when zo.id = zd.id then 1 else t.dias_estandar end end;
  fecha := case when dias = 0 then public.log_hoy() else public.log_sumar_habiles(public.log_hoy(), dias) end;
  return jsonb_build_object('ok', true, 'tarifario_id', t.id, 'flete', round(flete), 'seguro', round(v_valor * t.seguro_pct / 100), 'comision_reembolso', round(v_reem * t.reembolso_pct / 100),
    'retiro', case when p_retiro then t.retiro_precio else 0 end,
    'total', round(flete) + round(v_valor * t.seguro_pct / 100) + round(v_reem * t.reembolso_pct / 100) + case when p_retiro then t.retiro_precio else 0 end,
    'peso_real', round(v_real, 2), 'peso_vol', round(vol, 2), 'peso_facturable', fact, 'zona_origen', zo.id, 'zona_destino', zd.id,
    'zona_origen_nombre', zo.nombre, 'zona_destino_nombre', zd.nombre, 'dias', dias, 'fecha_estimada', fecha);
end $$;

-- Cuenta logística de un comercio (se crea sola la primera vez).
create or replace function public.log_cuenta_de_comercio(p_comercio uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid; c public.delivery_comercios;
begin
  if not (public.log_es_admin() or public.delivery_permiso(p_comercio, 'pedidos')) then raise exception 'No tenés permiso para los envíos de este comercio'; end if;
  select id into v from public.log_cuentas where comercio_id = p_comercio;
  if v is not null then return v; end if;
  select * into c from public.delivery_comercios where id = p_comercio;
  if c.id is null then raise exception 'Comercio no encontrado'; end if;
  insert into public.log_cuentas (tipo, comercio_id, razon_social, telefono, direccion_retiro, lat, lng, estado)
    values ('comercio', c.id, c.nombre, left(c.telefono, 30), left(c.direccion, 200), c.latitud, c.longitud, 'activa')
    on conflict (comercio_id) do nothing returning id into v;
  if v is null then select id into v from public.log_cuentas where comercio_id = p_comercio; end if;
  return v;
end $$;

-- Cotización pública (cotizador) o de una cuenta (con su tarifario).
create or replace function public.log_cotizar(p_cuenta uuid, p_comercio uuid, p_servicio text, p_cp_origen integer, p_cp_destino integer, p_bultos jsonb,
  p_valor numeric default 0, p_reembolso numeric default 0, p_retiro boolean default false) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_tarifario uuid;
begin
  if p_cuenta is not null and public.log_es_admin() then select tarifario_id into v_tarifario from public.log_cuentas where id = p_cuenta;
  elsif p_comercio is not null and public.delivery_permiso(p_comercio, 'pedidos') then select tarifario_id into v_tarifario from public.log_cuentas where comercio_id = p_comercio;
  end if;
  return public._log_cotizar(v_tarifario, p_servicio, p_cp_origen, p_cp_destino, p_bultos, p_valor, p_reembolso, p_retiro);
end $$;

-- ---------------------------------------------------------------- máquina de estados
create or replace function public._log_transicion(p_envio uuid, p_estado text, p_sucursal uuid, p_detalle text, p_receptor_nombre text default null, p_receptor_dni text default null, p_cobrado boolean default false)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  e public.log_envios; s public.log_sucursales; desc_ text; permitido boolean;
  mapa constant jsonb := '{
    "creado": ["admitido", "cancelado"],
    "admitido": ["en_centro", "en_distribucion", "en_sucursal", "siniestrado"],
    "en_centro": ["en_transito", "en_distribucion", "en_sucursal", "en_devolucion", "siniestrado"],
    "en_transito": ["en_centro", "en_sucursal", "en_distribucion", "siniestrado"],
    "en_sucursal": ["en_distribucion", "entregado", "en_devolucion", "en_transito", "siniestrado"],
    "en_distribucion": ["entregado", "visita_fallida", "en_centro", "siniestrado"],
    "visita_fallida": ["en_distribucion", "en_sucursal", "en_centro", "en_devolucion", "siniestrado"],
    "en_devolucion": ["en_transito", "en_centro", "devuelto", "siniestrado"]
  }';
begin
  select * into e from public.log_envios where id = p_envio for update;
  if not found then raise exception 'Envío no encontrado'; end if;
  permitido := coalesce(mapa -> e.estado, '[]'::jsonb) ? p_estado;
  if not permitido then raise exception 'El envío % está "%": no puede pasar a "%"', e.numero, replace(e.estado, '_', ' '), replace(p_estado, '_', ' '); end if;
  if p_sucursal is not null then select * into s from public.log_sucursales where id = p_sucursal and activa; if s.id is null then raise exception 'Sucursal inválida'; end if; end if;
  if p_estado in ('en_centro', 'en_sucursal') and s.id is null then raise exception 'Indicá en qué sucursal o centro está'; end if;
  if p_estado = 'entregado' then
    if char_length(btrim(coalesce(p_receptor_nombre, ''))) < 2 then raise exception 'Indicá quién lo recibió'; end if;
    if coalesce(p_receptor_dni, '') !~ '^[0-9]{6,9}$' then raise exception 'Indicá el DNI de quien lo recibió (solo números)'; end if;
    if e.reembolso > 0 and not coalesce(p_cobrado, false) then raise exception 'Este envío es contra reembolso: confirmá que cobraste $%', to_char(e.reembolso, 'FM999G999G999'); end if;
  end if;
  if p_estado in ('visita_fallida', 'siniestrado', 'cancelado') and char_length(btrim(coalesce(p_detalle, ''))) < 3 then raise exception 'Indicá el motivo'; end if;

  desc_ := case p_estado
    when 'admitido' then 'Recibimos tu envío' || coalesce(' en ' || s.nombre, '')
    when 'en_centro' then 'En el centro de distribución ' || s.nombre || ' (' || s.ciudad || ')'
    when 'en_transito' then 'En viaje hacia ' || e.des_ciudad
    when 'en_sucursal' then case when e.entrega_modo = 'sucursal' and s.id = e.sucursal_destino_id then 'Listo para retirar en ' || s.nombre || ' — ' || s.direccion else 'En la sucursal ' || s.nombre || ' (' || s.ciudad || ')' end
    when 'en_distribucion' then 'Salió a reparto'
    when 'visita_fallida' then 'No pudimos entregarlo: ' || btrim(p_detalle)
    when 'entregado' then 'Entregado a ' || split_part(btrim(p_receptor_nombre), ' ', 1)
    when 'en_devolucion' then 'Vuelve al remitente'
    when 'devuelto' then 'Devuelto al remitente'
    when 'cancelado' then 'Envío cancelado'
    when 'siniestrado' then 'Hay un problema con este envío y lo estamos gestionando'
  end;
  update public.log_envios set estado = p_estado, sucursal_actual_id = coalesce(s.id, case when p_estado in ('en_distribucion', 'en_transito') then null else sucursal_actual_id end),
    intentos = intentos + case when p_estado = 'visita_fallida' then 1 else 0 end,
    receptor_nombre = case when p_estado = 'entregado' then btrim(p_receptor_nombre) else receptor_nombre end,
    receptor_dni = case when p_estado = 'entregado' then p_receptor_dni else receptor_dni end,
    entregado_at = case when p_estado = 'entregado' then now() else entregado_at end,
    reembolso_cobrado = case when p_estado = 'entregado' and e.reembolso > 0 then true else reembolso_cobrado end,
    motivo_cancelacion = case when p_estado = 'cancelado' then btrim(p_detalle) else motivo_cancelacion end,
    updated_at = now()
  where id = e.id;
  insert into public.log_eventos (envio_id, estado, descripcion, sucursal_id, detalle, usuario_id)
    values (e.id, p_estado, desc_, s.id, nullif(left(btrim(coalesce(p_detalle, '')), 500), ''), auth.uid());
  if e.comercio_id is not null and p_estado in ('entregado', 'visita_fallida', 'devuelto', 'siniestrado', 'en_sucursal') and (p_estado <> 'en_sucursal' or e.entrega_modo = 'sucursal') then
    perform public.notificar_local(e.comercio_id, 'pedidos', 'pedidos', 'ENVIO_' || upper(p_estado), 'Envío ' || e.numero, desc_, '/app/comercio/envios/' || e.id, 'log-' || e.id || '-' || p_estado || '-' || e.intentos, p_estado in ('visita_fallida', 'siniestrado'));
  end if;
end $$;
revoke all on function public._log_transicion(uuid, text, uuid, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- alta de envíos
create or replace function public.log_crear_envio(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_clave uuid := case when (p ->> 'clave') ~ '^[0-9a-f-]{36}$' then (p ->> 'clave')::uuid end;
  v_cuenta public.log_cuentas; v_comercio uuid; ex public.log_envios; q jsonb; so public.log_sucursales; sd public.log_sucursales;
  v_servicio text := p ->> 'servicio'; v_origen text := coalesce(p ->> 'origen_modo', 'retiro'); v_entrega text := coalesce(p ->> 'entrega_modo', 'domicilio');
  v_rem_cp int; v_des_cp int; v_id uuid; v_numero text; b jsonb; n int := 0; v_pedido uuid; v_saldo numeric;
  v_valor numeric := greatest(coalesce((p ->> 'valor_declarado')::numeric, 0), 0); v_reem numeric := greatest(coalesce((p ->> 'reembolso')::numeric, 0), 0);
begin
  if auth.uid() is null then raise exception 'Iniciá sesión'; end if;
  if v_clave is null then raise exception 'Falta la clave del envío'; end if;
  select * into ex from public.log_envios where clave = v_clave;
  if ex.id is not null then
    if ex.creado_por is distinct from auth.uid() then raise exception 'Clave inválida'; end if;
    return jsonb_build_object('id', ex.id, 'numero', ex.numero);
  end if;
  -- De quién es el envío
  if (p ->> 'comercio_id') ~ '^[0-9a-f-]{36}$' then
    v_comercio := (p ->> 'comercio_id')::uuid;
    v_id := public.log_cuenta_de_comercio(v_comercio);
    select * into v_cuenta from public.log_cuentas where id = v_id;
    v_id := null;
  elsif (p ->> 'cuenta_id') ~ '^[0-9a-f-]{36}$' and public.log_es_admin() then
    select * into v_cuenta from public.log_cuentas where id = (p ->> 'cuenta_id')::uuid;
    v_comercio := v_cuenta.comercio_id;
  end if;
  if v_cuenta.id is null then raise exception 'No tenés permiso para crear este envío'; end if;
  if v_cuenta.estado <> 'activa' then raise exception 'La cuenta % está %: no puede despachar', v_cuenta.numero, v_cuenta.estado; end if;
  -- Origen y destino
  if v_origen not in ('retiro', 'sucursal') or v_entrega not in ('domicilio', 'sucursal') then raise exception 'Modalidad inválida'; end if;
  v_rem_cp := case when (p ->> 'rem_cp') ~ '^[0-9]{4}$' then (p ->> 'rem_cp')::int end;
  if v_origen = 'sucursal' then
    select * into so from public.log_sucursales where id = case when (p ->> 'sucursal_origen_id') ~ '^[0-9a-f-]{36}$' then (p ->> 'sucursal_origen_id')::uuid end and activa;
    if so.id is null then raise exception 'Elegí la sucursal donde vas a dejar el envío'; end if;
    v_rem_cp := coalesce(v_rem_cp, so.cp);
  elsif public._log_txt(p, 'rem_direccion', 200) is null then raise exception 'Indicá la dirección de retiro';
  end if;
  if v_rem_cp is null then raise exception 'Indicá el código postal de origen'; end if;
  if v_entrega = 'sucursal' then
    select * into sd from public.log_sucursales where id = case when (p ->> 'sucursal_destino_id') ~ '^[0-9a-f-]{36}$' then (p ->> 'sucursal_destino_id')::uuid end and activa;
    if sd.id is null then raise exception 'Elegí la sucursal donde lo retira el destinatario'; end if;
    v_des_cp := sd.cp;
  else
    if public._log_txt(p, 'des_direccion', 200) is null then raise exception 'Indicá la dirección de entrega'; end if;
    v_des_cp := case when (p ->> 'des_cp') ~ '^[0-9]{4}$' then (p ->> 'des_cp')::int end;
    if v_des_cp is null then raise exception 'Indicá el código postal de destino (4 números)'; end if;
  end if;
  if char_length(coalesce(public._log_txt(p, 'des_nombre', 120), '')) < 2 then raise exception 'Indicá el nombre del destinatario'; end if;
  if coalesce(public._log_txt(p, 'des_telefono', 30), '') !~ '^[0-9+() -]{6,30}$' then raise exception 'Indicá un teléfono del destinatario'; end if;
  if v_entrega = 'domicilio' and public._log_txt(p, 'des_ciudad', 80) is null then raise exception 'Indicá la ciudad de destino'; end if;
  if public._log_txt(p, 'des_dni', 9) is not null and public._log_txt(p, 'des_dni', 9) !~ '^[0-9]{6,9}$' then raise exception 'El DNI del destinatario va sin puntos (6 a 9 números)'; end if;
  if v_reem > 10000000 or v_valor > 100000000 then raise exception 'Monto fuera de rango'; end if;
  -- Pedido del comercio (opcional): tiene que ser suyo y no tener otro envío activo.
  if (p ->> 'pedido_id') ~ '^[0-9a-f-]{36}$' then
    v_pedido := (p ->> 'pedido_id')::uuid;
    if not exists (select 1 from public.delivery_pedidos where id = v_pedido and comercio_id = v_comercio) then raise exception 'Ese pedido no es de este comercio'; end if;
    if exists (select 1 from public.log_envios where pedido_id = v_pedido and estado not in ('cancelado', 'devuelto')) then raise exception 'Ese pedido ya tiene un envío'; end if;
  end if;
  -- Precio: lo calcula siempre el servidor.
  q := public._log_cotizar(v_cuenta.tarifario_id, v_servicio, v_rem_cp, v_des_cp, p -> 'bultos', v_valor, v_reem, v_origen = 'retiro');
  if not (q ->> 'ok')::boolean then raise exception '%', q ->> 'motivo'; end if;
  if v_cuenta.condicion_pago = 'cuenta_corriente' and v_cuenta.limite_credito > 0 then
    v_saldo := coalesce((select sum(precio_total) from public.log_envios where cuenta_id = v_cuenta.id and estado <> 'cancelado'), 0) - coalesce((select sum(monto) from public.log_pagos where cuenta_id = v_cuenta.id), 0);
    if v_saldo + (q ->> 'total')::numeric > v_cuenta.limite_credito then raise exception 'La cuenta superaría su límite de crédito ($%)', to_char(v_cuenta.limite_credito, 'FM999G999G999'); end if;
  end if;

  insert into public.log_envios (clave, cuenta_id, comercio_id, pedido_id, referencia, servicio, origen_modo, entrega_modo,
    rem_nombre, rem_telefono, rem_direccion, rem_ciudad, rem_provincia, rem_cp, sucursal_origen_id,
    des_nombre, des_telefono, des_email, des_dni, des_direccion, des_ciudad, des_provincia, des_cp, des_notas, des_lat, des_lng, sucursal_destino_id,
    zona_origen_id, zona_destino_id, bultos, peso_kg, peso_vol_kg, peso_facturable, valor_declarado, contenido, reembolso,
    precio_flete, precio_seguro, precio_reembolso, precio_retiro, precio_total, fecha_estimada, creado_por)
  values (v_clave, v_cuenta.id, v_comercio, v_pedido, public._log_txt(p, 'referencia', 40), v_servicio, v_origen, v_entrega,
    coalesce(public._log_txt(p, 'rem_nombre', 120), v_cuenta.nombre_fantasia, v_cuenta.razon_social), coalesce(public._log_txt(p, 'rem_telefono', 30), v_cuenta.telefono),
    case when v_origen = 'retiro' then public._log_txt(p, 'rem_direccion', 200) else so.direccion end,
    coalesce(public._log_txt(p, 'rem_ciudad', 80), so.ciudad, v_cuenta.ciudad), coalesce(public._log_txt(p, 'rem_provincia', 60), so.provincia, v_cuenta.provincia), v_rem_cp, so.id,
    public._log_txt(p, 'des_nombre', 120), public._log_txt(p, 'des_telefono', 30), lower(public._log_txt(p, 'des_email', 160)), public._log_txt(p, 'des_dni', 9),
    case when v_entrega = 'domicilio' then public._log_txt(p, 'des_direccion', 200) else sd.direccion end,
    case when v_entrega = 'domicilio' then public._log_txt(p, 'des_ciudad', 80) else sd.ciudad end,
    case when v_entrega = 'domicilio' then coalesce(public._log_txt(p, 'des_provincia', 60), 'Buenos Aires') else sd.provincia end,
    v_des_cp, public._log_txt(p, 'des_notas', 300),
    case when jsonb_typeof(p -> 'des_lat') = 'number' then (p ->> 'des_lat')::numeric end, case when jsonb_typeof(p -> 'des_lng') = 'number' then (p ->> 'des_lng')::numeric end, sd.id,
    (q ->> 'zona_origen')::uuid, (q ->> 'zona_destino')::uuid, jsonb_array_length(p -> 'bultos'), (q ->> 'peso_real')::numeric, (q ->> 'peso_vol')::numeric, (q ->> 'peso_facturable')::numeric,
    v_valor, public._log_txt(p, 'contenido', 120), v_reem,
    (q ->> 'flete')::numeric, (q ->> 'seguro')::numeric, (q ->> 'comision_reembolso')::numeric, (q ->> 'retiro')::numeric, (q ->> 'total')::numeric, (q ->> 'fecha_estimada')::date, auth.uid())
  returning id, numero into v_id, v_numero;
  for b in select * from jsonb_array_elements(p -> 'bultos') loop
    n := n + 1;
    insert into public.log_bultos (envio_id, nro, codigo, peso_kg, alto_cm, ancho_cm, largo_cm)
      values (v_id, n, v_numero || '-' || lpad(n::text, 2, '0'), (b ->> 'peso_kg')::numeric,
        case when jsonb_typeof(b -> 'alto_cm') = 'number' then (b ->> 'alto_cm')::numeric end, case when jsonb_typeof(b -> 'ancho_cm') = 'number' then (b ->> 'ancho_cm')::numeric end,
        case when jsonb_typeof(b -> 'largo_cm') = 'number' then (b ->> 'largo_cm')::numeric end);
  end loop;
  insert into public.log_eventos (envio_id, estado, descripcion, usuario_id) values (v_id, 'creado',
    case when v_origen = 'sucursal' then 'Envío creado. Esperamos el paquete en ' || so.nombre else 'Envío creado. Falta retirarlo' end, auth.uid());
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

create or replace function public.log_cancelar(p_envio uuid, p_motivo text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e public.log_envios;
begin
  select * into e from public.log_envios where id = p_envio;
  if e.id is null or not (public.log_es_admin() or (e.comercio_id is not null and public.delivery_permiso(e.comercio_id, 'pedidos'))) then raise exception 'Envío no encontrado'; end if;
  if e.estado <> 'creado' then raise exception 'Solo se cancela antes de que lo recibamos. Si ya está en camino, abrí una incidencia.'; end if;
  update public.log_envios set retiro_id = null where id = e.id;
  perform public._log_transicion(e.id, 'cancelado', null, coalesce(nullif(btrim(p_motivo), ''), 'Cancelado por el remitente'));
end $$;

-- ---------------------------------------------------------------- operación (administración)
create or replace function public.log_avanzar(p_envio uuid, p_estado text, p_sucursal uuid default null, p_detalle text default null,
  p_receptor_nombre text default null, p_receptor_dni text default null, p_cobrado boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  perform public._log_transicion(p_envio, p_estado, p_sucursal, p_detalle, p_receptor_nombre, p_receptor_dni, p_cobrado);
end $$;

-- Escaneo masivo (recepción en centro, despacho, salida a reparto…): cada código se procesa por separado y se informa.
create or replace function public.log_escanear(p_codigos text[], p_estado text, p_sucursal uuid default null, p_detalle text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c text; e public.log_envios; v_out jsonb := '[]'::jsonb; vistos uuid[] := '{}';
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  if p_estado in ('entregado', 'visita_fallida', 'cancelado') then raise exception 'Ese estado se carga envío por envío'; end if;
  if cardinality(p_codigos) > 300 then raise exception 'Hasta 300 códigos por vez'; end if;
  foreach c in array p_codigos loop
    c := upper(btrim(c));
    continue when c = '';
    select * into e from public.log_envios where numero = c or numero = split_part(c, '-', 1) limit 1;
    if e.id is null then v_out := v_out || jsonb_build_object('codigo', c, 'ok', false, 'mensaje', 'No existe'); continue; end if;
    if e.id = any(vistos) then v_out := v_out || jsonb_build_object('codigo', c, 'numero', e.numero, 'ok', true, 'mensaje', 'Ya procesado (otro bulto)'); continue; end if;
    vistos := vistos || e.id;
    begin
      perform public._log_transicion(e.id, p_estado, p_sucursal, p_detalle);
      v_out := v_out || jsonb_build_object('codigo', c, 'numero', e.numero, 'ok', true, 'mensaje', 'Listo');
    exception when others then
      v_out := v_out || jsonb_build_object('codigo', c, 'numero', e.numero, 'ok', false, 'mensaje', sqlerrm);
    end;
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------- retiros
create or replace function public.log_solicitar_retiro(p_comercio uuid, p_cuenta uuid, p_fecha date, p_franja text, p_envios uuid[], p_direccion text default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_cuenta public.log_cuentas; v_id uuid; v_dir text; n int;
begin
  if p_comercio is not null then v_id := public.log_cuenta_de_comercio(p_comercio); select * into v_cuenta from public.log_cuentas where id = v_id; v_id := null;
  elsif public.log_es_admin() then select * into v_cuenta from public.log_cuentas where id = p_cuenta; end if;
  if v_cuenta.id is null then raise exception 'No tenés permiso'; end if;
  if p_franja not in ('manana', 'tarde') then raise exception 'Franja inválida'; end if;
  if p_fecha < public.log_hoy() or p_fecha > public.log_hoy() + 14 then raise exception 'Elegí una fecha entre hoy y las próximas dos semanas'; end if;
  if p_fecha = public.log_hoy() and ((p_franja = 'manana' and public.log_hora() > time '11:00') or (p_franja = 'tarde' and public.log_hora() > time '16:00')) then raise exception 'Para hoy ya no llegamos en esa franja: elegí otra'; end if;
  if extract(isodow from p_fecha) = 7 then raise exception 'Los domingos no hacemos retiros'; end if;
  if coalesce(cardinality(p_envios), 0) = 0 then raise exception 'Elegí los envíos a retirar'; end if;
  select count(*) into n from public.log_envios where id = any(p_envios) and cuenta_id = v_cuenta.id and estado = 'creado' and origen_modo = 'retiro'
    and (retiro_id is null or retiro_id in (select id from public.log_retiros where estado in ('fallido', 'cancelado')));
  if n <> cardinality(p_envios) then raise exception 'Algún envío ya tiene retiro, no es de esta cuenta o ya lo recibimos'; end if;
  v_dir := coalesce(nullif(btrim(p_direccion), ''), (select rem_direccion from public.log_envios where id = p_envios[1]), v_cuenta.direccion_retiro);
  if v_dir is null then raise exception 'Indicá la dirección de retiro'; end if;
  insert into public.log_retiros (cuenta_id, direccion, ciudad, cp, contacto, telefono, fecha, franja, notas, creado_por)
    values (v_cuenta.id, left(v_dir, 200), v_cuenta.ciudad, (select rem_cp from public.log_envios where id = p_envios[1]), coalesce(v_cuenta.contacto_nombre, v_cuenta.razon_social), v_cuenta.telefono,
      p_fecha, p_franja, nullif(left(btrim(coalesce(p_notas, '')), 300), ''), auth.uid())
    returning id into v_id;
  update public.log_envios set retiro_id = v_id, updated_at = now() where id = any(p_envios);
  insert into public.log_eventos (envio_id, estado, descripcion, usuario_id)
    select id, 'creado', 'Retiro programado para el ' || to_char(p_fecha, 'DD/MM') || ' (' || case p_franja when 'manana' then '9 a 13 h' else '14 a 18 h' end || ')', auth.uid() from public.log_envios where id = any(p_envios);
  return v_id;
end $$;

create or replace function public.log_retiro_actualizar(p_retiro uuid, p_estado text, p_repartidor uuid default null, p_motivo text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.log_retiros; e record;
begin
  select * into r from public.log_retiros where id = p_retiro for update;
  if r.id is null then raise exception 'Retiro no encontrado'; end if;
  if not public.log_es_admin() then
    -- El comercio solo puede cancelar su retiro antes de que salga.
    if not (p_estado = 'cancelado' and r.estado = 'solicitado' and exists (select 1 from public.log_cuentas c where c.id = r.cuenta_id and c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'pedidos'))) then
      raise exception 'No tenés permiso';
    end if;
  end if;
  if r.estado in ('realizado', 'cancelado') then raise exception 'Ese retiro ya está %', r.estado; end if;
  if p_estado = 'asignado' then
    if p_repartidor is null or not exists (select 1 from public.delivery_repartidores where perfil_id = p_repartidor and activo) then raise exception 'Elegí un repartidor activo'; end if;
    update public.log_retiros set estado = 'asignado', repartidor_id = p_repartidor where id = r.id;
  elsif p_estado = 'realizado' then
    update public.log_retiros set estado = 'realizado', realizado_at = now() where id = r.id;
    for e in select id from public.log_envios where retiro_id = r.id and estado = 'creado' loop
      perform public._log_transicion(e.id, 'admitido', null, 'Retirado en domicilio');
    end loop;
  elsif p_estado in ('fallido', 'cancelado') then
    if p_estado = 'fallido' and char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Indicá por qué no se pudo retirar'; end if;
    update public.log_retiros set estado = p_estado, motivo = nullif(btrim(coalesce(p_motivo, '')), '') where id = r.id;
    insert into public.log_eventos (envio_id, estado, descripcion, usuario_id)
      select id, 'creado', case when p_estado = 'fallido' then 'No pudimos retirarlo: ' || btrim(p_motivo) || '. Programá otro retiro.' else 'Retiro cancelado' end, auth.uid()
      from public.log_envios where retiro_id = r.id and estado = 'creado';
    update public.log_envios set retiro_id = null where retiro_id = r.id and estado = 'creado';
  else raise exception 'Estado inválido';
  end if;
end $$;

-- ---------------------------------------------------------------- última milla: hojas de ruta y entregas
create or replace function public.log_hoja_crear(p_repartidor uuid, p_sucursal uuid, p_codigos text[]) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_num bigint; c text; e public.log_envios; ok int := 0; errores jsonb := '[]'::jsonb;
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  if not exists (select 1 from public.delivery_repartidores where perfil_id = p_repartidor and activo) then raise exception 'Elegí un repartidor activo'; end if;
  if coalesce(cardinality(p_codigos), 0) = 0 or cardinality(p_codigos) > 120 then raise exception 'Entre 1 y 120 envíos por hoja'; end if;
  insert into public.log_hojas_ruta (repartidor_id, sucursal_id, creado_por) values (p_repartidor, p_sucursal, auth.uid()) returning id, numero into v_id, v_num;
  foreach c in array p_codigos loop
    c := upper(btrim(c)); continue when c = '';
    select * into e from public.log_envios where numero = split_part(c, '-', 1) or numero = c limit 1;
    if e.id is null then errores := errores || jsonb_build_object('codigo', c, 'mensaje', 'No existe'); continue; end if;
    if e.entrega_modo <> 'domicilio' then errores := errores || jsonb_build_object('codigo', c, 'mensaje', 'Se retira en sucursal'); continue; end if;
    if e.hoja_ruta_id = v_id then continue; end if;
    begin
      update public.log_envios set hoja_ruta_id = v_id where id = e.id;
      perform public._log_transicion(e.id, 'en_distribucion', null, 'Hoja de ruta ' || v_num);
      ok := ok + 1;
    exception when others then
      update public.log_envios set hoja_ruta_id = e.hoja_ruta_id where id = e.id;
      errores := errores || jsonb_build_object('codigo', c, 'mensaje', sqlerrm);
    end;
  end loop;
  if ok = 0 then raise exception 'Ningún envío se pudo cargar: %', errores::text; end if;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'cargados', ok, 'errores', errores);
end $$;

create or replace function public.log_hoja_cerrar(p_hoja uuid) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare h public.log_hojas_ruta; e record; n int := 0; v_suc uuid;
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  select * into h from public.log_hojas_ruta where id = p_hoja for update;
  if h.id is null or h.estado = 'cerrada' then raise exception 'Hoja de ruta no encontrada o ya cerrada'; end if;
  v_suc := coalesce(h.sucursal_id, (select id from public.log_sucursales where tipo = 'centro' and activa order by created_at limit 1));
  for e in select id from public.log_envios where hoja_ruta_id = h.id and estado = 'en_distribucion' loop
    perform public._log_transicion(e.id, 'en_centro', v_suc, 'Volvió al centro sin resolver (hoja ' || h.numero || ')');
    n := n + 1;
  end loop;
  update public.log_hojas_ruta set estado = 'cerrada', cerrada_at = now() where id = h.id;
  return n;
end $$;

-- Repartidor: sus entregas de hojas abiertas (solo lo necesario para entregar).
create or replace function public.log_mis_entregas() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'numero', e.numero, 'estado', e.estado, 'hoja', h.numero, 'des_nombre', e.des_nombre, 'des_telefono', e.des_telefono,
    'des_direccion', e.des_direccion, 'des_ciudad', e.des_ciudad, 'des_notas', e.des_notas, 'des_lat', e.des_lat, 'des_lng', e.des_lng, 'bultos', e.bultos, 'reembolso', e.reembolso,
    'intentos', e.intentos, 'remitente', e.rem_nombre) order by e.estado <> 'en_distribucion', e.des_direccion), '[]'::jsonb)
  from public.log_envios e join public.log_hojas_ruta h on h.id = e.hoja_ruta_id
  where h.repartidor_id = auth.uid() and h.estado = 'abierta' and (e.estado = 'en_distribucion' or e.updated_at > now() - interval '12 hours')
$$;

create or replace function public.log_entrega(p_envio uuid, p_resultado text, p_receptor_nombre text default null, p_receptor_dni text default null, p_motivo text default null, p_cobrado boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e public.log_envios;
begin
  select e2.* into e from public.log_envios e2 join public.log_hojas_ruta h on h.id = e2.hoja_ruta_id
   where e2.id = p_envio and h.repartidor_id = auth.uid() and h.estado = 'abierta';
  if e.id is null then raise exception 'Ese envío no está en tu hoja de ruta'; end if;
  if e.estado <> 'en_distribucion' then raise exception 'Ese envío ya está resuelto'; end if;
  if p_resultado = 'entregado' then perform public._log_transicion(e.id, 'entregado', null, null, p_receptor_nombre, p_receptor_dni, p_cobrado);
  elsif p_resultado = 'fallida' then perform public._log_transicion(e.id, 'visita_fallida', null, p_motivo);
  else raise exception 'Resultado inválido'; end if;
end $$;

-- ---------------------------------------------------------------- incidencias
create or replace function public.log_incidencia_abrir(p_envio uuid, p_tipo text, p_descripcion text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare e public.log_envios; v uuid;
begin
  select * into e from public.log_envios where id = p_envio;
  if e.id is null or not (public.log_es_admin() or (e.comercio_id is not null and public.delivery_permiso(e.comercio_id, 'pedidos'))) then raise exception 'Envío no encontrado'; end if;
  if exists (select 1 from public.log_incidencias where envio_id = e.id and tipo = p_tipo and estado <> 'resuelta') then raise exception 'Ya hay un reclamo abierto de ese tipo para este envío'; end if;
  insert into public.log_incidencias (envio_id, cuenta_id, tipo, descripcion, abierta_por) values (e.id, e.cuenta_id, p_tipo, btrim(p_descripcion), auth.uid()) returning id into v;
  insert into public.log_eventos (envio_id, estado, descripcion, visible, usuario_id) values (e.id, e.estado, 'Reclamo abierto (' || p_tipo || ')', false, auth.uid());
  return v;
end $$;

create or replace function public.log_incidencia_actualizar(p_id uuid, p_estado text, p_resolucion text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare i public.log_incidencias; e public.log_envios;
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  select * into i from public.log_incidencias where id = p_id for update;
  if i.id is null then raise exception 'Incidencia no encontrada'; end if;
  if p_estado not in ('abierta', 'en_gestion', 'resuelta') then raise exception 'Estado inválido'; end if;
  if p_estado = 'resuelta' and char_length(btrim(coalesce(p_resolucion, ''))) < 5 then raise exception 'Contá cómo se resolvió'; end if;
  update public.log_incidencias set estado = p_estado, resolucion = coalesce(nullif(btrim(coalesce(p_resolucion, '')), ''), resolucion), resuelta_at = case when p_estado = 'resuelta' then now() end where id = i.id;
  select * into e from public.log_envios where id = i.envio_id;
  if p_estado = 'resuelta' and e.comercio_id is not null then
    perform public.notificar_local(e.comercio_id, 'pedidos', 'pedidos', 'ENVIO_RECLAMO', 'Reclamo ' || i.numero || ' resuelto', left(btrim(p_resolucion), 140), '/app/comercio/envios/' || e.id, 'log-inc-' || i.id, true);
  end if;
end $$;

-- ---------------------------------------------------------------- dinero: estado de cuenta, rendiciones y pagos
create or replace function public.log_estado_cuenta(p_cuenta uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare c public.log_cuentas; facturado numeric; pagado numeric; mes record; reem_pend numeric; rend_pend numeric;
begin
  select * into c from public.log_cuentas where id = p_cuenta;
  if c.id is null or not (public.log_es_admin() or (c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'finanzas'))) then raise exception 'Cuenta no encontrada'; end if;
  select coalesce(sum(precio_total), 0) into facturado from public.log_envios where cuenta_id = c.id and estado not in ('creado', 'cancelado');
  select coalesce(sum(monto), 0) into pagado from public.log_pagos where cuenta_id = c.id;
  select count(*) n, coalesce(sum(precio_total), 0) monto into mes from public.log_envios where cuenta_id = c.id and estado <> 'cancelado' and created_at >= date_trunc('month', now());
  select coalesce(sum(reembolso), 0) into reem_pend from public.log_envios where cuenta_id = c.id and reembolso_cobrado and rendicion_id is null;
  select coalesce(sum(monto), 0) into rend_pend from public.log_rendiciones where cuenta_id = c.id and estado = 'pendiente';
  return jsonb_build_object('facturado', facturado, 'pagado', pagado, 'saldo', facturado - pagado, 'mes_envios', mes.n, 'mes_monto', mes.monto,
    'reembolsos_sin_rendir', reem_pend, 'rendiciones_pendientes', rend_pend, 'condicion_pago', c.condicion_pago, 'limite_credito', c.limite_credito);
end $$;

create or replace function public.log_rendicion_generar(p_cuenta uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid; total numeric; n int;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  select coalesce(sum(reembolso), 0), count(*) into total, n from public.log_envios where cuenta_id = p_cuenta and reembolso_cobrado and rendicion_id is null and estado = 'entregado';
  if n = 0 then raise exception 'No hay cobros de contra reembolso para rendir'; end if;
  insert into public.log_rendiciones (cuenta_id, monto, cantidad) values (p_cuenta, total, n) returning id into v;
  update public.log_envios set rendicion_id = v where cuenta_id = p_cuenta and reembolso_cobrado and rendicion_id is null and estado = 'entregado';
  return v;
end $$;

create or replace function public.log_rendicion_pagar(p_id uuid, p_referencia text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.log_rendiciones; c public.log_cuentas;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  update public.log_rendiciones set estado = 'pagada', pagada_at = now(), referencia = nullif(left(btrim(coalesce(p_referencia, '')), 120), '') where id = p_id and estado = 'pendiente' returning * into r;
  if r.id is null then raise exception 'Rendición no encontrada o ya pagada'; end if;
  select * into c from public.log_cuentas where id = r.cuenta_id;
  if c.comercio_id is not null then
    perform public.notificar_local(c.comercio_id, 'finanzas', 'pagos', 'ENVIO_RENDICION', 'Te transferimos los cobros contra reembolso', 'Rendición ' || r.numero || ': $' || to_char(r.monto, 'FM999G999G999'), '/app/comercio/envios?vista=cuenta', 'log-rend-' || r.id, true);
  end if;
end $$;

create or replace function public.log_pago_registrar(p_cuenta uuid, p_monto numeric, p_medio text, p_referencia text default null, p_fecha date default current_date) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > 100000000 then raise exception 'Monto inválido'; end if;
  insert into public.log_pagos (cuenta_id, monto, medio, referencia, fecha, registrado_por) values (p_cuenta, round(p_monto, 2), p_medio, nullif(left(btrim(coalesce(p_referencia, '')), 120), ''), coalesce(p_fecha, current_date), auth.uid()) returning id into v;
  return v;
end $$;

-- ---------------------------------------------------------------- CRM de cuentas
create or replace function public.log_cuenta_guardar(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid := p_id; et text[];
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  et := coalesce((select array_agg(distinct left(lower(btrim(x)), 30)) from jsonb_array_elements_text(case when jsonb_typeof(p -> 'etiquetas') = 'array' then p -> 'etiquetas' else '[]'::jsonb end) x where btrim(x) <> ''), '{}');
  if v is null then
    insert into public.log_cuentas (tipo, razon_social, estado) values (coalesce(p ->> 'tipo', 'empresa'), btrim(p ->> 'razon_social'), coalesce(p ->> 'estado', 'activa')) returning id into v;
  end if;
  update public.log_cuentas set
    tipo = coalesce(p ->> 'tipo', tipo), razon_social = coalesce(public._log_txt(p, 'razon_social', 120), razon_social),
    nombre_fantasia = public._log_txt(p, 'nombre_fantasia', 120), cuit = nullif(regexp_replace(coalesce(p ->> 'cuit', ''), '\D', '', 'g'), ''),
    condicion_iva = nullif(p ->> 'condicion_iva', ''), contacto_nombre = public._log_txt(p, 'contacto_nombre', 80), email = lower(public._log_txt(p, 'email', 160)),
    telefono = public._log_txt(p, 'telefono', 30), direccion_retiro = public._log_txt(p, 'direccion_retiro', 200), ciudad = public._log_txt(p, 'ciudad', 80),
    provincia = public._log_txt(p, 'provincia', 60), cp = case when (p ->> 'cp') ~ '^[0-9]{4}$' then (p ->> 'cp')::int end,
    tarifario_id = case when (p ->> 'tarifario_id') ~ '^[0-9a-f-]{36}$' then (p ->> 'tarifario_id')::uuid end,
    condicion_pago = coalesce(nullif(p ->> 'condicion_pago', ''), condicion_pago), limite_credito = greatest(coalesce((p ->> 'limite_credito')::numeric, 0), 0),
    estado = coalesce(nullif(p ->> 'estado', ''), estado), ejecutivo_id = case when (p ->> 'ejecutivo_id') ~ '^[0-9a-f-]{36}$' then (p ->> 'ejecutivo_id')::uuid end,
    etiquetas = et, notas = public._log_txt(p, 'notas', 2000), updated_at = now()
  where id = v;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  return v;
end $$;

-- El comercio completa los datos de su propia cuenta (los comerciales los define administración).
create or replace function public.log_cuenta_datos_comercio(p_comercio uuid, p jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v uuid;
begin
  v := public.log_cuenta_de_comercio(p_comercio);
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para cambiar estos datos'; end if;
  if (p ->> 'cp') is not null and (p ->> 'cp') <> '' and (p ->> 'cp') !~ '^[0-9]{4}$' then raise exception 'El código postal son 4 números'; end if;
  update public.log_cuentas set razon_social = coalesce(public._log_txt(p, 'razon_social', 120), razon_social), cuit = nullif(regexp_replace(coalesce(p ->> 'cuit', ''), '\D', '', 'g'), ''),
    condicion_iva = nullif(p ->> 'condicion_iva', ''), contacto_nombre = public._log_txt(p, 'contacto_nombre', 80), email = lower(public._log_txt(p, 'email', 160)),
    telefono = public._log_txt(p, 'telefono', 30), direccion_retiro = public._log_txt(p, 'direccion_retiro', 200), ciudad = public._log_txt(p, 'ciudad', 80),
    provincia = public._log_txt(p, 'provincia', 60), cp = case when (p ->> 'cp') ~ '^[0-9]{4}$' then (p ->> 'cp')::int end, updated_at = now()
  where id = v;
end $$;

create or replace function public.log_actividad_guardar(p_cuenta uuid, p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid := p_id;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  if v is null then
    insert into public.log_actividades (cuenta_id, tipo, titulo, detalle, vence_at, autor_id) values (p_cuenta, coalesce(p ->> 'tipo', 'nota'), btrim(p ->> 'titulo'), public._log_txt(p, 'detalle', 2000),
      case when (p ->> 'vence_at') is not null and (p ->> 'vence_at') <> '' then (p ->> 'vence_at')::timestamptz end, auth.uid()) returning id into v;
  else
    update public.log_actividades set tipo = coalesce(p ->> 'tipo', tipo), titulo = coalesce(public._log_txt(p, 'titulo', 120), titulo), detalle = public._log_txt(p, 'detalle', 2000),
      vence_at = case when (p ->> 'vence_at') is not null and (p ->> 'vence_at') <> '' then (p ->> 'vence_at')::timestamptz end,
      completada_at = case when (p ->> 'completada')::boolean then coalesce(completada_at, now()) when p ? 'completada' then null else completada_at end
    where id = v;
  end if;
  return v;
end $$;

create or replace function public.log_actividad_eliminar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  delete from public.log_actividades where id = p_id;
end $$;

-- ---------------------------------------------------------------- configuración (sucursales, zonas, tarifas)
create or replace function public.log_sucursal_guardar(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid := p_id;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  if (p ->> 'cp') !~ '^[0-9]{4}$' then raise exception 'El código postal son 4 números'; end if;
  if v is null then
    insert into public.log_sucursales (codigo, nombre, tipo, direccion, ciudad, provincia, cp) values (upper(btrim(p ->> 'codigo')), btrim(p ->> 'nombre'), coalesce(p ->> 'tipo', 'sucursal'),
      btrim(p ->> 'direccion'), btrim(p ->> 'ciudad'), btrim(p ->> 'provincia'), (p ->> 'cp')::int) returning id into v;
  end if;
  update public.log_sucursales set codigo = upper(btrim(p ->> 'codigo')), nombre = btrim(p ->> 'nombre'), tipo = coalesce(p ->> 'tipo', tipo), direccion = btrim(p ->> 'direccion'),
    ciudad = btrim(p ->> 'ciudad'), provincia = btrim(p ->> 'provincia'), cp = (p ->> 'cp')::int, telefono = public._log_txt(p, 'telefono', 30), horario = public._log_txt(p, 'horario', 120),
    activa = coalesce((p ->> 'activa')::boolean, activa),
    lat = case when jsonb_typeof(p -> 'lat') = 'number' then (p ->> 'lat')::numeric else lat end, lng = case when jsonb_typeof(p -> 'lng') = 'number' then (p ->> 'lng')::numeric else lng end
  where id = v;
  return v;
end $$;

-- Zona: rangos de CP escritos como "6070-6079, 6100".
create or replace function public.log_zona_guardar(p_id uuid, p_nombre text, p_rangos text, p_express boolean, p_orden integer) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid := p_id; parte text; a int; b int; mr int4multirange := '{}'::int4multirange;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  foreach parte in array regexp_split_to_array(coalesce(p_rangos, ''), '\s*,\s*') loop
    continue when btrim(parte) = '';
    if btrim(parte) !~ '^[0-9]{4}(\s*-\s*[0-9]{4})?$' then raise exception 'Rango inválido: "%". Usá 4 números o "desde-hasta"', parte; end if;
    a := split_part(regexp_replace(parte, '\s', '', 'g'), '-', 1)::int;
    b := coalesce(nullif(split_part(regexp_replace(parte, '\s', '', 'g'), '-', 2), '')::int, a);
    if b < a or a < 1000 or b > 9999 then raise exception 'Rango inválido: "%"', parte; end if;
    mr := mr + int4multirange(int4range(a, b + 1));
  end loop;
  if isempty(mr) then raise exception 'Indicá al menos un código postal'; end if;
  if v is null then insert into public.log_zonas (nombre, cps, express, orden) values (btrim(p_nombre), mr, coalesce(p_express, false), coalesce(p_orden, 100)) returning id into v;
  else update public.log_zonas set nombre = btrim(p_nombre), cps = mr, express = coalesce(p_express, false), orden = coalesce(p_orden, orden) where id = v; end if;
  return v;
end $$;

create or replace function public.log_tarifario_guardar(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid := p_id;
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  if v is null then insert into public.log_tarifarios (nombre) values (btrim(p ->> 'nombre')) returning id into v; end if;
  update public.log_tarifarios set nombre = coalesce(public._log_txt(p, 'nombre', 60), nombre), kg_extra = coalesce((p ->> 'kg_extra')::numeric, kg_extra), seguro_pct = coalesce((p ->> 'seguro_pct')::numeric, seguro_pct),
    reembolso_pct = coalesce((p ->> 'reembolso_pct')::numeric, reembolso_pct), retiro_precio = coalesce((p ->> 'retiro_precio')::numeric, retiro_precio),
    divisor_volumetrico = coalesce((p ->> 'divisor_volumetrico')::int, divisor_volumetrico), dias_estandar = coalesce((p ->> 'dias_estandar')::int, dias_estandar),
    dias_prioritario = coalesce((p ->> 'dias_prioritario')::int, dias_prioritario), activo = coalesce((p ->> 'activo')::boolean, activo)
  where id = v;
  -- Copiar las tarifas de otro tarifario (para armar uno especial a partir del general).
  if (p ->> 'copiar_de') ~ '^[0-9a-f-]{36}$' and not exists (select 1 from public.log_tarifas where tarifario_id = v) then
    insert into public.log_tarifas (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg, precio)
      select v, servicio, zona_origen, zona_destino, hasta_kg, round(precio * (1 + coalesce((p ->> 'ajuste_pct')::numeric, 0) / 100), -1) from public.log_tarifas where tarifario_id = (p ->> 'copiar_de')::uuid;
  end if;
  return v;
end $$;

create or replace function public.log_tarifa_guardar(p_tarifario uuid, p_servicio text, p_zona_origen uuid, p_zona_destino uuid, p_hasta_kg numeric, p_precio numeric) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.log_es_admin() then raise exception 'Solo administración'; end if;
  if p_precio is null then
    delete from public.log_tarifas where tarifario_id = p_tarifario and servicio = p_servicio and zona_origen = p_zona_origen and zona_destino = p_zona_destino and hasta_kg = p_hasta_kg;
  else
    insert into public.log_tarifas (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg, precio) values (p_tarifario, p_servicio, p_zona_origen, p_zona_destino, p_hasta_kg, round(p_precio, 2))
      on conflict (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg) do update set precio = excluded.precio;
  end if;
end $$;

-- ---------------------------------------------------------------- seguimiento público y tablero
create or replace function public.log_seguimiento(p_numero text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare e public.log_envios; sd public.log_sucursales;
begin
  select * into e from public.log_envios where numero = upper(btrim(split_part(coalesce(p_numero, ''), '-', 1)));
  if e.id is null then return null; end if;
  select * into sd from public.log_sucursales where id = e.sucursal_destino_id;
  return jsonb_build_object('numero', e.numero, 'estado', e.estado, 'servicio', e.servicio, 'entrega_modo', e.entrega_modo, 'destino', e.des_ciudad || ', ' || e.des_provincia,
    'origen', coalesce(e.rem_ciudad, ''), 'bultos', e.bultos, 'fecha_estimada', e.fecha_estimada, 'creado', e.created_at, 'entregado_at', e.entregado_at,
    'receptor', case when e.receptor_nombre is not null then split_part(e.receptor_nombre, ' ', 1) end, 'intentos', e.intentos,
    'sucursal_destino', case when sd.id is not null then jsonb_build_object('nombre', sd.nombre, 'direccion', sd.direccion, 'ciudad', sd.ciudad, 'horario', sd.horario) end,
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('estado', v.estado, 'descripcion', v.descripcion, 'fecha', v.created_at, 'lugar', s.ciudad) order by v.created_at desc), '[]'::jsonb)
                from public.log_eventos v left join public.log_sucursales s on s.id = v.sucursal_id where v.envio_id = e.id and v.visible));
end $$;

create or replace function public.log_tablero() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.log_es_admin() then raise exception 'Solo la operación de logística'; end if;
  return jsonb_build_object(
    'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (select estado, count(*) n from public.log_envios where estado not in ('entregado', 'devuelto', 'cancelado') or updated_at > now() - interval '1 day' group by estado) x),
    'creados_hoy', (select count(*) from public.log_envios where created_at >= current_date),
    'entregados_hoy', (select count(*) from public.log_envios where estado = 'entregado' and entregado_at >= current_date),
    'demorados', (select count(*) from public.log_envios where fecha_estimada < public.log_hoy() and estado not in ('entregado', 'devuelto', 'cancelado', 'siniestrado')),
    'incidencias_abiertas', (select count(*) from public.log_incidencias where estado <> 'resuelta'),
    'retiros_hoy', (select count(*) from public.log_retiros where fecha = public.log_hoy() and estado in ('solicitado', 'asignado')),
    'retiros_sin_asignar', (select count(*) from public.log_retiros where estado = 'solicitado'),
    'hojas_abiertas', (select count(*) from public.log_hojas_ruta where estado = 'abierta'),
    'reembolsos_sin_rendir', (select coalesce(sum(reembolso), 0) from public.log_envios where reembolso_cobrado and rendicion_id is null),
    'facturado_mes', (select coalesce(sum(precio_total), 0) from public.log_envios where estado <> 'cancelado' and created_at >= date_trunc('month', now())),
    'envios_mes', (select count(*) from public.log_envios where estado <> 'cancelado' and created_at >= date_trunc('month', now())));
end $$;

-- Permisos de ejecución
do $$
declare f text;
begin
  foreach f in array array[
    'log_cotizar(uuid, uuid, text, integer, integer, jsonb, numeric, numeric, boolean)', 'log_seguimiento(text)', 'log_zona_de(integer)', 'log_sumar_habiles(date, integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  foreach f in array array[
    'log_cuenta_de_comercio(uuid)', 'log_crear_envio(jsonb)', 'log_cancelar(uuid, text)', 'log_avanzar(uuid, text, uuid, text, text, text, boolean)', 'log_escanear(text[], text, uuid, text)',
    'log_solicitar_retiro(uuid, uuid, date, text, uuid[], text, text)', 'log_retiro_actualizar(uuid, text, uuid, text)', 'log_hoja_crear(uuid, uuid, text[])', 'log_hoja_cerrar(uuid)',
    'log_mis_entregas()', 'log_entrega(uuid, text, text, text, text, boolean)', 'log_incidencia_abrir(uuid, text, text)', 'log_incidencia_actualizar(uuid, text, text)',
    'log_estado_cuenta(uuid)', 'log_rendicion_generar(uuid)', 'log_rendicion_pagar(uuid, text)', 'log_pago_registrar(uuid, numeric, text, text, date)',
    'log_cuenta_guardar(uuid, jsonb)', 'log_cuenta_datos_comercio(uuid, jsonb)', 'log_actividad_guardar(uuid, uuid, jsonb)', 'log_actividad_eliminar(uuid)',
    'log_sucursal_guardar(uuid, jsonb)', 'log_zona_guardar(uuid, text, text, boolean, integer)', 'log_tarifario_guardar(uuid, jsonb)', 'log_tarifa_guardar(uuid, text, uuid, uuid, numeric, numeric)', 'log_tablero()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_log_cotizar(uuid, text, integer, integer, jsonb, numeric, numeric, boolean)', '_log_txt(jsonb, text, integer)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
