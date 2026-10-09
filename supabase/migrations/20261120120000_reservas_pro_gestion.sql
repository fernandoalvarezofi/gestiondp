-- RESERVAS PRO (3/4): ciclo de vida del turno, reprogramación, acciones masivas, ficha del cliente, agenda, métricas y lista de espera.
-- Transiciones válidas (las aplica el servidor, nunca la pantalla):
--   pendiente  -> confirmado | cancelado
--   confirmado -> en_curso (desde 15 min antes) | completado | ausente (una vez empezado) | cancelado
--   en_curso   -> completado | ausente
-- Revertir: drop function turno_cambiar_estado, turno_reprogramar, turno_masivo, turno_nota_interna, cliente_nota_guardar,
--   turno_cliente_ficha, turnos_metricas, turno_espera_unirse, turnos_pendientes_vencer; restaurar turno_cancelar, turno_cerrar,
--   mis_turnos y delivery_turnos_agenda(uuid,date,date,uuid) de 20261113100000.

create or replace function public.turno_cancelar(p_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.turnos; s public.servicios; v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 200);
begin
  select * into t from public.turnos where id = p_id for update;
  if not found then raise exception 'Turno no encontrado'; end if;
  select * into s from public.servicios where id = t.servicio_id;
  if t.cliente_id = auth.uid() then
    if t.estado not in ('pendiente', 'confirmado') then raise exception 'Este turno ya no se puede cancelar'; end if;
    if t.estado = 'confirmado' and t.inicio < now() + make_interval(hours => s.cancelar_hasta_horas) then raise exception 'Solo se puede cancelar hasta % hs antes. Comunicate con el local', s.cancelar_hasta_horas; end if;
    update public.turnos set estado = 'cancelado', cancelado_por = 'cliente', motivo_cancelacion = v_motivo, updated_at = now() where id = p_id;
  elsif public.delivery_permiso(t.comercio_id, 'pedidos') then
    if t.estado not in ('pendiente', 'confirmado') then raise exception 'Este turno ya no se puede cancelar'; end if;
    if t.fin < now() then raise exception 'Este turno ya terminó'; end if;
    update public.turnos set estado = 'cancelado', cancelado_por = 'comercio', motivo_cancelacion = v_motivo, updated_at = now() where id = p_id;
  else
    raise exception 'Turno no encontrado';
  end if;
end $$;

