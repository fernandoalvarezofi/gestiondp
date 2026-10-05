-- FASE 2 (Commerce), paso 2: devoluciones y reintegros conectados a Pagos y al libro.
-- Flujo: el cliente pide devolver productos de un pedido ENTREGADO (dentro del plazo) -> el comercio aprueba o rechaza -> el comercio confirma el
-- reintegro (y opcionalmente repone el stock). Al reintegrar se revierte el dinero con asientos nuevos en delivery_libro (nunca se edita nada):
--   * comercio: -monto de la devolución y se le devuelve la comisión proporcional;
--   * plataforma: se revierte esa comisión y su IVA;
--   * cliente: +monto en la billetera (destino 'billetera'), o, si pagó online y devuelve el pedido completo, el pedido pasa a 'a_reintegrar'
--     y sigue el flujo de reintegro por Mercado Pago ya existente (destino 'medio_original').
-- Revertir: drop function devolucion_*, delivery_mis_devoluciones, delivery_devoluciones_comercio; drop table devoluciones; los asientos del libro ya generados quedan (son historia).

create table if not exists public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.delivery_pedidos (id) on delete restrict,
  comercio_id uuid not null,
  cliente_id uuid not null,
  estado text not null default 'solicitada' check (estado in ('solicitada', 'aprobada', 'rechazada', 'cancelada', 'reintegrada')),
  motivo text not null check (motivo in ('danado', 'incorrecto', 'faltante', 'no_conforme', 'arrepentimiento', 'otro')),
  detalle text check (detalle is null or char_length(detalle) <= 500),
  destino text not null default 'billetera' check (destino in ('billetera', 'medio_original')),
  items jsonb not null,
  monto numeric(12, 2) not null check (monto > 0),
  respuesta text check (respuesta is null or char_length(respuesta) <= 500),
  respondido_por uuid,
  respondido_at timestamptz,
  reintegrado_at timestamptz,
  repuso_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists devoluciones_pedido_idx on public.devoluciones (pedido_id);
create index if not exists devoluciones_comercio_idx on public.devoluciones (comercio_id, estado, created_at desc);
create index if not exists devoluciones_cliente_idx on public.devoluciones (cliente_id, created_at desc);

alter table public.devoluciones enable row level security;
revoke all on public.devoluciones from anon, authenticated;
grant all on public.devoluciones to service_role;

-- El inventario reconoce el motivo "devolucion" (aditivo).
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_motivo_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_motivo_check
  check (motivo in ('alta', 'venta', 'cancelacion', 'impago', 'vencido', 'ajuste_pedido', 'ajuste', 'devolucion'));

