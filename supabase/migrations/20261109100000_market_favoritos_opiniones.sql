-- FASE 4 (Market), paso 3: favoritos de productos en el servidor y opiniones por producto ligadas a una compra real.
--  * delivery_favoritos_producto: cada persona ve y edita solo los suyos (RLS); tope de 200; importación desde el navegador al ingresar.
--  * delivery_resenas_producto: una opinión por producto comprado (línea de un pedido ENTREGADO, dentro de 90 días); respuesta del comercio;
--    reportes (comercio) y moderación (administración). Promedio y cantidad en el producto (rating_avg / rating_count), mantenidos por disparador.
--  * market_buscar: nuevo orden 'rating' (mejor calificados).
-- Revertir: drop function producto_resena_*, delivery_mis_productos_sin_opinar, favoritos_producto_importar, delivery_admin_resenas_reportadas; drop table delivery_resenas_producto_reportes, delivery_resenas_producto, delivery_favoritos_producto; alter table delivery_productos drop column rating_avg, rating_count.

-- Favoritos -------------------------------------------------------------------------------------------------------------------
create table if not exists public.delivery_favoritos_producto (
  perfil_id uuid not null references auth.users (id) on delete cascade,
  producto_id uuid not null references public.delivery_productos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, producto_id)
);
alter table public.delivery_favoritos_producto enable row level security;
drop policy if exists "Favoritos propios" on public.delivery_favoritos_producto;
create policy "Favoritos propios" on public.delivery_favoritos_producto for all to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
revoke all on public.delivery_favoritos_producto from anon, authenticated;
grant select, insert, delete on public.delivery_favoritos_producto to authenticated;
grant all on public.delivery_favoritos_producto to service_role;

create or replace function public.favoritos_producto_tope() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.delivery_favoritos_producto where perfil_id = new.perfil_id) >= 200 then raise exception 'Llegaste al máximo de 200 productos favoritos'; end if;
  return new;
end $$;
drop trigger if exists favoritos_producto_tope on public.delivery_favoritos_producto;
create trigger favoritos_producto_tope before insert on public.delivery_favoritos_producto for each row execute function public.favoritos_producto_tope();