create or replace function public.turno_cambiar_estado(p_id uuid, p_estado text, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.turnos;
begin
  if p_estado not in ('confirmado', 'en_curso', 'completado', 'ausente', 'cancelado') then raise exception 'Estado inválido'; end if;
  select * into t from public.turnos where id = p_id for update;
  if not found or not public.delivery_permiso(t.comercio_id, 'pedidos') then raise exception 'Turno no encontrado'; end if;
  if p_estado = 'cancelado' then perform public.turno_cancelar(p_id, p_motivo); return; end if;
  if t.estado = p_estado then return; end if;
  if p_estado = 'confirmado' then
    if t.estado <> 'pendiente' then raise exception 'Solo se confirman turnos pendientes'; end if;
    if t.fin < now() then raise exception 'Este turno ya pasó'; end if;
    update public.turnos set estado = 'confirmado', confirmado_at = now(), updated_at = now() where id = p_id;
  elsif p_estado = 'en_curso' then
    if t.estado <> 'confirmado' then raise exception 'Solo se puede empezar un turno confirmado'; end if;
    if t.inicio > now() + interval '15 minutes' then raise exception 'El turno todavía no empezó'; end if;
    update public.turnos set estado = 'en_curso', updated_at = now() where id = p_id;
  else
    if t.estado not in ('confirmado', 'en_curso') then raise exception 'Este turno ya fue cerrado o cancelado'; end if;
    if t.inicio > now() then raise exception 'El turno todavía no empezó'; end if;
    update public.turnos set estado = p_estado, updated_at = now() where id = p_id;
  end if;
end $$;

-- Compatibilidad con la función anterior.
create or replace function public.turno_cerrar(p_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_estado not in ('completado', 'ausente') then raise exception 'Estado inválido'; end if;
  perform public.turno_cambiar_estado(p_id, p_estado);
end $$;

-- Reprogramar: el local en cualquier momento antes de que empiece; la persona según los ajustes del local y la política de cancelación.
create or replace function public.turno_reprogramar(p_id uuid, p_inicio timestamptz, p_profesional uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.turnos; s public.servicios; a public.agenda_ajustes; v_prof uuid; v_motivo text; v_es_local boolean; v_estado text;
begin
  select * into t from public.turnos where id = p_id for update;
  if not found then raise exception 'Turno no encontrado'; end if;
  v_es_local := public.delivery_permiso(t.comercio_id, 'pedidos');
  if not v_es_local and t.cliente_id is distinct from auth.uid() then raise exception 'Turno no encontrado'; end if;
  if t.estado not in ('pendiente', 'confirmado') then raise exception 'Este turno ya no se puede cambiar'; end if;
  select * into s from public.servicios where id = t.servicio_id;
  v_prof := coalesce(p_profesional, t.profesional_id);
  v_estado := t.estado;
  if v_es_local then
    if t.inicio < now() then raise exception 'El turno ya empezó'; end if;
  else
    a := public.agenda_ajuste(t.comercio_id);
    if not a.cliente_reprograma then raise exception 'Este local no permite reprogramar desde la app. Escribile o cancelá el turno'; end if;
    if t.reprogramaciones >= a.max_reprogramaciones then raise exception 'Ya cambiaste este turno % veces. Cancelalo y reservá otro', t.reprogramaciones; end if;
    if t.inicio < now() + make_interval(hours => s.cancelar_hasta_horas) then raise exception 'Solo se puede cambiar hasta % hs antes', s.cancelar_hasta_horas; end if;
    if s.requiere_confirmacion then v_estado := 'pendiente'; end if;
  end if;
  if p_inicio = t.inicio and v_prof = t.profesional_id then raise exception 'Elegí un horario distinto'; end if;
  perform public.turno_candado(v_prof, s.id);
  v_motivo := public.turno_disponible(s.id, v_prof, p_inicio, t.personas, t.id, v_es_local);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  begin
    update public.turnos set inicio = p_inicio, fin = p_inicio + make_interval(mins => s.duracion_min), profesional_id = v_prof, estado = v_estado,
           confirmado_at = case when v_estado = 'pendiente' then null else confirmado_at end, reprogramaciones = reprogramaciones + 1, updated_at = now()
     where id = p_id;
  exception when exclusion_violation then raise exception 'Ese horario ya fue tomado. Elegí otro';
  end;
end $$;

-- Acciones masivas sobre turnos del local (hasta 200). Devuelve cuántos se aplicaron y los errores de cada uno.
create or replace function public.turno_masivo(p_ids uuid[], p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ok integer := 0; v_err jsonb := '[]'::jsonb; v_estado text;
begin
  v_estado := case p_accion when 'confirmar' then 'confirmado' when 'cancelar' then 'cancelado' when 'completar' then 'completado' when 'ausente' then 'ausente' when 'empezar' then 'en_curso' end;
  if v_estado is null then raise exception 'Acción inválida'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then raise exception 'Elegí entre 1 y 200 turnos'; end if;
  foreach v_id in array p_ids loop
    begin
      perform public.turno_cambiar_estado(v_id, v_estado, p_motivo);
      v_ok := v_ok + 1;
    exception when others then v_err := v_err || jsonb_build_object('id', v_id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('aplicados', v_ok, 'errores', v_err);
end $$;

create or replace function public.turno_nota_interna(p_id uuid, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare v_com uuid;
begin
  select comercio_id into v_com from public.turnos where id = p_id;
  if v_com is null or not public.delivery_permiso(v_com, 'pedidos') then raise exception 'Turno no encontrado'; end if;
  if char_length(coalesce(p_nota, '')) > 1000 then raise exception 'La nota es demasiado larga (máximo 1000 caracteres)'; end if;
  update public.turnos set nota_interna = nullif(btrim(coalesce(p_nota, '')), ''), updated_at = now() where id = p_id;
end $$;

-- Nota del local sobre una persona: solo para clientes reales del local (con pedidos o turnos).
create or replace function public.cliente_nota_guardar(p_comercio uuid, p_cliente uuid, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso'; end if;
  if char_length(coalesce(p_nota, '')) > 2000 then raise exception 'La nota es demasiado larga (máximo 2000 caracteres)'; end if;
  if not exists (select 1 from public.turnos where comercio_id = p_comercio and cliente_id = p_cliente)
     and not exists (select 1 from public.delivery_pedidos where comercio_id = p_comercio and cliente_id = p_cliente) then raise exception 'Esa persona no es cliente del local'; end if;
  if nullif(btrim(coalesce(p_nota, '')), '') is null then
    delete from public.comercio_cliente_notas where comercio_id = p_comercio and cliente_id = p_cliente;
  else
    insert into public.comercio_cliente_notas (comercio_id, cliente_id, nota, actualizado_por, updated_at) values (p_comercio, p_cliente, btrim(p_nota), auth.uid(), now())
      on conflict (comercio_id, cliente_id) do update set nota = excluded.nota, actualizado_por = excluded.actualizado_por, updated_at = now();
  end if;
end $$;

-- Ficha del cliente para el local: datos de contacto, nota, números y últimos turnos en ESTE local. Sin cuenta: se agrupa por teléfono.
create or replace function public.turno_cliente_ficha(p_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.turnos; v_tel text; v_base jsonb;
begin
  select * into t from public.turnos where id = p_turno;
  if not found or not public.delivery_permiso(t.comercio_id, 'pedidos') then raise exception 'Turno no encontrado'; end if;
  v_tel := regexp_replace(coalesce(t.telefono, ''), '\D', '', 'g');
  with mios as (
    select x.* from public.turnos x where x.comercio_id = t.comercio_id
       and ((t.cliente_id is not null and x.cliente_id = t.cliente_id) or (t.cliente_id is null and x.cliente_id is null and v_tel <> '' and regexp_replace(coalesce(x.telefono, ''), '\D', '', 'g') = v_tel) or x.id = t.id)
  )
  select jsonb_build_object(
    'cliente_id', t.cliente_id,
    'nombre', coalesce((select nullif(btrim(pf.nombre), '') from public.perfiles pf where pf.id = t.cliente_id), t.cliente_nombre, 'Cliente'),
    'telefono', coalesce(t.telefono, (select pf.telefono from public.perfiles pf where pf.id = t.cliente_id)),
    'con_cuenta', t.cliente_id is not null,
    'nota', (select n.nota from public.comercio_cliente_notas n where n.comercio_id = t.comercio_id and n.cliente_id = t.cliente_id),
    'total', (select count(*) from mios),
    'completados', (select count(*) from mios where estado = 'completado'),
    'ausentes', (select count(*) from mios where estado = 'ausente'),
    'cancelados', (select count(*) from mios where estado = 'cancelado'),
    'gastado', (select coalesce(sum(precio), 0) from mios where estado = 'completado'),
    'pedidos', case when t.cliente_id is null then 0 else (select count(*) from public.delivery_pedidos p where p.comercio_id = t.comercio_id and p.cliente_id = t.cliente_id) end,
    'primera_visita', (select min(inicio) from mios),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'inicio', m.inicio, 'estado', m.estado, 'servicio', s.nombre, 'profesional', pr.nombre, 'precio', m.precio) order by m.inicio desc)
                          from (select * from mios order by inicio desc limit 20) m join public.servicios s on s.id = m.servicio_id join public.profesionales pr on pr.id = m.profesional_id), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('evento', e.evento, 'detalle', e.detalle, 'fecha', e.fecha, 'por', coalesce(nullif(split_part(coalesce(pa.nombre, ''), ' ', 1), ''), case when e.actor is null then 'Sistema' else 'Equipo' end)) order by e.fecha)
                          from public.turno_eventos e left join public.perfiles pa on pa.id = e.actor where e.turno_id = t.id), '[]'::jsonb)
  ) into v_base;
  return v_base;
end $$;

-- Agenda del local en un rango, con filtros. Incluye todo lo que necesita la vista de día, semana y mes.
drop function if exists public.delivery_turnos_agenda(uuid, date, date, uuid);
create or replace function public.delivery_turnos_agenda(p_comercio uuid, p_desde date, p_hasta date, p_profesional uuid default null, p_servicio uuid default null, p_estado text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver la agenda de este local'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'Rango de fechas inválido (hasta 62 días)'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'precio', t.precio, 'notas', t.notas, 'telefono', coalesce(t.telefono, pf.telefono),
           'servicio_id', t.servicio_id, 'servicio', s.nombre, 'color', s.color, 'profesional_id', t.profesional_id, 'profesional', p.nombre, 'recurso', r.nombre,
           'cliente_id', t.cliente_id, 'cliente', coalesce(nullif(btrim(pf.nombre), ''), t.cliente_nombre, 'Cliente'), 'personas', t.personas, 'origen', t.origen, 'grupal', t.grupal,
           'nota_interna', t.nota_interna, 'reprogramaciones', t.reprogramaciones, 'cancelado_por', t.cancelado_por, 'motivo_cancelacion', t.motivo_cancelacion,
           'puede_cerrar', t.estado in ('confirmado', 'en_curso') and t.inicio <= now(), 'puede_empezar', t.estado = 'confirmado' and t.inicio <= now() + interval '15 minutes')
           order by t.inicio, p.nombre)
      from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales p on p.id = t.profesional_id
      left join public.perfiles pf on pf.id = t.cliente_id left join public.recursos r on r.id = t.recurso_id
     where t.comercio_id = p_comercio and (t.inicio at time zone tz)::date between p_desde and p_hasta
       and (p_profesional is null or t.profesional_id = p_profesional) and (p_servicio is null or t.servicio_id = p_servicio)
       and (p_estado is null or t.estado = p_estado)), '[]'::jsonb);
