-- CATÁLOGO PRO: el catálogo deja de ser un CRUD y pasa a ser un sistema comercial, sin romper carrito, pedidos ni tienda.
--  * Producto: tipo (físico / digital / servicio), estado (borrador / publicado / programado / archivado) con fecha de publicación,
--    SKU y código de barras, costo (margen), stock mínimo (alerta), slug único por local, título y descripción SEO,
--    descripción larga, productos relacionados y oferta programada (precio promocional con vigencia).
--  * Variantes: código de barras, costo y stock mínimo propios. SKU único dentro del local (productos y variantes).
--  * Colecciones del local (curadas a mano), además de las secciones y la categoría del marketplace que ya existían.
--  * Visibilidad: solo lo "publicado" se ve en la tienda, el marketplace y el buscador, y solo eso se puede comprar
--    (un disparador en los ítems del pedido lo garantiza aunque se llame al servidor directamente).
--  * Ofertas programadas y publicaciones programadas: una tarea cada 5 minutos aplica y retira la oferta guardando el
--    precio regular; el pedido sigue leyendo un único precio vigente, así carrito, pedido y tienda no se desincronizan.
--    Los pedidos ya conservan nombre y precio unitario de cada ítem (snapshot), así que cambiar un precio no altera ventas hechas.
--  * Historial de cambios (precio, costo, estado, disponibilidad, SKU…) por producto y variante, con quién y cuándo.
--  * Acciones masivas, duplicado completo (con variantes y opciones) e importación con validación en el servidor.
-- Revertir: drop table delivery_producto_cambios, delivery_coleccion_productos, delivery_colecciones; drop function catalogo_*, producto_duplicar,
--   productos_programados_aplicar, delivery_slug_producto; alter table delivery_productos / delivery_producto_variantes drop las columnas nuevas;
--   restaurar la política "Productos visibles para todos" y market_filtrados sin la condición de estado; cron.unschedule('catalogo-programado').

alter table public.delivery_productos
  add column if not exists tipo text not null default 'fisico' check (tipo in ('fisico', 'digital', 'servicio')),
  add column if not exists estado text not null default 'publicado' check (estado in ('borrador', 'publicado', 'programado', 'archivado')),
  add column if not exists publicar_desde timestamptz,
  add column if not exists sku text check (sku is null or char_length(btrim(sku)) between 1 and 40),
  add column if not exists codigo_barras text check (codigo_barras is null or codigo_barras ~ '^[0-9A-Za-z-]{4,32}$'),
  add column if not exists costo numeric(12, 2) check (costo is null or costo >= 0),
  add column if not exists stock_minimo integer check (stock_minimo is null or stock_minimo between 0 and 100000),
  add column if not exists slug text check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90)),
  add column if not exists seo_titulo text check (seo_titulo is null or char_length(seo_titulo) <= 70),
  add column if not exists seo_descripcion text check (seo_descripcion is null or char_length(seo_descripcion) <= 170),
  add column if not exists descripcion_larga text check (descripcion_larga is null or char_length(descripcion_larga) <= 8000),
  add column if not exists relacionados uuid[] not null default '{}' check (cardinality(relacionados) <= 12),
  add column if not exists precio_promo numeric(12, 2) check (precio_promo is null or precio_promo > 0),
  add column if not exists promo_desde timestamptz,
  add column if not exists promo_hasta timestamptz,
  add column if not exists promo_activa boolean not null default false,
  add column if not exists promo_respaldo jsonb;

alter table public.delivery_productos drop constraint if exists delivery_productos_promo_rango;
alter table public.delivery_productos add constraint delivery_productos_promo_rango check (precio_promo is null or promo_desde is not null and (promo_hasta is null or promo_hasta > promo_desde));
alter table public.delivery_productos drop constraint if exists delivery_productos_programado_fecha;
alter table public.delivery_productos add constraint delivery_productos_programado_fecha check (estado <> 'programado' or publicar_desde is not null);

alter table public.delivery_producto_variantes
  add column if not exists codigo_barras text check (codigo_barras is null or codigo_barras ~ '^[0-9A-Za-z-]{4,32}$'),
  add column if not exists costo numeric(12, 2) check (costo is null or costo >= 0),
  add column if not exists stock_minimo integer check (stock_minimo is null or stock_minimo between 0 and 100000);

