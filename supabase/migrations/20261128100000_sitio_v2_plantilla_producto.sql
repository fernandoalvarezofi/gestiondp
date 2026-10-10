-- Mi tienda v2: plantilla de la ficha de producto (secciones debajo de la ficha en todos los productos), validada como cualquier sección.
create or replace function public.delivery_guardar_tienda_tema(p_comercio uuid, p_tema jsonb) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v jsonb := '{}'::jsonb; k text; val text; item text; sec jsonb := '[]'::jsonb; bloques jsonb := '[]'::jsonb; b jsonb; n int := 0; tiene_catalogo boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
  if not coalesce(public.delivery_permiso(p_comercio, 'ajustes'), false) then raise exception 'No tenés permiso para editar la tienda'; end if;
  if jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(p_tema::text) > 160000 then raise exception 'La tienda es demasiado grande'; end if;
  val := p_tema->>'plantilla';
  if val is not null then
    if val not in ('boutique','galeria','impacto','gourmet','atelier','urbano','mercado','estudio','taller') then raise exception 'Plantilla inválida'; end if;
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
  foreach k in array array['banner_url', 'favicon_url', 'og_imagen'] loop
    val := p_tema->>k;
    if val is not null and val <> '' then
      if val !~ '^https://' or length(val) > 600 then raise exception 'La imagen (%) tiene que ser una dirección https', k; end if;
      v := v || jsonb_build_object(k, val);
    end if;
  end loop;
  foreach k in array array['titulo','subtitulo','boton','anuncio','acerca','instagram','facebook','web','whatsapp','seo_titulo','seo_descripcion','pie','pixel_meta','ga4'] loop
    val := btrim(coalesce(p_tema->>k, ''));
    if val <> '' then
      if k = 'titulo' and length(val) > 80 then raise exception 'El título es muy largo'; end if;
      if k = 'boton' and length(val) > 24 then raise exception 'El texto del botón es muy largo'; end if;
      if k in ('subtitulo','anuncio') and length(val) > 160 then raise exception 'El texto de % es muy largo', k; end if;
      if k = 'acerca' and length(val) > 800 then raise exception 'La descripción es muy larga'; end if;
      if k = 'seo_titulo' and length(val) > 70 then raise exception 'El título para buscadores admite hasta 70 caracteres'; end if;
      if k = 'seo_descripcion' and length(val) > 170 then raise exception 'La descripción para buscadores admite hasta 170 caracteres'; end if;
      if k = 'pie' and length(val) > 300 then raise exception 'El texto del pie admite hasta 300 caracteres'; end if;
      if k = 'whatsapp' and val !~ '^[0-9]{8,15}$' then raise exception 'El WhatsApp va solo con números (con código de país)'; end if;
      if k in ('instagram','facebook') and val !~ '^[A-Za-z0-9._-]{1,60}$' then raise exception 'Usuario de % inválido', k; end if;
      if k = 'web' and (val !~ '^https://' or length(val) > 200) then raise exception 'La web debe empezar con https://'; end if;
      if k = 'pixel_meta' and val !~ '^[0-9]{8,20}$' then raise exception 'El ID del píxel de Meta son solo números'; end if;
      if k = 'ga4' and val !~ '^G-[A-Z0-9]{4,14}$' then raise exception 'El ID de Google Analytics empieza con G-'; end if;
      v := v || jsonb_build_object(k, val);
    end if;
  end loop;
  foreach k in array array['mostrar_opiniones', 'indexar', 'mostrar_busqueda', 'pie_auto'] loop
    if (p_tema->>k) in ('true','false') then v := v || jsonb_build_object(k, (p_tema->>k)::boolean); end if;
  end loop;
  val := p_tema->>'catalogo_orden';
  if val is not null then
    if val not in ('relevancia','recientes','precio_asc','precio_desc','nombre') then raise exception 'Orden del catálogo inválido'; end if;
    v := v || jsonb_build_object('catalogo_orden', val);
  end if;
  if p_tema ? 'menu' then v := v || jsonb_build_object('menu', public._ts_menu(p_tema->'menu')); end if;
  if p_tema ? 'pie_columnas' then v := v || jsonb_build_object('pie_columnas', public._ts_pie(p_tema->'pie_columnas')); end if;
  if jsonb_typeof(p_tema->'cabecera') = 'object' then
    v := v || jsonb_build_object('cabecera', jsonb_build_object(
      'fija', coalesce(case when jsonb_typeof(p_tema->'cabecera'->'fija') = 'boolean' then (p_tema->'cabecera'->>'fija')::boolean end, true),
      'transparente', coalesce(case when jsonb_typeof(p_tema->'cabecera'->'transparente') = 'boolean' then (p_tema->'cabecera'->>'transparente')::boolean end, false)));
  end if;
  if p_tema ? 'secciones' then
    if jsonb_typeof(p_tema->'secciones') is distinct from 'array' or jsonb_array_length(p_tema->'secciones') > 8 then raise exception 'Secciones inválidas'; end if;
    for item in select jsonb_array_elements_text(p_tema->'secciones') loop
      if item not in ('categorias','destacados','catalogo','acerca','opiniones','contacto') then raise exception 'Sección inválida'; end if;
      if not sec ? item then sec := sec || to_jsonb(item); end if;
    end loop;
    if not sec ? 'catalogo' then sec := sec || to_jsonb('catalogo'::text); end if;
    v := v || jsonb_build_object('secciones', sec);
  end if;
  if p_tema ? 'diseno' then
    if jsonb_typeof(p_tema->'diseno') is distinct from 'object' then raise exception 'Diseño inválido'; end if;
    v := v || jsonb_build_object('diseno', public._ts_diseno(p_tema->'diseno'));
  end if;
  if p_tema ? 'bloques' then
    if jsonb_typeof(p_tema->'bloques') is distinct from 'array' or jsonb_array_length(p_tema->'bloques') > 40 then raise exception 'Demasiadas secciones (máximo 40)'; end if;
    for b in select jsonb_array_elements(p_tema->'bloques') loop
      n := n + 1;
      b := public._ts_bloque(b, n);
      if b is not null then
        bloques := bloques || jsonb_build_array(b);
        if b->>'tipo' = 'catalogo' then tiene_catalogo := true; end if;
      end if;
    end loop;
    if not tiene_catalogo then bloques := bloques || jsonb_build_array(public._ts_bloque('{"tipo":"catalogo","id":"catalogo"}'::jsonb, n + 1)); end if;
    v := v || jsonb_build_object('bloques', bloques);
  end if;
  -- Plantilla de la ficha de producto: hasta 12 secciones, sin catálogo.
  if p_tema ? 'producto_bloques' then
    if jsonb_typeof(p_tema->'producto_bloques') is distinct from 'array' or jsonb_array_length(p_tema->'producto_bloques') > 12 then raise exception 'La ficha de producto admite hasta 12 secciones'; end if;
    bloques := '[]'::jsonb; n := 0;
    for b in select jsonb_array_elements(p_tema->'producto_bloques') loop
      n := n + 1; b := public._ts_bloque(b, n);
      if b is not null and b->>'tipo' <> 'catalogo' then bloques := bloques || jsonb_build_array(b); end if;
    end loop;
    v := v || jsonb_build_object('producto_bloques', bloques);
  end if;
  update public.delivery_comercios set tienda_tema = v where id = p_comercio;
end $function$;
