-- MENSAJERÍA CORE (parte 4): avisos (bandeja + push), fotos, tiempo real y copia de los mensajes viejos.

-- 1) Copia de los chats anteriores al motor nuevo (las tablas viejas quedan como estaban). Antes del disparador de avisos
--    para no notificar mensajes viejos.
insert into public.msg_hilos (contexto, contexto_id, canal, comercio_id, legacy_id, created_at, ultimo_mensaje_at, ultimo_texto, ultimo_autor)
select 'pedido', d.pedido_id, case d.canal when 'comercio' then 'cliente_comercio' else 'cliente_repartidor' end, p.comercio_id,
       'dm:' || d.pedido_id || ':' || d.canal, min(d.created_at), max(d.created_at),
       (array_agg(left(d.texto, 120) order by d.created_at desc))[1], (array_agg(d.autor_id order by d.created_at desc))[1]
from public.delivery_mensajes d join public.delivery_pedidos p on p.id = d.pedido_id
group by d.pedido_id, d.canal, p.comercio_id
on conflict do nothing;

insert into public.msg_mensajes (hilo_id, autor_id, autor_rol, tipo, texto, created_at)
select h.id, d.autor_id, case when d.autor_id = p.cliente_id then 'cliente' when d.canal = 'repartidor' then 'repartidor' else 'comercio' end, 'texto', d.texto, d.created_at
from public.delivery_mensajes d join public.delivery_pedidos p on p.id = d.pedido_id
join public.msg_hilos h on h.legacy_id = 'dm:' || d.pedido_id || ':' || d.canal
where not exists (select 1 from public.msg_mensajes m where m.hilo_id = h.id)
order by d.created_at;

insert into public.msg_hilos (contexto, canal, comercio_id, cliente_id, producto_id, legacy_id, created_at, ultimo_mensaje_at, ultimo_texto)
select 'consulta', 'consulta', c.comercio_id, c.cliente_id, c.producto_id, 'cv:' || c.id, c.created_at, c.ultimo_mensaje_at, c.ultimo_texto
from public.conversaciones c
on conflict do nothing;

insert into public.msg_mensajes (hilo_id, autor_id, autor_rol, tipo, texto, created_at)
select h.id, m.autor_id, case when m.de_comercio then 'comercio' else 'cliente' end, 'texto', m.texto, m.created_at
from public.conv_mensajes m join public.msg_hilos h on h.legacy_id = 'cv:' || m.conversacion_id
where not exists (select 1 from public.msg_mensajes x where x.hilo_id = h.id)
order by m.id;

-- Lo copiado se considera leído (no aparecen globitos por conversaciones viejas).
insert into public.msg_lecturas (hilo_id, usuario_id, leido_at)
select distinct m.hilo_id, m.autor_id, now() from public.msg_mensajes m join public.msg_hilos h on h.id = m.hilo_id where h.legacy_id is not null and m.autor_id is not null
on conflict do nothing;

-- 2) Avisos: cada mensaje le llega a la otra parte en su bandeja de notificaciones y por push.
--    La clave de agrupación usa hasta dónde leyó el destinatario: mientras no lea, los mensajes seguidos son un solo aviso.
create or replace function public.msg_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h public.msg_hilos; p public.delivery_pedidos; e public.delivery_envios; v public.delivery_viajes;
  v_de text := coalesce(public.msg_nombre(new.autor_id), 'Alguien');
  v_cuerpo text := case new.tipo when 'ubicacion' then '📍 Te compartió una ubicación' when 'foto' then '📷 Te mandó una foto' else left(coalesce(new.texto, ''), 120) end;
  v_local text; v_ref text; v_cliente uuid; v_otro uuid;
