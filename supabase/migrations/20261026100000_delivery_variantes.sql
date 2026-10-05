-- VARIANTES DE PRODUCTO (talle, color, sabor…) con stock, SKU y precio propios.
-- Un producto con `usa_variantes` se vende solo eligiendo una variante; el servidor valida la variante, cobra su precio,
-- descuenta SU stock y lo devuelve si el pedido se cancela (por cualquier camino) con un disparador.

create table if not exists public.delivery_producto_variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.delivery_productos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  sku text check (sku is null or length(trim(sku)) between 1 and 40),
  precio numeric(12,2) check (precio is null or precio >= 0),
  stock integer check (stock is null or stock >= 0),
  disponible boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  unique (producto_id, nombre)
);
create index if not exists delivery_producto_variantes_producto_idx on public.delivery_producto_variantes (producto_id, orden);

alter table public.delivery_productos add column if not exists usa_variantes boolean not null default false;
alter table public.delivery_pedido_items add column if not exists variante_id uuid references public.delivery_producto_variantes(id) on delete set null;

-- Un producto con variantes no lleva stock propio: el stock vive en cada variante.
create or replace function public.delivery_producto_sin_stock_propio() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.usa_variantes then new.stock := null; end if;
  return new;
end $$;
drop trigger if exists delivery_producto_sin_stock_propio on public.delivery_productos;
create trigger delivery_producto_sin_stock_propio before insert or update of usa_variantes, stock on public.delivery_productos
  for each row execute function public.delivery_producto_sin_stock_propio();

-- Máximo 100 variantes por producto.
create or replace function public.delivery_variantes_limite() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.delivery_producto_variantes where producto_id = new.producto_id) >= 100 then
    raise exception 'Un producto puede tener hasta 100 variantes';
  end if;
  return new;
end $$;
drop trigger if exists delivery_variantes_limite on public.delivery_producto_variantes;
create trigger delivery_variantes_limite before insert on public.delivery_producto_variantes for each row execute function public.delivery_variantes_limite();

