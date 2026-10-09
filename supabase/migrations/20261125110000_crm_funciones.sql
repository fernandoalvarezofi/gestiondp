-- CRM: funciones de lectura y escritura. Todas validan crm_puede(comercio) y trabajan solo con datos de ese comercio.

-- Listado (y también la base de la ficha: con p_id devuelve un solo contacto con las mismas métricas y segmento).
-- Segmentos calculados con datos reales (no se guardan):
--   interesado = sin compras ni turnos (llegó por mensaje, suscripción o carga manual)
--   vip        = 3 o más operaciones y gasto dentro del 10 % más alto del local
--   nuevo      = primera operación en los últimos 30 días
--   inactivo   = sin operaciones en los últimos 60 días
--   recurrente = 2 o más operaciones
--   ocasional  = el resto (una sola operación, reciente)
create or replace function public.crm_clientes(
  p_comercio uuid, p_q text default null, p_segmento text default null, p_etiqueta text default null,
  p_orden text default 'reciente', p_limite integer default 50, p_offset integer default 0, p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 5000);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(lower(btrim(coalesce(p_q, ''))), '');
  v_tel text;
  v_res jsonb;
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso para ver los clientes de este local'; end if;
  if p_segmento is not null and p_segmento not in ('interesado', 'vip', 'nuevo', 'inactivo', 'recurrente', 'ocasional', 'con_tareas', 'marketing') then raise exception 'Segmento inválido'; end if;
  if v_q is not null then v_q := replace(replace(replace(left(v_q, 80), '\', '\\'), '%', '\%'), '_', '\_'); v_tel := public._tel_norm(v_q); end if;

  with c as (
    select * from public.crm_contactos where comercio_id = p_comercio and fusionado_en is null and (p_id is null or id = p_id)
  ), ped as (
    select p.cliente_id, count(*) n, coalesce(sum(p.subtotal), 0) monto, min(p.created_at) primero, max(p.created_at) ultimo
      from public.delivery_pedidos p
     where p.comercio_id = p_comercio and p.estado <> 'cancelado' and p.pago_estado not in ('pendiente', 'rechazado') and p.cliente_id in (select cliente_id from c)
     group by p.cliente_id
  ), tur as (
    select t.contacto_id,
           count(*) filter (where t.estado <> 'cancelado' and (t.estado <> 'ausente')) n,
           coalesce(sum(t.precio) filter (where t.estado = 'completado'), 0) monto,
           min(t.inicio) filter (where t.estado not in ('cancelado', 'ausente')) primero,
           max(t.inicio) filter (where t.estado = 'completado' or (t.estado in ('confirmado', 'en_curso') and t.inicio <= now())) ultimo,
           min(t.inicio) filter (where t.inicio > now() and t.estado in ('pendiente', 'confirmado')) proximo,
           count(*) filter (where t.estado = 'ausente') ausentes
      from public.turnos t where t.comercio_id = p_comercio and t.contacto_id in (select id from c) group by t.contacto_id
  ), msg as (
    select h.cliente_id, max(h.ultimo_mensaje_at) ultimo from public.msg_hilos h where h.comercio_id = p_comercio and h.cliente_id in (select cliente_id from c) group by h.cliente_id
  ), act as (
    select a.contacto_id, max(a.created_at) ultimo, count(*) filter (where a.tipo = 'tarea' and a.completada_at is null) tareas,
           count(*) filter (where a.tipo = 'tarea' and a.completada_at is null and a.vence_at < now()) vencidas
      from public.crm_actividades a where a.comercio_id = p_comercio and a.contacto_id in (select id from c) group by a.contacto_id
  ), base as (
    select c.*, coalesce(ped.n, 0) pedidos, coalesce(tur.n, 0) turnos, coalesce(ped.n, 0) + coalesce(tur.n, 0) operaciones,
           coalesce(ped.monto, 0) + coalesce(tur.monto, 0) gastado,
           least(ped.primero, tur.primero) primera, greatest(ped.ultimo, tur.ultimo) ultima_compra,
           greatest(ped.ultimo, tur.ultimo, msg.ultimo, act.ultimo, c.created_at) ultima_interaccion,
           tur.proximo, coalesce(tur.ausentes, 0) ausentes, coalesce(act.tareas, 0) tareas, coalesce(act.vencidas, 0) tareas_vencidas
      from c left join ped on ped.cliente_id = c.cliente_id left join tur on tur.contacto_id = c.id
      left join msg on msg.cliente_id = c.cliente_id left join act on act.contacto_id = c.id
  ), umbral as (
    -- El 10 % de mayor gasto se calcula sobre todo el local, no solo sobre la página.
    select coalesce(percentile_cont(0.9) within group (order by x.g), 0) vip from (
      select coalesce(sum(p.subtotal), 0) g from public.delivery_pedidos p
       where p.comercio_id = p_comercio and p.estado <> 'cancelado' and p.pago_estado not in ('pendiente', 'rechazado') group by p.cliente_id
    ) x where x.g > 0
  ), seg as (
    select b.*, case
      when b.operaciones = 0 then 'interesado'
      when b.operaciones >= 3 and b.gastado > 0 and b.gastado >= (select vip from umbral) then 'vip'
      when b.primera >= now() - interval '30 days' then 'nuevo'
      when coalesce(b.ultima_compra, b.primera) < now() - interval '60 days' then 'inactivo'
      when b.operaciones >= 2 then 'recurrente'
      else 'ocasional' end segmento
      from base b
  ), filtrado as (
    select * from seg s
     where (v_q is null or lower(s.nombre) like '%' || v_q || '%' or lower(coalesce(s.email, '')) like '%' || v_q || '%'
            or (v_tel is not null and s.telefono_norm like '%' || v_tel || '%'))
       and (p_etiqueta is null or p_etiqueta = any (s.etiquetas))
       and (p_segmento is null or (p_segmento = 'con_tareas' and s.tareas > 0) or (p_segmento = 'marketing' and s.acepta_marketing) or s.segmento = p_segmento)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrado),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nombre', f.nombre, 'telefono', f.telefono, 'email', f.email, 'etiquetas', to_jsonb(f.etiquetas), 'notas', f.notas,
        'con_cuenta', f.cliente_id is not null, 'cliente_id', f.cliente_id, 'origen', f.origen,
        'acepta_marketing', f.acepta_marketing, 'marketing_at', f.marketing_at,
        'pedidos', f.pedidos, 'turnos', f.turnos, 'operaciones', f.operaciones, 'gastado', f.gastado,
        'ticket_promedio', case when f.operaciones > 0 then round(f.gastado / f.operaciones) else 0 end,
        'primera', f.primera, 'ultima_compra', f.ultima_compra, 'ultima_interaccion', f.ultima_interaccion, 'proximo_turno', f.proximo,
        'ausentes', f.ausentes, 'tareas', f.tareas, 'tareas_vencidas', f.tareas_vencidas, 'segmento', f.segmento, 'creado', f.created_at
      ) order by
        case when p_orden = 'nombre' then lower(f.nombre) end asc,
        case when p_orden = 'gasto' then f.gastado end desc nulls last,
        case when p_orden = 'operaciones' then f.operaciones end desc nulls last,
        case when p_orden = 'antiguedad' then f.created_at end asc,
        f.ultima_interaccion desc nulls last, f.id)
      from (select * from filtrado
             order by case when p_orden = 'nombre' then lower(nombre) end asc,
                      case when p_orden = 'gasto' then gastado end desc nulls last,
                      case when p_orden = 'operaciones' then operaciones end desc nulls last,
                      case when p_orden = 'antiguedad' then created_at end asc,
                      ultima_interaccion desc nulls last, id
             limit v_lim offset v_off) f), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

