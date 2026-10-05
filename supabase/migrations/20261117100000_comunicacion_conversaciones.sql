-- FASE 10, paso 2: conversaciones entre comprador y vendedor (consultas antes de comprar). Es aparte del chat de un pedido en curso.
--  * Una conversación por par (cliente, local). Los mensajes son de solo agregar; nadie edita ni borra.
--  * Todo pasa por funciones del servidor: la persona solo ve sus conversaciones; el local, las de los locales donde tiene permiso de "pedidos".
--  * Tope de 20 mensajes por minuto por persona y 1.000 caracteres por mensaje. Avisa a la otra parte en su bandeja (categoría "mensajes").
-- Revertir: drop trigger conv_mensaje_aviso; drop functions conversacion_*; drop tables conv_mensajes, conversaciones.

create table if not exists public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  producto_id uuid references public.delivery_productos (id) on delete set null,
  ultimo_mensaje_at timestamptz not null default now(),
  ultimo_texto text,
  cliente_leido_at timestamptz,
  comercio_leido_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comercio_id, cliente_id)
);
create index if not exists conversaciones_cliente_idx on public.conversaciones (cliente_id, ultimo_mensaje_at desc);
create index if not exists conversaciones_comercio_idx on public.conversaciones (comercio_id, ultimo_mensaje_at desc);

create table if not exists public.conv_mensajes (
  id bigint generated always as identity primary key,
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  de_comercio boolean not null,
  texto text not null check (char_length(texto) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists conv_mensajes_idx on public.conv_mensajes (conversacion_id, id);
create index if not exists conv_mensajes_autor_idx on public.conv_mensajes (autor_id, created_at desc);

alter table public.conversaciones enable row level security;
alter table public.conv_mensajes enable row level security;
revoke all on public.conversaciones, public.conv_mensajes from anon, authenticated;
grant all on public.conversaciones, public.conv_mensajes to service_role;

create or replace function public.conv_es_parte(p_conv uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when c.cliente_id = auth.uid() then 'cliente' when public.delivery_permiso(c.comercio_id, 'pedidos') then 'comercio' end
    from public.conversaciones c where c.id = p_conv
$$;
revoke all on function public.conv_es_parte(uuid) from public, anon, authenticated;

create or replace function public.conv_agregar(p_conv uuid, p_texto text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_rol text := public.conv_es_parte(p_conv); v_texto text := btrim(coalesce(p_texto, '')); v_id bigint;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if v_rol is null then raise exception 'No tenés acceso a esta conversación'; end if;
  if char_length(v_texto) < 1 then raise exception 'Escribí un mensaje'; end if;
  if char_length(v_texto) > 1000 then raise exception 'El mensaje es muy largo (máximo 1.000 caracteres)'; end if;
  if (select count(*) from public.conv_mensajes where autor_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'Estás enviando muchos mensajes. Esperá un momento.'; end if;
  insert into public.conv_mensajes (conversacion_id, autor_id, de_comercio, texto) values (p_conv, auth.uid(), v_rol = 'comercio', v_texto) returning id into v_id;
  update public.conversaciones set ultimo_mensaje_at = clock_timestamp(), ultimo_texto = left(v_texto, 120),
    cliente_leido_at = case when v_rol = 'cliente' then clock_timestamp() else cliente_leido_at end, comercio_leido_at = case when v_rol = 'comercio' then clock_timestamp() else comercio_leido_at end where id = p_conv;
  return v_id;
end $$;

-- Abre (o retoma) la conversación con un local y manda el primer mensaje.
create or replace function public.conversacion_iniciar(p_comercio uuid, p_texto text, p_producto uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prod uuid;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  if not exists (select 1 from public.delivery_comercios where id = p_comercio and activo and aprobado) then raise exception 'Local no disponible'; end if;
  if exists (select 1 from public.delivery_comercios where id = p_comercio and propietario_id = auth.uid()) then raise exception 'No podés escribirte a vos mismo'; end if;
  select id into v_prod from public.delivery_productos where id = p_producto and comercio_id = p_comercio;
  insert into public.conversaciones (comercio_id, cliente_id, producto_id) values (p_comercio, auth.uid(), v_prod)
    on conflict (comercio_id, cliente_id) do update set producto_id = coalesce(excluded.producto_id, public.conversaciones.producto_id) returning id into v_id;
  perform public.conv_agregar(v_id, p_texto);
  return v_id;
end $$;

create or replace function public.conversacion_enviar(p_conv uuid, p_texto text) returns bigint
language sql security definer set search_path = public as $$ select public.conv_agregar(p_conv, p_texto) $$;

create or replace function public.conversacion_marcar_leida(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rol text := public.conv_es_parte(p_conv);
begin
  if v_rol is null then raise exception 'No tenés acceso a esta conversación'; end if;
  update public.conversaciones set cliente_leido_at = case when v_rol = 'cliente' then clock_timestamp() else cliente_leido_at end, comercio_leido_at = case when v_rol = 'comercio' then clock_timestamp() else comercio_leido_at end where id = p_conv;
end $$;

create or replace function public.conversacion_mensajes(p_conv uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.conv_es_parte(p_conv) is null then raise exception 'No tenés acceso a esta conversación'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'de_comercio', m.de_comercio, 'texto', m.texto, 'created_at', m.created_at) order by m.id)
                     from (select * from public.conv_mensajes where conversacion_id = p_conv order by id desc limit 200) m), '[]'::jsonb);
end $$;

create or replace function public.mis_conversaciones() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'comercio', co.nombre, 'comercio_slug', co.slug, 'logo_url', co.logo_url, 'producto', p.nombre, 'ultimo_texto', c.ultimo_texto, 'ultimo_mensaje_at', c.ultimo_mensaje_at,
    'sin_leer', exists (select 1 from public.conv_mensajes m where m.conversacion_id = c.id and m.de_comercio and m.created_at > coalesce(c.cliente_leido_at, '-infinity'))) order by c.ultimo_mensaje_at desc), '[]'::jsonb)
    from public.conversaciones c join public.delivery_comercios co on co.id = c.comercio_id left join public.delivery_productos p on p.id = c.producto_id where c.cliente_id = auth.uid()
$$;

create or replace function public.conversaciones_comercio(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'cliente', coalesce(nullif(split_part(coalesce(pf.nombre, ''), ' ', 1), ''), 'Cliente'), 'producto', p.nombre, 'ultimo_texto', c.ultimo_texto, 'ultimo_mensaje_at', c.ultimo_mensaje_at,
    'sin_leer', exists (select 1 from public.conv_mensajes m where m.conversacion_id = c.id and not m.de_comercio and m.created_at > coalesce(c.comercio_leido_at, '-infinity'))) order by c.ultimo_mensaje_at desc)
    from public.conversaciones c left join public.perfiles pf on pf.id = c.cliente_id left join public.delivery_productos p on p.id = c.producto_id where c.comercio_id = p_comercio), '[]'::jsonb);
