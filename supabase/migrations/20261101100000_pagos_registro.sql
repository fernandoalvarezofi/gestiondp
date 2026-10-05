-- FASE 5 (Payments), paso 1: registro propio de cada cobro, con su historial, y máquina de estados del pago.
-- Hasta ahora el estado del cobro vivía solo dentro del pedido (pago_estado, pago_id). Acá se agrega, sin quitar nada:
--   * pagos: un registro por cada cobro del proveedor (hoy Mercado Pago), único por (proveedor, identificador);
--   * pagos_eventos: historial inmutable de TODO lo que llegó (aplicado, duplicado, monto distinto, firma inválida, cobro duplicado…);
--   * pago_aplicar_notificacion(): única puerta para cambiar un pago; valida monto, ordena los avisos (pueden llegar repetidos o desordenados)
--     y actualiza el pedido con las mismas reglas de siempre. Solo la ejecuta el servidor (service_role), nunca la app.
-- La contabilidad (libro, liquidaciones) NO se modifica en este paso.
-- Revertir: drop function pago_aplicar_notificacion, pago_registrar_incidente, pago_transicion_valida, delivery_admin_pagos; drop table pagos_eventos, pagos.

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  referencia_tipo text not null default 'pedido' check (referencia_tipo in ('pedido')),
  referencia_id uuid not null,
  proveedor text not null check (proveedor in ('mercadopago')),
  external_id text not null check (length(external_id) between 1 and 64),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'reintegrado', 'contracargo')),
  monto numeric(12, 2) not null default 0 check (monto >= 0),
  moneda text not null default 'ARS',
  preferencia_id text,
  detalle_estado text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  unique (proveedor, external_id)
);
create index if not exists pagos_referencia_idx on public.pagos (referencia_tipo, referencia_id);
create index if not exists pagos_actualizado_idx on public.pagos (actualizado_at desc);