-- Resumen del CRM para el panel: segmentos, seguimientos y consultas que esperan respuesta.
create or replace function public.crm_resumen(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb; v_items jsonb;
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso para ver los clientes de este local'; end if;
  v_items := public.crm_clientes(p_comercio, null, null, null, 'reciente', 5000, 0)->'items';
  select jsonb_build_object(
    'total', jsonb_array_length(v_items),
    'segmentos', coalesce((select jsonb_object_agg(s, n) from (select x->>'segmento' s, count(*) n from jsonb_array_elements(v_items) x group by 1) q), '{}'::jsonb),
    'con_marketing', (select count(*) from jsonb_array_elements(v_items) x where (x->>'acepta_marketing')::boolean),
    'nuevos_30d', (select count(*) from public.crm_contactos where comercio_id = p_comercio and fusionado_en is null and created_at >= now() - interval '30 days'),
    'tareas_pendientes', (select count(*) from public.crm_actividades where comercio_id = p_comercio and tipo = 'tarea' and completada_at is null),
    'tareas_vencidas', (select count(*) from public.crm_actividades where comercio_id = p_comercio and tipo = 'tarea' and completada_at is null and vence_at < now()),
    'tareas_hoy', (select count(*) from public.crm_actividades where comercio_id = p_comercio and tipo = 'tarea' and completada_at is null
                    and (vence_at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date),
    -- Conversaciones donde el último mensaje es del cliente: alguien espera respuesta.
    'consultas_sin_responder', (select count(*) from public.msg_hilos h where h.comercio_id = p_comercio and h.ultimo_autor = h.cliente_id and h.ultimo_mensaje_at > now() - interval '30 days'),
    'turnos_hoy', (select count(*) from public.turnos t where t.comercio_id = p_comercio and t.estado in ('pendiente', 'confirmado', 'en_curso')
                    and (t.inicio at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date)
  ) into v;
  return v;
end $$;

-- Ficha integral: datos, métricas, línea de tiempo (pedidos, turnos, conversaciones, soporte y actividades) y posibles duplicados.
create or replace function public.crm_ficha(p_contacto uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare c public.crm_contactos; v_base jsonb; v_linea jsonb; v_dup jsonb; v_destino uuid;
begin
  select * into c from public.crm_contactos where id = p_contacto;
  if c.id is null or not public.crm_puede(c.comercio_id) then raise exception 'Contacto no encontrado'; end if;
  if c.fusionado_en is not null then
    -- Se unificó con otro: se abre el contacto que quedó.
    select id into v_destino from public.crm_contactos where id = c.fusionado_en;
    return jsonb_build_object('fusionado_en', v_destino);
  end if;
  v_base := public.crm_clientes(c.comercio_id, null, null, null, 'reciente', 1, 0, c.id)->'items'->0;

  select coalesce(jsonb_agg(e order by (e->>'fecha')::timestamptz desc), '[]'::jsonb) into v_linea from (
    select e from (
    select jsonb_build_object('tipo', 'pedido', 'id', p.id, 'fecha', p.created_at, 'titulo', 'Pedido #' || upper(left(p.id::text, 6)),
             'detalle', (select string_agg(i.cantidad || '× ' || i.nombre, ', ') from (select * from public.delivery_pedido_items where pedido_id = p.id limit 4) i),
             'estado', p.estado, 'monto', p.total) e
      from public.delivery_pedidos p where c.cliente_id is not null and p.comercio_id = c.comercio_id and p.cliente_id = c.cliente_id
      order by p.created_at desc limit 60
  ) a1
  union all select e from (
    select jsonb_build_object('tipo', 'turno', 'id', t.id, 'fecha', t.inicio, 'titulo', s.nombre, 'detalle', 'Con ' || pr.nombre || case when t.personas > 1 then ' · ' || t.personas || ' personas' else '' end,
             'estado', t.estado, 'monto', t.precio) e
      from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales pr on pr.id = t.profesional_id
     where t.contacto_id = c.id order by t.inicio desc limit 60
  ) a2
  union all select e from (
    select jsonb_build_object('tipo', 'mensaje', 'id', h.id, 'fecha', h.ultimo_mensaje_at,
             'titulo', case h.contexto when 'pedido' then 'Conversación de un pedido' when 'consulta' then 'Consulta' when 'producto' then 'Pregunta por un producto' when 'turno' then 'Conversación de un turno' else 'Conversación' end,
             'detalle', left(h.ultimo_texto, 160), 'estado', case when h.ultimo_autor = h.cliente_id then 'esperando' else 'respondida' end) e
      from public.msg_hilos h where c.cliente_id is not null and h.comercio_id = c.comercio_id and h.cliente_id = c.cliente_id
     order by h.ultimo_mensaje_at desc limit 30
  ) a3
  union all select e from (
    select jsonb_build_object('tipo', 'reclamo', 'id', r.id, 'fecha', r.created_at, 'titulo', 'Reclamo: ' || replace(r.tipo, '_', ' '), 'detalle', left(r.detalle, 160), 'estado', r.estado) e
      from public.delivery_reclamos r where c.cliente_id is not null and r.comercio_id = c.comercio_id and r.cliente_id = c.cliente_id
     order by r.created_at desc limit 30
  ) a4
  union all select e from (
    select jsonb_build_object('tipo', a.tipo, 'id', a.id, 'fecha', case when a.tipo = 'tarea' and a.completada_at is null and a.vence_at is not null then a.vence_at else a.created_at end,
             'titulo', a.titulo, 'detalle', a.detalle, 'vence_at', a.vence_at, 'completada_at', a.completada_at, 'actividad', true,
             'autor', coalesce(nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), 'Equipo'), 'creado', a.created_at,
             'estado', case when a.tipo <> 'tarea' then null when a.completada_at is not null then 'completada' when a.vence_at < now() then 'vencida' else 'pendiente' end) e
      from public.crm_actividades a left join public.perfiles pf on pf.id = a.autor_id where a.contacto_id = c.id
     order by a.created_at desc limit 100
  ) a5
  ) todo;

  -- Posibles duplicados: mismo teléfono, mismo email o mismo nombre sin cuenta. Dos cuentas distintas de Woref no se unifican.
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'telefono', d.telefono, 'email', d.email, 'con_cuenta', d.cliente_id is not null,
           'motivo', case when d.telefono_norm = c.telefono_norm then 'Mismo teléfono' when lower(d.email) = lower(c.email) then 'Mismo email' else 'Mismo nombre' end)), '[]'::jsonb)
    into v_dup
    from public.crm_contactos d
   where d.comercio_id = c.comercio_id and d.id <> c.id and d.fusionado_en is null
     and not (d.cliente_id is not null and c.cliente_id is not null)
     and ((c.telefono_norm is not null and d.telefono_norm = c.telefono_norm)
          or (c.email is not null and lower(d.email) = lower(c.email))
          or (lower(btrim(d.nombre)) = lower(btrim(c.nombre)) and (d.cliente_id is null or c.cliente_id is null) and lower(btrim(c.nombre)) <> 'cliente'));

  return v_base || jsonb_build_object('linea', v_linea, 'duplicados', v_dup, 'comercio_id', c.comercio_id);
