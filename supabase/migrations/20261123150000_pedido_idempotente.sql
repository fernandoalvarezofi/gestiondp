-- Confirmar un pedido es idempotente: el carrito manda una clave única por intento de compra. Si la respuesta se pierde
-- (corte de red justo después de crear el pedido) y la persona vuelve a tocar "Confirmar", se devuelve el MISMO pedido en
-- vez de crear otro (y, con pago online, cobrar dos veces). No modifica delivery_crear_pedido(_online): las envuelve.
create table if not exists public.delivery_pedido_claves (
  clave uuid primary key,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  pedido_id uuid not null references public.delivery_pedidos (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists delivery_pedido_claves_cliente_idx on public.delivery_pedido_claves (cliente_id, created_at desc);
create index if not exists delivery_pedido_claves_pedido_idx on public.delivery_pedido_claves (pedido_id);
alter table public.delivery_pedido_claves enable row level security;
-- Sin políticas: solo la función (security definer) la lee y escribe.
revoke all on public.delivery_pedido_claves from anon, authenticated;

create or replace function public.delivery_confirmar_pedido(
  p_clave uuid, p_online boolean,
  p_comercio uuid, p_items jsonb, p_direccion text, p_direccion_id uuid default null, p_metodo_pago text default 'efectivo',
  p_propina numeric default 0, p_cupon text default null, p_notas text default null, p_telefono text default null,
  p_latitud numeric default null, p_longitud numeric default null, p_tipo_entrega text default 'delivery',
  p_programado_para timestamptz default null, p_paga_con numeric default null, p_usar_saldo boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_existente uuid;
  v_pedido uuid;
begin
  if v_uid is null then raise exception 'Ingresá para confirmar el pedido'; end if;
  if p_clave is null then raise exception 'Falta la clave del pedido'; end if;
  -- Dos llamadas con la misma clave a la vez: la segunda espera a la primera y después encuentra su pedido.
  perform pg_advisory_xact_lock(hashtextextended(p_clave::text, 0));
  select pedido_id into v_existente from public.delivery_pedido_claves where clave = p_clave and cliente_id = v_uid;
  if v_existente is not null then return v_existente; end if;
  if exists (select 1 from public.delivery_pedido_claves where clave = p_clave) then raise exception 'Clave de pedido inválida'; end if;

  if p_online then
    v_pedido := public.delivery_crear_pedido_online(
      p_comercio => p_comercio, p_items => p_items, p_direccion => p_direccion, p_direccion_id => p_direccion_id,
      p_propina => p_propina, p_cupon => p_cupon, p_notas => p_notas, p_telefono => p_telefono,
      p_latitud => p_latitud, p_longitud => p_longitud, p_tipo_entrega => p_tipo_entrega, p_programado_para => p_programado_para);
  else
    v_pedido := public.delivery_crear_pedido(
      p_comercio => p_comercio, p_items => p_items, p_direccion => p_direccion, p_direccion_id => p_direccion_id,
      p_metodo_pago => p_metodo_pago, p_propina => p_propina, p_cupon => p_cupon, p_notas => p_notas, p_telefono => p_telefono,
      p_latitud => p_latitud, p_longitud => p_longitud, p_tipo_entrega => p_tipo_entrega, p_programado_para => p_programado_para,
      p_paga_con => p_paga_con, p_usar_saldo => p_usar_saldo);
  end if;
  insert into public.delivery_pedido_claves (clave, cliente_id, pedido_id) values (p_clave, v_uid, v_pedido);
  return v_pedido;
end $$;

revoke all on function public.delivery_confirmar_pedido(uuid, boolean, uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric, boolean) from public, anon;
grant execute on function public.delivery_confirmar_pedido(uuid, boolean, uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric, boolean) to authenticated;
