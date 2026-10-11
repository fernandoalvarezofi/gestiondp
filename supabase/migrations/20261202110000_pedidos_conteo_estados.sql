-- Pedidos del panel: la búsqueda devuelve además cuántos pedidos hay en cada estado (para los filtros con contador).
-- El conteo respeta período y texto pero no el estado elegido, así cada filtro muestra su número real.
-- No destructiva: reemplaza la función con la misma firma y agrega una clave a la respuesta.
CREATE OR REPLACE FUNCTION public.delivery_comercio_pedidos_buscar(p_comercio uuid, p_desde date, p_hasta date, p_estado text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(lower(btrim(coalesce(p_q, ''))), '');
  v_ini timestamptz;
  v_fin timestamptz;
  v_res jsonb;
begin
  if p_comercio is null or not coalesce(public.delivery_permiso(p_comercio, 'pedidos'), false) then
    raise exception 'No tenés permiso para ver los pedidos de este local';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Elegí un rango de fechas válido'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El rango puede ser de hasta 400 días'; end if;
  if p_estado is not null and p_estado not in ('pendiente','confirmado','preparando','listo','en_camino','entregado','cancelado') then
    raise exception 'Estado inválido';
  end if;
  if v_q is not null then
    v_q := replace(replace(replace(ltrim(left(v_q, 60), '#'), '\', '\\'), '%', '\%'), '_', '\_');
  end if;
  v_ini := p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_fin := (p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  with todos as (
    select p.id, p.created_at, p.estado, p.total, p.subtotal
    from public.delivery_pedidos p
    left join public.perfiles c on c.id = p.cliente_id
    where p.comercio_id = p_comercio
      and p.created_at >= v_ini and p.created_at < v_fin
      and (v_q is null
           or p.id::text like v_q || '%'
           or lower(coalesce(c.nombre, '')) like '%' || v_q || '%'
           or regexp_replace(coalesce(p.telefono_contacto, ''), '\D', '', 'g') like '%' || nullif(regexp_replace(v_q, '\D', '', 'g'), '') || '%')
  ), base as (
    select * from todos where p_estado is null or estado::text = p_estado
  ), pagina as (
    select id, created_at from base order by created_at desc limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'entregados', (select count(*) from base where estado = 'entregado'),
    'cancelados', (select count(*) from base where estado = 'cancelado'),
    'ventas', (select coalesce(sum(subtotal), 0) from base where estado = 'entregado'),
    'por_estado', coalesce((select jsonb_object_agg(estado, n) from (select estado::text as estado, count(*) as n from todos group by estado) x), '{}'::jsonb),
    'ids', coalesce((select jsonb_agg(id order by created_at desc) from pagina), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $function$;