end $$;

-- Alta o edición de un contacto (datos que el comercio administra).
create or replace function public.crm_contacto_guardar(p_comercio uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nombre text := btrim(coalesce(p_datos->>'nombre', '')); v_tel text := nullif(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_mail text := lower(nullif(btrim(coalesce(p_datos->>'email', '')), '')); v_notas text := nullif(btrim(coalesce(p_datos->>'notas', '')), '');
  v_tags text[]; v_mkt boolean := coalesce((p_datos->>'acepta_marketing')::boolean, false); v_prev public.crm_contactos;
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso para editar los clientes de este local'; end if;
  if char_length(v_nombre) not between 1 and 120 then raise exception 'Escribí el nombre (hasta 120 caracteres)'; end if;
  if v_tel is not null and char_length(coalesce(public._tel_norm(v_tel), '')) not between 6 and 20 then raise exception 'Revisá el teléfono'; end if;
  if v_mail is not null and (char_length(v_mail) > 160 or v_mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'Revisá el email'; end if;
  if char_length(coalesce(v_notas, '')) > 4000 then raise exception 'Las notas pueden tener hasta 4000 caracteres'; end if;
  select coalesce(array_agg(distinct t), '{}') into v_tags from (
    select left(lower(btrim(x)), 30) t from jsonb_array_elements_text(coalesce(p_datos->'etiquetas', '[]'::jsonb)) x where btrim(x) <> '') q;
  if cardinality(v_tags) > 20 then raise exception 'Hasta 20 etiquetas por cliente'; end if;
  if p_id is null then
    insert into public.crm_contactos (comercio_id, nombre, telefono, email, etiquetas, notas, acepta_marketing, marketing_at, origen, creado_por)
    values (p_comercio, v_nombre, v_tel, v_mail, v_tags, v_notas, v_mkt, case when v_mkt then now() end, 'manual', auth.uid()) returning id into v_id;
    return v_id;
  end if;
  select * into v_prev from public.crm_contactos where id = p_id and comercio_id = p_comercio and fusionado_en is null for update;
  if v_prev.id is null then raise exception 'Contacto no encontrado'; end if;
  update public.crm_contactos set nombre = v_nombre, telefono = v_tel, email = v_mail, etiquetas = v_tags, notas = v_notas,
         acepta_marketing = v_mkt, marketing_at = case when v_mkt and not v_prev.acepta_marketing then now() when not v_mkt then null else marketing_at end,
         updated_at = now()
   where id = p_id;
  return p_id;
end $$;

-- Actividades: registrar, completar/reabrir tareas y borrar.
create or replace function public.crm_actividad_guardar(p_contacto uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare c public.crm_contactos; v_id uuid; v_tipo text := coalesce(p_datos->>'tipo', 'nota'); v_titulo text := btrim(coalesce(p_datos->>'titulo', ''));
  v_detalle text := nullif(btrim(coalesce(p_datos->>'detalle', '')), ''); v_vence timestamptz := nullif(p_datos->>'vence_at', '')::timestamptz;
begin
  select * into c from public.crm_contactos where id = p_contacto and fusionado_en is null;
  if c.id is null or not public.crm_puede(c.comercio_id) then raise exception 'Contacto no encontrado'; end if;
  if v_tipo not in ('nota', 'llamada', 'whatsapp', 'email', 'reunion', 'tarea') then raise exception 'Tipo de actividad inválido'; end if;
  if char_length(v_titulo) not between 1 and 140 then raise exception 'Escribí un título (hasta 140 caracteres)'; end if;
  if char_length(coalesce(v_detalle, '')) > 4000 then raise exception 'El detalle puede tener hasta 4000 caracteres'; end if;
  if v_tipo = 'tarea' and v_vence is null then raise exception 'Elegí para cuándo es la tarea'; end if;
  if v_tipo <> 'tarea' then v_vence := null; end if;
  if p_id is null then
    insert into public.crm_actividades (comercio_id, contacto_id, tipo, titulo, detalle, vence_at, autor_id)
    values (c.comercio_id, c.id, v_tipo, v_titulo, v_detalle, v_vence, auth.uid()) returning id into v_id;
    return v_id;
  end if;
  update public.crm_actividades set tipo = v_tipo, titulo = v_titulo, detalle = v_detalle, vence_at = v_vence, updated_at = now()
   where id = p_id and contacto_id = c.id returning id into v_id;
  if v_id is null then raise exception 'Actividad no encontrada'; end if;
  return v_id;
end $$;

create or replace function public.crm_actividad_estado(p_id uuid, p_completada boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a public.crm_actividades;
begin
  select * into a from public.crm_actividades where id = p_id;
  if a.id is null or not public.crm_puede(a.comercio_id) then raise exception 'Actividad no encontrada'; end if;
  if a.tipo <> 'tarea' then raise exception 'Solo las tareas se completan'; end if;
  update public.crm_actividades set completada_at = case when p_completada then now() end, updated_at = now() where id = p_id;
end $$;

create or replace function public.crm_actividad_eliminar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a public.crm_actividades;
begin
  select * into a from public.crm_actividades where id = p_id;
  if a.id is null or not public.crm_puede(a.comercio_id) then raise exception 'Actividad no encontrada'; end if;
  delete from public.crm_actividades where id = p_id;
end $$;

-- Seguimientos (tareas) del local.
create or replace function public.crm_tareas(p_comercio uuid, p_filtro text default 'pendientes')
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso para ver los seguimientos de este local'; end if;
  if p_filtro not in ('pendientes', 'vencidas', 'hoy', 'proximas', 'completadas') then raise exception 'Filtro inválido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'detalle', a.detalle, 'vence_at', a.vence_at, 'completada_at', a.completada_at,
            'contacto_id', c.id, 'contacto', c.nombre, 'telefono', c.telefono, 'autor', coalesce(nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), 'Equipo'))
            order by case when p_filtro = 'completadas' then a.completada_at end desc, a.vence_at asc nulls last)
      from public.crm_actividades a join public.crm_contactos c on c.id = a.contacto_id left join public.perfiles pf on pf.id = a.autor_id
     where a.comercio_id = p_comercio and a.tipo = 'tarea'
       and case p_filtro
             when 'completadas' then a.completada_at is not null and a.completada_at > now() - interval '60 days'
             when 'vencidas' then a.completada_at is null and a.vence_at < now()
             when 'hoy' then a.completada_at is null and (a.vence_at at time zone tz)::date = (now() at time zone tz)::date
             when 'proximas' then a.completada_at is null and a.vence_at >= now()
             else a.completada_at is null end
     limit 300), '[]'::jsonb);
