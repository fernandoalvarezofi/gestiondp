-- INVENTARIO: ajustes manuales con motivo y nota (recepción de mercadería, merma, devolución, conteo de inventario).
-- El asiento sigue siendo inmodificable y lo escribe el mismo disparador; esta función solo informa el motivo y la nota.
-- Revertir: drop function inventario_ajustar; alter table inventario_movimientos drop column nota; restaurar el check de motivo,
--   inventario_registrar y delivery_inventario_movimientos de 20261104100000.

alter table public.inventario_movimientos add column if not exists nota text check (nota is null or char_length(nota) <= 200);
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_motivo_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_motivo_check
  check (motivo in ('alta', 'venta', 'cancelacion', 'impago', 'vencido', 'ajuste_pedido', 'ajuste', 'recepcion', 'merma', 'devolucion', 'inventario'));

create or replace function public.inventario_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_motivo text := coalesce(nullif(current_setting('woref.stock_motivo', true), ''), 'ajuste');
        v_nota text := nullif(current_setting('woref.stock_nota', true), '');
        v_comercio uuid; v_producto uuid; v_variante uuid; v_new jsonb := to_jsonb(new);
begin
  if tg_table_name = 'delivery_productos' then v_comercio := (v_new->>'comercio_id')::uuid; v_producto := (v_new->>'id')::uuid;
  else v_producto := (v_new->>'producto_id')::uuid; v_variante := (v_new->>'id')::uuid; select comercio_id into v_comercio from public.delivery_productos where id = v_producto; end if;
  if tg_op = 'INSERT' then
    if new.stock is null then return new; end if;
    insert into public.inventario_movimientos (comercio_id, producto_id, variante_id, delta, stock_antes, stock_despues, motivo, usuario_id, nota)
      values (v_comercio, v_producto, v_variante, new.stock, 0, new.stock, 'alta', auth.uid(), v_nota);
  elsif new.stock is distinct from old.stock then
    insert into public.inventario_movimientos (comercio_id, producto_id, variante_id, delta, stock_antes, stock_despues, motivo, usuario_id, nota)
      values (v_comercio, v_producto, v_variante, case when new.stock is not null and old.stock is not null then new.stock - old.stock end, old.stock, new.stock, v_motivo, auth.uid(), v_nota);
  end if;
  return new;
end $$;

-- Ajuste manual: sumar/restar una cantidad o fijar el stock contado, con motivo obligatorio.
create or replace function public.inventario_ajustar(p_producto uuid, p_variante uuid, p_modo text, p_cantidad integer, p_motivo text, p_nota text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare p public.delivery_productos; v_actual integer; v_nuevo integer;
begin
  select * into p from public.delivery_productos where id = p_producto for update;
  if not found or not public.delivery_permiso(p.comercio_id, 'catalogo') then raise exception 'Producto no encontrado'; end if;
  if p_motivo not in ('recepcion', 'merma', 'devolucion', 'inventario', 'ajuste') then raise exception 'Motivo inválido'; end if;
  if p_modo not in ('sumar', 'fijar') or p_cantidad is null then raise exception 'Ajuste inválido'; end if;
  if char_length(coalesce(p_nota, '')) > 200 then raise exception 'La nota admite hasta 200 caracteres'; end if;
  if p_variante is not null then
    select stock into v_actual from public.delivery_producto_variantes where id = p_variante and producto_id = p_producto for update;
    if not found then raise exception 'Variante no encontrada'; end if;
  else
    if p.usa_variantes then raise exception 'Este producto lleva el stock por variante'; end if;
    v_actual := p.stock;
  end if;
  v_nuevo := case when p_modo = 'fijar' then p_cantidad else coalesce(v_actual, 0) + p_cantidad end;
  if v_nuevo < 0 then raise exception 'El stock no puede quedar negativo (hay %)', coalesce(v_actual, 0); end if;
  if v_nuevo > 1000000 then raise exception 'Cantidad demasiado grande'; end if;
  perform set_config('woref.stock_motivo', p_motivo, true);
  perform set_config('woref.stock_nota', coalesce(left(btrim(p_nota), 200), ''), true);
  if p_variante is not null then update public.delivery_producto_variantes set stock = v_nuevo where id = p_variante;
  else update public.delivery_productos set stock = v_nuevo where id = p_producto; end if;
  return v_nuevo;
end $$;
revoke all on function public.inventario_ajustar(uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function public.inventario_ajustar(uuid, uuid, text, integer, text, text) to authenticated;

create or replace function public.delivery_inventario_movimientos(p_comercio uuid, p_producto uuid default null, p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso para ver el inventario de este local'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha desc, x.id desc) from (
    select m.id, m.fecha, m.producto_id, p.nombre as producto, m.variante_id, v.nombre as variante, m.delta, m.stock_antes, m.stock_despues, m.motivo, m.nota
      from public.inventario_movimientos m join public.delivery_productos p on p.id = m.producto_id left join public.delivery_producto_variantes v on v.id = m.variante_id
     where m.comercio_id = p_comercio and (p_producto is null or m.producto_id = p_producto)
     order by m.fecha desc, m.id desc limit least(greatest(p_limite, 1), 200)) x), '[]'::jsonb);
end $$;
