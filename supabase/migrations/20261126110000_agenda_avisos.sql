-- Contadores de la agenda para el menú del panel y fecha de un turno para abrirlo desde un enlace.
-- La tabla turnos no se lee directo desde el navegador (solo por funciones con permiso), por eso van como RPC.
create or replace function public.agenda_avisos(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver la agenda de este local'; end if;
  return jsonb_build_object(
    'por_confirmar', (select count(*) from public.turnos where comercio_id = p_comercio and estado = 'pendiente' and inicio >= now()),
    'por_cerrar', (select count(*) from public.turnos where comercio_id = p_comercio and estado in ('confirmado', 'en_curso') and fin < now() and fin > now() - interval '7 days'));
end $$;

create or replace function public.agenda_turno_inicio(p_turno uuid)
returns timestamptz language plpgsql stable security definer set search_path to 'public' as $$
declare v_comercio uuid; v_inicio timestamptz;
begin
  select comercio_id, inicio into v_comercio, v_inicio from public.turnos where id = p_turno;
  if v_comercio is null or not public.delivery_permiso(v_comercio, 'pedidos') then return null; end if;
  return v_inicio;
end $$;

revoke all on function public.agenda_avisos(uuid) from public, anon;
grant execute on function public.agenda_avisos(uuid) to authenticated;
revoke all on function public.agenda_turno_inicio(uuid) from public, anon;
grant execute on function public.agenda_turno_inicio(uuid) to authenticated;
