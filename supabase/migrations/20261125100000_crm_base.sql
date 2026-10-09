-- CRM del comercio.
-- Contacto = una persona en relación con UN comercio (con cuenta de Woref o cargada a mano, p. ej. quien reservó por teléfono).
-- Es la fuente de verdad de "clientes de este local". Pedidos, turnos, conversaciones y soporte NO se copian: se vinculan
-- (pedidos/mensajes/soporte por cliente_id, turnos por contacto_id) y la ficha los reúne en una línea de tiempo.
-- Actividad = lo que el comercio registra: nota, llamada, WhatsApp, email, reunión o tarea de seguimiento (con vencimiento).
-- Privacidad: se guarda solo lo que la persona le dio a ESTE comercio (nombre, teléfono del pedido/turno, email de suscripción
-- o cargado a mano). Nunca el teléfono del perfil de Woref. Todo se lee y escribe por funciones que validan el permiso.

create or replace function public._tel_norm(p text) returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')
$$;

create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  cliente_id uuid references auth.users (id) on delete set null,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  telefono text check (telefono is null or char_length(telefono) <= 40),
  telefono_norm text generated always as (public._tel_norm(telefono)) stored,
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 20),
  notas text check (notas is null or char_length(notas) <= 4000),
  acepta_marketing boolean not null default false,
  marketing_at timestamptz,
  origen text not null default 'manual' check (origen in ('pedido', 'turno', 'mensaje', 'tienda', 'manual')),
  fusionado_en uuid references public.crm_contactos (id) on delete set null,
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_contactos_cliente_uq on public.crm_contactos (comercio_id, cliente_id) where cliente_id is not null and fusionado_en is null;
create index if not exists crm_contactos_comercio_idx on public.crm_contactos (comercio_id, created_at desc) where fusionado_en is null;
create index if not exists crm_contactos_tel_idx on public.crm_contactos (comercio_id, telefono_norm) where telefono_norm is not null;
create index if not exists crm_contactos_email_idx on public.crm_contactos (comercio_id, lower(email)) where email is not null;
create index if not exists crm_contactos_cliente_idx on public.crm_contactos (cliente_id) where cliente_id is not null;
create index if not exists crm_contactos_etiquetas_idx on public.crm_contactos using gin (etiquetas);

create table if not exists public.crm_actividades (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  contacto_id uuid not null references public.crm_contactos (id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'llamada', 'whatsapp', 'email', 'reunion', 'tarea')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 140),
  detalle text check (detalle is null or char_length(detalle) <= 4000),
  vence_at timestamptz,
  completada_at timestamptz,
  autor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_actividades_contacto_idx on public.crm_actividades (contacto_id, created_at desc);
create index if not exists crm_actividades_tareas_idx on public.crm_actividades (comercio_id, vence_at) where tipo = 'tarea' and completada_at is null;
create index if not exists crm_actividades_autor_idx on public.crm_actividades (autor_id);

alter table public.crm_contactos enable row level security;
alter table public.crm_actividades enable row level security;
revoke all on public.crm_contactos, public.crm_actividades from anon, authenticated;

-- Turnos: a qué contacto pertenecen (incluye a quien no tiene cuenta).
alter table public.turnos add column if not exists contacto_id uuid references public.crm_contactos (id) on delete set null;
create index if not exists turnos_contacto_idx on public.turnos (contacto_id) where contacto_id is not null;

-- Quién puede usar el CRM de un comercio: dueño y encargados (mismo permiso que estadísticas y clientes).
create or replace function public.crm_puede(p_comercio uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.delivery_permiso(p_comercio, 'estadisticas'), false)
$$;

