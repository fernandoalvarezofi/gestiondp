-- FASE 5 (Payments), paso 2: libro APARTE de movimientos de dinero del proveedor de pagos.
-- No toca delivery_libro ni las liquidaciones (ese libro es devengado al entregar; acá se registra lo que realmente entra y sale por Mercado Pago).
--   * pagos_libro: solo altas. Un asiento por (pago, tipo): cobro (+), reintegro (-), contracargo (-). Nunca cambia un saldo sin asiento.
--   * pago_libro_asentar(): lo llama pago_aplicar_notificacion cuando el estado del pago cambia de verdad (idempotente).
--   * delivery_admin_conciliacion_pagos(): compara el estado de cada pago con sus asientos y marca las diferencias.
-- Revertir: drop function delivery_admin_conciliacion_pagos, pago_libro_asentar; drop table pagos_libro; recrear pago_aplicar_notificacion desde 20261101100000.

create table if not exists public.pagos_libro (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  pago_id uuid not null references public.pagos (id) on delete restrict,
  pedido_id uuid not null,
  tipo text not null check (tipo in ('cobro', 'reintegro', 'contracargo')),
  monto numeric(12, 2) not null,
  moneda text not null default 'ARS',
  unique (pago_id, tipo),
  check ((tipo = 'cobro' and monto > 0) or (tipo <> 'cobro' and monto < 0))
);
create index if not exists pagos_libro_pedido_idx on public.pagos_libro (pedido_id);

create or replace function public.pagos_libro_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('woref.pagos_mantenimiento', true) = '1' then return old; end if;
  raise exception 'El libro de pagos no se puede modificar';
end $$;
drop trigger if exists pagos_libro_inmutable on public.pagos_libro;
create trigger pagos_libro_inmutable before update or delete on public.pagos_libro for each row execute function public.pagos_libro_inmutable();

alter table public.pagos_libro enable row level security;
revoke all on public.pagos_libro from anon, authenticated;
grant all on public.pagos_libro to service_role;

create or replace function public.pago_libro_asentar(p_pago uuid, p_pedido uuid, p_estado_nuevo text, p_monto numeric) returns void
language plpgsql security definer set search_path = public as $$
declare v_tipo text := case p_estado_nuevo when 'aprobado' then 'cobro' when 'reintegrado' then 'reintegro' when 'contracargo' then 'contracargo' end;
begin
  if v_tipo is null or coalesce(p_monto, 0) <= 0 then return; end if;
  -- Si el dinero ya salió por contracargo, un reintegro posterior no lo descuenta de nuevo.
  if v_tipo = 'reintegro' and exists (select 1 from public.pagos_libro where pago_id = p_pago and tipo = 'contracargo') then return; end if;
  insert into public.pagos_libro (pago_id, pedido_id, tipo, monto)
    values (p_pago, p_pedido, v_tipo, case when v_tipo = 'cobro' then p_monto else -p_monto end)
    on conflict (pago_id, tipo) do nothing;
end $$;
revoke all on function public.pago_libro_asentar(uuid, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.pago_libro_asentar(uuid, uuid, text, numeric) to service_role;

-- pago_aplicar_notificacion asienta el movimiento justo antes de responder (misma transacción: o queda todo o nada).
do $m$
declare v_def text; v_ancla text := E'  return jsonb_build_object(''aplicado'', true, ''estado'', v_nuevo);';
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pago_aplicar_notificacion';
  if v_def is null or position(v_ancla in v_def) = 0 then raise exception 'pago_aplicar_notificacion no tiene la forma esperada'; end if;
  if position('pago_libro_asentar' in v_def) > 0 then return; end if;
  v_def := replace(v_def, v_ancla, E'  perform public.pago_libro_asentar(v_pago.id, p_pedido, v_nuevo, case when v_nuevo = ''aprobado'' then coalesce(p_monto, v_pago.monto) else v_pago.monto end);\n' || v_ancla);
  execute v_def;
end $m$;

-- Conciliación: por cada pago, lo que debería haber en el libro según su estado frente a lo que hay.
create or replace function public.delivery_admin_conciliacion_pagos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  with s as (
    select p.id, p.referencia_id as pedido_id, p.estado, p.monto, coalesce(sum(l.monto), 0) as saldo,
           case p.estado when 'aprobado' then p.monto else 0 end as esperado
      from public.pagos p left join public.pagos_libro l on l.pago_id = p.id group by p.id)
  select jsonb_build_object(
    'cobrado', coalesce((select sum(monto) from public.pagos_libro where tipo = 'cobro'), 0),
    'reintegrado', coalesce(-(select sum(monto) from public.pagos_libro where tipo = 'reintegro'), 0),
    'contracargos', coalesce(-(select sum(monto) from public.pagos_libro where tipo = 'contracargo'), 0),
    'neto', coalesce((select sum(monto) from public.pagos_libro), 0),
    'diferencias', coalesce((select jsonb_agg(jsonb_build_object('pago_id', id, 'pedido_id', pedido_id, 'estado', estado, 'monto', monto, 'saldo', saldo, 'esperado', esperado))
                               from s where saldo <> esperado), '[]'::jsonb)) into v;
  return v;
end $$;
revoke all on function public.delivery_admin_conciliacion_pagos() from public, anon;
grant execute on function public.delivery_admin_conciliacion_pagos() to authenticated;