create table if not exists public.pagos_eventos (
  id bigint generated always as identity primary key,
  pago_id uuid references public.pagos (id) on delete set null,
  proveedor text not null,
  external_id text,
  tipo text not null check (tipo in ('aplicado', 'duplicado', 'transicion_ignorada', 'monto_distinto', 'estado_desconocido', 'pedido_inexistente', 'pedido_distinto', 'cobro_duplicado', 'firma_invalida', 'firma_ausente')),
  estado_anterior text,
  estado_nuevo text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pagos_eventos_pago_idx on public.pagos_eventos (pago_id, created_at desc);
create index if not exists pagos_eventos_tipo_idx on public.pagos_eventos (tipo, created_at desc);

-- Solo se agrega: el historial no se edita ni se borra.
create or replace function public.pagos_eventos_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('woref.pagos_mantenimiento', true) = '1' then return old; end if;
  raise exception 'El historial de pagos no se puede modificar';
end $$;
drop trigger if exists pagos_eventos_inmutable on public.pagos_eventos;
create trigger pagos_eventos_inmutable before update or delete on public.pagos_eventos for each row execute function public.pagos_eventos_inmutable();

alter table public.pagos enable row level security;
alter table public.pagos_eventos enable row level security;
revoke all on public.pagos, public.pagos_eventos from anon, authenticated;
grant all on public.pagos, public.pagos_eventos to service_role;

-- Máquina de estados del pago: lo que el proveedor puede hacer con un cobro, y nada más.
create or replace function public.pago_transicion_valida(p_desde text, p_hasta text) returns boolean
language sql immutable set search_path = public as $$
  select (p_desde, p_hasta) in (
    ('pendiente', 'aprobado'), ('pendiente', 'rechazado'),
    ('aprobado', 'reintegrado'), ('aprobado', 'contracargo'),
    ('contracargo', 'reintegrado'))
$$;

create or replace function public.pago_aplicar_notificacion(
  p_proveedor text, p_external_id text, p_pedido uuid, p_estado_proveedor text, p_monto numeric, p_detalle text default null, p_preferencia text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nuevo text; v_pedido public.delivery_pedidos; v_pago public.pagos; v_otros integer;
  v_detalle text := left(coalesce(p_detalle, ''), 120);
begin
  if p_proveedor is distinct from 'mercadopago' then raise exception 'Proveedor no soportado'; end if;
  if coalesce(p_external_id, '') = '' or length(p_external_id) > 64 then raise exception 'Identificador de pago inválido'; end if;
  v_nuevo := case p_estado_proveedor
    when 'approved' then 'aprobado' when 'authorized' then 'pendiente' when 'in_process' then 'pendiente' when 'pending' then 'pendiente'
    when 'rejected' then 'rechazado' when 'cancelled' then 'rechazado' when 'refunded' then 'reintegrado' when 'charged_back' then 'contracargo' end;
  if v_nuevo is null then
    insert into public.pagos_eventos (proveedor, external_id, tipo, detalle) values (p_proveedor, p_external_id, 'estado_desconocido', jsonb_build_object('estado_proveedor', left(coalesce(p_estado_proveedor, ''), 40)));
    return jsonb_build_object('aplicado', false, 'motivo', 'estado_desconocido');
  end if;

  select * into v_pedido from public.delivery_pedidos where id = p_pedido for update;
  if not found then
    insert into public.pagos_eventos (proveedor, external_id, tipo, detalle) values (p_proveedor, p_external_id, 'pedido_inexistente', jsonb_build_object('pedido', p_pedido));
    return jsonb_build_object('aplicado', false, 'motivo', 'pedido_inexistente');
  end if;

  insert into public.pagos (referencia_tipo, referencia_id, proveedor, external_id, estado, monto, preferencia_id, detalle_estado)
    values ('pedido', p_pedido, p_proveedor, p_external_id, 'pendiente', coalesce(p_monto, 0), p_preferencia, nullif(v_detalle, ''))
    on conflict (proveedor, external_id) do nothing;
  select * into v_pago from public.pagos where proveedor = p_proveedor and external_id = p_external_id for update;

  if v_pago.referencia_id <> p_pedido then
    insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, detalle) values (v_pago.id, p_proveedor, p_external_id, 'pedido_distinto', jsonb_build_object('pedido_recibido', p_pedido, 'pedido_registrado', v_pago.referencia_id));
    return jsonb_build_object('aplicado', false, 'motivo', 'pedido_distinto');
  end if;

  -- El monto cobrado tiene que coincidir con el total del pedido.
  if v_nuevo = 'aprobado' and abs(coalesce(p_monto, 0) - v_pedido.total) > 1 then
    insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, estado_anterior, estado_nuevo, detalle)
      values (v_pago.id, p_proveedor, p_external_id, 'monto_distinto', v_pago.estado, v_nuevo, jsonb_build_object('cobrado', p_monto, 'total_pedido', v_pedido.total));
    return jsonb_build_object('aplicado', false, 'motivo', 'monto_distinto');
  end if;

  if v_nuevo = v_pago.estado then
    insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, estado_anterior, estado_nuevo) values (v_pago.id, p_proveedor, p_external_id, 'duplicado', v_pago.estado, v_nuevo);
    return jsonb_build_object('aplicado', false, 'motivo', 'duplicado', 'estado', v_pago.estado);
  end if;
  if not public.pago_transicion_valida(v_pago.estado, v_nuevo) then
    insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, estado_anterior, estado_nuevo) values (v_pago.id, p_proveedor, p_external_id, 'transicion_ignorada', v_pago.estado, v_nuevo);
    return jsonb_build_object('aplicado', false, 'motivo', 'transicion_ignorada', 'estado', v_pago.estado);
  end if;

  update public.pagos set estado = v_nuevo, monto = case when v_nuevo = 'aprobado' then coalesce(p_monto, monto) else monto end,
         detalle_estado = coalesce(nullif(v_detalle, ''), detalle_estado), preferencia_id = coalesce(p_preferencia, preferencia_id), actualizado_at = now()
   where id = v_pago.id;

  -- Pedido: mismas reglas de siempre. Un reintegro pendiente solo lo cierra un reintegro o contracargo; un cobro aprobado sobre un pedido ya cancelado queda para reintegrar.
  if not (v_pedido.pago_estado = 'a_reintegrar' and v_nuevo not in ('reintegrado', 'contracargo')) then
    update public.delivery_pedidos set
        pago_estado = case when v_nuevo = 'aprobado' and v_pedido.estado = 'cancelado' then 'a_reintegrar' when v_nuevo = 'contracargo' then 'reintegrado' else v_nuevo end,
        pago_id = p_external_id
     where id = p_pedido;
  end if;

  insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, estado_anterior, estado_nuevo, detalle)
    values (v_pago.id, p_proveedor, p_external_id, 'aplicado', v_pago.estado, v_nuevo, jsonb_build_object('monto', p_monto));

  -- Dos cobros aprobados para el mismo pedido: el cliente pagó de más. Se avisa a administración (no se toca el pedido).
  if v_nuevo = 'aprobado' then
    select count(*) into v_otros from public.pagos where referencia_tipo = 'pedido' and referencia_id = p_pedido and estado = 'aprobado' and id <> v_pago.id;
    if v_otros > 0 then
      insert into public.pagos_eventos (pago_id, proveedor, external_id, tipo, detalle) values (v_pago.id, p_proveedor, p_external_id, 'cobro_duplicado', jsonb_build_object('otros_aprobados', v_otros));
    end if;
  end if;
  return jsonb_build_object('aplicado', true, 'estado', v_nuevo);
