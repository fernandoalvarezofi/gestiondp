-- FASE 9: guardar la agenda semanal y los servicios de un profesional en UN solo paso (todo o nada), validando que los tramos no se pisen.
-- Revertir: drop function profesional_agenda_guardar, profesional_servicios_guardar.
create or replace function public.profesional_agenda_guardar(p_profesional uuid, p_tramos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_com uuid; t jsonb; a jsonb; v_n integer;
begin
  select comercio_id into v_com from public.profesionales where id = p_profesional;
  if v_com is null or not public.delivery_permiso(v_com, 'ajustes') then raise exception 'Profesional no encontrado'; end if;
  if jsonb_typeof(p_tramos) <> 'array' or jsonb_array_length(p_tramos) > 70 then raise exception 'La agenda no es válida (hasta 70 tramos)'; end if;
  for t in select * from jsonb_array_elements(p_tramos) loop
    if jsonb_typeof(t) <> 'object' or (t->>'dia_semana') !~ '^[0-6]$' or (t->>'desde') !~ '^[0-2][0-9]:[0-5][0-9]' or (t->>'hasta') !~ '^[0-2][0-9]:[0-5][0-9]' then raise exception 'Hay un tramo con formato inválido'; end if;
    if (t->>'desde')::time >= (t->>'hasta')::time then raise exception 'En cada tramo la hora de inicio tiene que ser anterior a la de fin'; end if;
  end loop;
  -- Sin tramos que se pisen en un mismo día.
  for a in select * from jsonb_array_elements(p_tramos) loop
    select count(*) into v_n from jsonb_array_elements(p_tramos) b2
     where (b2->>'dia_semana') = (a->>'dia_semana') and (b2->>'desde')::time < (a->>'hasta')::time and (b2->>'hasta')::time > (a->>'desde')::time;
    if v_n > 1 then raise exception 'Hay horarios que se pisan en el mismo día'; end if;
  end loop;
  delete from public.disponibilidad where profesional_id = p_profesional;
  insert into public.disponibilidad (profesional_id, dia_semana, desde, hasta)
    select p_profesional, (x->>'dia_semana')::smallint, (x->>'desde')::time, (x->>'hasta')::time from jsonb_array_elements(p_tramos) x;
end $$;

create or replace function public.profesional_servicios_guardar(p_profesional uuid, p_servicios uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_com uuid;
begin
  select comercio_id into v_com from public.profesionales where id = p_profesional;
  if v_com is null or not public.delivery_permiso(v_com, 'ajustes') then raise exception 'Profesional no encontrado'; end if;
  if exists (select 1 from unnest(coalesce(p_servicios, '{}')) s where not exists (select 1 from public.servicios sv where sv.id = s and sv.comercio_id = v_com)) then raise exception 'Hay servicios que no son de este local'; end if;
  delete from public.profesional_servicios where profesional_id = p_profesional;
  insert into public.profesional_servicios (profesional_id, servicio_id) select distinct p_profesional, s from unnest(coalesce(p_servicios, '{}')) s;
end $$;

revoke all on function public.profesional_agenda_guardar(uuid, jsonb), public.profesional_servicios_guardar(uuid, uuid[]) from public, anon;
grant execute on function public.profesional_agenda_guardar(uuid, jsonb), public.profesional_servicios_guardar(uuid, uuid[]) to authenticated;