end $$;

-- Unificar duplicados: el contacto de origen se integra en el de destino (turnos, actividades, etiquetas, notas y datos).
create or replace function public.crm_fusionar(p_origen uuid, p_destino uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare o public.crm_contactos; d public.crm_contactos;
begin
  if p_origen = p_destino then raise exception 'Elegí dos contactos distintos'; end if;
  select * into o from public.crm_contactos where id = p_origen for update;
  select * into d from public.crm_contactos where id = p_destino for update;
  if o.id is null or d.id is null or o.comercio_id <> d.comercio_id or not public.crm_puede(o.comercio_id) then raise exception 'Contacto no encontrado'; end if;
  if o.fusionado_en is not null or d.fusionado_en is not null then raise exception 'Uno de los contactos ya fue unificado'; end if;
  if o.cliente_id is not null and d.cliente_id is not null and o.cliente_id <> d.cliente_id then
    raise exception 'Son dos cuentas distintas de Woref: no se pueden unificar';
  end if;
  update public.turnos set contacto_id = d.id where contacto_id = o.id;
  update public.crm_actividades set contacto_id = d.id where contacto_id = o.id;
  update public.crm_contactos set fusionado_en = d.id, cliente_id = null, updated_at = now() where id = o.id;
  update public.crm_contactos set
      cliente_id = coalesce(d.cliente_id, o.cliente_id),
      telefono = coalesce(d.telefono, o.telefono), email = coalesce(d.email, o.email),
      etiquetas = (select coalesce(array_agg(distinct t), '{}') from unnest(d.etiquetas || o.etiquetas) t),
      notas = nullif(left(concat_ws(E'\n\n', d.notas, o.notas), 4000), ''),
      acepta_marketing = d.acepta_marketing or o.acepta_marketing, marketing_at = coalesce(d.marketing_at, o.marketing_at),
      updated_at = now()
   where id = d.id;
  insert into public.crm_actividades (comercio_id, contacto_id, tipo, titulo, detalle, autor_id)
  values (d.comercio_id, d.id, 'nota', 'Se unificó con «' || o.nombre || '»', 'Sus turnos, actividades y datos ahora están en esta ficha.', auth.uid());
  return d.id;
end $$;

-- Etiquetas usadas en el local (para filtros y sugerencias).
create or replace function public.crm_etiquetas(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('etiqueta', t, 'cantidad', n) order by n desc, t)
    from (select unnest(etiquetas) t, count(*) n from public.crm_contactos where comercio_id = p_comercio and fusionado_en is null group by 1) q), '[]'::jsonb);