-- Pasa a la cuenta los favoritos que la persona tenía guardados en el navegador (solo productos que existen; hasta 200).
create or replace function public.favoritos_producto_importar(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Ingresá a tu cuenta'; end if;
  insert into public.delivery_favoritos_producto (perfil_id, producto_id)
    select auth.uid(), p.id from public.delivery_productos p where p.id = any ((coalesce(p_ids, '{}'::uuid[]))[1:200])
    order by p.id on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.favoritos_producto_importar(uuid[]) from public, anon;
grant execute on function public.favoritos_producto_importar(uuid[]) to authenticated;

-- Opiniones por producto ---------------------------------------------------------------------------------------------------
alter table public.delivery_productos
  add column if not exists rating_avg numeric(3, 2),
  add column if not exists rating_count integer not null default 0;

create table if not exists public.delivery_resenas_producto (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.delivery_productos (id) on delete cascade,
  comercio_id uuid not null,
  cliente_id uuid not null,
  pedido_item_id uuid not null unique references public.delivery_pedido_items (id) on delete cascade,
  puntaje integer not null check (puntaje between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 500),
  respuesta text check (respuesta is null or char_length(respuesta) <= 500),
  respondida_at timestamptz,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists resenas_producto_idx on public.delivery_resenas_producto (producto_id, created_at desc) where visible;
create index if not exists resenas_producto_comercio_idx on public.delivery_resenas_producto (comercio_id, created_at desc);
alter table public.delivery_resenas_producto enable row level security;
revoke all on public.delivery_resenas_producto from anon, authenticated;
grant all on public.delivery_resenas_producto to service_role;

create table if not exists public.delivery_resenas_producto_reportes (
  resena_id uuid not null references public.delivery_resenas_producto (id) on delete cascade,
  reportado_por uuid not null,
  motivo text not null check (char_length(motivo) between 5 and 300),
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  primary key (resena_id, reportado_por)
);
alter table public.delivery_resenas_producto_reportes enable row level security;
revoke all on public.delivery_resenas_producto_reportes from anon, authenticated;
grant all on public.delivery_resenas_producto_reportes to service_role;

create or replace function public.resena_producto_recalcular() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prod uuid := coalesce(new.producto_id, old.producto_id);
begin
  update public.delivery_productos p set
    rating_avg = (select round(avg(r.puntaje)::numeric, 2) from public.delivery_resenas_producto r where r.producto_id = v_prod and r.visible),
    rating_count = (select count(*) from public.delivery_resenas_producto r where r.producto_id = v_prod and r.visible)
   where p.id = v_prod;
  return null;
end $$;
drop trigger if exists resena_producto_recalcular on public.delivery_resenas_producto;
create trigger resena_producto_recalcular after insert or update of puntaje, visible or delete on public.delivery_resenas_producto for each row execute function public.resena_producto_recalcular();

create or replace function public.producto_resena_crear(p_item uuid, p_puntaje integer, p_comentario text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_item public.delivery_pedido_items; v_ped public.delivery_pedidos; v_id uuid; v_com text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if auth.uid() is null then raise exception 'Ingresá para dejar tu opinión'; end if;
  if p_puntaje is null or p_puntaje not between 1 and 5 then raise exception 'El puntaje va de 1 a 5'; end if;
  if char_length(coalesce(v_com, '')) > 500 then raise exception 'El comentario es demasiado largo (máximo 500 caracteres)'; end if;
  select * into v_item from public.delivery_pedido_items where id = p_item;
  if not found or v_item.producto_id is null then raise exception 'No encontramos ese producto en tus pedidos'; end if;
  select * into v_ped from public.delivery_pedidos where id = v_item.pedido_id and cliente_id = auth.uid();
  if not found then raise exception 'No encontramos ese producto en tus pedidos'; end if;
  if v_ped.estado <> 'entregado' then raise exception 'Podés opinar cuando recibas el producto'; end if;
  if coalesce(v_ped.entregado_at, v_ped.created_at) < now() - interval '90 days' then raise exception 'Pasó el plazo para opinar sobre este producto (90 días)'; end if;
  begin
    insert into public.delivery_resenas_producto (producto_id, comercio_id, cliente_id, pedido_item_id, puntaje, comentario)
      values (v_item.producto_id, v_ped.comercio_id, auth.uid(), p_item, p_puntaje, v_com) returning id into v_id;
  exception when unique_violation then raise exception 'Ya opinaste sobre este producto';
  end;
  return v_id;
end $$;

-- Productos entregados que la persona todavía no calificó (últimos 90 días).
create or replace function public.delivery_mis_productos_sin_opinar(p_pedido uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'producto_id', i.producto_id, 'nombre', i.nombre, 'imagen_url', pr.imagen_url, 'pedido_id', i.pedido_id, 'comercio', c.nombre, 'entregado_at', p.entregado_at)
         order by p.entregado_at desc), '[]'::jsonb)
    from public.delivery_pedido_items i
    join public.delivery_pedidos p on p.id = i.pedido_id and p.cliente_id = auth.uid() and p.estado = 'entregado'
    join public.delivery_comercios c on c.id = p.comercio_id
    left join public.delivery_productos pr on pr.id = i.producto_id
   where auth.uid() is not null and i.producto_id is not null and (p_pedido is null or i.pedido_id = p_pedido)
     and coalesce(p.entregado_at, p.created_at) >= now() - interval '90 days'
     and not exists (select 1 from public.delivery_resenas_producto r where r.pedido_item_id = i.id)
$$;

-- Lectura pública de las opiniones de un producto (autor: nombre y apellido abreviado).
create or replace function public.producto_resenas(p_producto uuid, p_limite integer default 10, p_desde integer default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'promedio', (select rating_avg from public.delivery_productos where id = p_producto),
      'cantidad', (select rating_count from public.delivery_productos where id = p_producto),
      'distribucion', (select coalesce(jsonb_object_agg(s.n::text, coalesce(x.c, 0)), '{}'::jsonb) from generate_series(1, 5) s(n)
                         left join (select puntaje, count(*) c from public.delivery_resenas_producto where producto_id = p_producto and visible group by 1) x on x.puntaje = s.n)),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'puntaje', r.puntaje, 'comentario', r.comentario, 'respuesta', r.respuesta, 'respondida_at', r.respondida_at, 'created_at', r.created_at,
        'autor', coalesce(nullif(trim(split_part(coalesce(pf.nombre, ''), ' ', 1) || ' ' || coalesce(nullif(left(split_part(coalesce(pf.nombre, ''), ' ', 2), 1) || '.', '.'), '')), ''), 'Cliente')) order by r.created_at desc)
      from (select * from public.delivery_resenas_producto where producto_id = p_producto and visible order by created_at desc
             limit least(greatest(coalesce(p_limite, 10), 1), 50) offset least(greatest(coalesce(p_desde, 0), 0), 1000)) r
      left join public.perfiles pf on pf.id = r.cliente_id), '[]'::jsonb))
$$;

-- Comercio: ver y responder las opiniones de sus productos.
create or replace function public.delivery_resenas_producto_comercio(p_comercio uuid, p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'opiniones') then raise exception 'No tenés permiso para ver las opiniones de este local'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'producto_id', r.producto_id, 'producto', p.nombre, 'puntaje', r.puntaje, 'comentario', r.comentario, 'respuesta', r.respuesta,
           'respondida_at', r.respondida_at, 'created_at', r.created_at, 'visible', r.visible,
           'autor', coalesce(nullif(trim(split_part(coalesce(pf.nombre, ''), ' ', 1)), ''), 'Cliente'),
           'reportada', exists (select 1 from public.delivery_resenas_producto_reportes x where x.resena_id = r.id and x.resuelto_at is null)) order by r.created_at desc)
      from (select * from public.delivery_resenas_producto where comercio_id = p_comercio order by created_at desc limit least(greatest(coalesce(p_limite, 50), 1), 200)) r
      join public.delivery_productos p on p.id = r.producto_id left join public.perfiles pf on pf.id = r.cliente_id), '[]'::jsonb);
