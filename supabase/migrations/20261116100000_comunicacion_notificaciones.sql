-- FASE 10 (Comunicación), paso 1: bandeja de notificaciones dentro de la app + preferencias de push por categoría.
--  * notificaciones: cada persona ve solo las suyas (RLS). Se crean únicamente con notificar() (el servidor), nunca desde la app.
--  * notificar(): valida el texto y el enlace (solo rutas internas), evita duplicados con una clave y, si la persona no silenció esa categoría,
--    pide el push al servidor (función push-notificacion). Nunca bloquea la operación original.
--  * Avisos de dominio por disparadores a prueba de fallas: turnos, devoluciones, opiniones de producto, pagos y pedidos (los pedidos ya tienen su push propio: acá solo
--    quedan en la bandeja, sin duplicar el aviso al celular). Recordatorios de turnos (24 h y 2 h antes) por tarea programada.
-- Revertir: drop trigger notif_*; drop function notificar, notif_*, comercio_destinatarios, mis_notificaciones, ...; drop table notificaciones_preferencias, notificaciones; cron.unschedule.

create table if not exists public.notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  categoria text not null check (categoria in ('pedidos', 'pagos', 'turnos', 'devoluciones', 'opiniones', 'mensajes', 'sistema')),
  tipo text not null check (char_length(tipo) between 3 and 40),
  titulo text not null check (char_length(titulo) between 1 and 100),
  cuerpo text check (cuerpo is null or char_length(cuerpo) <= 240),
  url text check (url is null or (url ~ '^/([A-Za-z0-9_?=&.#%-][A-Za-z0-9/_?=&.#%-]*)?$' and char_length(url) <= 200)),
  dedupe text check (dedupe is null or char_length(dedupe) <= 120),
  leida_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_no_leidas_idx on public.notificaciones (usuario_id) where leida_at is null;
create unique index if not exists notificaciones_dedupe_uk on public.notificaciones (usuario_id, dedupe) where dedupe is not null;

create table if not exists public.notificaciones_preferencias (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  categoria text not null check (categoria in ('pedidos', 'pagos', 'turnos', 'devoluciones', 'opiniones', 'mensajes', 'sistema')),
  push boolean not null default true,
  primary key (usuario_id, categoria)
);

alter table public.notificaciones enable row level security;
alter table public.notificaciones_preferencias enable row level security;
revoke all on public.notificaciones, public.notificaciones_preferencias from anon, authenticated;
grant select on public.notificaciones to authenticated;
grant all on public.notificaciones, public.notificaciones_preferencias to service_role;
drop policy if exists "Mis notificaciones" on public.notificaciones;
create policy "Mis notificaciones" on public.notificaciones for select to authenticated using (usuario_id = auth.uid());

-- Quiénes reciben los avisos de un local, según el permiso (misma regla que delivery_permiso, pero listando personas).
create or replace function public.comercio_destinatarios(p_comercio uuid, p_permiso text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct u), '{}') from (
    select c.propietario_id as u from public.delivery_comercios c where c.id = p_comercio and c.propietario_id is not null
    union
    select e.user_id from public.delivery_comercio_equipo e
     where e.comercio_id = p_comercio and e.estado = 'activo'
       and ((e.rol = 'operador' and p_permiso = 'pedidos') or (e.rol = 'encargado' and p_permiso in ('pedidos', 'catalogo', 'promociones', 'opiniones', 'estadisticas', 'ajustes')))
    union
    select m.user_id from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
     where c.id = p_comercio and m.estado = 'activo'
       and (m.rol in ('owner', 'admin') or (m.rol = 'manager' and p_permiso in ('pedidos', 'catalogo', 'promociones', 'opiniones', 'estadisticas', 'ajustes'))
            or (m.rol = 'operator' and p_permiso = 'pedidos') or (m.rol = 'seller' and p_permiso in ('pedidos', 'catalogo')))
  ) x where u is not null
$$;
revoke all on function public.comercio_destinatarios(uuid, text) from public, anon, authenticated;