end $$;

-- Mis turnos (cliente): incluye si puede cancelar o cambiar según las reglas del local.
create or replace function public.mis_turnos() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'precio', t.precio, 'notas', t.notas, 'personas', t.personas,
           'servicio_id', t.servicio_id, 'servicio', s.nombre, 'duracion_min', s.duracion_min, 'modalidad', s.modalidad, 'profesional_id', t.profesional_id, 'profesional', p.nombre,
           'comercio_id', c.id, 'comercio', c.nombre, 'comercio_slug', c.slug, 'direccion', c.direccion,
           'cancelar_hasta', t.inicio - make_interval(hours => s.cancelar_hasta_horas),
           'puede_cancelar', t.estado = 'pendiente' or (t.estado = 'confirmado' and t.inicio >= now() + make_interval(hours => s.cancelar_hasta_horas)),
           'puede_reprogramar', t.estado in ('pendiente', 'confirmado') and t.inicio >= now() + make_interval(hours => s.cancelar_hasta_horas)
                                and coalesce(a.cliente_reprograma, true) and t.reprogramaciones < coalesce(a.max_reprogramaciones, 2),
           'cancelado_por', t.cancelado_por, 'motivo_cancelacion', t.motivo_cancelacion) order by t.inicio desc), '[]'::jsonb)
    from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profesionales p on p.id = t.profesional_id join public.delivery_comercios c on c.id = t.comercio_id
    left join public.agenda_ajustes a on a.comercio_id = t.comercio_id
   where t.cliente_id = auth.uid() and t.inicio > now() - interval '90 days'