end $$;

create or replace function public.producto_resena_responder(p_id uuid, p_respuesta text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.delivery_resenas_producto; v_txt text := nullif(trim(coalesce(p_respuesta, '')), '');
begin
  select * into r from public.delivery_resenas_producto where id = p_id;
  if not found or not public.delivery_permiso(r.comercio_id, 'opiniones') then raise exception 'Opinión no encontrada'; end if;
  if v_txt is null or char_length(v_txt) > 500 then raise exception 'Escribí una respuesta de hasta 500 caracteres'; end if;
  update public.delivery_resenas_producto set respuesta = v_txt, respondida_at = now() where id = p_id;
end $$;

-- El comercio puede reportar una opinión abusiva; administración decide si la oculta.
create or replace function public.producto_resena_reportar(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.delivery_resenas_producto;
begin
  select * into r from public.delivery_resenas_producto where id = p_id;
  if not found or not public.delivery_permiso(r.comercio_id, 'opiniones') then raise exception 'Opinión no encontrada'; end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Contanos por qué la reportás'; end if;
  insert into public.delivery_resenas_producto_reportes (resena_id, reportado_por, motivo) values (p_id, auth.uid(), left(trim(p_motivo), 300)) on conflict do nothing;
end $$;

create or replace function public.delivery_admin_resenas_reportadas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'producto', p.nombre, 'comercio', c.nombre, 'puntaje', r.puntaje, 'comentario', r.comentario, 'visible', r.visible, 'motivo', x.motivo, 'reportada_at', x.created_at) order by x.created_at desc)
      from public.delivery_resenas_producto_reportes x join public.delivery_resenas_producto r on r.id = x.resena_id
      join public.delivery_productos p on p.id = r.producto_id join public.delivery_comercios c on c.id = r.comercio_id where x.resuelto_at is null), '[]'::jsonb);
end $$;

create or replace function public.delivery_admin_resena_moderar(p_id uuid, p_visible boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  update public.delivery_resenas_producto set visible = coalesce(p_visible, true) where id = p_id;
  if not found then raise exception 'Opinión no encontrada'; end if;
  update public.delivery_resenas_producto_reportes set resuelto_at = now() where resena_id = p_id and resuelto_at is null;
end $$;

revoke all on function public.producto_resena_crear(uuid, integer, text), public.delivery_mis_productos_sin_opinar(uuid), public.delivery_resenas_producto_comercio(uuid, integer), public.producto_resena_responder(uuid, text),
  public.producto_resena_reportar(uuid, text), public.delivery_admin_resenas_reportadas(), public.delivery_admin_resena_moderar(uuid, boolean) from public, anon;
grant execute on function public.producto_resena_crear(uuid, integer, text), public.delivery_mis_productos_sin_opinar(uuid), public.delivery_resenas_producto_comercio(uuid, integer), public.producto_resena_responder(uuid, text),
  public.producto_resena_reportar(uuid, text), public.delivery_admin_resenas_reportadas(), public.delivery_admin_resena_moderar(uuid, boolean) to authenticated;
revoke all on function public.producto_resenas(uuid, integer, integer) from public;
grant execute on function public.producto_resenas(uuid, integer, integer) to anon, authenticated;

-- Buscador: orden por calificación. Se agrega el campo al conjunto filtrado leyendo el producto.
do $m$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'market_buscar';
  if v_def is null then raise exception 'market_buscar no existe'; end if;
  if position('rating_avg' in v_def) > 0 then return; end if;
  if position($a$'nuevos', 'cercania')$a$ in v_def) = 0 or position('from f join public.delivery_comercios c on c.id = f.comercio_id' in v_def) = 0
     or position($b$case when p_orden = 'nuevos' then d.created_at end desc,$b$ in v_def) = 0 or position('select f.*, c.nombre as c_nombre' in v_def) = 0 then raise exception 'market_buscar no tiene la forma esperada'; end if;
  v_def := replace(v_def, $a$'nuevos', 'cercania')$a$, $a$'nuevos', 'cercania', 'rating')$a$);
  v_def := replace(v_def, 'select f.*, c.nombre as c_nombre', 'select f.*, pp.rating_avg, pp.rating_count, c.nombre as c_nombre');
  v_def := replace(v_def, 'from f join public.delivery_comercios c on c.id = f.comercio_id', 'from f join public.delivery_comercios c on c.id = f.comercio_id join public.delivery_productos pp on pp.id = f.id');
  v_def := replace(v_def, $b$case when p_orden = 'nuevos' then d.created_at end desc,$b$, $b$case when p_orden = 'nuevos' then d.created_at end desc,
              case when p_orden = 'rating' then d.rating_avg end desc nulls last,
              case when p_orden = 'rating' then d.rating_count end desc,$b$);
  execute v_def;
end $m$;