end $$;

-- Contacto de una cuenta de Woref en el local (para abrir la ficha desde un pedido o una conversación).
create or replace function public.crm_contacto_de_cliente(p_comercio uuid, p_cliente uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.crm_puede(p_comercio) then raise exception 'No tenés permiso'; end if;
  if not exists (select 1 from public.delivery_pedidos where comercio_id = p_comercio and cliente_id = p_cliente)
     and not exists (select 1 from public.turnos where comercio_id = p_comercio and cliente_id = p_cliente)
     and not exists (select 1 from public.msg_hilos where comercio_id = p_comercio and cliente_id = p_cliente) then
    raise exception 'Esa persona no es cliente del local';
  end if;
  return public.crm_asegurar_contacto(p_comercio, p_cliente, null, null, null, 'pedido');
end $$;

do $$ declare f text; begin
  foreach f in array array['crm_clientes(uuid,text,text,text,text,integer,integer,uuid)', 'crm_resumen(uuid)', 'crm_ficha(uuid)', 'crm_contacto_guardar(uuid,uuid,jsonb)',
    'crm_actividad_guardar(uuid,uuid,jsonb)', 'crm_actividad_estado(uuid,boolean)', 'crm_actividad_eliminar(uuid)', 'crm_tareas(uuid,text)',
    'crm_fusionar(uuid,uuid)', 'crm_etiquetas(uuid)', 'crm_contacto_de_cliente(uuid,uuid)', 'crm_puede(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- La nota del cliente (agenda) y la del CRM son la misma: se guarda en el contacto.
create or replace function public.cliente_nota_guardar(p_comercio uuid, p_cliente uuid, p_nota text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso'; end if;
  if char_length(coalesce(p_nota, '')) > 4000 then raise exception 'La nota es demasiado larga (máximo 4000 caracteres)'; end if;
  if not exists (select 1 from public.turnos where comercio_id = p_comercio and cliente_id = p_cliente)
     and not exists (select 1 from public.delivery_pedidos where comercio_id = p_comercio and cliente_id = p_cliente) then raise exception 'Esa persona no es cliente del local'; end if;
  v_id := public.crm_asegurar_contacto(p_comercio, p_cliente, null, null, null, 'turno');
  update public.crm_contactos set notas = nullif(btrim(coalesce(p_nota, '')), ''), updated_at = now() where id = v_id;
end $$;

-- Agenda y ficha del turno: incluyen el contacto del CRM y usan el teléfono que la persona le dio al local (nunca el del perfil).
create or replace function public.delivery_turnos_agenda(p_comercio uuid, p_desde date, p_hasta date, p_profesional uuid default null, p_servicio uuid default null, p_estado text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver la agenda de este local'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'Rango de fechas inválido (hasta 62 días)'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'precio', t.precio, 'notas', t.notas,
           'telefono', coalesce(t.telefono, ct.telefono),
           'servicio_id', t.servicio_id, 'servicio', s.nombre, 'color', s.color, 'profesional_id', t.profesional_id, 'profesional', p.nombre, 'recurso', r.nombre,
           'cliente_id', t.cliente_id, 'contacto_id', t.contacto_id, 'cliente', coalesce(ct.nombre, nullif(btrim(pf.nombre), ''), t.cliente_nombre, 'Cliente'),
           'personas', t.personas, 'origen', t.origen, 'grupal', t.grupal,
           'nota_interna', t.nota_interna, 'reprogramaciones', t.reprogramaciones, 'cancelado_por', t.cancelado_por, 'motivo_cancelacion', t.motivo_cancelacion,
           'creado', t.created_at, 'confirmado_at', t.confirmado_at, 'duracion_min', s.duracion_min,
           'puede_cerrar', t.estado in ('confirmado', 'en_curso') and t.inicio <= now(), 'puede_empezar', t.estado = 'confirmado' and t.inicio <= now() + interval '15 minutes')
           order by t.inicio, p.nombre)
      from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales p on p.id = t.profesional_id
      left join public.perfiles pf on pf.id = t.cliente_id left join public.recursos r on r.id = t.recurso_id
      left join public.crm_contactos ct on ct.id = t.contacto_id
     where t.comercio_id = p_comercio and (t.inicio at time zone tz)::date between p_desde and p_hasta
       and (p_profesional is null or t.profesional_id = p_profesional) and (p_servicio is null or t.servicio_id = p_servicio)
       and (p_estado is null or t.estado = p_estado)), '[]'::jsonb);