begin
  if new.tipo = 'sistema' then return null; end if;
  begin
    select * into h from public.msg_hilos where id = new.hilo_id;

    if h.contexto = 'consulta' then
      select nombre into v_local from public.delivery_comercios where id = h.comercio_id;
      if new.autor_rol = 'cliente' then
        perform public.notificar_local(h.comercio_id, 'pedidos', 'mensajes', 'MENSAJE_RECIBIDO', 'Consulta de ' || v_de, v_cuerpo, '/app/comercio/mensajes?h=' || h.id,
          'msg-' || h.id || '-l-' || coalesce(to_char((select max(leido_at) from public.msg_lecturas where hilo_id = h.id and usuario_id <> h.cliente_id), 'YYYYMMDDHH24MISSUS'), '0'), true);
      else
        perform public.notificar(h.cliente_id, 'mensajes', 'MENSAJE_RECIBIDO', coalesce(v_local, 'Un local') || ' te respondió', v_cuerpo, '/app/mensajes?h=' || h.id,
          'msg-' || h.id || '-' || coalesce(to_char((select leido_at from public.msg_lecturas where hilo_id = h.id and usuario_id = h.cliente_id), 'YYYYMMDDHH24MISSUS'), '0'), true);
      end if;

    elsif h.contexto = 'pedido' then
      select * into p from public.delivery_pedidos where id = h.contexto_id;
      select nombre into v_local from public.delivery_comercios where id = p.comercio_id;
      v_ref := '#' || upper(left(p.id::text, 6));
      -- Destinatario según canal y autor.
      if (h.canal = 'cliente_comercio' and new.autor_rol = 'cliente') or (h.canal = 'comercio_repartidor' and new.autor_rol = 'repartidor') then
        perform public.notificar_local(p.comercio_id, 'pedidos', 'mensajes', 'MENSAJE_RECIBIDO', 'Pedido ' || v_ref || ' · ' || v_de, v_cuerpo, '/app/comercio/mensajes?h=' || h.id,
          'msg-' || h.id || '-l-' || coalesce(to_char((select max(leido_at) from public.msg_lecturas where hilo_id = h.id and usuario_id not in (p.cliente_id, coalesce(p.repartidor_id, p.cliente_id))), 'YYYYMMDDHH24MISSUS'), '0'), true);
      else
        v_otro := case
          when h.canal = 'cliente_comercio' then p.cliente_id
          when h.canal = 'cliente_repartidor' and new.autor_rol = 'cliente' then p.repartidor_id
          when h.canal = 'cliente_repartidor' then p.cliente_id
          else p.repartidor_id end;
        perform public.notificar(v_otro, 'mensajes', 'MENSAJE_RECIBIDO',
          case when v_otro = p.cliente_id then (case when new.autor_rol = 'comercio' then coalesce(v_local, 'El local') else 'Tu repartidor' end) || ' te escribió' else 'Pedido ' || v_ref || ' · ' || (case when new.autor_rol = 'comercio' then coalesce(v_local, 'El local') else v_de end) end,
          v_cuerpo, case when v_otro = p.cliente_id then '/app/mensajes?h=' else '/app/repartidor/mensajes?h=' end || h.id,
          'msg-' || h.id || '-' || coalesce(to_char((select leido_at from public.msg_lecturas where hilo_id = h.id and usuario_id = v_otro), 'YYYYMMDDHH24MISSUS'), '0'), true);
      end if;

    elsif h.contexto = 'envio' then
      select * into e from public.delivery_envios where id = h.contexto_id;
      v_otro := case when new.autor_rol = 'cliente' then e.repartidor_id else e.cliente_id end;
      perform public.notificar(v_otro, 'mensajes', 'MENSAJE_RECIBIDO', case when v_otro = e.cliente_id then 'Tu repartidor te escribió' else 'Envío · ' || v_de end,
        v_cuerpo, case when v_otro = e.cliente_id then '/app/mensajes?h=' else '/app/repartidor/mensajes?h=' end || h.id,
        'msg-' || h.id || '-' || coalesce(to_char((select leido_at from public.msg_lecturas where hilo_id = h.id and usuario_id = v_otro), 'YYYYMMDDHH24MISSUS'), '0'), true);

    elsif h.contexto = 'viaje' then
      select * into v from public.delivery_viajes where id = h.contexto_id;
      v_otro := case when new.autor_rol = 'pasajero' then v.conductor_id else v.cliente_id end;
      perform public.notificar(v_otro, 'mensajes', 'MENSAJE_RECIBIDO', case when v_otro = v.cliente_id then 'Tu conductor te escribió' else 'Pasajero · ' || v_de end,
        v_cuerpo, case when v_otro = v.cliente_id then '/app/mensajes?h=' else '/app/conductor/mensajes?h=' end || h.id,
        'msg-' || h.id || '-' || coalesce(to_char((select leido_at from public.msg_lecturas where hilo_id = h.id and usuario_id = v_otro), 'YYYYMMDDHH24MISSUS'), '0'), true);
    end if;
  exception when others then
    raise warning 'msg_aviso % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.msg_aviso() from public, anon, authenticated;