end $$;

-- Incidentes del canal de avisos (firma inválida o ausente). Con tope por hora para que nadie pueda llenar el historial.
create or replace function public.pago_registrar_incidente(p_proveedor text, p_external_id text, p_tipo text, p_detalle jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('firma_invalida', 'firma_ausente') then raise exception 'Tipo de incidente inválido'; end if;
  if (select count(*) from public.pagos_eventos where tipo in ('firma_invalida', 'firma_ausente') and created_at > now() - interval '1 hour') >= 200 then return; end if;
  insert into public.pagos_eventos (proveedor, external_id, tipo, detalle) values (left(coalesce(p_proveedor, 'mercadopago'), 30), left(p_external_id, 64), p_tipo, coalesce(p_detalle, '{}'::jsonb));
end $$;

revoke all on function public.pago_aplicar_notificacion(text, text, uuid, text, numeric, text, text), public.pago_registrar_incidente(text, text, text, jsonb), public.pago_transicion_valida(text, text) from public, anon, authenticated;
grant execute on function public.pago_aplicar_notificacion(text, text, uuid, text, numeric, text, text), public.pago_registrar_incidente(text, text, text, jsonb), public.pago_transicion_valida(text, text) to service_role;

-- Administración: cobros recientes con sus alertas (monto distinto, cobro duplicado, firma inválida…).
create or replace function public.delivery_admin_pagos(p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return jsonb_build_object(
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'pedido_id', x.referencia_id, 'proveedor', x.proveedor, 'external_id', x.external_id, 'estado', x.estado, 'monto', x.monto,
             'actualizado_at', x.actualizado_at, 'alertas', x.alertas) order by x.actualizado_at desc)
        from (select p.*, (select count(*) from public.pagos_eventos e where e.pago_id = p.id and e.tipo in ('monto_distinto', 'cobro_duplicado', 'pedido_distinto')) as alertas
                from public.pagos p order by p.actualizado_at desc limit least(greatest(p_limite, 1), 200)) x), '[]'::jsonb),
    'incidentes_24h', (select count(*) from public.pagos_eventos where tipo in ('firma_invalida', 'firma_ausente') and created_at > now() - interval '24 hours'));
end $$;
revoke all on function public.delivery_admin_pagos(integer) from public, anon;
grant execute on function public.delivery_admin_pagos(integer) to authenticated;

-- Clave secreta de las notificaciones (firma). Se guarda en el servidor y no se puede volver a leer.
create or replace function public.delivery_admin_guardar_mp_firma(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo un administrador puede configurar los pagos'; end if;
  if coalesce(trim(p_secret), '') = '' then delete from public.app_config where clave = 'mp_webhook_secret'; return; end if;
  if trim(p_secret) !~ '^[A-Za-z0-9_-]{16,200}$' then raise exception 'La clave secreta de notificaciones no es válida: son letras y números, de 16 caracteres o más'; end if;
  insert into public.app_config (clave, valor) values ('mp_webhook_secret', trim(p_secret)) on conflict (clave) do update set valor = excluded.valor, updated_at = now();
end $$;
revoke all on function public.delivery_admin_guardar_mp_firma(text) from public, anon;
grant execute on function public.delivery_admin_guardar_mp_firma(text) to authenticated;

create or replace function public.delivery_admin_estado_mp() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_token text; v_fecha timestamptz;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  select valor, updated_at into v_token, v_fecha from public.app_config where clave = 'mp_access_token';
  return jsonb_build_object(
    'configurado', v_token is not null,
    'modo', case when v_token like 'TEST-%' then 'prueba' when v_token is not null then 'produccion' end,
    'termina_en', case when v_token is not null then right(v_token, 4) end,
    'actualizado', v_fecha,
    'firma_configurada', exists (select 1 from public.app_config where clave = 'mp_webhook_secret'));
end $$;
