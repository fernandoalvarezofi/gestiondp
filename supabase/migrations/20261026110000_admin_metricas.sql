-- Envía a la base de administración números AGREGADOS por día (sin datos personales) para el tablero del dueño.
-- Mismo canal firmado (HMAC) que la auditoría. Se recalculan los últimos 3 días en cada envío (idempotente).

create or replace function public.delivery_admin_metricas_enviar() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_secret text; v_ts text; v_sig text; v_body jsonb; v_rid bigint; v_metricas jsonb;
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select valor into v_url from public.app_config where clave = 'admin_ingest_url';
  select valor into v_secret from public.app_config where clave = 'admin_ingest_secret';
  if v_url is null or v_secret is null then return; end if;

  with dias as (select generate_series(v_hoy - 2, v_hoy, interval '1 day')::date as dia),
  ped as (
    select (p.created_at at time zone v_tz)::date as dia, p.estado, p.subtotal, p.tarifa_servicio, c.comision_pct
      from public.delivery_pedidos p join public.delivery_comercios c on c.id = p.comercio_id
     where p.created_at >= (v_hoy - 2)::timestamp at time zone v_tz
  ),
  filas as (
    select d.dia, 'pedidos' as clave, (select count(*) from ped where ped.dia = d.dia)::numeric as valor from dias d
    union all select d.dia, 'pedidos_entregados', (select count(*) from ped where ped.dia = d.dia and ped.estado = 'entregado')::numeric from dias d
    union all select d.dia, 'pedidos_cancelados', (select count(*) from ped where ped.dia = d.dia and ped.estado = 'cancelado')::numeric from dias d
    union all select d.dia, 'ventas', coalesce((select sum(subtotal) from ped where ped.dia = d.dia and ped.estado = 'entregado'), 0) from dias d
    union all select d.dia, 'ingresos_servicio', coalesce((select sum(tarifa_servicio) from ped where ped.dia = d.dia and ped.estado = 'entregado'), 0) from dias d
    union all select d.dia, 'comision', coalesce((select round(sum(subtotal * comision_pct / 100)) from ped where ped.dia = d.dia and ped.estado = 'entregado'), 0) from dias d
    union all select d.dia, 'usuarios_nuevos', (select count(*) from public.perfiles x where (x.created_at at time zone v_tz)::date = d.dia)::numeric from dias d
    union all select d.dia, 'comercios_nuevos', (select count(*) from public.delivery_comercios x where (x.created_at at time zone v_tz)::date = d.dia)::numeric from dias d
    union all select v_hoy, 'comercios_activos', (select count(*) from public.delivery_comercios where aprobado and activo)::numeric
    union all select v_hoy, 'comercios_pendientes', (select count(*) from public.delivery_comercios where not aprobado)::numeric
    union all select v_hoy, 'repartidores_activos', (select count(*) from public.delivery_repartidores where activo)::numeric
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'clave', clave, 'valor', valor)), '[]'::jsonb) into v_metricas from filas;

  v_body := jsonb_build_object('metricas', v_metricas);
  v_ts := (extract(epoch from now())::bigint)::text;
  v_sig := encode(extensions.hmac(v_ts || '.' || v_body::text, v_secret, 'sha256'), 'hex');
  select net.http_post(url := v_url, body := v_body, headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-ts', v_ts, 'x-woref-sig', v_sig)) into v_rid;
end $$;
revoke all on function public.delivery_admin_metricas_enviar() from public, anon, authenticated;

select cron.schedule('delivery-admin-metricas', '7 * * * *', 'select public.delivery_admin_metricas_enviar()');