$$;

-- Métricas de la agenda en un rango (hasta 93 días): ocupación, cancelaciones, ausencias, por servicio, por profesional e ingresos.
create or replace function public.turnos_metricas(p_comercio uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 93 then raise exception 'Rango de fechas inválido (hasta 93 días)'; end if;
  return (
    with t as (
      select tu.*, (tu.inicio at time zone tz)::date as dia, extract(epoch from (tu.fin - tu.inicio)) / 60 as minutos
        from public.turnos tu where tu.comercio_id = p_comercio and (tu.inicio at time zone tz)::date between p_desde and p_hasta
    ),
    dias as (select d::date as dia from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
              where not exists (select 1 from public.agenda_cierres ci where ci.comercio_id = p_comercio and d::date between ci.desde and ci.hasta)),
    capacidad as (
      select p.id as profesional_id, coalesce(sum(extract(epoch from (dsp.hasta - dsp.desde)) / 60), 0) as minutos
        from public.profesionales p join dias on true join public.disponibilidad dsp on dsp.profesional_id = p.id and dsp.dia_semana = extract(dow from dias.dia)::int
       where p.comercio_id = p_comercio and p.activo group by p.id
    ),
    ocupado as (select profesional_id, sum(minutos) as minutos from t where estado in ('pendiente', 'confirmado', 'en_curso', 'completado') group by profesional_id)
    select jsonb_build_object(
      'total', (select count(*) from t),
      'por_estado', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from t group by estado) x), '{}'::jsonb),
      'ingresos', (select coalesce(sum(precio), 0) from t where estado = 'completado'),
      'ingresos_previstos', (select coalesce(sum(precio), 0) from t where estado in ('pendiente', 'confirmado', 'en_curso')),
      'perdido_ausencias', (select coalesce(sum(precio), 0) from t where estado = 'ausente'),
      'online', (select count(*) from t where origen = 'online'),
      'panel', (select count(*) from t where origen = 'panel'),
      'clientes_unicos', (select count(distinct coalesce(cliente_id::text, telefono, cliente_nombre)) from t where estado <> 'cancelado'),
      'minutos_ocupados', (select coalesce(sum(minutos), 0) from ocupado),
      'minutos_disponibles', (select coalesce(sum(minutos), 0) from capacidad),
      'por_servicio', coalesce((select jsonb_agg(x order by (x->>'turnos')::int desc) from (
          select jsonb_build_object('servicio', s.nombre, 'turnos', count(*), 'completados', count(*) filter (where t.estado = 'completado'),
                 'cancelados', count(*) filter (where t.estado = 'cancelado'), 'ausentes', count(*) filter (where t.estado = 'ausente'),
                 'ingresos', coalesce(sum(t.precio) filter (where t.estado = 'completado'), 0)) x
            from t join public.servicios s on s.id = t.servicio_id group by s.nombre) q), '[]'::jsonb),
      'por_profesional', coalesce((select jsonb_agg(x order by x->>'profesional') from (
          select jsonb_build_object('profesional', p.nombre, 'turnos', (select count(*) from t where t.profesional_id = p.id and t.estado <> 'cancelado'),
                 'minutos_ocupados', coalesce(o.minutos, 0), 'minutos_disponibles', coalesce(c.minutos, 0),
                 'ingresos', (select coalesce(sum(precio), 0) from t where t.profesional_id = p.id and t.estado = 'completado')) x
            from public.profesionales p left join capacidad c on c.profesional_id = p.id left join ocupado o on o.profesional_id = p.id
           where p.comercio_id = p_comercio and (p.activo or o.minutos is not null)) q), '[]'::jsonb),
      'por_dia_semana', coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'turnos', n) order by d) from (select extract(dow from dia)::int d, count(*) n from t where estado <> 'cancelado' group by 1) q), '[]'::jsonb),
      'por_hora', coalesce((select jsonb_agg(jsonb_build_object('hora', h, 'turnos', n) order by h) from (select extract(hour from inicio at time zone tz)::int h, count(*) n from t where estado <> 'cancelado' group by 1) q), '[]'::jsonb)
    ));