-- Busca o crea el contacto de una persona en un comercio. Con cuenta: por cliente_id. Sin cuenta: por teléfono o email.
-- Nunca une automáticamente a alguien sin cuenta con una cuenta (podría ser otra persona con el mismo teléfono): eso lo sugiere
-- la ficha como posible duplicado y lo decide el comercio.
create or replace function public.crm_asegurar_contacto(p_comercio uuid, p_cliente uuid, p_nombre text, p_telefono text, p_email text, p_origen text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nombre text; v_tel text := nullif(btrim(coalesce(p_telefono, '')), ''); v_mail text := lower(nullif(btrim(coalesce(p_email, '')), ''));
begin
  if p_comercio is null then return null; end if;
  if v_mail is not null and v_mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_mail := null; end if;
  v_nombre := left(coalesce(nullif(btrim(p_nombre), ''), (select nullif(btrim(nombre), '') from public.perfiles where id = p_cliente), split_part(v_mail, '@', 1), 'Cliente'), 120);
  if p_cliente is not null then
    select id into v_id from public.crm_contactos where comercio_id = p_comercio and cliente_id = p_cliente and fusionado_en is null;
    if v_id is null then
      insert into public.crm_contactos (comercio_id, cliente_id, nombre, telefono, email, origen)
      values (p_comercio, p_cliente, v_nombre, left(v_tel, 40), v_mail, p_origen)
      on conflict (comercio_id, cliente_id) where cliente_id is not null and fusionado_en is null do nothing
      returning id into v_id;
      if v_id is null then select id into v_id from public.crm_contactos where comercio_id = p_comercio and cliente_id = p_cliente and fusionado_en is null; end if;
    else
      update public.crm_contactos set telefono = coalesce(telefono, left(v_tel, 40)), email = coalesce(email, v_mail), updated_at = now()
       where id = v_id and ((telefono is null and v_tel is not null) or (email is null and v_mail is not null));
    end if;
    return v_id;
  end if;
  if public._tel_norm(v_tel) is not null then
    select id into v_id from public.crm_contactos where comercio_id = p_comercio and cliente_id is null and fusionado_en is null and telefono_norm = public._tel_norm(v_tel) order by created_at limit 1;
  end if;
  if v_id is null and v_mail is not null then
    select id into v_id from public.crm_contactos where comercio_id = p_comercio and cliente_id is null and fusionado_en is null and lower(email) = v_mail order by created_at limit 1;
  end if;
  if v_id is null then
    insert into public.crm_contactos (comercio_id, nombre, telefono, email, origen) values (p_comercio, v_nombre, left(v_tel, 40), v_mail, p_origen) returning id into v_id;
  else
    update public.crm_contactos set telefono = coalesce(telefono, left(v_tel, 40)), email = coalesce(email, v_mail), updated_at = now() where id = v_id and (telefono is null or email is null);
  end if;
  return v_id;
end $$;
revoke all on function public.crm_asegurar_contacto(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Alta automática de contactos. Un error acá nunca rompe el pedido, el turno ni el mensaje.
create or replace function public.crm_turno_contacto() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.contacto_id is null then
    begin new.contacto_id := public.crm_asegurar_contacto(new.comercio_id, new.cliente_id, new.cliente_nombre, new.telefono, null, 'turno');
    exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists crm_turno_contacto on public.turnos;
create trigger crm_turno_contacto before insert on public.turnos for each row execute function public.crm_turno_contacto();

create or replace function public.crm_pedido_contacto() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  begin perform public.crm_asegurar_contacto(new.comercio_id, new.cliente_id, null, new.telefono_contacto, null, 'pedido');
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists crm_pedido_contacto on public.delivery_pedidos;
create trigger crm_pedido_contacto after insert on public.delivery_pedidos for each row execute function public.crm_pedido_contacto();

create or replace function public.crm_hilo_contacto() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.comercio_id is not null and new.cliente_id is not null then
    begin perform public.crm_asegurar_contacto(new.comercio_id, new.cliente_id, null, null, null, 'mensaje');
    exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists crm_hilo_contacto on public.msg_hilos;
create trigger crm_hilo_contacto after insert on public.msg_hilos for each row execute function public.crm_hilo_contacto();

create or replace function public.crm_suscriptor_contacto() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  begin
    v_id := public.crm_asegurar_contacto(new.comercio_id, null, null, null, new.email, 'tienda');
    if new.consentimiento_at is not null then
      update public.crm_contactos set acepta_marketing = true, marketing_at = new.consentimiento_at where id = v_id and not acepta_marketing;
    end if;
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists crm_suscriptor_contacto on public.delivery_tienda_suscriptores;
create trigger crm_suscriptor_contacto after insert on public.delivery_tienda_suscriptores for each row execute function public.crm_suscriptor_contacto();

-- Carga inicial con lo que ya existe.
do $$
declare r record;
begin
  for r in select distinct on (comercio_id, cliente_id) comercio_id, cliente_id, telefono_contacto, created_at from public.delivery_pedidos where cliente_id is not null order by comercio_id, cliente_id, created_at loop
    perform public.crm_asegurar_contacto(r.comercio_id, r.cliente_id, null, r.telefono_contacto, null, 'pedido');
  end loop;
  for r in select id, comercio_id, cliente_id, cliente_nombre, telefono from public.turnos where contacto_id is null order by created_at loop
    update public.turnos set contacto_id = public.crm_asegurar_contacto(r.comercio_id, r.cliente_id, r.cliente_nombre, r.telefono, null, 'turno') where id = r.id;
  end loop;
  for r in select distinct comercio_id, cliente_id from public.msg_hilos where comercio_id is not null and cliente_id is not null loop
    perform public.crm_asegurar_contacto(r.comercio_id, r.cliente_id, null, null, null, 'mensaje');
  end loop;
  for r in select comercio_id, email, consentimiento_at from public.delivery_tienda_suscriptores loop
    update public.crm_contactos set acepta_marketing = true, marketing_at = r.consentimiento_at
     where id = public.crm_asegurar_contacto(r.comercio_id, null, null, null, r.email, 'tienda') and r.consentimiento_at is not null;
  end loop;
  -- Las notas que el local ya tenía sobre sus clientes pasan a la ficha del CRM.
  update public.crm_contactos c set notas = n.nota from public.comercio_cliente_notas n
   where n.comercio_id = c.comercio_id and n.cliente_id = c.cliente_id and c.notas is null;
end $$;