create index if not exists delivery_productos_estado_idx on public.delivery_productos (comercio_id, estado);
create unique index if not exists delivery_productos_slug_uq on public.delivery_productos (comercio_id, slug) where slug is not null;
create index if not exists delivery_productos_sku_idx on public.delivery_productos (comercio_id, lower(sku)) where sku is not null;
create index if not exists delivery_productos_programados_idx on public.delivery_productos (publicar_desde) where estado = 'programado';
create index if not exists delivery_productos_promos_idx on public.delivery_productos (promo_desde, promo_hasta) where precio_promo is not null or promo_activa;

-- Slug: se genera del nombre si no se indica, sin acentos, y se desambigua dentro del local (-2, -3…).
create or replace function public.delivery_slug_producto() returns trigger
language plpgsql set search_path = public, extensions as $$
declare v_base text; v_slug text; n integer := 1;
begin
  if new.slug is not null and tg_op = 'UPDATE' and new.slug = old.slug then return new; end if;
  v_base := coalesce(nullif(new.slug, ''), public.f_unaccent(lower(new.nombre)));
  v_base := trim(both '-' from regexp_replace(regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'), '-{2,}', '-', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'producto'), 80);
  v_slug := v_base;
  while exists (select 1 from public.delivery_productos p where p.comercio_id = new.comercio_id and p.slug = v_slug and p.id is distinct from new.id) loop
    n := n + 1; v_slug := left(v_base, 80 - char_length(n::text) - 1) || '-' || n;
  end loop;
  new.slug := v_slug;
  return new;
end $$;
drop trigger if exists delivery_slug_producto on public.delivery_productos;
create trigger delivery_slug_producto before insert or update of slug, nombre on public.delivery_productos for each row execute function public.delivery_slug_producto();
update public.delivery_productos set slug = null where slug is null; -- dispara el cálculo para los existentes

-- SKU único dentro del local (entre productos y variantes) y relacionados del mismo local.
create or replace function public.delivery_catalogo_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_com uuid; v_sku text; v_id uuid;
begin
  if tg_table_name = 'delivery_productos' then
    v_com := new.comercio_id; v_sku := nullif(btrim(coalesce(new.sku, '')), ''); v_id := new.id;
    new.sku := v_sku;
    if cardinality(new.relacionados) > 0 then
      new.relacionados := array(select distinct r from unnest(new.relacionados) r where r <> new.id);
      if exists (select 1 from unnest(new.relacionados) r where not exists (select 1 from public.delivery_productos p where p.id = r and p.comercio_id = new.comercio_id)) then
        raise exception 'Los productos relacionados tienen que ser de este local';
      end if;
    end if;
  else
    select comercio_id into v_com from public.delivery_productos where id = new.producto_id;
    v_sku := nullif(btrim(coalesce(new.sku, '')), ''); v_id := new.id;
    new.sku := v_sku;
  end if;
  if v_sku is not null and (
       exists (select 1 from public.delivery_productos p where p.comercio_id = v_com and lower(p.sku) = lower(v_sku) and p.id is distinct from v_id)
    or exists (select 1 from public.delivery_producto_variantes v join public.delivery_productos p on p.id = v.producto_id where p.comercio_id = v_com and lower(v.sku) = lower(v_sku) and v.id is distinct from v_id)) then
    raise exception 'El SKU % ya está usado en otro producto o variante de este local', v_sku;
  end if;
  return new;
end $$;
drop trigger if exists delivery_catalogo_validar on public.delivery_productos;
create trigger delivery_catalogo_validar before insert or update of sku, relacionados on public.delivery_productos for each row execute function public.delivery_catalogo_validar();
drop trigger if exists delivery_catalogo_validar on public.delivery_producto_variantes;
create trigger delivery_catalogo_validar before insert or update of sku on public.delivery_producto_variantes for each row execute function public.delivery_catalogo_validar();

-- Solo lo publicado se ve y se vende.
alter policy "Productos visibles para todos" on public.delivery_productos
  using ((estado = 'publicado' and exists (select 1 from public.delivery_comercios c where c.id = delivery_productos.comercio_id and c.activo and c.aprobado)) or public.delivery_permiso(comercio_id, 'catalogo'));

create or replace function public.delivery_item_publicado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.producto_id is not null and exists (select 1 from public.delivery_productos p where p.id = new.producto_id and p.estado <> 'publicado') then
    raise exception 'Un producto de tu carrito ya no está disponible';
  end if;
  return new;
end $$;
drop trigger if exists delivery_item_publicado on public.delivery_pedido_items;
create trigger delivery_item_publicado before insert on public.delivery_pedido_items for each row execute function public.delivery_item_publicado();

create or replace function public.market_filtrados(p_q text, p_categoria uuid, p_marca text, p_min numeric, p_max numeric, p_con_stock boolean, p_ofertas boolean)
 returns table(id uuid, comercio_id uuid, categoria_id uuid, marca text, precio numeric, rank real, destacado boolean, created_at timestamp with time zone)
 language plpgsql stable security definer set search_path to 'public', 'extensions' as $function$
declare v_q text := public.f_unaccent(lower(left(trim(coalesce(p_q, '')), 80))); v_tokens text[];
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  select coalesce(array_agg(t), '{}') into v_tokens from (select t from regexp_split_to_table(v_q, '\s+') t where t <> '' limit 6) x;
  return query
    select p.id, p.comercio_id, p.categoria_id, p.marca, p.precio,
           (case when v_q = '' then 0::real
                 else (case when public.f_unaccent(lower(p.nombre)) like v_q || '%' then 3 when public.f_unaccent(lower(p.nombre)) like '%' || v_q || '%' then 2 else 0 end)::real
                      + extensions.word_similarity(v_q, p.busqueda) end),
           coalesce(p.destacado, false), p.created_at
      from public.delivery_productos p
      join public.delivery_comercios c on c.id = p.comercio_id and c.activo and c.aprobado
     where p.disponible and p.en_market and p.estado = 'publicado'
       and (p_categoria is null or p.categoria_id in (select k.id from public.categorias k where k.id = p_categoria or k.parent_id = p_categoria))
       and (p_marca is null or public.f_unaccent(lower(p.marca)) = public.f_unaccent(lower(p_marca)))
       and (p_min is null or p.precio >= p_min) and (p_max is null or p.precio <= p_max)
       and (not coalesce(p_ofertas, false) or (p.precio_anterior is not null and p.precio_anterior > p.precio))
       and (not coalesce(p_con_stock, true) or ((p.stock is null or p.stock > 0)
            and (not coalesce(p.usa_variantes, false) or exists (select 1 from public.delivery_producto_variantes v where v.producto_id = p.id and v.disponible and (v.stock is null or v.stock > 0)))))
       and not exists (select 1 from unnest(v_tokens) tk where not (p.busqueda like '%' || tk || '%' or tk <% p.busqueda));
end $function$;

-- Colecciones ----------------------------------------------------------------------------------------------------------
create table if not exists public.delivery_colecciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),
  imagen_url text check (imagen_url is null or (imagen_url ~ '^https://' and char_length(imagen_url) <= 600)),
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (comercio_id, slug)
);
create table if not exists public.delivery_coleccion_productos (
  coleccion_id uuid not null references public.delivery_colecciones (id) on delete cascade,
  producto_id uuid not null references public.delivery_productos (id) on delete cascade,
  orden integer not null default 0,
  primary key (coleccion_id, producto_id)
);
create index if not exists delivery_coleccion_productos_producto_idx on public.delivery_coleccion_productos (producto_id);

