-- FASE 4 (Market), paso 1: taxonomía de categorías, marca y atributos por producto, y canales por producto (Market / Tienda / ambos).
-- Aditivo: los productos existentes siguen igual (categoria de texto = sección del comercio). Los nuevos campos son opcionales.
--  * categorias: árbol de 2 niveles administrado por Woref (lectura pública, escritura solo administración).
--  * delivery_productos: categoria_id, marca, atributos (pares clave/valor validados), en_market, en_tienda (por defecto, ambos).
-- Los canales son una preferencia de PRESENTACIÓN (dónde se muestra), no de confidencialidad: la lectura de productos sigue las políticas existentes.
-- Revertir: alter table delivery_productos drop column categoria_id, marca, atributos, en_market, en_tienda; drop table categorias; drop function producto_atributos_validos.

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categorias (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  nombre text not null check (char_length(nombre) between 2 and 60),
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists categorias_parent_idx on public.categorias (parent_id, orden);

-- Dos niveles como máximo: una categoría hija no puede tener hijas.
create or replace function public.categorias_dos_niveles() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then raise exception 'Una categoría no puede ser su propia madre'; end if;
    if exists (select 1 from public.categorias where id = new.parent_id and parent_id is not null) then raise exception 'Solo se permiten dos niveles de categorías'; end if;
    if exists (select 1 from public.categorias where parent_id = new.id) then raise exception 'Una categoría con subcategorías no puede pasar a ser subcategoría'; end if;
  end if;
  return new;
end $$;
drop trigger if exists categorias_dos_niveles on public.categorias;
create trigger categorias_dos_niveles before insert or update of parent_id on public.categorias for each row execute function public.categorias_dos_niveles();

alter table public.categorias enable row level security;
drop policy if exists "Categorías activas visibles para todos" on public.categorias;
create policy "Categorías activas visibles para todos" on public.categorias for select to anon, authenticated using (activa or public.has_role(auth.uid(), 'admin'::app_role));
revoke all on public.categorias from anon, authenticated;
grant select on public.categorias to anon, authenticated;
grant all on public.categorias to service_role;

-- Semilla: categorías generales de un marketplace argentino.
do $seed$
declare r jsonb; c text; v_root uuid; v_orden integer := 0; v_hijo integer;
  v_arbol jsonb := '[
   {"n":"Comida y bebidas","h":["Restaurantes","Pizzerías","Hamburguesas","Panadería y pastelería","Heladería","Café","Bebidas","Comida saludable"]},
   {"n":"Supermercado y almacén","h":["Almacén","Frutas y verduras","Carnes","Lácteos y fiambres","Limpieza","Kiosco"]},
   {"n":"Moda","h":["Mujer","Hombre","Niños","Calzado","Accesorios"]},
   {"n":"Hogar y deco","h":["Muebles","Decoración","Cocina","Baño","Jardín"]},
   {"n":"Electrónica","h":["Celulares","Computación","Audio","TV y video","Accesorios electrónicos"]},
   {"n":"Salud y belleza","h":["Perfumería","Cuidado de la piel","Farmacia","Maquillaje","Cuidado personal"]},
   {"n":"Deportes","h":["Indumentaria deportiva","Fitness","Ciclismo","Camping y aire libre"]},
   {"n":"Mascotas","h":["Alimento para mascotas","Accesorios para mascotas","Salud de mascotas"]},
   {"n":"Juguetes y bebés","h":["Juguetes","Bebés","Juegos de mesa"]},
   {"n":"Libros y papelería","h":["Libros","Papelería","Arte y manualidades"]},
   {"n":"Herramientas y construcción","h":["Herramientas","Pinturas","Ferretería"]},
   {"n":"Otros","h":[]}
  ]'::jsonb;
begin
  if exists (select 1 from public.categorias) then return; end if;
  for r in select * from jsonb_array_elements(v_arbol) loop
    v_orden := v_orden + 1; v_hijo := 0;
    insert into public.categorias (slug, nombre, orden)
      values (trim(both '-' from regexp_replace(lower(translate(r->>'n', 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuaeiounu')), '[^a-z0-9]+', '-', 'g')), r->>'n', v_orden) returning id into v_root;
    for c in select jsonb_array_elements_text(r->'h') loop
      v_hijo := v_hijo + 1;
      insert into public.categorias (parent_id, slug, nombre, orden)
        values (v_root, trim(both '-' from regexp_replace(lower(translate(r->>'n' || ' ' || c, 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuaeiounu')), '[^a-z0-9]+', '-', 'g')), c, v_hijo);
    end loop;
  end loop;
end $seed$;

-- Administración de categorías (solo administradores).
create or replace function public.delivery_admin_guardar_categoria(p_id uuid, p_parent uuid, p_slug text, p_nombre text, p_orden integer default 0, p_activa boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  if p_id is null then
    insert into public.categorias (parent_id, slug, nombre, orden, activa) values (p_parent, lower(trim(p_slug)), trim(p_nombre), coalesce(p_orden, 0), coalesce(p_activa, true)) returning id into v_id;
  else
    update public.categorias set parent_id = p_parent, slug = lower(trim(p_slug)), nombre = trim(p_nombre), orden = coalesce(p_orden, 0), activa = coalesce(p_activa, true) where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Categoría no encontrada'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.delivery_admin_guardar_categoria(uuid, uuid, text, text, integer, boolean) from public, anon;
grant execute on function public.delivery_admin_guardar_categoria(uuid, uuid, text, text, integer, boolean) to authenticated;

-- Productos: categoría, marca, atributos y canales.
create or replace function public.producto_atributos_validos(a jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(a) = 'object'
     and (select count(*) from jsonb_object_keys(a)) <= 12
     and not exists (select 1 from jsonb_each(a) e where char_length(e.key) not between 1 and 30 or jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') not between 1 and 60)
$$;

alter table public.delivery_productos
  add column if not exists categoria_id uuid references public.categorias (id) on delete set null,
  add column if not exists marca text check (marca is null or char_length(marca) <= 60),
  add column if not exists atributos jsonb not null default '{}'::jsonb check (public.producto_atributos_validos(atributos)),
  add column if not exists en_market boolean not null default true,
  add column if not exists en_tienda boolean not null default true;
alter table public.delivery_productos drop constraint if exists delivery_productos_canal_check;
alter table public.delivery_productos add constraint delivery_productos_canal_check check (en_market or en_tienda);
create index if not exists delivery_productos_categoria_idx on public.delivery_productos (categoria_id) where categoria_id is not null;