drop trigger if exists msg_aviso on public.msg_mensajes;
create trigger msg_aviso after insert on public.msg_mensajes for each row execute function public.msg_aviso();

-- Los mensajes no se editan ni se borran desde la app (la moderación solo los oculta).
create or replace function public.msg_inmutable() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.texto is not distinct from old.texto and new.lat is not distinct from old.lat and new.lng is not distinct from old.lng
     and new.foto_path is not distinct from old.foto_path and new.autor_id is not distinct from old.autor_id and new.hilo_id = old.hilo_id then return new; end if;
  if current_setting('woref.mantenimiento', true) = 'on' then return new; end if;
  raise exception 'Los mensajes no se pueden modificar';
end $$;
drop trigger if exists msg_inmutable on public.msg_mensajes;
create trigger msg_inmutable before update on public.msg_mensajes for each row execute function public.msg_inmutable();

-- Corrección: el aviso de mensaje reportado va en la categoría "sistema" (no existe "soporte").
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
    perform public.notificar(a, 'sistema', 'MENSAJE_REPORTADO', 'Mensaje reportado', left(v_motivo, 120), '/app/admin/mensajes', 'msgrep-' || m.id, true);
  end loop;
end $$;

-- 3) Fotos: bucket privado; se sube y se ve solo si participás del hilo (la carpeta es el id del hilo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mensajes', 'mensajes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.msg_foto_puede_subir(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_hilo uuid;
begin
  v_hilo := split_part(p_name, '/', 1)::uuid;
  return public.msg_rol(v_hilo) is not null and public.msg_motivo_cerrado(v_hilo) is null and p_name !~ '\.\.';
exception when others then return false;
end $$;
create or replace function public.msg_foto_puede_ver(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.msg_puede_ver(split_part(p_name, '/', 1)::uuid);
exception when others then return false;
end $$;
revoke all on function public.msg_foto_puede_subir(text), public.msg_foto_puede_ver(text) from public, anon;
grant execute on function public.msg_foto_puede_subir(text), public.msg_foto_puede_ver(text) to authenticated;

drop policy if exists msg_fotos_subir on storage.objects;
create policy msg_fotos_subir on storage.objects for insert to authenticated with check (bucket_id = 'mensajes' and public.msg_foto_puede_subir(name));
drop policy if exists msg_fotos_ver on storage.objects;
create policy msg_fotos_ver on storage.objects for select to authenticated using (bucket_id = 'mensajes' and public.msg_foto_puede_ver(name));

-- 4) Tiempo real: mensajes nuevos y lecturas (doble tilde) llegan al instante; respetan las políticas de lectura.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'msg_mensajes') then
    alter publication supabase_realtime add table public.msg_mensajes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'msg_lecturas') then
    alter publication supabase_realtime add table public.msg_lecturas;
  end if;
end $$;
