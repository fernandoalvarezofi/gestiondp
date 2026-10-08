-- MENSAJERÍA CORE (parte 2): abrir conversaciones, enviar, leer y archivar. Todo pasa por estas funciones.

-- Si el contexto todavía admite mensajes. Pedidos, viajes y envíos: mientras están activos y hasta 24 h después de
-- terminar (para objetos olvidados o aclaraciones). Consultas: si el local está activo y no bloqueó a la persona.
create or replace function public.msg_motivo_cerrado(p_hilo uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare h public.msg_hilos; p public.delivery_pedidos; e public.delivery_envios; v public.delivery_viajes;
begin
  select * into h from public.msg_hilos where id = p_hilo;
  if h.contexto = 'consulta' then
    if not exists (select 1 from public.delivery_comercios where id = h.comercio_id and activo) then return 'Este local no está disponible'; end if;
    if exists (select 1 from public.msg_bloqueos where comercio_id = h.comercio_id and cliente_id = h.cliente_id) then return 'Este local no recibe más mensajes tuyos'; end if;
    return null;
  elsif h.contexto = 'pedido' then
    select * into p from public.delivery_pedidos where id = h.contexto_id;
    if p.pago_estado in ('pendiente', 'rechazado') and p.estado = 'pendiente' then return 'El pedido todavía no fue confirmado'; end if;
    if h.canal <> 'cliente_comercio' and p.repartidor_id is null then return 'Todavía no hay un repartidor asignado'; end if;
    if p.estado in ('entregado', 'cancelado') and coalesce(p.entregado_at, p.cancelado_at, p.updated_at) < now() - interval '24 hours' then return 'La conversación de este pedido ya cerró. Si necesitás ayuda, hacé un reclamo.'; end if;
  elsif h.contexto = 'envio' then
    select * into e from public.delivery_envios where id = h.contexto_id;
    if e.repartidor_id is null then return 'Todavía no hay un repartidor asignado'; end if;
    if e.estado in ('entregado', 'cancelado') and coalesce(e.entregado_at, e.cancelado_at, e.updated_at) < now() - interval '24 hours' then return 'La conversación de este envío ya cerró'; end if;
  elsif h.contexto = 'viaje' then
    select * into v from public.delivery_viajes where id = h.contexto_id;
    if v.conductor_id is null then return 'Todavía no hay un conductor asignado'; end if;
    if v.estado in ('completado', 'cancelado') and coalesce(v.completado_at, v.cancelado_at, v.updated_at) < now() - interval '24 hours' then return 'La conversación de este viaje ya cerró'; end if;
  end if;
  return null;
end $$;

-- Abre (o retoma) el hilo de un pedido, viaje o envío. Solo si quien lo pide participa de ese canal.
create or replace function public.msg_abrir(p_contexto text, p_id uuid, p_canal text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_comercio uuid;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if p_contexto not in ('pedido', 'viaje', 'envio') then raise exception 'Contexto inválido'; end if;
  if p_contexto = 'pedido' then select comercio_id into v_comercio from public.delivery_pedidos where id = p_id; end if;
  select id into v_id from public.msg_hilos where contexto = p_contexto and contexto_id = p_id and canal = p_canal;
  if v_id is null then
    insert into public.msg_hilos (contexto, contexto_id, canal, comercio_id) values (p_contexto, p_id, p_canal, v_comercio)
      on conflict do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.msg_hilos where contexto = p_contexto and contexto_id = p_id and canal = p_canal; end if;
  end if;
  -- Si no participa, la excepción deshace también la creación del hilo.
  if not public.msg_puede_ver(v_id) then raise exception 'No participás de esta conversación'; end if;
  return v_id;
end $$;

create or replace function public.msg_enviar(p_hilo uuid, p_tipo text default 'texto', p_texto text default null, p_lat numeric default null, p_lng numeric default null, p_foto text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_rol text := public.msg_rol(p_hilo); v_cerrado text; v_texto text := nullif(btrim(regexp_replace(coalesce(p_texto, ''), '[[:cntrl:]]', ' ', 'g')), ''); v_id bigint; v_resumen text;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if v_rol is null then raise exception 'No participás de esta conversación'; end if;
  v_cerrado := public.msg_motivo_cerrado(p_hilo);
  if v_cerrado is not null then raise exception '%', v_cerrado; end if;
  if p_tipo not in ('texto', 'rapido', 'ubicacion', 'foto') then raise exception 'Tipo de mensaje inválido'; end if;
  if p_tipo in ('texto', 'rapido') and v_texto is null then raise exception 'Escribí un mensaje'; end if;
  if char_length(coalesce(v_texto, '')) > 1000 then raise exception 'El mensaje es muy largo (máximo 1.000 caracteres)'; end if;
  if p_tipo = 'ubicacion' and (p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180) then raise exception 'Ubicación inválida'; end if;
  if p_tipo = 'foto' and (p_foto is null or p_foto not like p_hilo::text || '/%' or p_foto ~ '\.\.') then raise exception 'Foto inválida'; end if;
  if (select count(*) from public.msg_mensajes where autor_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Estás enviando muchos mensajes. Esperá un momento.';
  end if;
  insert into public.msg_mensajes (hilo_id, autor_id, autor_rol, tipo, texto, lat, lng, foto_path)
    values (p_hilo, auth.uid(), v_rol, p_tipo, v_texto, case when p_tipo = 'ubicacion' then p_lat end, case when p_tipo = 'ubicacion' then p_lng end, case when p_tipo = 'foto' then p_foto end)
    returning id into v_id;
  v_resumen := case p_tipo when 'ubicacion' then '📍 Ubicación compartida' when 'foto' then '📷 Foto' else left(v_texto, 120) end;
  update public.msg_hilos set ultimo_mensaje_at = clock_timestamp(), ultimo_texto = v_resumen, ultimo_autor = auth.uid() where id = p_hilo;
  insert into public.msg_lecturas (hilo_id, usuario_id, leido_at) values (p_hilo, auth.uid(), clock_timestamp())
    on conflict (hilo_id, usuario_id) do update set leido_at = excluded.leido_at, archivado_at = null;
  return v_id;
end $$;

-- Consulta a un local antes de comprar (reemplaza a conversacion_iniciar).
create or replace function public.msg_consulta_iniciar(p_comercio uuid, p_texto text, p_producto uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prod uuid;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if not exists (select 1 from public.delivery_comercios where id = p_comercio and activo and aprobado) then raise exception 'Local no disponible'; end if;
  if public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No podés escribirte a tu propio local'; end if;
  select id into v_prod from public.delivery_productos where id = p_producto and comercio_id = p_comercio;
  insert into public.msg_hilos (contexto, canal, comercio_id, cliente_id, producto_id) values ('consulta', 'consulta', p_comercio, auth.uid(), v_prod)
    on conflict (comercio_id, cliente_id) where contexto = 'consulta' do update set producto_id = coalesce(excluded.producto_id, public.msg_hilos.producto_id)
    returning id into v_id;
  perform public.msg_enviar(v_id, 'texto', p_texto);
  return v_id;
end $$;

create or replace function public.msg_marcar_leido(p_hilo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.msg_rol(p_hilo) is null then return; end if;
  insert into public.msg_lecturas (hilo_id, usuario_id, leido_at) values (p_hilo, auth.uid(), clock_timestamp())
    on conflict (hilo_id, usuario_id) do update set leido_at = excluded.leido_at;
end $$;

create or replace function public.msg_archivar(p_hilo uuid, p_archivar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.msg_rol(p_hilo) is null then raise exception 'No participás de esta conversación'; end if;
  insert into public.msg_lecturas (hilo_id, usuario_id, leido_at, archivado_at) values (p_hilo, auth.uid(), clock_timestamp(), case when p_archivar then clock_timestamp() end)
    on conflict (hilo_id, usuario_id) do update set archivado_at = case when p_archivar then clock_timestamp() end;
end $$;

-- Mensajes de un hilo (de a 60, hacia atrás con p_antes). "otro_leido_at": hasta dónde leyó la otra parte (doble tilde).
create or replace function public.msg_mensajes(p_hilo uuid, p_antes bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public.msg_rol(p_hilo);
begin
  if not public.msg_puede_ver(p_hilo) then raise exception 'No tenés acceso a esta conversación'; end if;
  return jsonb_build_object(
    'mi_rol', v_rol,
    'otro_leido_at', (select max(l.leido_at) from public.msg_lecturas l where l.hilo_id = p_hilo and l.usuario_id <> auth.uid()
                        and not exists (select 1 from public.msg_mensajes m where m.hilo_id = p_hilo and m.autor_id = l.usuario_id and m.autor_rol = v_rol)),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'autor_rol', m.autor_rol, 'mio', m.autor_id = auth.uid(), 'tipo', m.tipo,
        'texto', case when m.oculto_at is not null then null else m.texto end,
        'lat', case when m.oculto_at is null then m.lat end, 'lng', case when m.oculto_at is null then m.lng end,
        'foto_path', case when m.oculto_at is null then m.foto_path end,
        'oculto', m.oculto_at is not null, 'created_at', m.created_at) order by m.id)
      from (select * from public.msg_mensajes where hilo_id = p_hilo and (p_antes is null or id < p_antes) order by id desc limit 60) m), '[]'::jsonb)
  );
end $$;

revoke all on function public.msg_motivo_cerrado(uuid) from public, anon, authenticated;
revoke all on function public.msg_abrir(text, uuid, text), public.msg_enviar(uuid, text, text, numeric, numeric, text), public.msg_consulta_iniciar(uuid, text, uuid),
  public.msg_marcar_leido(uuid), public.msg_archivar(uuid, boolean), public.msg_mensajes(uuid, bigint) from public, anon;
grant execute on function public.msg_abrir(text, uuid, text), public.msg_enviar(uuid, text, text, numeric, numeric, text), public.msg_consulta_iniciar(uuid, text, uuid),
  public.msg_marcar_leido(uuid), public.msg_archivar(uuid, boolean), public.msg_mensajes(uuid, bigint) to authenticated;
