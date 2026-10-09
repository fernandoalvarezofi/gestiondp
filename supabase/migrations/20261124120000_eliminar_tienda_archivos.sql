-- Al eliminar del todo una tienda, se informan las fotos del bucket "delivery" que eran suyas y ya no usa nadie más,
-- para que la app las borre con la API de Storage (la base no permite borrar archivos directamente).
-- Las sucursales comparten fotos con su tienda principal: solo se informan las que no aparecen en ningún otro comercio o producto.
-- En una baja no se borra nada (la tienda se puede restaurar).
create or replace function public._fotos_de(p_texto text)
returns setof text language sql immutable as $$
  select distinct m[1] from regexp_matches(coalesce(p_texto, ''), '/storage/v1/object/public/delivery/([^"''?\s\\{},\]\)]+)', 'g') as m
$$;

create or replace function public.delivery_eliminar_tienda(p_comercio uuid, p_confirmacion text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_res jsonb; v_c record; v_fotos text[]; v_libres text[];
begin
  perform 1 from public.delivery_comercios where id = p_comercio for update;
  v_res := public.delivery_tienda_eliminacion_resumen(p_comercio);
  select id, nombre, slug, eliminado_at into v_c from public.delivery_comercios where id = p_comercio;
  if v_c.eliminado_at is not null then raise exception 'La tienda ya está dada de baja'; end if;
  if lower(btrim(coalesce(p_confirmacion, ''))) <> lower(btrim(v_c.nombre)) then
    raise exception 'Escribí el nombre exacto de la tienda para confirmar';
  end if;
  if jsonb_array_length(v_res->'bloqueos') > 0 then raise exception '%', v_res->'bloqueos'->>0; end if;

  if v_res->>'modo' = 'eliminar' then
    select coalesce(array_agg(distinct f), '{}') into v_fotos from (
      select public._fotos_de(concat_ws(' ', c.imagen_url, c.logo_url, c.tienda_tema::text)) f from public.delivery_comercios c where c.id = p_comercio
      union all
      select public._fotos_de(concat_ws(' ', p.imagen_url, p.imagenes::text)) from public.delivery_productos p where p.comercio_id = p_comercio
      union all
      select public._fotos_de(s.imagen_url) from public.servicios s where s.comercio_id = p_comercio
    ) x where f is not null;
    delete from public.delivery_comercios where id = p_comercio;
    -- Solo las que ya no usa ningún otro comercio, producto o servicio.
    select coalesce(array_agg(f), '{}') into v_libres from unnest(v_fotos) f
     where not exists (select 1 from public.delivery_comercios c where concat_ws(' ', c.imagen_url, c.logo_url, c.tienda_tema::text) like '%' || f || '%')
       and not exists (select 1 from public.delivery_productos p where concat_ws(' ', p.imagen_url, p.imagenes::text) like '%' || f || '%')
       and not exists (select 1 from public.servicios s where s.imagen_url like '%' || f || '%');
    return jsonb_build_object('resultado', 'eliminada', 'nombre', v_c.nombre, 'archivos', to_jsonb(v_libres));
  end if;

  update public.delivery_productos set estado = 'archivado' where comercio_id = p_comercio and estado <> 'archivado';
  update public.delivery_comercios
     set eliminado_at = now(), eliminado_por = auth.uid(), activo = false, esta_abierto = false, destacado = false,
         slug_anterior = slug, slug = left(slug, 60) || '-baja-' || substr(replace(id::text, '-', ''), 1, 8)
   where id = p_comercio;
  return jsonb_build_object('resultado', 'baja', 'nombre', v_c.nombre, 'archivos', '[]'::jsonb);
end $$;
revoke all on function public.delivery_eliminar_tienda(uuid, text) from public, anon;
grant execute on function public.delivery_eliminar_tienda(uuid, text) to authenticated;