-- Permiso: quien puede editar el catálogo del comercio (dueño o equipo con permiso `catalogo`).
create or replace function public.delivery_puede_catalogo_producto(p_producto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.delivery_productos p
    where p.id = p_producto and (public.delivery_permiso(p.comercio_id, 'catalogo') or public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;
grant execute on function public.delivery_puede_catalogo_producto(uuid) to authenticated;

grant select on public.delivery_producto_variantes to anon, authenticated;
grant insert, update, delete on public.delivery_producto_variantes to authenticated;
grant all on public.delivery_producto_variantes to service_role;
alter table public.delivery_producto_variantes enable row level security;
drop policy if exists "Variantes visibles" on public.delivery_producto_variantes;
drop policy if exists "Catálogo crea variantes" on public.delivery_producto_variantes;
drop policy if exists "Catálogo edita variantes" on public.delivery_producto_variantes;
drop policy if exists "Catálogo borra variantes" on public.delivery_producto_variantes;
create policy "Variantes visibles" on public.delivery_producto_variantes for select to anon, authenticated using (true);
create policy "Catálogo crea variantes" on public.delivery_producto_variantes for insert to authenticated with check (public.delivery_puede_catalogo_producto(producto_id));
create policy "Catálogo edita variantes" on public.delivery_producto_variantes for update to authenticated using (public.delivery_puede_catalogo_producto(producto_id)) with check (public.delivery_puede_catalogo_producto(producto_id));
create policy "Catálogo borra variantes" on public.delivery_producto_variantes for delete to authenticated using (public.delivery_puede_catalogo_producto(producto_id));

-- Devolución de stock de variantes al cancelarse un pedido, sin importar quién lo cancele.
create or replace function public.delivery_variantes_devolver_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.delivery_producto_variantes v set stock = v.stock + i.total
    from (select variante_id, sum(cantidad) as total from public.delivery_pedido_items where pedido_id = new.id and variante_id is not null group by variante_id) i
   where v.id = i.variante_id and v.stock is not null;
  return null;
end $$;
revoke all on function public.delivery_variantes_devolver_stock() from public, anon, authenticated;
drop trigger if exists delivery_variantes_devolver_stock on public.delivery_pedidos;
create trigger delivery_variantes_devolver_stock after update of estado on public.delivery_pedidos
  for each row when (new.estado = 'cancelado' and old.estado is distinct from 'cancelado')
  execute function public.delivery_variantes_devolver_stock();

-- El RPC de pedidos se reescribe a partir de la definición vigente: valida la variante, cobra su precio y descuenta su stock.
do $mig$
declare d text; n text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'delivery_crear_pedido';
  n := d;
  n := replace(n, 'v_estimada timestamptz;', 'v_estimada timestamptz; v_var public.delivery_producto_variantes; v_precio numeric;');
  n := replace(n, E'    IF v_prod.stock IS NOT NULL AND v_prod.stock < (',
E'    v_var := NULL; v_precio := v_prod.precio;
    IF v_prod.usa_variantes THEN
      IF nullif(v_item->>''variante_id'', '''') IS NULL THEN RAISE EXCEPTION ''Elegí una opción de %'', v_prod.nombre; END IF;
      SELECT * INTO v_var FROM public.delivery_producto_variantes WHERE id = (v_item->>''variante_id'')::uuid AND producto_id = v_prod.id FOR UPDATE;
      IF NOT FOUND OR NOT v_var.disponible THEN RAISE EXCEPTION ''La opción elegida de % ya no está disponible'', v_prod.nombre; END IF;
      IF v_var.stock IS NOT NULL AND v_var.stock < (
        SELECT sum((i->>''cantidad'')::integer) FROM jsonb_array_elements(p_items) i WHERE (i->>''variante_id'')::uuid = v_var.id
      ) THEN RAISE EXCEPTION ''No hay stock suficiente de % (%)'', v_prod.nombre, v_var.nombre; END IF;
      v_precio := coalesce(v_var.precio, v_prod.precio);
    ELSIF v_prod.stock IS NOT NULL AND v_prod.stock < (');
  n := replace(n, '(v_prod.precio + (v_opciones->>''extra'')::numeric) * v_cantidad', '(v_precio + (v_opciones->>''extra'')::numeric) * v_cantidad');
  n := replace(n,
E'    INSERT INTO public.delivery_pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad, notas, opciones)
      VALUES (v_pedido, v_prod.id, v_prod.nombre, v_prod.precio + (v_opciones->>''extra'')::numeric, v_cantidad,',
E'    v_var := NULL; v_precio := v_prod.precio;
    IF v_prod.usa_variantes THEN
      SELECT * INTO v_var FROM public.delivery_producto_variantes WHERE id = (v_item->>''variante_id'')::uuid;
      v_precio := coalesce(v_var.precio, v_prod.precio);
    END IF;
    INSERT INTO public.delivery_pedido_items (pedido_id, producto_id, variante_id, nombre, precio_unitario, cantidad, notas, opciones)
      VALUES (v_pedido, v_prod.id, v_var.id, v_prod.nombre || CASE WHEN v_var.id IS NOT NULL THEN '' · '' || v_var.nombre ELSE '''' END, v_precio + (v_opciones->>''extra'')::numeric, v_cantidad,');
  n := replace(n,
E'    IF v_prod.stock IS NOT NULL THEN
      UPDATE public.delivery_productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    END IF;',
E'    IF v_prod.stock IS NOT NULL THEN
      UPDATE public.delivery_productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    END IF;
    IF v_var.id IS NOT NULL AND v_var.stock IS NOT NULL THEN
      UPDATE public.delivery_producto_variantes SET stock = stock - v_cantidad WHERE id = v_var.id;
    END IF;');
  if n = d or position('v_precio' in n) = 0 or position('delivery_producto_variantes SET stock' in n) = 0 or position('variante_id, nombre' in n) = 0 then
    raise exception 'No se pudo reescribir delivery_crear_pedido: la definición vigente cambió';
  end if;
  execute n;
end $mig$;
