-- Guardar el tema de la tienda con bloques y diseño global validados (reemplaza la versión anterior).
create or replace function public.delivery_guardar_tienda_tema(p_comercio uuid, p_tema jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  k text;
  val text;
  item text;
  sec jsonb := '[]'::jsonb;
  bloques jsonb := '[]'::jsonb;
  b jsonb;
  n int := 0;
  tiene_catalogo boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
  if not coalesce(public.delivery_permiso(p_comercio, 'ajustes'), false) then
    raise exception 'No tenés permiso para editar la tienda';
  end if;
  if jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(p_tema::text) > 60000 then raise exception 'La tienda es demasiado grande'; end if;

  val := p_tema->>'plantilla';
  if val is not null then
    if val not in ('boutique','galeria','impacto','gourmet') then raise exception 'Plantilla inválida'; end if;
    v := v || jsonb_build_object('plantilla', val);
  end if;
  val := p_tema->>'color';
  if val is not null and val <> '' then
    if val !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Color inválido'; end if;
    v := v || jsonb_build_object('color', upper(val));
  end if;
  val := p_tema->>'tipografia';
  if val is not null then
    if val not in ('sans','serif') then raise exception 'Tipografía inválida'; end if;
    v := v || jsonb_build_object('tipografia', val);
  end if;
  val := p_tema->>'banner_url';
  if val is not null and val <> '' then
    if val !~ '^https://' or length(val) > 600 then raise exception 'La imagen de portada es inválida'; end if;
    v := v || jsonb_build_object('banner_url', val);
  end if;
  foreach k in array array['titulo','subtitulo','boton','anuncio','acerca','instagram','facebook','web','whatsapp'] loop
    val := btrim(coalesce(p_tema->>k, ''));
    if val <> '' then
      if k = 'titulo' and length(val) > 80 then raise exception 'El título es muy largo'; end if;
      if k = 'boton' and length(val) > 24 then raise exception 'El texto del botón es muy largo'; end if;
      if k in ('subtitulo','anuncio') and length(val) > 160 then raise exception 'El texto de % es muy largo', k; end if;
      if k = 'acerca' and length(val) > 800 then raise exception 'La descripción es muy larga'; end if;
      if k = 'whatsapp' and val !~ '^[0-9]{8,15}$' then raise exception 'El WhatsApp va solo con números (con código de país)'; end if;
      if k in ('instagram','facebook') and val !~ '^[A-Za-z0-9._-]{1,60}$' then raise exception 'Usuario de % inválido', k; end if;
      if k = 'web' and (val !~ '^https://' or length(val) > 200) then raise exception 'La web debe empezar con https://'; end if;
      v := v || jsonb_build_object(k, val);
    end if;
  end loop;
  if (p_tema->>'mostrar_opiniones') in ('true','false') then
    v := v || jsonb_build_object('mostrar_opiniones', (p_tema->>'mostrar_opiniones')::boolean);
  end if;

  if p_tema ? 'secciones' then
    if jsonb_typeof(p_tema->'secciones') is distinct from 'array' or jsonb_array_length(p_tema->'secciones') > 8 then
      raise exception 'Secciones inválidas';
    end if;
    for item in select jsonb_array_elements_text(p_tema->'secciones') loop
      if item not in ('categorias','destacados','catalogo','acerca','opiniones','contacto') then raise exception 'Sección inválida'; end if;
      if not sec ? item then sec := sec || to_jsonb(item); end if;
    end loop;
    if not sec ? 'catalogo' then sec := sec || to_jsonb('catalogo'::text); end if;
    v := v || jsonb_build_object('secciones', sec);
  end if;

  -- Diseño global
  if p_tema ? 'diseno' then
    if jsonb_typeof(p_tema->'diseno') is distinct from 'object' then raise exception 'Diseño inválido'; end if;
    v := v || jsonb_build_object('diseno', public._ts_diseno(p_tema->'diseno'));
  end if;

  -- Bloques de la página (máximo 24, el catálogo es obligatorio)
  if p_tema ? 'bloques' then
    if jsonb_typeof(p_tema->'bloques') is distinct from 'array' or jsonb_array_length(p_tema->'bloques') > 24 then
      raise exception 'Demasiados bloques (máximo 24)';
    end if;
    for b in select jsonb_array_elements(p_tema->'bloques') loop
      n := n + 1;
      b := public._ts_bloque(b, n);
      if b is not null then
        bloques := bloques || jsonb_build_array(b);
        if b->>'tipo' = 'catalogo' then tiene_catalogo := true; end if;
      end if;
    end loop;
    if not tiene_catalogo then
      bloques := bloques || jsonb_build_array(public._ts_bloque('{"tipo":"catalogo","id":"catalogo"}'::jsonb, n + 1));
    end if;
    v := v || jsonb_build_object('bloques', bloques);
  end if;

  update public.delivery_comercios set tienda_tema = v where id = p_comercio;
end;
$$;

revoke all on function public.delivery_guardar_tienda_tema(uuid, jsonb) from public, anon;
grant execute on function public.delivery_guardar_tienda_tema(uuid, jsonb) to authenticated;
revoke all on function public._ts_txt(jsonb, text, int), public._ts_url(jsonb, text, int), public._ts_enum(jsonb, text, text[], text), public._ts_int(jsonb, text, int, int, int), public._ts_color(jsonb, text), public._ts_bloque(jsonb, int), public._ts_diseno(jsonb) from public, anon, authenticated;