end $$;

-- Lista de espera: la persona pide que le avisen si se libera un horario de ese servicio en ese día.
create or replace function public.turno_espera_unirse(p_servicio uuid, p_fecha date, p_profesional uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.servicios; v_id uuid; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if auth.uid() is null then raise exception 'Ingresá para anotarte'; end if;
  select * into s from public.servicios where id = p_servicio and activo;
  if not found then raise exception 'Ese servicio no está disponible'; end if;
  if not (public.agenda_ajuste(s.comercio_id)).lista_espera then raise exception 'Este local no tiene lista de espera'; end if;
  if p_fecha is null or p_fecha < v_hoy or p_fecha > v_hoy + s.reserva_max_dias then raise exception 'Elegí una fecha válida'; end if;
  if p_profesional is not null and not exists (select 1 from public.profesional_servicios where profesional_id = p_profesional and servicio_id = s.id) then raise exception 'Ese profesional no hace este servicio'; end if;
  if (select count(*) from public.turnos_espera where cliente_id = auth.uid() and avisado_at is null and fecha >= v_hoy) >= 5 then raise exception 'Ya estás en 5 listas de espera'; end if;
  insert into public.turnos_espera (comercio_id, servicio_id, profesional_id, cliente_id, fecha) values (s.comercio_id, s.id, p_profesional, auth.uid(), p_fecha)
    on conflict (servicio_id, cliente_id, fecha) do update set avisado_at = null, profesional_id = excluded.profesional_id returning id into v_id;
  return v_id;
end $$;

-- Pendientes que nadie confirmó y ya empezaron: se cancelan solas (y se avisa a la persona).
create or replace function public.turnos_pendientes_vencer() returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.turnos set estado = 'cancelado', cancelado_por = 'comercio', motivo_cancelacion = 'El local no confirmó el turno a tiempo', updated_at = now()
   where estado = 'pendiente' and inicio < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.turno_cambiar_estado(uuid, text, text), public.turno_reprogramar(uuid, timestamptz, uuid), public.turno_masivo(uuid[], text, text),
  public.turno_nota_interna(uuid, text), public.cliente_nota_guardar(uuid, uuid, text), public.turno_cliente_ficha(uuid),
  public.delivery_turnos_agenda(uuid, date, date, uuid, uuid, text), public.turnos_metricas(uuid, date, date), public.turno_espera_unirse(uuid, date, uuid) from public, anon;
grant execute on function public.turno_cambiar_estado(uuid, text, text), public.turno_reprogramar(uuid, timestamptz, uuid), public.turno_masivo(uuid[], text, text),
  public.turno_nota_interna(uuid, text), public.cliente_nota_guardar(uuid, uuid, text), public.turno_cliente_ficha(uuid),
  public.delivery_turnos_agenda(uuid, date, date, uuid, uuid, text), public.turnos_metricas(uuid, date, date), public.turno_espera_unirse(uuid, date, uuid) to authenticated;
revoke all on function public.turnos_pendientes_vencer() from public, anon, authenticated;
grant execute on function public.turnos_pendientes_vencer() to service_role;
