-- Agenda conectada al CRM y lista de espera visible para el local.

-- 1) Turno desde el panel para un contacto del CRM (con o sin cuenta). Antes solo se podía elegir a alguien con cuenta
--    o escribir nombre y teléfono (y se generaban fichas duplicadas). p_contacto es opcional y va al final.
drop function if exists public.turno_crear_panel(uuid, uuid, timestamptz, uuid, text, text, text, integer, text);
create or replace function public.turno_crear_panel(
  p_servicio uuid, p_profesional uuid, p_inicio timestamptz, p_cliente uuid default null, p_cliente_nombre text default null,
  p_telefono text default null, p_notas text default null, p_personas integer default 1, p_nota_interna text default null, p_contacto uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  s public.servicios; v_id uuid; v_motivo text; v_personas integer := coalesce(p_personas, 1); ct public.crm_contactos;
  v_cliente uuid := p_cliente;
  v_nombre text := nullif(btrim(coalesce(p_cliente_nombre, '')), ''); v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g'), '');
begin
  select * into s from public.servicios where id = p_servicio;
  if not found or not public.delivery_permiso(s.comercio_id, 'pedidos') then raise exception 'Servicio no encontrado'; end if;
  if p_contacto is not null then
    select * into ct from public.crm_contactos where id = p_contacto and comercio_id = s.comercio_id and fusionado_en is null;
    if ct.id is null then raise exception 'Ese cliente no es de este local'; end if;
    v_cliente := ct.cliente_id;
    v_nombre := case when ct.cliente_id is null then left(ct.nombre, 80) end;
    v_tel := coalesce(v_tel, nullif(regexp_replace(coalesce(ct.telefono, ''), '[^0-9+() -]', '', 'g'), ''));
  end if;
  if v_cliente is null and v_nombre is null then raise exception 'Indicá el nombre de la persona'; end if;
  if v_nombre is not null and char_length(v_nombre) not between 2 and 80 then raise exception 'El nombre tiene que tener entre 2 y 80 letras'; end if;
  if v_tel is not null and char_length(regexp_replace(v_tel, '\D', '', 'g')) < 8 then raise exception 'El teléfono no es válido'; end if;
  if char_length(coalesce(p_notas, '')) > 300 or char_length(coalesce(p_nota_interna, '')) > 1000 then raise exception 'La nota es demasiado larga'; end if;
  if p_contacto is null and v_cliente is not null and not exists (select 1 from public.delivery_pedidos where comercio_id = s.comercio_id and cliente_id = v_cliente)
     and not exists (select 1 from public.turnos where comercio_id = s.comercio_id and cliente_id = v_cliente) then
    raise exception 'Esa persona todavía no es cliente del local. Cargala con nombre y teléfono';
  end if;
  perform public.turno_candado(p_profesional, s.id);
  v_motivo := public.turno_disponible(s.id, p_profesional, p_inicio, v_personas, null, true);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  begin
    insert into public.turnos (comercio_id, servicio_id, profesional_id, cliente_id, cliente_nombre, inicio, fin, precio, telefono, notas, nota_interna, personas, estado, confirmado_at, origen, creado_por, contacto_id)
      values (s.comercio_id, s.id, p_profesional, v_cliente, v_nombre, p_inicio, p_inicio + make_interval(mins => s.duracion_min), s.precio * v_personas, v_tel,
              nullif(btrim(coalesce(p_notas, '')), ''), nullif(btrim(coalesce(p_nota_interna, '')), ''), v_personas, 'confirmado', now(), 'panel', auth.uid(), p_contacto)
      returning id into v_id;
  exception when exclusion_violation then raise exception 'Ese horario ya fue tomado, o esa persona ya tiene otro turno a esa hora';
  end;
  return v_id;
end $function$;
revoke all on function public.turno_crear_panel(uuid, uuid, timestamptz, uuid, text, text, text, integer, text, uuid) from public, anon;
grant execute on function public.turno_crear_panel(uuid, uuid, timestamptz, uuid, text, text, text, integer, text, uuid) to authenticated;

-- 2) Lista de espera del local: quién espera qué día y servicio, y si ya se le avisó.
create or replace function public.agenda_lista_espera(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.delivery_permiso(p_comercio, 'pedidos') then raise exception 'No tenés permiso para ver la agenda de este local'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'fecha', e.fecha, 'servicio_id', e.servicio_id, 'servicio', s.nombre, 'profesional', pr.nombre, 'avisado_at', e.avisado_at, 'creado', e.created_at,
      'cliente_id', e.cliente_id, 'contacto_id', ct.id, 'cliente', coalesce(ct.nombre, nullif(btrim(pf.nombre), ''), 'Cliente'), 'telefono', ct.telefono)
      order by e.fecha, e.created_at)
    from public.turnos_espera e join public.servicios s on s.id = e.servicio_id left join public.profesionales pr on pr.id = e.profesional_id
    left join public.perfiles pf on pf.id = e.cliente_id
    left join public.crm_contactos ct on ct.comercio_id = e.comercio_id and ct.cliente_id = e.cliente_id and ct.fusionado_en is null
   where e.comercio_id = p_comercio and e.fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date), '[]'::jsonb);
end $$;

create or replace function public.agenda_espera_quitar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_comercio uuid;
begin
  select comercio_id into v_comercio from public.turnos_espera where id = p_id;
  if v_comercio is null or not public.delivery_permiso(v_comercio, 'pedidos') then raise exception 'No encontrado'; end if;
  delete from public.turnos_espera where id = p_id;
end $$;

revoke all on function public.agenda_lista_espera(uuid) from public, anon;
grant execute on function public.agenda_lista_espera(uuid) to authenticated;
revoke all on function public.agenda_espera_quitar(uuid) from public, anon;
grant execute on function public.agenda_espera_quitar(uuid) to authenticated;
