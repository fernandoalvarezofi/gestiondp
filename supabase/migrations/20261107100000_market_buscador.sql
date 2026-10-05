-- FASE 4 (Market), paso 2: buscador del marketplace en la base de datos (SearchService con Postgres).
-- Texto sin tildes y tolerante a errores de tipeo (pg_trgm), filtros (categoría, marca, precio, stock, ofertas), orden y cercanía, y facetas.
-- Devuelve IDs ordenados + datos públicos del comercio; el front trae los productos completos con la consulta normal (misma política de lectura).
-- Públicas (anon): con topes (texto 80, 6 palabras, 48 por página, 1000 de desplazamiento).
-- Revertir: drop function market_buscar, market_facetas, market_filtrados, producto_busqueda_texto, producto_busqueda_trg, f_unaccent; alter table delivery_productos drop column busqueda.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(t text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

alter table public.delivery_productos add column if not exists busqueda text;

create or replace function public.producto_busqueda_texto(p public.delivery_productos) returns text
language sql stable set search_path = public as $$
  select public.f_unaccent(lower(concat_ws(' ', p.nombre, p.marca, p.categoria,
    (select c.nombre from public.categorias c where c.id = p.categoria_id),
    (select m.nombre from public.categorias c join public.categorias m on m.id = c.parent_id where c.id = p.categoria_id),
    p.descripcion, (select string_agg(e.value #>> '{}', ' ') from jsonb_each(p.atributos) e))))
$$;

create or replace function public.producto_busqueda_trg() returns trigger
language plpgsql set search_path = public as $$
begin new.busqueda := public.producto_busqueda_texto(new); return new; end $$;
drop trigger if exists producto_busqueda on public.delivery_productos;
create trigger producto_busqueda before insert or update of nombre, marca, categoria, descripcion, atributos, categoria_id on public.delivery_productos for each row execute function public.producto_busqueda_trg();

update public.delivery_productos p set busqueda = public.producto_busqueda_texto(p);
create index if not exists delivery_productos_busqueda_trgm on public.delivery_productos using gin (busqueda extensions.gin_trgm_ops);

-- Núcleo compartido: productos visibles en el Market que cumplen los filtros, con su puntaje de relevancia.
create or replace function public.market_filtrados(p_q text, p_categoria uuid, p_marca text, p_min numeric, p_max numeric, p_con_stock boolean, p_ofertas boolean)
returns table (id uuid, comercio_id uuid, categoria_id uuid, marca text, precio numeric, rank real, destacado boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
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
     where p.disponible and p.en_market
       and (p_categoria is null or p.categoria_id in (select k.id from public.categorias k where k.id = p_categoria or k.parent_id = p_categoria))
       and (p_marca is null or public.f_unaccent(lower(p.marca)) = public.f_unaccent(lower(p_marca)))
       and (p_min is null or p.precio >= p_min) and (p_max is null or p.precio <= p_max)
       and (not coalesce(p_ofertas, false) or (p.precio_anterior is not null and p.precio_anterior > p.precio))
       and (not coalesce(p_con_stock, true) or ((p.stock is null or p.stock > 0)
            and (not coalesce(p.usa_variantes, false) or exists (select 1 from public.delivery_producto_variantes v where v.producto_id = p.id and v.disponible and (v.stock is null or v.stock > 0)))))
       and not exists (select 1 from unnest(v_tokens) tk where not (p.busqueda like '%' || tk || '%' or tk <% p.busqueda));
end $$;
revoke all on function public.market_filtrados(text, uuid, text, numeric, numeric, boolean, boolean) from public, anon, authenticated;

create or replace function public.market_buscar(p_q text default null, p_categoria uuid default null, p_marca text default null, p_min numeric default null, p_max numeric default null,
  p_con_stock boolean default true, p_ofertas boolean default false, p_lat numeric default null, p_lng numeric default null, p_orden text default 'relevancia', p_limite integer default 24, p_desde integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_lim integer := least(greatest(coalesce(p_limite, 24), 1), 48); v_off integer := least(greatest(coalesce(p_desde, 0), 0), 1000); v_res jsonb; v_total integer;
begin
  if p_orden not in ('relevancia', 'precio_asc', 'precio_desc', 'nuevos', 'cercania') then p_orden := 'relevancia'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180) then p_lat := null; p_lng := null; end if;
  with f as (select * from public.market_filtrados(p_q, p_categoria, p_marca, p_min, p_max, p_con_stock, p_ofertas)),
  d as (
    select f.*, c.nombre as c_nombre, c.slug as c_slug, c.logo_url as c_logo, c.esta_abierto as c_abierto, c.rating as c_rating, c.total_resenas as c_resenas,
           case when p_lat is not null and c.latitud is not null and c.longitud is not null then
             round((6371 * 2 * asin(sqrt(least(1, power(sin(radians(c.latitud::double precision - p_lat::double precision) / 2), 2)
               + cos(radians(p_lat::double precision)) * cos(radians(c.latitud::double precision)) * power(sin(radians(c.longitud::double precision - p_lng::double precision) / 2), 2)))))::numeric, 1) end as km
      from f join public.delivery_comercios c on c.id = f.comercio_id),
  paginado as (
    select d.*, count(*) over () as total from d
     order by case when p_orden = 'relevancia' then d.rank end desc nulls last,
              case when p_orden = 'precio_asc' then d.precio end asc,
              case when p_orden = 'precio_desc' then d.precio end desc,
              case when p_orden = 'nuevos' then d.created_at end desc,
              case when p_orden = 'cercania' then d.km end asc nulls last,
              d.destacado desc, d.id
     limit v_lim offset v_off)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'distancia_km', km, 'comercio', jsonb_build_object('id', comercio_id, 'nombre', c_nombre, 'slug', c_slug, 'logo_url', c_logo, 'esta_abierto', c_abierto, 'rating', c_rating, 'resenas', c_resenas))), '[]'::jsonb),
         coalesce(max(total), 0)::integer into v_res, v_total from paginado;
  return jsonb_build_object('total', v_total, 'items', v_res);
end $$;

-- Facetas para los filtros: categorías (con cantidad), marcas más frecuentes y rango de precios. Cada faceta ignora su propio filtro.
create or replace function public.market_facetas(p_q text default null, p_categoria uuid default null, p_marca text default null, p_min numeric default null, p_max numeric default null, p_con_stock boolean default true, p_ofertas boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  return jsonb_build_object(
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'parent_id', k.parent_id, 'nombre', k.nombre, 'slug', k.slug, 'n', x.n) order by k.orden, k.nombre)
        from (select categoria_id, count(*) n from public.market_filtrados(p_q, null, p_marca, p_min, p_max, p_con_stock, p_ofertas) where categoria_id is not null group by 1) x
        join public.categorias k on k.id = x.categoria_id), '[]'::jsonb),
    'marcas', coalesce((select jsonb_agg(jsonb_build_object('marca', m.marca, 'n', m.n) order by m.n desc, m.marca)
        from (select marca, count(*) n from public.market_filtrados(p_q, p_categoria, null, p_min, p_max, p_con_stock, p_ofertas) where marca is not null and marca <> '' group by 1 order by 2 desc limit 12) m), '[]'::jsonb),
    'precio', (select jsonb_build_object('min', min(precio), 'max', max(precio)) from public.market_filtrados(p_q, p_categoria, p_marca, null, null, p_con_stock, p_ofertas)));
end $$;

revoke all on function public.market_buscar(text, uuid, text, numeric, numeric, boolean, boolean, numeric, numeric, text, integer, integer), public.market_facetas(text, uuid, text, numeric, numeric, boolean, boolean) from public;
grant execute on function public.market_buscar(text, uuid, text, numeric, numeric, boolean, boolean, numeric, numeric, text, integer, integer), public.market_facetas(text, uuid, text, numeric, numeric, boolean, boolean) to anon, authenticated;
