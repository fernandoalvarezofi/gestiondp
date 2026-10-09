-- Los avisos de turnos al local abren directamente ese turno en el calendario (antes llevaban a la agenda general).
CREATE OR REPLACE FUNCTION public.notif_turno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.servicios; v_cuando text; v_nombre text; v_antes text; v_link text;
begin
  begin
    select * into s from public.servicios where id = new.servicio_id;
    v_cuando := to_char(new.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI');
    v_link := '/app/comercio/turnos/calendario?turno=' || new.id;
    select coalesce(nullif(split_part(coalesce(nombre, ''), ' ', 1), ''), 'Alguien') into v_nombre from public.perfiles where id = new.cliente_id;
    v_nombre := coalesce(v_nombre, new.cliente_nombre, 'Alguien');
    if tg_op = 'INSERT' then
      if new.origen = 'panel' then
        if new.cliente_id is not null then
          perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'Te agendaron un turno', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id, true);
        end if;
      elsif new.estado = 'pendiente' then
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_PENDIENTE', 'Solicitud enviada', s.nombre || ' · ' || v_cuando || '. Te avisamos cuando el local la confirme', '/app/turnos', 'turno-pend-' || new.id, true);
        perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_PENDIENTE', 'Turno para confirmar', v_nombre || ' pidió ' || s.nombre || ' · ' || v_cuando, v_link, 'turno-pend-' || new.id, true);
      else
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'Turno confirmado', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id, true);
        perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_NUEVO', 'Nuevo turno', v_nombre || ' reservó ' || s.nombre || ' · ' || v_cuando, v_link, 'turno-nuevo-' || new.id, true);
      end if;
    else
      if new.estado = 'confirmado' and old.estado = 'pendiente' and new.cliente_id is not null then
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'El local confirmó tu turno', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id || '-' || new.reprogramaciones, true);
      elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
        if new.cancelado_por = 'cliente' then
          perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_CANCELADO', 'Turno cancelado', v_nombre || ' canceló ' || s.nombre || ' · ' || v_cuando, v_link, 'turno-canc-' || new.id, true);
        elsif new.cliente_id is not null then
          perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CANCELADO', case when old.estado = 'pendiente' then 'El local no pudo tomar tu turno' else 'El local canceló tu turno' end,
            s.nombre || ' · ' || v_cuando || coalesce('. ' || new.motivo_cancelacion, ''), '/app/turnos', 'turno-canc-' || new.id, true);
        end if;
        perform public.turnos_avisar_espera(new.servicio_id, old.inicio);
      elsif new.inicio is distinct from old.inicio then
        v_antes := to_char(old.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI');
        if new.cliente_id is not null and new.cliente_id is distinct from auth.uid() then
          perform public.notificar(new.cliente_id, 'turnos', 'TURNO_REPROGRAMADO', 'Cambiaron el horario de tu turno', s.nombre || ': ahora ' || v_cuando || ' (antes ' || v_antes || ')', '/app/turnos', 'turno-repro-' || new.id || '-' || new.reprogramaciones, true);
        else
          perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_REPROGRAMADO', 'Turno reprogramado', v_nombre || ' cambió ' || s.nombre || ' al ' || v_cuando || ' (antes ' || v_antes || ')', v_link, 'turno-repro-' || new.id || '-' || new.reprogramaciones, true);
        end if;
        perform public.turnos_avisar_espera(new.servicio_id, old.inicio);
      end if;
    end if;
  exception when others then raise warning 'notif_turno % falló: %', new.id, sqlerrm;
  end;
  return null;
end $function$;