create or replace function public.devolucion_solicitar(p_pedido uuid, p_items jsonb, p_motivo text, p_detalle text default null, p_destino text default 'billetera') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ped public.delivery_pedidos; v_it public.delivery_pedido_items; v_e jsonb; v_dias integer := coalesce(public.delivery_ajuste('devolucion_dias', 7), 7)::integer;
  v_bruto numeric := 0; v_prev integer; v_cant integer; v_lista jsonb := '[]'::jsonb; v_monto numeric; v_unidades integer := 0; v_unidades_pedido integer; v_unidades_prev integer; v_id uuid;
  v_vistos uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'Ingresá para pedir una devolución'; end if;
  if p_motivo not in ('danado', 'incorrecto', 'faltante', 'no_conforme', 'arrepentimiento', 'otro') then raise exception 'Motivo inválido'; end if;
  if p_destino not in ('billetera', 'medio_original') then raise exception 'Destino inválido'; end if;
  if char_length(coalesce(p_detalle, '')) > 500 then raise exception 'El detalle es demasiado largo'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Elegí al menos un producto'; end if;

  -- Se bloquea el pedido: dos pedidos de devolución a la vez no pueden pasarse de las unidades compradas.
  select * into v_ped from public.delivery_pedidos where id = p_pedido and cliente_id = auth.uid() for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_ped.estado <> 'entregado' then raise exception 'Solo se pueden devolver productos de pedidos entregados'; end if;
  if coalesce(v_ped.entregado_at, v_ped.created_at) < now() - make_interval(days => v_dias) then raise exception 'Pasó el plazo para pedir la devolución (% días)', v_dias; end if;
  if (select count(*) from public.devoluciones where pedido_id = p_pedido and estado in ('solicitada', 'aprobada')) >= 3 then raise exception 'Este pedido ya tiene devoluciones en curso'; end if;
  if (select count(*) from public.devoluciones where cliente_id = auth.uid() and estado = 'solicitada') >= 10 then raise exception 'Tenés muchas devoluciones esperando respuesta'; end if;

  for v_e in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_e) <> 'object' or (v_e->>'item_id') !~ '^[0-9a-f-]{36}$' or (v_e->>'cantidad') !~ '^[0-9]{1,3}$' then raise exception 'Producto o cantidad inválidos'; end if;
    v_cant := (v_e->>'cantidad')::integer;
    if v_cant < 1 then raise exception 'La cantidad tiene que ser al menos 1'; end if;
    select * into v_it from public.delivery_pedido_items where id = (v_e->>'item_id')::uuid and pedido_id = p_pedido;
    if not found then raise exception 'Ese producto no es de este pedido'; end if;
    if v_it.id = any(v_vistos) then raise exception 'Producto repetido'; end if;
    v_vistos := v_vistos || v_it.id;
    select coalesce(sum((x->>'cantidad')::integer), 0) into v_prev from public.devoluciones d, jsonb_array_elements(d.items) x
     where d.pedido_id = p_pedido and d.estado in ('solicitada', 'aprobada', 'reintegrada') and x->>'item_id' = v_it.id::text;
    if v_cant > v_it.cantidad - v_prev then raise exception 'Solo podés devolver % unidad(es) de %', greatest(v_it.cantidad - v_prev, 0), v_it.nombre; end if;
    v_bruto := v_bruto + v_it.precio_unitario * v_cant;
    v_unidades := v_unidades + v_cant;
    v_lista := v_lista || jsonb_build_object('item_id', v_it.id, 'nombre', v_it.nombre, 'cantidad', v_cant, 'precio_unitario', v_it.precio_unitario);
  end loop;

  -- Lo que se devuelve es proporcional a lo que se pagó (si hubo descuento o cupón, se prorratea).
  v_monto := round(v_bruto * case when v_ped.subtotal > 0 then greatest(v_ped.subtotal - coalesce(v_ped.descuento, 0), 0) / v_ped.subtotal else 1 end, 2);
  if v_monto <= 0 then raise exception 'No hay nada para reintegrar en esos productos'; end if;

  if p_destino = 'medio_original' then
    select coalesce(sum(cantidad), 0) into v_unidades_pedido from public.delivery_pedido_items where pedido_id = p_pedido;
    select coalesce(sum((x->>'cantidad')::integer), 0) into v_unidades_prev from public.devoluciones d, jsonb_array_elements(d.items) x where d.pedido_id = p_pedido and d.estado in ('solicitada', 'aprobada', 'reintegrada');
    if v_ped.metodo_pago <> 'mercadopago' or v_ped.pago_estado <> 'aprobado' then raise exception 'Solo se puede devolver al medio original un pedido pagado online'; end if;
    if v_unidades + v_unidades_prev <> v_unidades_pedido then raise exception 'La devolución al medio original es solo para el pedido completo. Elegí la billetera para una devolución parcial'; end if;
  end if;

  insert into public.devoluciones (pedido_id, comercio_id, cliente_id, motivo, detalle, destino, items, monto)
    values (p_pedido, v_ped.comercio_id, auth.uid(), p_motivo, nullif(trim(coalesce(p_detalle, '')), ''), p_destino, v_lista, v_monto) returning id into v_id;
  return v_id;
end $$;

create or replace function public.devolucion_cancelar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.devoluciones set estado = 'cancelada', updated_at = now() where id = p_id and cliente_id = auth.uid() and estado = 'solicitada';
  if not found then raise exception 'No se puede cancelar esta devolución'; end if;
end $$;