create or replace function public.delivery_coleccion_mismo_comercio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select comercio_id from public.delivery_colecciones where id = new.coleccion_id) is distinct from (select comercio_id from public.delivery_productos where id = new.producto_id) then
    raise exception 'El producto y la colección tienen que ser del mismo local';
  end if;
  if (select count(*) from public.delivery_coleccion_productos where coleccion_id = new.coleccion_id) >= 500 then raise exception 'Una colección puede tener hasta 500 productos'; end if;
  return new;
end $$;
drop trigger if exists delivery_coleccion_mismo_comercio on public.delivery_coleccion_productos;
create trigger delivery_coleccion_mismo_comercio before insert on public.delivery_coleccion_productos for each row execute function public.delivery_coleccion_mismo_comercio();

alter table public.delivery_colecciones enable row level security;
alter table public.delivery_coleccion_productos enable row level security;
revoke all on public.delivery_colecciones, public.delivery_coleccion_productos from anon, authenticated;
grant select on public.delivery_colecciones, public.delivery_coleccion_productos to anon, authenticated;
grant insert, update, delete on public.delivery_colecciones, public.delivery_coleccion_productos to authenticated;
grant all on public.delivery_colecciones, public.delivery_coleccion_productos to service_role;
drop policy if exists "Colecciones visibles" on public.delivery_colecciones;
create policy "Colecciones visibles" on public.delivery_colecciones for select to anon, authenticated
  using ((activa and exists (select 1 from public.delivery_comercios c where c.id = comercio_id and c.activo and c.aprobado)) or public.delivery_permiso(comercio_id, 'catalogo'));