-- Crea una notificación (y pide el push). Interna: solo la ejecutan funciones del servidor.
create or replace function public.notificar(p_usuario uuid, p_categoria text, p_tipo text, p_titulo text, p_cuerpo text default null, p_url text default null, p_dedupe text default null, p_push boolean default true) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare v_id bigint; v_url text; v_secret text; v_push_on boolean; v_hay boolean;
begin
  if p_usuario is null then return null; end if;
  insert into public.notificaciones (usuario_id, categoria, tipo, titulo, cuerpo, url, dedupe)
    values (p_usuario, p_categoria, left(p_tipo, 40), left(p_titulo, 100), left(nullif(p_cuerpo, ''), 240), p_url, p_dedupe)
    on conflict (usuario_id, dedupe) where dedupe is not null do nothing returning id into v_id;
  if v_id is null or not p_push then return v_id; end if;
  begin
    select coalesce((select push from public.notificaciones_preferencias where usuario_id = p_usuario and categoria = p_categoria), true) into v_push_on;
    select exists (select 1 from public.delivery_push_suscripciones where perfil_id = p_usuario) into v_hay;
    if v_push_on and v_hay then
      select valor into v_url from public.app_config where clave = 'push_function_url';
      select valor into v_secret from public.app_config where clave = 'push_webhook_secret';
      if v_url is not null and v_secret is not null then
        perform net.http_post(url := regexp_replace(v_url, '/[^/]+$', '/push-notificacion'), body := jsonb_build_object('id', v_id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-secret', v_secret));
      end if;
    end if;
  exception when others then null;
  end;
  return v_id;
end $$;
revoke all on function public.notificar(uuid, text, text, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.notificar_local(p_comercio uuid, p_permiso text, p_categoria text, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_dedupe text, p_push boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  foreach u in array public.comercio_destinatarios(p_comercio, p_permiso) loop
    perform public.notificar(u, p_categoria, p_tipo, p_titulo, p_cuerpo, p_url, case when p_dedupe is null then null else p_dedupe || ':' || u::text end, p_push);
  end loop;
end $$;
revoke all on function public.notificar_local(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;

-- Lecturas y acciones de la persona ---------------------------------------------------------------------------------------
create or replace function public.mis_notificaciones(p_limite integer default 30, p_antes bigint default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb) from (
    select n.id, n.categoria, n.tipo, n.titulo, n.cuerpo, n.url, n.leida_at, n.created_at from public.notificaciones n
     where n.usuario_id = auth.uid() and (p_antes is null or n.id < p_antes) order by n.id desc limit least(greatest(coalesce(p_limite, 30), 1), 100)) x
$$;
create or replace function public.notificaciones_no_leidas() returns integer
language sql stable security definer set search_path = public as $$ select count(*)::integer from public.notificaciones where usuario_id = auth.uid() and leida_at is null $$;
create or replace function public.notificaciones_marcar_leidas(p_ids bigint[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  update public.notificaciones set leida_at = now() where usuario_id = auth.uid() and leida_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
create or replace function public.mis_preferencias_notificaciones() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(c, coalesce((select p.push from public.notificaciones_preferencias p where p.usuario_id = auth.uid() and p.categoria = c), true)), '{}'::jsonb)
    from unnest(array['pedidos', 'pagos', 'turnos', 'devoluciones', 'opiniones', 'mensajes', 'sistema']) c
$$;
create or replace function public.guardar_preferencia_notificacion(p_categoria text, p_push boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if p_categoria not in ('pedidos', 'pagos', 'turnos', 'devoluciones', 'opiniones', 'mensajes', 'sistema') then raise exception 'Categoría inválida'; end if;
  insert into public.notificaciones_preferencias (usuario_id, categoria, push) values (auth.uid(), p_categoria, coalesce(p_push, true))
    on conflict (usuario_id, categoria) do update set push = excluded.push;
end $$;
revoke all on function public.mis_notificaciones(integer, bigint), public.notificaciones_no_leidas(), public.notificaciones_marcar_leidas(bigint[]), public.mis_preferencias_notificaciones(), public.guardar_preferencia_notificacion(text, boolean) from public, anon;
grant execute on function public.mis_notificaciones(integer, bigint), public.notificaciones_no_leidas(), public.notificaciones_marcar_leidas(bigint[]), public.mis_preferencias_notificaciones(), public.guardar_preferencia_notificacion(text, boolean) to authenticated;

-- Tiempo real para la campanita.
do $rt$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones') then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $rt$;

-- Avisos de dominio (todos a prueba de fallas: si algo sale mal, la operación original sigue) ---------------------------------
create or replace function public.notif_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.servicios; v_cuando text; v_nombre text;
begin
  begin
    select * into s from public.servicios where id = new.servicio_id;
    v_cuando := to_char(new.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI');
    select coalesce(nullif(split_part(coalesce(nombre, ''), ' ', 1), ''), 'Alguien') into v_nombre from public.perfiles where id = new.cliente_id;
    if tg_op = 'INSERT' then
      perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'Turno confirmado', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id, true);
      perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_NUEVO', 'Nuevo turno', coalesce(v_nombre, 'Alguien') || ' reservó ' || s.nombre || ' · ' || v_cuando, '/app/comercio/turnos', 'turno-nuevo-' || new.id, true);
    elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
      if new.cancelado_por = 'cliente' then
        perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_CANCELADO', 'Turno cancelado', coalesce(v_nombre, 'Alguien') || ' canceló ' || s.nombre || ' · ' || v_cuando, '/app/comercio/turnos', 'turno-canc-' || new.id, true);
      else
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CANCELADO', 'El local canceló tu turno', s.nombre || ' · ' || v_cuando || coalesce('. ' || new.motivo_cancelacion, ''), '/app/turnos', 'turno-canc-' || new.id, true);
      end if;
    end if;
  exception when others then raise warning 'notif_turno % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_turno on public.turnos;
create trigger notif_turno after insert or update of estado on public.turnos for each row execute function public.notif_turno();

create or replace function public.notif_devolucion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.notificar_local(new.comercio_id, 'pedidos', 'devoluciones', 'DEVOLUCION_SOLICITADA', 'Nueva devolución para responder', 'Piden devolver ' || to_char(new.monto, 'FM999G999G990') || ' pesos de un pedido.', '/app/comercio/devoluciones', 'dev-nueva-' || new.id, true);
    elsif new.estado is distinct from old.estado then
      if new.estado = 'aprobada' then perform public.notificar(new.cliente_id, 'devoluciones', 'DEVOLUCION_APROBADA', 'Aprobaron tu devolución', 'Cuando el local reciba los productos te devuelve el dinero.', '/app/pedidos/' || new.pedido_id, 'dev-apr-' || new.id, true);
      elsif new.estado = 'rechazada' then perform public.notificar(new.cliente_id, 'devoluciones', 'DEVOLUCION_RECHAZADA', 'No se aprobó tu devolución', coalesce(new.respuesta, 'Revisá la respuesta del local.'), '/app/pedidos/' || new.pedido_id, 'dev-rech-' || new.id, true);
      elsif new.estado = 'reintegrada' then perform public.notificar(new.cliente_id, 'devoluciones', 'DEVOLUCION_REINTEGRADA', 'Te devolvimos el dinero', case when new.destino = 'billetera' then 'Ya está en tu billetera de Woref.' else 'Te lo devolvemos por el medio de pago original.' end, '/app/pedidos/' || new.pedido_id, 'dev-reint-' || new.id, true);
      end if;
    end if;
  exception when others then raise warning 'notif_devolucion % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_devolucion on public.devoluciones;
create trigger notif_devolucion after insert or update of estado on public.devoluciones for each row execute function public.notif_devolucion();

create or replace function public.notif_opinion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prod text;
begin
  begin
    select nombre into v_prod from public.delivery_productos where id = new.producto_id;
    if tg_op = 'INSERT' then
      perform public.notificar_local(new.comercio_id, 'opiniones', 'opiniones', 'OPINION_NUEVA', 'Nueva opinión de ' || new.puntaje || (case when new.puntaje = 1 then ' estrella' else ' estrellas' end), coalesce(v_prod, 'Un producto') || coalesce(': ' || left(new.comentario, 120), ''), '/app/comercio/opiniones', 'op-nueva-' || new.id, true);
    elsif new.respuesta is not null and old.respuesta is null then
      perform public.notificar(new.cliente_id, 'opiniones', 'OPINION_RESPONDIDA', 'El vendedor respondió tu opinión', coalesce(v_prod, 'Tu opinión'), '/app/pedidos', 'op-resp-' || new.id, true);
    end if;
  exception when others then raise warning 'notif_opinion % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_opinion on public.delivery_resenas_producto;
create trigger notif_opinion after insert or update of respuesta on public.delivery_resenas_producto for each row execute function public.notif_opinion();

create or replace function public.notif_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cli uuid;
begin
  begin
    if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then return null; end if;
    select cliente_id into v_cli from public.delivery_pedidos where id = new.referencia_id;
    if new.estado = 'aprobado' then perform public.notificar(v_cli, 'pagos', 'PAGO_APROBADO', 'Pago aprobado', 'Recibimos tu pago de ' || to_char(new.monto, 'FM999G999G990') || ' pesos.', '/app/pedidos/' || new.referencia_id, 'pago-apr-' || new.id, true);
    elsif new.estado = 'reintegrado' then perform public.notificar(v_cli, 'pagos', 'PAGO_REINTEGRADO', 'Te reintegramos el pago', to_char(new.monto, 'FM999G999G990') || ' pesos vuelven a tu medio de pago.', '/app/pedidos/' || new.referencia_id, 'pago-reint-' || new.id, true);
    elsif new.estado = 'rechazado' then perform public.notificar(v_cli, 'pagos', 'PAGO_RECHAZADO', 'No se pudo cobrar tu pago', 'Probá con otro medio de pago desde tu pedido.', '/app/pedidos/' || new.referencia_id, 'pago-rech-' || new.id, true);
    end if;
  exception when others then raise warning 'notif_pago % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_pago on public.pagos;
create trigger notif_pago after insert or update of estado on public.pagos for each row execute function public.notif_pago();

-- Pedidos: ya tienen su push propio (enviar-push); acá solo quedan en la bandeja, sin repetir el aviso al celular.
create or replace function public.notif_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_texto text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.pago_estado is distinct from 'pendiente' then
        perform public.notificar_local(new.comercio_id, 'pedidos', 'pedidos', 'PEDIDO_NUEVO', 'Nuevo pedido', 'Entró un pedido por ' || to_char(new.total, 'FM999G999G990') || ' pesos.', '/app/comercio', 'ped-nuevo-' || new.id, false);
      end if;
    elsif new.pago_estado = 'aprobado' and old.pago_estado is distinct from 'aprobado' then
      perform public.notificar_local(new.comercio_id, 'pedidos', 'pedidos', 'PEDIDO_NUEVO', 'Nuevo pedido', 'Entró un pedido pagado por ' || to_char(new.total, 'FM999G999G990') || ' pesos.', '/app/comercio', 'ped-nuevo-' || new.id, false);
    elsif new.estado is distinct from old.estado then
      v_texto := case new.estado::text when 'confirmado' then 'Tu pedido fue aceptado' when 'preparando' then 'Están preparando tu pedido' when 'listo' then 'Tu pedido está listo para retirar'
                   when 'en_camino' then 'Tu pedido va en camino' when 'entregado' then 'Pedido entregado' when 'cancelado' then 'Tu pedido fue cancelado' end;
      if v_texto is not null then perform public.notificar(new.cliente_id, 'pedidos', 'PEDIDO_' || upper(new.estado::text), v_texto, case when new.estado::text = 'cancelado' then new.motivo_cancelacion end, '/app/pedidos/' || new.id, 'ped-' || new.id || '-' || new.estado::text, false); end if;
    elsif new.repartidor_id is distinct from old.repartidor_id and new.repartidor_id is not null then
      perform public.notificar(new.cliente_id, 'pedidos', 'REPARTIDOR_ASIGNADO', 'Un repartidor tomó tu pedido', 'Ya podés seguirlo en el mapa.', '/app/pedidos/' || new.id, 'ped-rep-' || new.id || '-' || new.repartidor_id, false);
    end if;
  exception when others then raise warning 'notif_pedido % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_pedido on public.delivery_pedidos;
create trigger notif_pedido after insert or update of estado, pago_estado, repartidor_id on public.delivery_pedidos for each row execute function public.notif_pedido();

-- Recordatorios de turno: 24 h y 2 h antes (la clave evita repetirlos).
create or replace function public.turnos_recordatorios() returns integer
language plpgsql security definer set search_path = public as $$
declare t record; v_n integer := 0; v_id bigint;
begin
  for t in select tu.id, tu.cliente_id, tu.inicio, s.nombre as servicio, c.nombre as comercio from public.turnos tu join public.servicios s on s.id = tu.servicio_id join public.delivery_comercios c on c.id = tu.comercio_id
            where tu.estado = 'confirmado' and tu.inicio > now() and tu.inicio <= now() + interval '24 hours' loop
    begin
      if t.inicio <= now() + interval '2 hours 15 minutes' then
        v_id := public.notificar(t.cliente_id, 'turnos', 'TURNO_RECORDATORIO', 'Tu turno es en un rato', t.servicio || ' en ' || t.comercio || ' a las ' || to_char(t.inicio at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'), '/app/turnos', 'turno-rec2-' || t.id, true);
      else
        v_id := public.notificar(t.cliente_id, 'turnos', 'TURNO_RECORDATORIO', 'Mañana tenés turno', t.servicio || ' en ' || t.comercio || ' · ' || to_char(t.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI'), '/app/turnos', 'turno-rec24-' || t.id, true);
      end if;
      if v_id is not null then v_n := v_n + 1; end if;
    exception when others then raise warning 'recordatorio % falló: %', t.id, sqlerrm;
    end;
  end loop;
  return v_n;
end $$;
revoke all on function public.turnos_recordatorios() from public, anon, authenticated;
grant execute on function public.turnos_recordatorios() to service_role;

create or replace function public.notificaciones_limpiar() returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from public.notificaciones where created_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.notificaciones_limpiar() from public, anon, authenticated;
grant execute on function public.notificaciones_limpiar() to service_role;

do $cron$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('turnos-recordatorios', 'notificaciones-limpieza');
    perform cron.schedule('turnos-recordatorios', '*/15 * * * *', 'select public.turnos_recordatorios()');
    perform cron.schedule('notificaciones-limpieza', '17 4 * * *', 'select public.notificaciones_limpiar()');
  end if;
end $cron$;
