-- FASE 2 (Commerce), paso 1: inventario con movimientos auditables.
-- Cada cambio de stock (producto o variante) deja un asiento inmodificable con cantidad, stock antes/después, motivo y quién lo hizo.
-- No cambia cómo se descuenta el stock: se agrega un disparador que observa, y las funciones de pedidos avisan el motivo (venta, cancelación…).
-- Revertir: drop trigger inventario_producto/inventario_variante; drop function inventario_registrar, delivery_inventario_movimientos; drop table inventario_movimientos
-- (las funciones de pedidos solo agregaron una línea set_config('woref.stock_motivo', …) que no afecta su lógica).

create table if not exists public.inventario_movimientos (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  comercio_id uuid not null,
  producto_id uuid not null,
  variante_id uuid,
  delta integer,
  stock_antes integer,
  stock_despues integer,
  motivo text not null check (motivo in ('alta', 'venta', 'cancelacion', 'impago', 'vencido', 'ajuste_pedido', 'ajuste')),
  usuario_id uuid
);
create index if not exists inventario_mov_producto_idx on public.inventario_movimientos (producto_id, fecha desc);
create index if not exists inventario_mov_comercio_idx on public.inventario_movimientos (comercio_id, fecha desc);

create or replace function public.inventario_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Solo se borra con el producto (cascada del borrado de la tienda) o con el interruptor de mantenimiento.
  if tg_op = 'DELETE' and current_setting('woref.inventario_mantenimiento', true) = '1' then return old; end if;
  raise exception 'El historial de inventario no se puede modificar';
end $$;
drop trigger if exists inventario_inmutable on public.inventario_movimientos;
create trigger inventario_inmutable before update or delete on public.inventario_movimientos for each row execute function public.inventario_inmutable();

alter table public.inventario_movimientos enable row level security;
revoke all on public.inventario_movimientos from anon, authenticated;
grant all on public.inventario_movimientos to service_role;

create or replace function public.inventario_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_motivo text := coalesce(nullif(current_setting('woref.stock_motivo', true), ''), 'ajuste');
        v_comercio uuid; v_producto uuid; v_variante uuid;
begin
  if tg_table_name = 'delivery_productos' then v_comercio := new.comercio_id; v_producto := new.id;
  else v_producto := new.producto_id; v_variante := new.id; select comercio_id into v_comercio from public.delivery_productos where id = new.producto_id; end if;
  if tg_op = 'INSERT' then
    if new.stock is null then return new; end if;
    insert into public.inventario_movimientos (comercio_id, producto_id, variante_id, delta, stock_antes, stock_despues, motivo, usuario_id)
      values (v_comercio, v_producto, v_variante, new.stock, 0, new.stock, 'alta', auth.uid());
  elsif new.stock is distinct from old.stock then
    insert into public.inventario_movimientos (comercio_id, producto_id, variante_id, delta, stock_antes, stock_despues, motivo, usuario_id)
      values (v_comercio, v_producto, v_variante, case when new.stock is not null and old.stock is not null then new.stock - old.stock end, old.stock, new.stock, v_motivo, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists inventario_producto on public.delivery_productos;
create trigger inventario_producto after insert or update of stock on public.delivery_productos for each row execute function public.inventario_registrar();
drop trigger if exists inventario_variante on public.delivery_producto_variantes;
create trigger inventario_variante after insert or update of stock on public.delivery_producto_variantes for each row execute function public.inventario_registrar();

-- Las funciones que mueven stock avisan el motivo (una línea al inicio; el resto de su lógica no cambia).
do $m$
declare r record; v_def text; v_mot text;
begin
  for r in select * from (values ('delivery_crear_pedido', 'venta'), ('delivery_actualizar_estado', 'cancelacion'), ('delivery_cancelar_impagos', 'impago'),
                                 ('delivery_vencer_sin_respuesta', 'vencido'), ('delivery_variantes_devolver_stock', 'cancelacion'), ('delivery_aplicar_ajuste', 'ajuste_pedido')) as t(f, m) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.f;
    if v_def is null then raise exception 'No existe %', r.f; end if;
    if position('woref.stock_motivo' in v_def) > 0 then continue; end if;
    if v_def !~* E'\\nbegin\\n' then raise exception '% no tiene la forma esperada', r.f; end if;
    v_def := regexp_replace(v_def, E'\\nbegin\\n', format(E'\nBEGIN\n  PERFORM set_config(''woref.stock_motivo'', ''%s'', true);\n', r.m), 'i');
    execute v_def;
  end loop;
end $m$;

-- Lectura para el comercio: solo quien puede ver el catálogo de esa tienda.
create or replace function public.delivery_inventario_movimientos(p_comercio uuid, p_producto uuid default null, p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'catalogo') then raise exception 'No tenés permiso para ver el inventario de este local'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha desc, x.id desc) from (
    select m.id, m.fecha, m.producto_id, p.nombre as producto, m.variante_id, v.nombre as variante, m.delta, m.stock_antes, m.stock_despues, m.motivo
      from public.inventario_movimientos m join public.delivery_productos p on p.id = m.producto_id left join public.delivery_producto_variantes v on v.id = m.variante_id
     where m.comercio_id = p_comercio and (p_producto is null or m.producto_id = p_producto)
     order by m.fecha desc, m.id desc limit least(greatest(p_limite, 1), 200)) x), '[]'::jsonb);
end $$;
revoke all on function public.delivery_inventario_movimientos(uuid, uuid, integer) from public, anon;
grant execute on function public.delivery_inventario_movimientos(uuid, uuid, integer) to authenticated;
