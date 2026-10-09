-- Eliminar servicios y profesionales del módulo de reservas (antes no había forma de hacerlo).
-- Misma regla que las tiendas: sin turnos se borra; con turnos pasados se archiva (sale del panel y de la página de reservas,
-- el historial de turnos se conserva); con turnos por venir se bloquea y se explica por qué.
alter table public.servicios add column if not exists eliminado_at timestamptz;
alter table public.profesionales add column if not exists eliminado_at timestamptz;

create or replace function public.agenda_eliminar(p_tipo text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_comercio uuid; v_nombre text; v_futuros int; v_total int;
begin
  if p_tipo not in ('servicio', 'profesional') then raise exception 'Tipo inválido'; end if;
  if p_tipo = 'servicio' then select comercio_id, nombre into v_comercio, v_nombre from public.servicios where id = p_id for update;
  else select comercio_id, nombre into v_comercio, v_nombre from public.profesionales where id = p_id for update; end if;
  if v_comercio is null then raise exception 'No existe'; end if;
  if not public.delivery_permiso(v_comercio, 'ajustes') then raise exception 'No tenés permiso para modificar la agenda de este local'; end if;

  select count(*), count(*) filter (where estado in ('pendiente', 'confirmado') and inicio > now())
    into v_total, v_futuros from public.turnos
   where (p_tipo = 'servicio' and servicio_id = p_id) or (p_tipo = 'profesional' and profesional_id = p_id);
  if v_futuros > 0 then
    raise exception '% tiene % % por venir: reprogramalos o cancelalos primero.', v_nombre, v_futuros, case when v_futuros = 1 then 'turno' else 'turnos' end;
  end if;

  if v_total = 0 then
    if p_tipo = 'servicio' then delete from public.servicios where id = p_id; else delete from public.profesionales where id = p_id; end if;
    return jsonb_build_object('resultado', 'eliminado', 'nombre', v_nombre);
  end if;
  if p_tipo = 'servicio' then update public.servicios set activo = false, eliminado_at = now() where id = p_id;
  else
    update public.profesionales set activo = false, eliminado_at = now() where id = p_id;
    delete from public.profesional_servicios where profesional_id = p_id;
  end if;
  return jsonb_build_object('resultado', 'archivado', 'nombre', v_nombre);
end $$;
revoke all on function public.agenda_eliminar(text, uuid) from public, anon;
grant execute on function public.agenda_eliminar(text, uuid) to authenticated;
