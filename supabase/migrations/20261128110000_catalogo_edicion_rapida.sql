-- Catálogo: edición rápida en tabla. Muchos cambios de precio, precio anterior, stock, disponibilidad y estado en UNA transacción.
-- Reglas: solo productos del comercio y con permiso de catálogo; el stock pasa por inventario_ajustar (queda en movimientos);
-- un producto con oferta activa no cambia su precio desde acá (la oferta tiene su propio flujo); todo o nada.
create or replace function public.catalogo_edicion_rapida(p_comercio uuid, p_cambios jsonb) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  c jsonb; p public.delivery_productos; v_var uuid; n int := 0; v_precio numeric; v_ant numeric; v_estado text; v_stock int; v_nombre text;
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso para editar el catálogo'; end if;
  if jsonb_typeof(p_cambios) is distinct from 'array' or jsonb_array_length(p_cambios) = 0 then raise exception 'No hay cambios'; end if;
  if jsonb_array_length(p_cambios) > 500 then raise exception 'Guardá de a 500 cambios como máximo'; end if;
  for c in select * from jsonb_array_elements(p_cambios) loop
    if jsonb_typeof(c) <> 'object' or (c->>'id') !~ '^[0-9a-f-]{36}$' then raise exception 'Cambio inválido'; end if;
    select * into p from public.delivery_productos where id = (c->>'id')::uuid and comercio_id = p_comercio for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    v_nombre := p.nombre;
    v_var := case when (c->>'variante') ~ '^[0-9a-f-]{36}$' then (c->>'variante')::uuid end;
    if v_var is not null and not exists (select 1 from public.delivery_producto_variantes where id = v_var and producto_id = p.id) then raise exception 'Variante no encontrada en %', v_nombre; end if;

    -- Precio (y precio anterior, que se muestra tachado)
    if c ? 'precio' or c ? 'precio_anterior' then
      if p.promo_activa and v_var is null then raise exception '“%” tiene una oferta activa: cambiá el precio desde su ficha', v_nombre; end if;
      if c ? 'precio' then
        if jsonb_typeof(c->'precio') <> 'number' then raise exception 'Precio inválido en %', v_nombre; end if;
        v_precio := round((c->>'precio')::numeric, 2);
        if v_precio < 0 or v_precio > 100000000 then raise exception 'Precio fuera de rango en %', v_nombre; end if;
      end if;
      if v_var is not null then
        if c ? 'precio' then update public.delivery_producto_variantes set precio = v_precio where id = v_var; end if;
      else
        v_precio := coalesce(v_precio, p.precio);
        v_ant := case when c ? 'precio_anterior' then case when jsonb_typeof(c->'precio_anterior') = 'number' then round((c->>'precio_anterior')::numeric, 2) end else p.precio_anterior end;
        if v_ant is not null and v_ant <= v_precio then raise exception 'En “%” el precio anterior tiene que ser mayor que el precio', v_nombre; end if;
        update public.delivery_productos set precio = v_precio, precio_anterior = v_ant where id = p.id;
      end if;
      v_precio := null; v_ant := null;
    end if;

    -- Stock: se fija con motivo "inventario" para que quede en el historial de movimientos.
    if c ? 'stock' then
      if jsonb_typeof(c->'stock') = 'null' then
        if v_var is not null then update public.delivery_producto_variantes set stock = null where id = v_var;
        else update public.delivery_productos set stock = null where id = p.id; end if;
      else
        if jsonb_typeof(c->'stock') <> 'number' then raise exception 'Stock inválido en %', v_nombre; end if;
        v_stock := (c->>'stock')::numeric::int;
        perform public.inventario_ajustar(p.id, v_var, 'fijar', v_stock, 'inventario', 'Edición rápida');
      end if;
    end if;

    if c ? 'disponible' then
      if jsonb_typeof(c->'disponible') <> 'boolean' then raise exception 'Disponibilidad inválida en %', v_nombre; end if;
      if v_var is not null then update public.delivery_producto_variantes set disponible = (c->>'disponible')::boolean where id = v_var;
      else update public.delivery_productos set disponible = (c->>'disponible')::boolean where id = p.id; end if;
    end if;

    if c ? 'estado' and v_var is null then
      v_estado := c->>'estado';
      if v_estado not in ('publicado', 'borrador', 'archivado') then raise exception 'Estado inválido en %', v_nombre; end if;
      update public.delivery_productos set estado = v_estado where id = p.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.catalogo_edicion_rapida(uuid, jsonb) from public, anon;
grant execute on function public.catalogo_edicion_rapida(uuid, jsonb) to authenticated;
