-- Descuentos automáticos: cupones del comercio que se aplican solos en el carrito (sin código), como en Shopify/Tiendanube.
-- Se modelan como cupones del comercio para que la contabilidad no cambie: el libro trata como "a cargo del comercio" el
-- descuento de un cupón de ese comercio, y los límites (mínimo, tope, vigencia, usos, alcance por sección/producto) ya existen.
-- Si el cliente escribe un código, se usa ese; si no, se elige el automático que más descuenta. No se combinan.

alter table public.delivery_cupones add column if not exists automatico boolean not null default false;
alter table public.delivery_cupones drop constraint if exists delivery_cupones_automatico_check;
alter table public.delivery_cupones add constraint delivery_cupones_automatico_check check (not automatico or (comercio_id is not null and cliente_id is null));
create index if not exists delivery_cupones_automaticos_idx on public.delivery_cupones (comercio_id) where automatico and activo;

-- El mejor descuento automático vigente para este carrito (o null). Lo usa el carrito para mostrarlo y el servidor al crear el pedido.
create or replace function public.delivery_cupon_automatico(p_comercio uuid, p_subtotal numeric, p_items jsonb, p_retiro boolean default false) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare k record; r jsonb; mejor jsonb;
begin
  for k in select codigo from public.delivery_cupones
            where comercio_id = p_comercio and automatico and activo and (inicia_at is null or inicia_at <= now()) and (vence_at is null or vence_at > now()) loop
    r := public.delivery_validar_cupon(k.codigo, p_comercio, p_subtotal, p_items);
    continue when not coalesce((r->>'valido')::boolean, false);
    continue when p_retiro and coalesce((r->>'envio_gratis')::boolean, false);
    if mejor is null or (r->>'descuento')::numeric > (mejor->>'descuento')::numeric then mejor := r; end if;
  end loop;
  return mejor;
end $$;
revoke all on function public.delivery_cupon_automatico(uuid, numeric, jsonb, boolean) from public;
grant execute on function public.delivery_cupon_automatico(uuid, numeric, jsonb, boolean) to anon, authenticated;

-- Al crear el pedido: sin código escrito, se aplica el automático (mismo bloque de cupones de siempre, mismo libro).
do $$
declare d text; antes text := E'  IF coalesce(trim(p_cupon), \'\') <> \'\' THEN';
begin
  d := pg_get_functiondef('public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric, boolean)'::regprocedure);
  if strpos(d, 'delivery_cupon_automatico') > 0 then return; end if;
  if strpos(d, antes) = 0 then raise exception 'No se encontró el bloque de cupones en delivery_crear_pedido'; end if;
  d := replace(d, antes, E'  IF coalesce(trim(p_cupon), \'\') = \'\' THEN p_cupon := public.delivery_cupon_automatico(p_comercio, v_subtotal, p_items, v_retiro)->>\'codigo\'; END IF;\n' || antes);
  execute d;
end $$;