drop policy if exists "Colecciones administradas" on public.delivery_colecciones;
create policy "Colecciones administradas" on public.delivery_colecciones for all to authenticated
  using (public.delivery_permiso(comercio_id, 'catalogo')) with check (public.delivery_permiso(comercio_id, 'catalogo'));
drop policy if exists "Productos de colección visibles" on public.delivery_coleccion_productos;
create policy "Productos de colección visibles" on public.delivery_coleccion_productos for select to anon, authenticated
  using (exists (select 1 from public.delivery_colecciones k where k.id = coleccion_id));
drop policy if exists "Productos de colección administrados" on public.delivery_coleccion_productos;
create policy "Productos de colección administrados" on public.delivery_coleccion_productos for all to authenticated
  using (exists (select 1 from public.delivery_colecciones k where k.id = coleccion_id and public.delivery_permiso(k.comercio_id, 'catalogo')))
  with check (exists (select 1 from public.delivery_colecciones k where k.id = coleccion_id and public.delivery_permiso(k.comercio_id, 'catalogo')));

-- Historial de cambios -------------------------------------------------------------------------------------------------
create table if not exists public.delivery_producto_cambios (
  id bigint generated always as identity primary key,
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  producto_id uuid references public.delivery_productos (id) on delete set null,
  variante_id uuid,
  producto_nombre text not null,
  campo text not null,
  antes text,
  despues text,
  usuario_id uuid,
  fecha timestamptz not null default now()
);
create index if not exists delivery_producto_cambios_idx on public.delivery_producto_cambios (comercio_id, producto_id, fecha desc);
alter table public.delivery_producto_cambios enable row level security;
revoke all on public.delivery_producto_cambios from anon, authenticated;
grant select on public.delivery_producto_cambios to authenticated;
grant all on public.delivery_producto_cambios to service_role;
drop policy if exists "Historial del catálogo para el local" on public.delivery_producto_cambios;
create policy "Historial del catálogo para el local" on public.delivery_producto_cambios for select to authenticated using (public.delivery_permiso(comercio_id, 'catalogo'));

create or replace function public.delivery_producto_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_com uuid; v_nombre text; v_prod uuid; v_var uuid; v_new jsonb := to_jsonb(new); v_old jsonb := to_jsonb(old); k text;
  campos text[] := case when tg_table_name = 'delivery_productos'
    then array['nombre', 'precio', 'precio_anterior', 'costo', 'estado', 'disponible', 'sku', 'categoria', 'tipo', 'precio_promo', 'promo_desde', 'promo_hasta']
    else array['nombre', 'precio', 'costo', 'disponible', 'sku'] end;
begin
  -- Se lee todo por jsonb: las dos tablas tienen columnas distintas y plpgsql valida cada campo de NEW al ejecutarse.
  if tg_table_name = 'delivery_productos' then
    v_prod := (v_new->>'id')::uuid; v_com := (v_new->>'comercio_id')::uuid; v_nombre := v_new->>'nombre';
  else
    v_var := (v_new->>'id')::uuid; v_prod := (v_new->>'producto_id')::uuid;
    select p.comercio_id, p.nombre || ' · ' || (v_new->>'nombre') into v_com, v_nombre from public.delivery_productos p where p.id = v_prod;
  end if;
  foreach k in array campos loop
    if (v_new->k) is distinct from (v_old->k) then
      insert into public.delivery_producto_cambios (comercio_id, producto_id, variante_id, producto_nombre, campo, antes, despues, usuario_id)
        values (v_com, v_prod, v_var, left(v_nombre, 160), k, left(v_old->>k, 200), left(v_new->>k, 200), auth.uid());
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists delivery_producto_auditar on public.delivery_productos;
create trigger delivery_producto_auditar after update on public.delivery_productos for each row execute function public.delivery_producto_auditar();
drop trigger if exists delivery_producto_auditar on public.delivery_producto_variantes;
create trigger delivery_producto_auditar after update on public.delivery_producto_variantes for each row execute function public.delivery_producto_auditar();