create or replace function public.devolucion_responder(p_id uuid, p_aprobar boolean, p_respuesta text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d public.devoluciones;
begin
  select * into d from public.devoluciones where id = p_id for update;
  if not found or not public.delivery_permiso(d.comercio_id, 'pedidos') then raise exception 'Devolución no encontrada'; end if;
  if d.estado <> 'solicitada' then raise exception 'Esta devolución ya fue respondida'; end if;
  if not p_aprobar and char_length(trim(coalesce(p_respuesta, ''))) < 5 then raise exception 'Contale al cliente por qué la rechazás'; end if;
  update public.devoluciones set estado = case when p_aprobar then 'aprobada' else 'rechazada' end, respuesta = left(nullif(trim(coalesce(p_respuesta, '')), ''), 500),
         respondido_por = auth.uid(), respondido_at = now(), updated_at = now() where id = p_id;
end $$;

-- Confirma el reintegro: mueve el dinero con asientos nuevos y, si se pide, repone el stock.
create or replace function public.devolucion_reintegrar(p_id uuid, p_reponer_stock boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.devoluciones; v_ped public.delivery_pedidos; v_pct numeric; v_ivapct numeric; v_comm numeric; v_iva numeric; v_e jsonb; v_it public.delivery_pedido_items;
  v_det jsonb;
begin
  select * into d from public.devoluciones where id = p_id for update;
  if not found or not public.delivery_permiso(d.comercio_id, 'pedidos') then raise exception 'Devolución no encontrada'; end if;
  if d.estado <> 'aprobada' then raise exception 'Primero hay que aprobar la devolución'; end if;
  select * into v_ped from public.delivery_pedidos where id = d.pedido_id for update;

  select coalesce((l.detalle->>'pct')::numeric, 0) into v_pct from public.delivery_libro l where l.pedido_id = d.pedido_id and l.titular_tipo = 'comercio' and l.tipo = 'comision' limit 1;
  if v_pct is null then select comision_pct into v_pct from public.delivery_comercios where id = d.comercio_id; end if;
  select coalesce((l.detalle->>'pct')::numeric, 0) into v_ivapct from public.delivery_libro l where l.pedido_id = d.pedido_id and l.tipo = 'iva' and l.titular_tipo = 'impuestos' limit 1;
  if v_ivapct is null then v_ivapct := public.delivery_ajuste('iva_pct', 21); end if;
  v_comm := round(d.monto * coalesce(v_pct, 0) / 100);
  v_iva := case when v_comm > 0 and v_ivapct > 0 then round(v_comm * v_ivapct / (100 + v_ivapct)) else 0 end;
  v_det := jsonb_build_object('pedido_id', d.pedido_id, 'devolucion_id', d.id);

  insert into public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle)
  select null, x.tt, x.tid, x.cu, x.ti, x.m, d.id::text, v_det from (values
    ('comercio', d.comercio_id, 'ventas', 'devolucion', -d.monto),
    ('comercio', d.comercio_id, 'ventas', 'comision_devuelta', v_comm),
    ('plataforma', null::uuid, 'ingresos', 'comision_devuelta', -v_comm),
    ('plataforma', null, 'ingresos', 'iva_devuelto', v_iva),
    ('impuestos', null, 'iva', 'iva_devuelto', -v_iva),
    ('cliente', d.cliente_id, 'billetera', 'devolucion', case when d.destino = 'billetera' then d.monto else 0 end)
  ) as x(tt, tid, cu, ti, m) where x.m <> 0;

  -- Devolución al medio original (pedido completo pagado online): sigue el flujo de reintegro por Mercado Pago.
  if d.destino = 'medio_original' then
    update public.delivery_pedidos set pago_estado = 'a_reintegrar' where id = d.pedido_id and pago_estado = 'aprobado';
  end if;

  if p_reponer_stock then
    perform set_config('woref.stock_motivo', 'devolucion', true);
    for v_e in select * from jsonb_array_elements(d.items) loop
      select * into v_it from public.delivery_pedido_items where id = (v_e->>'item_id')::uuid;
      if not found then continue; end if;
      if v_it.variante_id is not null then
        update public.delivery_producto_variantes set stock = stock + (v_e->>'cantidad')::integer where id = v_it.variante_id and stock is not null;
      else
        update public.delivery_productos set stock = stock + (v_e->>'cantidad')::integer where id = v_it.producto_id and stock is not null;
      end if;
    end loop;
  end if;

  update public.devoluciones set estado = 'reintegrada', reintegrado_at = now(), repuso_stock = coalesce(p_reponer_stock, false), updated_at = now() where id = p_id;
end $$;

revoke all on function public.devolucion_solicitar(uuid, jsonb, text, text, text), public.devolucion_cancelar(uuid), public.devolucion_responder(uuid, boolean, text), public.devolucion_reintegrar(uuid, boolean) from public, anon;
grant execute on function public.devolucion_solicitar(uuid, jsonb, text, text, text), public.devolucion_cancelar(uuid), public.devolucion_responder(uuid, boolean, text), public.devolucion_reintegrar(uuid, boolean) to authenticated;

-- Lecturas (la tabla no se lee directamente). Sin teléfonos ni datos de contacto.
create or replace function public.delivery_mis_devoluciones() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'pedido_id', d.pedido_id, 'comercio', c.nombre, 'estado', d.estado, 'motivo', d.motivo, 'detalle', d.detalle, 'destino', d.destino,
           'items', d.items, 'monto', d.monto, 'respuesta', d.respuesta, 'created_at', d.created_at, 'reintegrado_at', d.reintegrado_at) order by d.created_at desc), '[]'::jsonb)
    from public.devoluciones d join public.delivery_comercios c on c.id = d.comercio_id where d.cliente_id = auth.uid()
$$;
create or replace function public.delivery_devoluciones_comercio(p_comercio uuid, p_estado text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver las devoluciones de este local'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'pedido_id', d.pedido_id, 'estado', d.estado, 'motivo', d.motivo, 'detalle', d.detalle, 'destino', d.destino, 'items', d.items,
           'monto', d.monto, 'respuesta', d.respuesta, 'created_at', d.created_at, 'reintegrado_at', d.reintegrado_at, 'repuso_stock', d.repuso_stock) order by d.created_at desc)
      from public.devoluciones d where d.comercio_id = p_comercio and (p_estado is null or d.estado = p_estado)), '[]'::jsonb);
end $$;
revoke all on function public.delivery_mis_devoluciones(), public.delivery_devoluciones_comercio(uuid, text) from public, anon;
grant execute on function public.delivery_mis_devoluciones(), public.delivery_devoluciones_comercio(uuid, text) to authenticated;
