-- MENSAJERÍA CORE (parte 3): bandeja unificada, encabezado con contexto, reportes, bloqueo y moderación.

-- Primer nombre de una persona (nunca se muestran apellidos completos, teléfonos ni emails entre partes).
create or replace function public.msg_nombre(p_usuario uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(btrim(coalesce(nombre, '')), ' ', 1), ''), 'Usuario') from public.perfiles where id = p_usuario
$$;
revoke all on function public.msg_nombre(uuid) from public, anon, authenticated;

-- Cómo se ve un hilo para un rol: con quién hablo, de qué contexto y a dónde lleva.
create or replace function public.msg_resumen(p_hilo uuid, p_rol text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h public.msg_hilos; p public.delivery_pedidos; e public.delivery_envios; v public.delivery_viajes; c public.delivery_comercios; v_titulo text; v_sub text; v_url text; v_estado text; v_ref text;
begin
  select * into h from public.msg_hilos where id = p_hilo;
  if h.contexto = 'pedido' then
    select * into p from public.delivery_pedidos where id = h.contexto_id;
    select * into c from public.delivery_comercios where id = p.comercio_id;
    v_ref := '#' || upper(left(p.id::text, 6)); v_estado := p.estado;
    v_titulo := case
      when p_rol = 'cliente' and h.canal = 'cliente_comercio' then c.nombre
      when p_rol = 'cliente' then 'Tu repartidor' || coalesce(' · ' || public.msg_nombre(p.repartidor_id), '')
      when p_rol = 'comercio' and h.canal = 'cliente_comercio' then public.msg_nombre(p.cliente_id)
      when p_rol = 'comercio' then 'Repartidor' || coalesce(' · ' || public.msg_nombre(p.repartidor_id), '')
      when p_rol = 'repartidor' and h.canal = 'cliente_repartidor' then public.msg_nombre(p.cliente_id)
      when p_rol = 'repartidor' then c.nombre
      else c.nombre || ' · ' || replace(h.canal, '_', ' ↔ ') end;
    v_sub := 'Pedido ' || v_ref;
    v_url := case p_rol when 'cliente' then '/app/pedidos/' || p.id when 'comercio' then '/app/comercio/pedidos' when 'repartidor' then '/app/repartidor' else '/app/admin/pedidos' end;
  elsif h.contexto = 'envio' then
    select * into e from public.delivery_envios where id = h.contexto_id;
    v_ref := '#' || upper(left(e.id::text, 6)); v_estado := e.estado;
    v_titulo := case when p_rol = 'cliente' then 'Tu repartidor' || coalesce(' · ' || public.msg_nombre(e.repartidor_id), '') else public.msg_nombre(e.cliente_id) end;
    v_sub := 'Envío ' || v_ref || ' · ' || left(e.descripcion, 40);
    v_url := case p_rol when 'cliente' then '/app/envios/' || e.id when 'repartidor' then '/app/repartidor' else '/app/admin/envios' end;
  elsif h.contexto = 'viaje' then
    select * into v from public.delivery_viajes where id = h.contexto_id;
    v_ref := '#' || upper(left(v.id::text, 6)); v_estado := v.estado;
    v_titulo := case when p_rol = 'pasajero' then 'Tu conductor' || coalesce(' · ' || public.msg_nombre(v.conductor_id), '') else public.msg_nombre(v.cliente_id) end;
    v_sub := 'Viaje ' || v_ref || ' · ' || coalesce(nullif(btrim(split_part(v.destino_direccion, ',', 1)), ''), 'destino');
    v_url := case p_rol when 'pasajero' then '/app/remis/' || v.id when 'conductor' then '/app/conductor' else '/app/admin/viajes' end;
  else
    select * into c from public.delivery_comercios where id = h.comercio_id;
    v_titulo := case when p_rol = 'cliente' then c.nombre else public.msg_nombre(h.cliente_id) end;
    v_sub := 'Consulta' || coalesce(' · ' || (select nombre from public.delivery_productos where id = h.producto_id), '');
    v_url := case when p_rol = 'cliente' then '/t/' || c.slug else null end;
  end if;
  return jsonb_build_object('id', h.id, 'contexto', h.contexto, 'contexto_id', h.contexto_id, 'canal', h.canal, 'rol', p_rol,
    'titulo', coalesce(v_titulo, 'Conversación'), 'subtitulo', v_sub, 'referencia', v_ref, 'estado', v_estado, 'url', v_url,
    'logo_url', case when h.contexto = 'consulta' and p_rol = 'cliente' then c.logo_url when h.contexto = 'pedido' and h.canal = 'cliente_comercio' and p_rol = 'cliente' then c.logo_url end);
end $$;
revoke all on function public.msg_resumen(uuid, text) from public, anon, authenticated;

-- Encabezado de un hilo para quien lo abre: contexto, mi rol y si se puede escribir.
create or replace function public.msg_hilo_info(p_hilo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public.msg_rol(p_hilo); v_cerrado text;
begin
  if not public.msg_puede_ver(p_hilo) then raise exception 'No tenés acceso a esta conversación'; end if;
  v_cerrado := case when v_rol is null then 'Estás viendo esta conversación como administración' else public.msg_motivo_cerrado(p_hilo) end;
  return public.msg_resumen(p_hilo, coalesce(v_rol, 'admin')) || jsonb_build_object('puede_escribir', v_cerrado is null, 'motivo_cerrado', v_cerrado,
    'bloqueado', (select exists (select 1 from public.msg_bloqueos b join public.msg_hilos h on h.comercio_id = b.comercio_id and h.cliente_id = b.cliente_id where h.id = p_hilo and h.contexto = 'consulta')));
end $$;

-- Hilos donde participa la persona: como cliente/pasajero, repartidor o conductor (p_rol filtra) o, con p_comercio, como equipo de un local.
create or replace function public.msg_mis_hilos(p_comercio uuid default null, p_rol text default null)
returns table (hilo uuid, rol text) language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  if p_comercio is not null then
    if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'Sin permiso sobre este local'; end if;
    return query select h.id, 'comercio'::text from public.msg_hilos h where h.comercio_id = p_comercio and h.canal in ('consulta', 'cliente_comercio', 'comercio_repartidor');
    return;
  end if;
  return query
    select h.id, 'cliente'::text from public.msg_hilos h where h.contexto = 'consulta' and h.cliente_id = v_uid and coalesce(p_rol, 'cliente') = 'cliente'
    union all
    select h.id, 'cliente' from public.msg_hilos h join public.delivery_pedidos p on p.id = h.contexto_id
      where h.contexto = 'pedido' and h.canal in ('cliente_comercio', 'cliente_repartidor') and p.cliente_id = v_uid and coalesce(p_rol, 'cliente') = 'cliente'
    union all
    select h.id, 'repartidor' from public.msg_hilos h join public.delivery_pedidos p on p.id = h.contexto_id
      where h.contexto = 'pedido' and h.canal in ('cliente_repartidor', 'comercio_repartidor') and p.repartidor_id = v_uid and coalesce(p_rol, 'repartidor') = 'repartidor'
    union all
    select h.id, case when e.cliente_id = v_uid then 'cliente' else 'repartidor' end from public.msg_hilos h join public.delivery_envios e on e.id = h.contexto_id
      where h.contexto = 'envio' and (e.cliente_id = v_uid or e.repartidor_id = v_uid)
        and (p_rol is null or p_rol = case when e.cliente_id = v_uid then 'cliente' else 'repartidor' end)
    union all
    select h.id, case when v.cliente_id = v_uid then 'pasajero' else 'conductor' end from public.msg_hilos h join public.delivery_viajes v on v.id = h.contexto_id
      where h.contexto = 'viaje' and (v.cliente_id = v_uid or v.conductor_id = v_uid)
        and (p_rol is null or p_rol = case when v.cliente_id = v_uid then 'cliente' else 'conductor' end);
end $$;
revoke all on function public.msg_mis_hilos(uuid, text) from public, anon, authenticated;

-- Bandeja: conversaciones con mensajes, con su contexto, último mensaje y cuántos sin leer.
-- p_rol: 'cliente' (incluye pasajero), 'repartidor' o 'conductor'; null = todas. p_comercio: bandeja del local.
create or replace function public.msg_bandeja(p_comercio uuid default null, p_rol text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.msg_resumen(h.id, m.rol) || jsonb_build_object(
      'ultimo_texto', h.ultimo_texto, 'ultimo_mensaje_at', h.ultimo_mensaje_at, 'ultimo_mio', h.ultimo_autor = auth.uid(),
      'archivado', l.archivado_at is not null,
      'sin_leer', (select count(*) from public.msg_mensajes x where x.hilo_id = h.id and x.created_at > coalesce(l.leido_at, '-infinity')
                    and case when m.rol = 'comercio' then x.autor_rol <> 'comercio' else x.autor_id is distinct from auth.uid() end))
    order by h.ultimo_mensaje_at desc), '[]'::jsonb)
  from (select distinct on (hilo) hilo, rol from public.msg_mis_hilos(p_comercio, p_rol)) m
  join public.msg_hilos h on h.id = m.hilo and h.ultimo_mensaje_at is not null
  left join public.msg_lecturas l on l.hilo_id = h.id and l.usuario_id = auth.uid()
$$;

-- Cantidad de conversaciones con mensajes sin leer (para el globito del menú).
create or replace function public.msg_sin_leer(p_comercio uuid default null, p_rol text default null) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from (select distinct on (hilo) hilo, rol from public.msg_mis_hilos(p_comercio, p_rol)) m
  join public.msg_hilos h on h.id = m.hilo
  left join public.msg_lecturas l on l.hilo_id = h.id and l.usuario_id = auth.uid()
  where l.archivado_at is null and exists (select 1 from public.msg_mensajes x where x.hilo_id = h.id and x.created_at > coalesce(l.leido_at, '-infinity')
    and case when m.rol = 'comercio' then x.autor_rol <> 'comercio' else x.autor_id is distinct from auth.uid() end)
$$;

-- Reportar un mensaje ofensivo o sospechoso: lo revisa administración.
create or replace function public.msg_reportar(p_mensaje bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.msg_mensajes; v_motivo text := btrim(coalesce(p_motivo, '')); a uuid;
begin
  select * into m from public.msg_mensajes where id = p_mensaje;
  if m.id is null or public.msg_rol(m.hilo_id) is null then raise exception 'No podés reportar este mensaje'; end if;
  if m.autor_id = auth.uid() then raise exception 'No podés reportar tu propio mensaje'; end if;
  if char_length(v_motivo) < 3 then raise exception 'Contanos brevemente qué pasó'; end if;
  insert into public.msg_reportes (mensaje_id, hilo_id, usuario_id, motivo) values (m.id, m.hilo_id, auth.uid(), left(v_motivo, 300))
    on conflict (mensaje_id, usuario_id) do nothing;
  for a in select user_id from public.user_roles where role = 'admin' loop
    perform public.notificar(a, 'soporte', 'MENSAJE_REPORTADO', 'Mensaje reportado', left(v_motivo, 120), '/app/admin/mensajes', 'msgrep-' || m.id, true);
  end loop;
end $$;

-- El local bloquea (o desbloquea) a quien le escribe consultas. No afecta pedidos.
create or replace function public.msg_bloquear(p_hilo uuid, p_bloquear boolean) returns void
language plpgsql security definer set search_path = public as $$
declare h public.msg_hilos;
begin
  select * into h from public.msg_hilos where id = p_hilo;
  if h.contexto <> 'consulta' or public.msg_rol(p_hilo) is distinct from 'comercio' then raise exception 'Solo el local puede bloquear consultas'; end if;
  if p_bloquear then
    insert into public.msg_bloqueos (comercio_id, cliente_id, creado_por) values (h.comercio_id, h.cliente_id, auth.uid()) on conflict do nothing;
  else
    delete from public.msg_bloqueos where comercio_id = h.comercio_id and cliente_id = h.cliente_id;
  end if;
end $$;

-- Moderación (administración): reportes pendientes y resolución (ocultar el mensaje o descartar el reporte).
create or replace function public.msg_admin_reportes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'mensaje_id', m.id, 'hilo_id', r.hilo_id, 'motivo', r.motivo, 'created_at', r.created_at,
      'texto', m.texto, 'tipo', m.tipo, 'autor_rol', m.autor_rol, 'autor', public.msg_nombre(m.autor_id), 'reporta', public.msg_nombre(r.usuario_id),
      'oculto', m.oculto_at is not null, 'contexto', public.msg_resumen(r.hilo_id, 'admin')) order by r.created_at desc)
    from public.msg_reportes r join public.msg_mensajes m on m.id = r.mensaje_id where r.resuelto_at is null), '[]'::jsonb);