end $$;

create or replace function public.turno_cliente_ficha(p_turno uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t public.turnos; ct public.crm_contactos;
begin
  select * into t from public.turnos where id = p_turno;
  if not found or not public.delivery_permiso(t.comercio_id, 'pedidos') then raise exception 'Turno no encontrado'; end if;
  select * into ct from public.crm_contactos where id = t.contacto_id;
  return (with mios as (
    select x.* from public.turnos x where x.comercio_id = t.comercio_id and ((t.contacto_id is not null and x.contacto_id = t.contacto_id) or x.id = t.id)
  )
  select jsonb_build_object(
    'cliente_id', t.cliente_id, 'contacto_id', t.contacto_id,
    'nombre', coalesce(ct.nombre, (select nullif(btrim(pf.nombre), '') from public.perfiles pf where pf.id = t.cliente_id), t.cliente_nombre, 'Cliente'),
    'telefono', coalesce(t.telefono, ct.telefono),
    'con_cuenta', t.cliente_id is not null,
    'nota', ct.notas,
    'etiquetas', to_jsonb(coalesce(ct.etiquetas, '{}')),
    'total', (select count(*) from mios),
    'completados', (select count(*) from mios where estado = 'completado'),
    'ausentes', (select count(*) from mios where estado = 'ausente'),
    'cancelados', (select count(*) from mios where estado = 'cancelado'),
    'gastado', (select coalesce(sum(precio), 0) from mios where estado = 'completado'),
    'pedidos', case when t.cliente_id is null then 0 else (select count(*) from public.delivery_pedidos p where p.comercio_id = t.comercio_id and p.cliente_id = t.cliente_id) end,
    'primera_visita', (select min(inicio) from mios),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'inicio', m.inicio, 'estado', m.estado, 'servicio', s.nombre, 'profesional', pr.nombre, 'precio', m.precio) order by m.inicio desc)
                          from (select * from mios order by inicio desc limit 20) m join public.servicios s on s.id = m.servicio_id join public.profesionales pr on pr.id = m.profesional_id), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('evento', e.evento, 'detalle', e.detalle, 'fecha', e.fecha, 'por', coalesce(nullif(split_part(coalesce(pa.nombre, ''), ' ', 1), ''), case when e.actor is null then 'Sistema' else 'Equipo' end)) order by e.fecha)
                          from public.turno_eventos e left join public.perfiles pa on pa.id = e.actor where e.turno_id = t.id), '[]'::jsonb)
  ));
end $$;