-- Programados: publicar a la hora indicada y aplicar / retirar ofertas ------------------------------------------------
create or replace function public.productos_programados_aplicar(p_producto uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_x integer;
begin
  update public.delivery_productos set estado = 'publicado', publicar_desde = null
   where estado = 'programado' and publicar_desde <= now() and (p_producto is null or id = p_producto);
  get diagnostics v_x = row_count; v_n := v_n + v_x;
  -- Retirar ofertas vencidas o quitadas: vuelve el precio regular.
  update public.delivery_productos set precio = coalesce((promo_respaldo->>'precio')::numeric, precio), precio_anterior = (promo_respaldo->>'precio_anterior')::numeric,
         promo_activa = false, promo_respaldo = null,
         precio_promo = case when promo_hasta is not null and promo_hasta <= now() then null else precio_promo end,
         promo_desde = case when promo_hasta is not null and promo_hasta <= now() then null else promo_desde end,
         promo_hasta = case when promo_hasta is not null and promo_hasta <= now() then null else promo_hasta end
   where promo_activa and (precio_promo is null or promo_desde > now() or (promo_hasta is not null and promo_hasta <= now())) and (p_producto is null or id = p_producto);
  get diagnostics v_x = row_count; v_n := v_n + v_x;
  -- Aplicar ofertas que empiezan: guarda el precio regular y muestra el anterior tachado.
  update public.delivery_productos set promo_respaldo = jsonb_build_object('precio', precio, 'precio_anterior', precio_anterior),
         precio_anterior = precio, precio = precio_promo, promo_activa = true
   where not promo_activa and precio_promo is not null and precio_promo < precio and promo_desde <= now() and (promo_hasta is null or promo_hasta > now()) and (p_producto is null or id = p_producto);
  get diagnostics v_x = row_count; v_n := v_n + v_x;
  return v_n;
end $$;
revoke all on function public.productos_programados_aplicar(uuid) from public, anon, authenticated;
grant execute on function public.productos_programados_aplicar(uuid) to service_role;

-- Programar u quitar una oferta (el local). Valida y la aplica al instante si ya empezó.
create or replace function public.catalogo_oferta(p_producto uuid, p_precio numeric, p_desde timestamptz default null, p_hasta timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.delivery_productos; v_regular numeric;
begin
  select * into p from public.delivery_productos where id = p_producto for update;
  if not found or not public.delivery_permiso(p.comercio_id, 'catalogo') then raise exception 'Producto no encontrado'; end if;
  if p_precio is null then
    update public.delivery_productos set precio_promo = null, promo_desde = null, promo_hasta = null where id = p_producto;
  else
    v_regular := coalesce((p.promo_respaldo->>'precio')::numeric, p.precio);
    if p_precio <= 0 or p_precio >= v_regular then raise exception 'El precio de oferta tiene que ser menor al precio regular ($%)', v_regular; end if;
    if p_hasta is not null and p_hasta <= coalesce(p_desde, now()) then raise exception 'La oferta tiene que terminar después de empezar'; end if;
    if p_hasta is not null and p_hasta < now() then raise exception 'Esa fecha de fin ya pasó'; end if;
    -- Si había una oferta activa, primero se vuelve al precio regular para recalcular limpio.
    if p.promo_activa then
      update public.delivery_productos set precio = v_regular, precio_anterior = (p.promo_respaldo->>'precio_anterior')::numeric, promo_activa = false, promo_respaldo = null where id = p_producto;
    end if;
    update public.delivery_productos set precio_promo = round(p_precio, 2), promo_desde = coalesce(p_desde, now()), promo_hasta = p_hasta where id = p_producto;
  end if;
  perform public.productos_programados_aplicar(p_producto);
end $$;

-- Mientras hay una oferta activa, el precio que se edita es el regular (no se pisa la oferta).
create or replace function public.delivery_precio_con_oferta() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.promo_activa and new.promo_activa and new.precio is distinct from old.precio then
    new.promo_respaldo := jsonb_set(coalesce(old.promo_respaldo, '{}'::jsonb), '{precio}', to_jsonb(new.precio));
    new.precio := old.precio;
    new.precio_anterior := (new.promo_respaldo->>'precio')::numeric;
    if (new.promo_respaldo->>'precio')::numeric <= new.precio then
      -- El precio regular quedó por debajo de la oferta: se termina la oferta.
      new.precio := (new.promo_respaldo->>'precio')::numeric; new.precio_anterior := (old.promo_respaldo->>'precio_anterior')::numeric;
      new.promo_activa := false; new.promo_respaldo := null; new.precio_promo := null; new.promo_desde := null; new.promo_hasta := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists delivery_precio_con_oferta on public.delivery_productos;
create trigger delivery_precio_con_oferta before update of precio on public.delivery_productos for each row execute function public.delivery_precio_con_oferta();

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'catalogo-programado';
    perform cron.schedule('catalogo-programado', '*/5 * * * *', 'select public.productos_programados_aplicar()');
  end if;
end $$;

-- Acciones masivas ----------------------------------------------------------------------------------------------------
create or replace function public.catalogo_masivo(p_comercio uuid, p_ids uuid[], p_accion text, p_valor jsonb default '{}'::jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_ids uuid[]; v_txt text; v_col uuid;
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso para editar el catálogo'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 1000 then raise exception 'Elegí entre 1 y 1000 productos'; end if;
  select array_agg(id) into v_ids from public.delivery_productos where comercio_id = p_comercio and id = any(p_ids);
  if v_ids is null then return 0; end if;
  if p_accion in ('publicar', 'borrador', 'archivar') then
    update public.delivery_productos set estado = case p_accion when 'publicar' then 'publicado' when 'borrador' then 'borrador' else 'archivado' end, publicar_desde = null where id = any(v_ids);
  elsif p_accion = 'disponible' then
    update public.delivery_productos set disponible = coalesce((p_valor->>'valor')::boolean, true) where id = any(v_ids);
  elsif p_accion = 'destacar' then
    update public.delivery_productos set destacado = coalesce((p_valor->>'valor')::boolean, true) where id = any(v_ids);
  elsif p_accion = 'seccion' then
    v_txt := left(btrim(coalesce(p_valor->>'valor', '')), 40);
    if v_txt = '' then raise exception 'Indicá la sección'; end if;
    update public.delivery_productos set categoria = v_txt where id = any(v_ids);
  elsif p_accion = 'tipo' then
    if (p_valor->>'valor') not in ('fisico', 'digital', 'servicio') then raise exception 'Tipo inválido'; end if;
    update public.delivery_productos set tipo = p_valor->>'valor' where id = any(v_ids);
  elsif p_accion = 'canales' then
    update public.delivery_productos set en_market = coalesce((p_valor->>'market')::boolean, en_market), en_tienda = coalesce((p_valor->>'tienda')::boolean, en_tienda) where id = any(v_ids);
  elsif p_accion = 'coleccion' then
    v_col := (p_valor->>'valor')::uuid;
    if not exists (select 1 from public.delivery_colecciones where id = v_col and comercio_id = p_comercio) then raise exception 'Colección no encontrada'; end if;
    insert into public.delivery_coleccion_productos (coleccion_id, producto_id) select v_col, unnest(v_ids) on conflict do nothing;
  elsif p_accion = 'stock_minimo' then
    update public.delivery_productos set stock_minimo = nullif((p_valor->>'valor')::integer, -1) where id = any(v_ids);
  else
    raise exception 'Acción inválida';
  end if;
  get diagnostics v_n = row_count;
  return coalesce(v_n, 0);
end $$;

-- Duplicar un producto completo (variantes y opciones). Queda en borrador, sin SKU ni código de barras.
create or replace function public.producto_duplicar(p_producto uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.delivery_productos; v_id uuid; g record; v_g uuid;
begin
  select * into p from public.delivery_productos where id = p_producto;
  if not found or not public.delivery_permiso(p.comercio_id, 'catalogo') then raise exception 'Producto no encontrado'; end if;
  insert into public.delivery_productos (comercio_id, nombre, descripcion, descripcion_larga, categoria, imagen_url, imagenes, precio, precio_anterior, stock, disponible, destacado, orden,
      etiquetas, usa_variantes, categoria_id, marca, atributos, en_market, en_tienda, tipo, estado, costo, stock_minimo, seo_titulo, seo_descripcion, relacionados)
    values (p.comercio_id, left(p.nombre || ' (copia)', 80), p.descripcion, p.descripcion_larga, p.categoria, p.imagen_url, p.imagenes,
      coalesce((p.promo_respaldo->>'precio')::numeric, p.precio), case when p.promo_activa then (p.promo_respaldo->>'precio_anterior')::numeric else p.precio_anterior end,
      case when p.usa_variantes then null else p.stock end, p.disponible, false, coalesce(p.orden, 0) + 1,
      p.etiquetas, p.usa_variantes, p.categoria_id, p.marca, p.atributos, p.en_market, p.en_tienda, p.tipo, 'borrador', p.costo, p.stock_minimo, p.seo_titulo, p.seo_descripcion, p.relacionados)
    returning id into v_id;
  insert into public.delivery_producto_variantes (producto_id, nombre, precio, stock, disponible, orden, costo, stock_minimo)
    select v_id, nombre, precio, stock, disponible, orden, costo, stock_minimo from public.delivery_producto_variantes where producto_id = p.id;
  for g in select * from public.delivery_producto_grupos where producto_id = p.id order by orden loop
    insert into public.delivery_producto_grupos (producto_id, nombre, minimo, maximo, orden) values (v_id, g.nombre, g.minimo, g.maximo, g.orden) returning id into v_g;
    insert into public.delivery_producto_opciones (grupo_id, nombre, precio_extra, disponible, orden) select v_g, nombre, precio_extra, disponible, orden from public.delivery_producto_opciones where grupo_id = g.id;
  end loop;
  insert into public.delivery_coleccion_productos (coleccion_id, producto_id) select coleccion_id, v_id from public.delivery_coleccion_productos where producto_id = p.id;
  return v_id;
end $$;

-- Resumen del catálogo para el panel: estados, stock bajo, sin foto, sin SKU, margen.
create or replace function public.catalogo_resumen(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso'; end if;
  return (select jsonb_build_object(
    'total', count(*),
    'publicados', count(*) filter (where estado = 'publicado'),
    'borradores', count(*) filter (where estado = 'borrador'),
    'programados', count(*) filter (where estado = 'programado'),
    'archivados', count(*) filter (where estado = 'archivado'),
    'sin_foto', count(*) filter (where imagen_url is null and estado <> 'archivado'),
    'agotados', count(*) filter (where estado = 'publicado' and (not disponible or stock = 0 or (usa_variantes and not exists (select 1 from public.delivery_producto_variantes v where v.producto_id = p.id and v.disponible and (v.stock is null or v.stock > 0))))),
    'stock_bajo', count(*) filter (where estado = 'publicado' and ((not usa_variantes and stock is not null and stock_minimo is not null and stock <= stock_minimo)
                     or (usa_variantes and exists (select 1 from public.delivery_producto_variantes v where v.producto_id = p.id and v.stock is not null and coalesce(v.stock_minimo, p.stock_minimo) is not null and v.stock <= coalesce(v.stock_minimo, p.stock_minimo))))),
    'en_oferta', count(*) filter (where promo_activa),
    'valor_inventario', coalesce(sum(case when not usa_variantes and stock is not null and costo is not null then stock * costo end), 0)
      + coalesce((select sum(v.stock * coalesce(v.costo, pp.costo)) from public.delivery_producto_variantes v join public.delivery_productos pp on pp.id = v.producto_id where pp.comercio_id = p_comercio and v.stock is not null and coalesce(v.costo, pp.costo) is not null), 0)
  ) from public.delivery_productos p where p.comercio_id = p_comercio);
end $$;

revoke all on function public.catalogo_oferta(uuid, numeric, timestamptz, timestamptz), public.catalogo_masivo(uuid, uuid[], text, jsonb), public.producto_duplicar(uuid), public.catalogo_resumen(uuid) from public, anon;
grant execute on function public.catalogo_oferta(uuid, numeric, timestamptz, timestamptz), public.catalogo_masivo(uuid, uuid[], text, jsonb), public.producto_duplicar(uuid), public.catalogo_resumen(uuid) to authenticated;