end $$;

create or replace function public.msg_admin_resolver(p_reporte bigint, p_ocultar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.msg_reportes;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  select * into r from public.msg_reportes where id = p_reporte;
  if r.id is null then raise exception 'Reporte no encontrado'; end if;
  if p_ocultar then update public.msg_mensajes set oculto_at = now(), oculto_por = auth.uid() where id = r.mensaje_id; end if;
  update public.msg_reportes set resuelto_at = now(), resuelto_por = auth.uid(), accion = case when p_ocultar then 'ocultado' else 'descartado' end
    where mensaje_id = r.mensaje_id and resuelto_at is null;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), case when p_ocultar then 'mensaje_ocultado' else 'reporte_descartado' end, 'msg_mensajes', r.mensaje_id::text, jsonb_build_object('reporte', r.id, 'motivo', r.motivo));
end $$;

revoke all on function public.msg_hilo_info(uuid), public.msg_bandeja(uuid, text), public.msg_sin_leer(uuid, text), public.msg_reportar(bigint, text),
  public.msg_bloquear(uuid, boolean), public.msg_admin_reportes(), public.msg_admin_resolver(bigint, boolean) from public, anon;
grant execute on function public.msg_hilo_info(uuid), public.msg_bandeja(uuid, text), public.msg_sin_leer(uuid, text), public.msg_reportar(bigint, text),
  public.msg_bloquear(uuid, boolean), public.msg_admin_reportes(), public.msg_admin_resolver(bigint, boolean) to authenticated;
