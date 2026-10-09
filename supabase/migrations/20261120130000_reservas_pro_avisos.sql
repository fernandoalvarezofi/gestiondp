-- RESERVAS PRO (4/4): historial automático, avisos de cada cambio, lista de espera y recordatorios configurables.
-- Revertir: drop trigger turnos_evento; drop function turnos_evento, turnos_avisar_espera; restaurar notif_turno y turnos_recordatorios
--   de 20261116100000 (los pendientes vencidos se cancelan dentro de la tarea de recordatorios, cada 15 min).

create or replace function public.turnos_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.turno_eventos (turno_id, comercio_id, evento, detalle, actor) values (new.id, new.comercio_id, 'creado', jsonb_build_object('origen', new.origen, 'estado', new.estado, 'inicio', new.inicio), auth.uid());
  else
    if new.estado is distinct from old.estado then
      insert into public.turno_eventos (turno_id, comercio_id, evento, detalle, actor)
        values (new.id, new.comercio_id, new.estado, jsonb_strip_nulls(jsonb_build_object('de', old.estado, 'motivo', new.motivo_cancelacion, 'por', new.cancelado_por)), auth.uid());
    end if;
    if new.inicio is distinct from old.inicio or new.profesional_id is distinct from old.profesional_id then
      insert into public.turno_eventos (turno_id, comercio_id, evento, detalle, actor)
        values (new.id, new.comercio_id, 'reprogramado', jsonb_build_object('de', old.inicio, 'a', new.inicio, 'profesional_cambio', new.profesional_id is distinct from old.profesional_id), auth.uid());
    end if;
    if new.nota_interna is distinct from old.nota_interna then
      insert into public.turno_eventos (turno_id, comercio_id, evento, detalle, actor) values (new.id, new.comercio_id, 'nota', '{}'::jsonb, auth.uid());
    end if;
  end if;
  return null;
end $$;
drop trigger if exists turnos_evento on public.turnos;
create trigger turnos_evento after insert or update on public.turnos for each row execute function public.turnos_evento();

