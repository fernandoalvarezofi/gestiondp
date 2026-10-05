-- Funciones de marketplace para la tienda online: varias fotos por producto, preguntas y respuestas, y reputación del vendedor.

-- ---- Varias fotos por producto (hasta 6, solo https)
alter table public.delivery_productos add column if not exists imagenes text[] not null default '{}';

create or replace function public.delivery_productos_sanear_imagenes() returns trigger
language plpgsql set search_path = public as $$
begin
  new.imagenes := coalesce(array(
    select u from unnest(coalesce(new.imagenes, '{}'::text[])) with ordinality t(u, n)
    where u ~* '^https://' and length(u) <= 600 order by n limit 6), '{}'::text[]);
  return new;
end $$;

drop trigger if exists delivery_productos_sanear_imagenes on public.delivery_productos;
create trigger delivery_productos_sanear_imagenes before insert or update of imagenes on public.delivery_productos
  for each row execute function public.delivery_productos_sanear_imagenes();

-- ---- Preguntas y respuestas
create table if not exists public.delivery_producto_preguntas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.delivery_productos(id) on delete cascade,
  comercio_id uuid not null references public.delivery_comercios(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  pregunta text not null check (char_length(pregunta) between 5 and 300),
  respuesta text check (respuesta is null or char_length(respuesta) between 1 and 600),
  respondida_at timestamptz,
  respondida_por uuid,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists delivery_preguntas_producto_idx on public.delivery_producto_preguntas (producto_id, created_at desc);
create index if not exists delivery_preguntas_comercio_idx on public.delivery_producto_preguntas (comercio_id, respondida_at, created_at desc);
create index if not exists delivery_preguntas_autor_idx on public.delivery_producto_preguntas (autor_id, created_at desc);
alter table public.delivery_producto_preguntas enable row level security;

create policy "Preguntas visibles" on public.delivery_producto_preguntas for select to anon, authenticated
  using (
    (visible and exists (select 1 from public.delivery_comercios c where c.id = comercio_id and c.activo and c.aprobado))
    or autor_id = (select auth.uid())
    or public.delivery_permiso(comercio_id, 'opiniones')
  );
-- Sin políticas de escritura (solo las funciones). La columna `autor_id` no se puede leer desde la API.
revoke all on public.delivery_producto_preguntas from anon, authenticated;
grant select (id, producto_id, comercio_id, pregunta, respuesta, respondida_at, visible, created_at) on public.delivery_producto_preguntas to anon, authenticated;

create or replace function public.delivery_preguntar(p_producto uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p_texto, '')); cid uuid; nid uuid;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión para preguntar'; end if;
  if char_length(t) < 5 or char_length(t) > 300 then raise exception 'La pregunta debe tener entre 5 y 300 caracteres'; end if;
  if t ~* '(https?://|www\.|\.com\b|\.com\.ar\b|@[a-z0-9_.-]+)' or length(regexp_replace(t, '\D', '', 'g')) >= 8 then
    raise exception 'Por seguridad no se pueden incluir enlaces, mails ni teléfonos. Hacé tu pregunta sobre el producto.';
  end if;
  select p.comercio_id into cid from public.delivery_productos p join public.delivery_comercios c on c.id = p.comercio_id where p.id = p_producto and c.activo and c.aprobado;
  if cid is null then raise exception 'No encontramos ese producto'; end if;
  if coalesce(public.delivery_permiso(cid, 'pedidos'), false) then raise exception 'No podés preguntar en tu propio comercio'; end if;
  if (select count(*) from public.delivery_producto_preguntas where autor_id = (select auth.uid()) and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.delivery_producto_preguntas where autor_id = (select auth.uid()) and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Hiciste muchas preguntas seguidas. Probá de nuevo más tarde.';
  end if;
  insert into public.delivery_producto_preguntas (producto_id, comercio_id, autor_id, pregunta) values (p_producto, cid, (select auth.uid()), t) returning id into nid;
  return nid;
end $$;

create or replace function public.delivery_responder_pregunta(p_id uuid, p_respuesta text) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid; r text := btrim(coalesce(p_respuesta, ''));
begin
  select comercio_id into cid from public.delivery_producto_preguntas where id = p_id;
  if cid is null or not coalesce(public.delivery_permiso(cid, 'opiniones'), false) then raise exception 'No tenés permiso para responder'; end if;
  if char_length(r) < 1 or char_length(r) > 600 then raise exception 'La respuesta debe tener entre 1 y 600 caracteres'; end if;
  update public.delivery_producto_preguntas set respuesta = r, respondida_at = now(), respondida_por = (select auth.uid()) where id = p_id;
end $$;

create or replace function public.delivery_moderar_pregunta(p_id uuid, p_visible boolean) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select comercio_id into cid from public.delivery_producto_preguntas where id = p_id;
  if cid is null or not coalesce(public.delivery_permiso(cid, 'opiniones'), false) then raise exception 'No tenés permiso'; end if;
  update public.delivery_producto_preguntas set visible = p_visible where id = p_id;
end $$;

create or replace function public.delivery_borrar_mi_pregunta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.delivery_producto_preguntas where id = p_id and autor_id = (select auth.uid()) and respondida_at is null;
end $$;

create or replace function public.delivery_preguntas_comercio(p_comercio uuid) returns table (id uuid, producto_id uuid, producto text, pregunta text, respuesta text, respondida_at timestamptz, visible boolean, created_at timestamptz, autor text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.delivery_permiso(p_comercio, 'opiniones'), false) then raise exception 'Sin permiso'; end if;
  return query
    select q.id, q.producto_id, p.nombre, q.pregunta, q.respuesta, q.respondida_at, q.visible, q.created_at, coalesce(split_part(pf.nombre, ' ', 1), 'Cliente')
    from public.delivery_producto_preguntas q
    join public.delivery_productos p on p.id = q.producto_id
    left join public.perfiles pf on pf.id = q.autor_id
    where q.comercio_id = p_comercio
    order by (q.respondida_at is null) desc, q.created_at desc limit 200;
end $$;

revoke all on function public.delivery_preguntar(uuid, text), public.delivery_responder_pregunta(uuid, text), public.delivery_moderar_pregunta(uuid, boolean), public.delivery_borrar_mi_pregunta(uuid), public.delivery_preguntas_comercio(uuid) from public, anon;
grant execute on function public.delivery_preguntar(uuid, text), public.delivery_responder_pregunta(uuid, text), public.delivery_moderar_pregunta(uuid, boolean), public.delivery_borrar_mi_pregunta(uuid), public.delivery_preguntas_comercio(uuid) to authenticated;

-- ---- Reputación del vendedor (datos agregados, públicos)
create or replace function public.delivery_vendedor_resumen(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; out jsonb;
begin
  select id, created_at, rating, total_resenas into c from public.delivery_comercios where slug = p_slug and activo and aprobado;
  if c.id is null then return null; end if;
  select jsonb_build_object(
    'desde', c.created_at,
    'entregados', (select count(*) from public.delivery_pedidos where comercio_id = c.id and estado = 'entregado'),
    'rating', c.rating,
    'resenas', c.total_resenas,
    'positivas', (select round(100.0 * count(*) filter (where puntaje >= 4) / nullif(count(*), 0)) from public.delivery_resenas where comercio_id = c.id),
    'mas_vendidos', coalesce((
      select jsonb_agg(jsonb_build_object('producto_id', x.producto_id, 'unidades', x.unidades))
      from (select i.producto_id, sum(i.cantidad)::int as unidades
            from public.delivery_pedido_items i join public.delivery_pedidos p on p.id = i.pedido_id
            where p.comercio_id = c.id and p.estado = 'entregado' and p.entregado_at > now() - interval '90 days' and i.producto_id is not null
            group by i.producto_id having sum(i.cantidad) >= 3 order by 2 desc limit 5) x), '[]'::jsonb),
    'preguntas_respondidas', (select count(*) from public.delivery_producto_preguntas where comercio_id = c.id and respondida_at is not null)
  ) into out;
  return out;
end $$;
revoke all on function public.delivery_vendedor_resumen(text) from public;
grant execute on function public.delivery_vendedor_resumen(text) to anon, authenticated;
