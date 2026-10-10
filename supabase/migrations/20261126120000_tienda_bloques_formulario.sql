-- Constructor de tienda: bloques nuevos (testimonios, llamado a la acción, columnas, horarios y mapa, formulario)
-- y consultas desde la tienda que entran al CRM del local.

-- 1) Validación de bloques: la función existente pasa a ser la base y la nueva atiende los tipos nuevos.
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_ts_bloque_v1' and pronamespace = 'public'::regnamespace) then
    alter function public._ts_bloque(jsonb, integer) rename to _ts_bloque_v1;
  end if;
end $$;

create or replace function public._ts_bloque(b jsonb, idx integer)
returns jsonb language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare
  t text := case when jsonb_typeof(b -> 'tipo') = 'string' then b ->> 'tipo' end;
  bid text := case when jsonb_typeof(b -> 'id') = 'string' and (b ->> 'id') ~ '^[a-z0-9-]{1,16}$' then b ->> 'id' else 'b' || idx end;
  vis boolean := coalesce(case when jsonb_typeof(b -> 'visible') = 'boolean' then (b ->> 'visible')::boolean end, true);
  base jsonb; items jsonb;
  lista jsonb := case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end;
begin
  if jsonb_typeof(b) is distinct from 'object' or t is null then return null; end if;
  if t not in ('testimonios', 'cta', 'columnas', 'ubicacion', 'formulario') then return public._ts_bloque_v1(b, idx); end if;
  base := jsonb_build_object('id', bid, 'tipo', t, 'visible', vis);
  case t
    when 'testimonios' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('nombre', e.n, 'texto', e.x, 'detalle', e.d, 'foto_url', e.f))), '[]'::jsonb) into items
        from (select public._ts_txt(el, 'nombre', 60) n, public._ts_txt(el, 'texto', 300) x, public._ts_txt(el, 'detalle', 60) d, public._ts_url(el, 'foto_url', 600) f
                from jsonb_array_elements(lista) el limit 6) e where e.n is not null and e.x is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b, 'titulo', 80), 'estilo', public._ts_enum(b, 'estilo', array['tarjetas', 'destacado'], 'tarjetas'))) || jsonb_build_object('items', items);
    when 'cta' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b, 'titulo', 80), 'texto', public._ts_txt(b, 'texto', 200), 'boton', public._ts_txt(b, 'boton', 24),
        'enlace_tipo', public._ts_enum(b, 'enlace_tipo', array['catalogo', 'whatsapp', 'url', 'reservar'], 'catalogo'), 'enlace_url', public._ts_url(b, 'enlace_url', 300),
        'fondo', public._ts_enum(b, 'fondo', array['color', 'oscuro', 'suave'], 'color')));
    when 'columnas' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('titulo', e.t, 'texto', e.x, 'imagen_url', e.i, 'boton', e.bt, 'enlace_url', e.u))), '[]'::jsonb) into items
        from (select public._ts_txt(el, 'titulo', 60) t, public._ts_txt(el, 'texto', 300) x, public._ts_url(el, 'imagen_url', 600) i, public._ts_txt(el, 'boton', 24) bt, public._ts_url(el, 'enlace_url', 300) u
                from jsonb_array_elements(lista) el limit 4) e where e.t is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b, 'titulo', 80))) || jsonb_build_object('items', items);
    when 'ubicacion' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b, 'titulo', 80))) || jsonb_build_object('mapa', coalesce(case when jsonb_typeof(b -> 'mapa') = 'boolean' then (b ->> 'mapa')::boolean end, true));
    when 'formulario' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b, 'titulo', 80), 'texto', public._ts_txt(b, 'texto', 200), 'boton', public._ts_txt(b, 'boton', 24)))
        || jsonb_build_object('pedir_telefono', coalesce(case when jsonb_typeof(b -> 'pedir_telefono') = 'boolean' then (b ->> 'pedir_telefono')::boolean end, true));
  end case;
  return null;
end $$;

-- 2) Consulta desde la tienda: crea (o reutiliza) el cliente en el CRM del local con una tarea para responder y avisa al equipo.
--    Solo si la tienda publicó un formulario; límites: 3 por persona por día y 40 por local por hora.
create or replace function public.tienda_consulta_enviar(p_comercio uuid, p_nombre text, p_email text, p_telefono text, p_mensaje text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, '')); v_mail text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+() -]', '', 'g'), ''); v_msg text := btrim(coalesce(p_mensaje, ''));
  v_contacto uuid; c public.delivery_comercios;
begin
  select * into c from public.delivery_comercios where id = p_comercio and activo and aprobado and eliminado_at is null;
  if c.id is null then raise exception 'Tienda no encontrada'; end if;
  if not (coalesce(c.tienda_tema -> 'bloques', '[]'::jsonb) @> '[{"tipo":"formulario"}]'
          or exists (select 1 from public.delivery_tienda_paginas where comercio_id = c.id and estado = 'publicada' and bloques @> '[{"tipo":"formulario"}]')) then
    raise exception 'Esta tienda no recibe consultas por formulario';
  end if;
  if char_length(v_nombre) not between 2 and 80 then raise exception 'Escribí tu nombre'; end if;
  if v_mail is null or char_length(v_mail) > 160 or v_mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email'; end if;
  if v_tel is not null and char_length(regexp_replace(v_tel, '\D', '', 'g')) not between 8 and 15 then raise exception 'Revisá el teléfono'; end if;
  if char_length(v_msg) not between 5 and 2000 then raise exception 'Escribí tu consulta (entre 5 y 2000 caracteres)'; end if;
  if (select count(*) from public.crm_actividades where comercio_id = c.id and titulo = 'Consulta desde la tienda' and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Recibimos muchas consultas. Probá de nuevo en un rato';
  end if;
  v_contacto := public.crm_asegurar_contacto(c.id, auth.uid(), v_nombre, v_tel, v_mail, 'tienda');
  if (select count(*) from public.crm_actividades where contacto_id = v_contacto and titulo = 'Consulta desde la tienda' and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya nos enviaste varias consultas hoy. Te vamos a responder pronto';
  end if;
  insert into public.crm_actividades (comercio_id, contacto_id, tipo, titulo, detalle, vence_at)
    values (c.id, v_contacto, 'tarea', 'Consulta desde la tienda', left(v_msg, 2000) || E'\n\nResponder a: ' || v_mail || coalesce(' · ' || v_tel, ''), now() + interval '1 day');
  perform public.notificar_local(c.id, 'estadisticas', 'mensajes', 'CONSULTA_TIENDA', 'Nueva consulta desde tu tienda', v_nombre || ': ' || left(v_msg, 120),
    '/app/comercio/clientes/' || v_contacto, 'consulta-' || v_contacto || '-' || extract(epoch from now())::bigint, true);
end $$;

revoke all on function public.tienda_consulta_enviar(uuid, text, text, text, text) from public;
grant execute on function public.tienda_consulta_enviar(uuid, text, text, text, text) to anon, authenticated;