end $$;

revoke all on function public.conv_agregar(uuid, text) from public, anon, authenticated;
revoke all on function public.conversacion_iniciar(uuid, text, uuid), public.conversacion_enviar(uuid, text), public.conversacion_marcar_leida(uuid), public.conversacion_mensajes(uuid), public.mis_conversaciones(), public.conversaciones_comercio(uuid) from public, anon;
grant execute on function public.conversacion_iniciar(uuid, text, uuid), public.conversacion_enviar(uuid, text), public.conversacion_marcar_leida(uuid), public.conversacion_mensajes(uuid), public.mis_conversaciones(), public.conversaciones_comercio(uuid) to authenticated;

-- Aviso a la otra parte (a prueba de fallas). La clave agrupa los mensajes seguidos en un solo aviso sin leer.
create or replace function public.conv_mensaje_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversaciones; v_nombre text; v_local text;
begin
  begin
    select * into c from public.conversaciones where id = new.conversacion_id;
    if new.de_comercio then
      select nombre into v_local from public.delivery_comercios where id = c.comercio_id;
      perform public.notificar(c.cliente_id, 'mensajes', 'MENSAJE_RECIBIDO', coalesce(v_local, 'Un local') || ' te respondió', left(new.texto, 120), '/app/mensajes?c=' || c.id, 'msg-' || c.id || '-c-' || coalesce(to_char(c.cliente_leido_at, 'YYYYMMDDHH24MISSUS'), '0'), true);
    else
      select coalesce(nullif(split_part(coalesce(nombre, ''), ' ', 1), ''), 'Un cliente') into v_nombre from public.perfiles where id = c.cliente_id;
      perform public.notificar_local(c.comercio_id, 'pedidos', 'mensajes', 'MENSAJE_RECIBIDO', 'Mensaje de ' || v_nombre, left(new.texto, 120), '/app/comercio/mensajes?c=' || c.id, 'msg-' || c.id || '-l-' || coalesce(to_char(c.comercio_leido_at, 'YYYYMMDDHH24MISSUS'), '0'), true);
    end if;
  exception when others then raise warning 'conv_mensaje_aviso % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists conv_mensaje_aviso on public.conv_mensajes;
create trigger conv_mensaje_aviso after insert on public.conv_mensajes for each row execute function public.conv_mensaje_aviso();

-- Los mensajes no se editan (borrar solo ocurre en cascada si se elimina la cuenta o el local; la aplicación no tiene permiso de borrado).
create or replace function public.conv_mensajes_inmutable() returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('woref.mantenimiento', true) = 'on' then return new; end if;
  raise exception 'Los mensajes no se pueden modificar';
end $$;
drop trigger if exists conv_mensajes_inmutable on public.conv_mensajes;
create trigger conv_mensajes_inmutable before update on public.conv_mensajes for each row execute function public.conv_mensajes_inmutable();