-- Se liberó un horario (cancelación o cambio): avisar a quienes esperan ese servicio ese día.
create or replace function public.turnos_avisar_espera(p_servicio uuid, p_inicio timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare e record; v_fecha date := (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date; v_slug text; v_serv text;
begin
  if p_inicio < now() then return; end if;
  select c.slug, s.nombre into v_slug, v_serv from public.servicios s join public.delivery_comercios c on c.id = s.comercio_id where s.id = p_servicio;
  for e in select id, cliente_id from public.turnos_espera where servicio_id = p_servicio and fecha = v_fecha and avisado_at is null for update skip locked loop
    perform public.notificar(e.cliente_id, 'turnos', 'TURNO_LIBERADO', 'Se liberó un horario', v_serv || ' · ' || to_char(p_inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI') || '. Reservalo antes que otro',
      '/t/' || v_slug || '/reservar?servicio=' || p_servicio::text || '&fecha=' || v_fecha::text, 'turno-libre-' || e.id || '-' || extract(epoch from p_inicio)::bigint, true);
    update public.turnos_espera set avisado_at = now() where id = e.id;
  end loop;
end $$;
revoke all on function public.turnos_avisar_espera(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.notif_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.servicios; v_cuando text; v_nombre text; v_antes text;
begin
  begin
    select * into s from public.servicios where id = new.servicio_id;
    v_cuando := to_char(new.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI');
    select coalesce(nullif(split_part(coalesce(nombre, ''), ' ', 1), ''), 'Alguien') into v_nombre from public.perfiles where id = new.cliente_id;
    v_nombre := coalesce(v_nombre, new.cliente_nombre, 'Alguien');
    if tg_op = 'INSERT' then
      if new.origen = 'panel' then
        if new.cliente_id is not null then
          perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'Te agendaron un turno', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id, true);
        end if;
      elsif new.estado = 'pendiente' then
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_PENDIENTE', 'Solicitud enviada', s.nombre || ' · ' || v_cuando || '. Te avisamos cuando el local la confirme', '/app/turnos', 'turno-pend-' || new.id, true);
        perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_PENDIENTE', 'Turno para confirmar', v_nombre || ' pidió ' || s.nombre || ' · ' || v_cuando, '/app/comercio/turnos', 'turno-pend-' || new.id, true);
      else
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'Turno confirmado', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id, true);
        perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_NUEVO', 'Nuevo turno', v_nombre || ' reservó ' || s.nombre || ' · ' || v_cuando, '/app/comercio/turnos', 'turno-nuevo-' || new.id, true);
      end if;
    else
      if new.estado = 'confirmado' and old.estado = 'pendiente' and new.cliente_id is not null then
        perform public.notificar(new.cliente_id, 'turnos', 'TURNO_CONFIRMADO', 'El local confirmó tu turno', s.nombre || ' · ' || v_cuando, '/app/turnos', 'turno-conf-' || new.id || '-' || new.reprogramaciones, true);
      elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
        if new.cancelado_por = 'cliente' then
          perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_CANCELADO', 'Turno cancelado', v_nombre || ' canceló ' || s.nombre || ' · ' || v_cuando, '/app/comercio/turnos', 'turno-canc-' || new.id, true);
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
          perform public.notificar_local(new.comercio_id, 'pedidos', 'turnos', 'TURNO_REPROGRAMADO', 'Turno reprogramado', v_nombre || ' cambió ' || s.nombre || ' al ' || v_cuando || ' (antes ' || v_antes || ')', '/app/comercio/turnos', 'turno-repro-' || new.id || '-' || new.reprogramaciones, true);
        end if;
        perform public.turnos_avisar_espera(new.servicio_id, old.inicio);
      end if;
    end if;
  exception when others then raise warning 'notif_turno % falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists notif_turno on public.turnos;
create trigger notif_turno after insert or update of estado, inicio, profesional_id on public.turnos for each row execute function public.notif_turno();

-- Recordatorios: solo turnos confirmados de personas con cuenta, y según lo que eligió el local.
create or replace function public.turnos_recordatorios() returns integer
language plpgsql security definer set search_path = public as $$
declare t record; v_n integer := 0; v_id bigint;
begin
  for t in select tu.id, tu.cliente_id, tu.inicio, s.nombre as servicio, c.nombre as comercio, coalesce(a.recordatorio_24h, true) as r24, coalesce(a.recordatorio_2h, true) as r2
             from public.turnos tu join public.servicios s on s.id = tu.servicio_id join public.delivery_comercios c on c.id = tu.comercio_id
             left join public.agenda_ajustes a on a.comercio_id = tu.comercio_id
            where tu.estado = 'confirmado' and tu.cliente_id is not null and tu.inicio > now() and tu.inicio <= now() + interval '24 hours' loop
    begin
      v_id := null;
      if t.inicio <= now() + interval '2 hours 15 minutes' then
        if t.r2 then v_id := public.notificar(t.cliente_id, 'turnos', 'TURNO_RECORDATORIO', 'Tu turno es en un rato', t.servicio || ' en ' || t.comercio || ' a las ' || to_char(t.inicio at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'), '/app/turnos', 'turno-rec2-' || t.id, true); end if;
      elsif t.r24 then
        v_id := public.notificar(t.cliente_id, 'turnos', 'TURNO_RECORDATORIO', 'Mañana tenés turno', t.servicio || ' en ' || t.comercio || ' · ' || to_char(t.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI'), '/app/turnos', 'turno-rec24-' || t.id, true);
      end if;
      if v_id is not null then v_n := v_n + 1; end if;
    exception when others then raise warning 'recordatorio % falló: %', t.id, sqlerrm;
    end;
  end loop;
  perform public.turnos_pendientes_vencer();
  return v_n;
end $$;
revoke all on function public.turnos_recordatorios() from public, anon, authenticated;
grant execute on function public.turnos_recordatorios() to service_role;
