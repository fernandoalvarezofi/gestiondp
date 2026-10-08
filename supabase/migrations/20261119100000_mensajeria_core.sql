-- MENSAJERÍA CORE (parte 1): un solo motor de mensajes para todos los módulos de Woref.
-- Cada conversación (hilo) está atada a un CONTEXTO: un pedido, un viaje de remís, un envío o una consulta a un local.
-- Nadie puede escribirle a cualquiera: solo participan las partes con una relación válida en ese contexto y
-- los teléfonos nunca se muestran (todo pasa por Woref). Aditivo: las tablas viejas (delivery_mensajes,
-- conversaciones/conv_mensajes) quedan intactas; sus datos se copian al motor nuevo en la parte 4.

create table if not exists public.msg_hilos (
  id uuid primary key default gen_random_uuid(),
  contexto text not null check (contexto in ('pedido', 'viaje', 'envio', 'consulta')),
  contexto_id uuid,
  canal text not null check (canal in ('cliente_comercio', 'cliente_repartidor', 'comercio_repartidor', 'pasajero_conductor', 'consulta')),
  comercio_id uuid references public.delivery_comercios (id) on delete cascade,
  cliente_id uuid references auth.users (id) on delete cascade,
  producto_id uuid references public.delivery_productos (id) on delete set null,
  ultimo_mensaje_at timestamptz,
  ultimo_texto text,
  ultimo_autor uuid,
  legacy_id text unique,
  created_at timestamptz not null default now(),
  constraint msg_hilos_canal_ok check (
    (contexto = 'pedido' and canal in ('cliente_comercio', 'cliente_repartidor', 'comercio_repartidor') and contexto_id is not null)
    or (contexto = 'viaje' and canal = 'pasajero_conductor' and contexto_id is not null)
    or (contexto = 'envio' and canal = 'cliente_repartidor' and contexto_id is not null)
    or (contexto = 'consulta' and canal = 'consulta' and comercio_id is not null and cliente_id is not null))
);
create unique index if not exists msg_hilos_contexto_uq on public.msg_hilos (contexto, contexto_id, canal) where contexto <> 'consulta';
create unique index if not exists msg_hilos_consulta_uq on public.msg_hilos (comercio_id, cliente_id) where contexto = 'consulta';
create index if not exists msg_hilos_comercio_idx on public.msg_hilos (comercio_id, ultimo_mensaje_at desc);
create index if not exists msg_hilos_cliente_idx on public.msg_hilos (cliente_id, ultimo_mensaje_at desc);

create table if not exists public.msg_mensajes (
  id bigint generated always as identity primary key,
  hilo_id uuid not null references public.msg_hilos (id) on delete cascade,
  autor_id uuid references auth.users (id) on delete set null,
  autor_rol text not null check (autor_rol in ('cliente', 'comercio', 'repartidor', 'conductor', 'pasajero', 'sistema')),
  tipo text not null default 'texto' check (tipo in ('texto', 'rapido', 'ubicacion', 'foto', 'sistema')),
  texto text check (texto is null or char_length(texto) <= 1000),
  lat numeric check (lat is null or lat between -90 and 90),
  lng numeric check (lng is null or lng between -180 and 180),
  foto_path text,
  created_at timestamptz not null default clock_timestamp(),
  oculto_at timestamptz,
  oculto_por uuid
);
create index if not exists msg_mensajes_hilo_idx on public.msg_mensajes (hilo_id, id desc);
create index if not exists msg_mensajes_autor_idx on public.msg_mensajes (autor_id, created_at desc);

-- Hasta dónde leyó cada persona cada hilo (doble tilde, sin leer) y si lo archivó.
create table if not exists public.msg_lecturas (
  hilo_id uuid not null references public.msg_hilos (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  leido_at timestamptz,
  archivado_at timestamptz,
  primary key (hilo_id, usuario_id)
);

create table if not exists public.msg_reportes (
  id bigint generated always as identity primary key,
  mensaje_id bigint not null references public.msg_mensajes (id) on delete cascade,
  hilo_id uuid not null references public.msg_hilos (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 3 and 300),
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  resuelto_por uuid,
  accion text check (accion in ('ocultado', 'descartado')),
  unique (mensaje_id, usuario_id)
);

-- Un local puede bloquear a quien le escribe consultas con insultos o spam (no aplica a pedidos en curso).
create table if not exists public.msg_bloqueos (
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  creado_por uuid,
  created_at timestamptz not null default now(),
  primary key (comercio_id, cliente_id)
);

alter table public.msg_hilos enable row level security;
alter table public.msg_mensajes enable row level security;
alter table public.msg_lecturas enable row level security;
alter table public.msg_reportes enable row level security;
alter table public.msg_bloqueos enable row level security;
revoke all on public.msg_hilos, public.msg_mensajes, public.msg_lecturas, public.msg_reportes, public.msg_bloqueos from anon, authenticated;
grant select on public.msg_hilos, public.msg_mensajes, public.msg_lecturas to authenticated;

-- Rol de la persona actual en un hilo, deducido del contexto (si cambia el repartidor del pedido, cambia quién participa).
create or replace function public.msg_rol(p_hilo uuid) returns text
language sql stable security definer set search_path = public as $$
  select case h.contexto
    when 'consulta' then case when h.cliente_id = auth.uid() then 'cliente' when public.delivery_permiso(h.comercio_id, 'pedidos') then 'comercio' end
    when 'pedido' then (select case
        when h.canal in ('cliente_comercio', 'cliente_repartidor') and p.cliente_id = auth.uid() then 'cliente'
        when h.canal in ('cliente_comercio', 'comercio_repartidor') and public.delivery_permiso(p.comercio_id, 'pedidos') then 'comercio'
        when h.canal in ('cliente_repartidor', 'comercio_repartidor') and p.repartidor_id = auth.uid() then 'repartidor' end
      from public.delivery_pedidos p where p.id = h.contexto_id)
    when 'envio' then (select case when e.cliente_id = auth.uid() then 'cliente' when e.repartidor_id = auth.uid() then 'repartidor' end
      from public.delivery_envios e where e.id = h.contexto_id)
    when 'viaje' then (select case when v.cliente_id = auth.uid() then 'pasajero' when v.conductor_id = auth.uid() then 'conductor' end
      from public.delivery_viajes v where v.id = h.contexto_id)
  end
  from public.msg_hilos h where h.id = p_hilo
$$;

-- Ver (no escribir): participantes y administración (moderación y reclamos).
create or replace function public.msg_puede_ver(p_hilo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.msg_rol(p_hilo) is not null or public.has_role(auth.uid(), 'admin'::app_role)
$$;

revoke all on function public.msg_rol(uuid), public.msg_puede_ver(uuid) from public, anon;
grant execute on function public.msg_rol(uuid), public.msg_puede_ver(uuid) to authenticated;

drop policy if exists msg_hilos_ver on public.msg_hilos;
create policy msg_hilos_ver on public.msg_hilos for select to authenticated using (public.msg_puede_ver(id));
drop policy if exists msg_mensajes_ver on public.msg_mensajes;
create policy msg_mensajes_ver on public.msg_mensajes for select to authenticated using (public.msg_puede_ver(hilo_id));
drop policy if exists msg_lecturas_ver on public.msg_lecturas;
create policy msg_lecturas_ver on public.msg_lecturas for select to authenticated using (public.msg_puede_ver(hilo_id));
