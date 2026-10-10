-- Mi tienda v2 (1/2): contrato común de secciones validado en el servidor.
-- Estilo de sección (`est`) para cualquier bloque, destinos y botones unificados, bloque "contenido",
-- opciones por dispositivo en productos y galería, nuevos tokens de diseño y encabezado/pie configurables.
-- Todo es aditivo: lo guardado antes sigue siendo válido.

-- 1) Estilo de sección ---------------------------------------------------------------------------------------------------
create or replace function public._ts_estilo(e jsonb) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare o jsonb := '{}'::jsonb; f text; t text;
begin
  if jsonb_typeof(e) is distinct from 'object' then return null; end if;
  f := case when jsonb_typeof(e -> 'fondo') = 'string' then e ->> 'fondo' end;
  if f = 'color' then
    t := public._ts_color(e, 'color');
    if t is not null then o := o || jsonb_build_object('fondo', 'color', 'color', t); end if;
  elsif f = 'imagen' then
    t := public._ts_url(e, 'imagen', 600);
    if t is not null and t ~ '^https://[^\s<>"\\]+$' then o := o || jsonb_build_object('fondo', 'imagen', 'imagen', t, 'capa', public._ts_int(e, 'capa', 0, 80, 40)); end if;
  elsif f in ('suave', 'superficie', 'acento', 'oscuro') then
    o := o || jsonb_build_object('fondo', f);
  end if;
  if jsonb_typeof(e -> 'arriba') = 'number' then o := o || jsonb_build_object('arriba', public._ts_int(e, 'arriba', 0, 6, 3)); end if;
  if jsonb_typeof(e -> 'abajo') = 'number' then o := o || jsonb_build_object('abajo', public._ts_int(e, 'abajo', 0, 6, 3)); end if;
  t := public._ts_enum(e, 'ancho', array['estrecho', 'normal', 'amplio', 'completo'], null); if t is not null then o := o || jsonb_build_object('ancho', t); end if;
  t := public._ts_enum(e, 'alinear', array['izquierda', 'centro'], null); if t is not null then o := o || jsonb_build_object('alinear', t); end if;
  t := public._ts_enum(e, 'ver', array['escritorio', 'movil'], null); if t is not null then o := o || jsonb_build_object('ver', t); end if;
  t := lower(coalesce(public._ts_txt(e, 'ancla', 40), '')); if t ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then o := o || jsonb_build_object('ancla', t); end if;
  t := public._ts_txt(e, 'nombre', 40); if t is not null then o := o || jsonb_build_object('nombre', t); end if;
  return case when o = '{}'::jsonb then null else o end;
end $$;

-- 2) Destinos y botones ----------------------------------------------------------------------------------------------------
create or replace function public._ts_destino(d jsonb) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare t text; v text;
begin
  if jsonb_typeof(d) is distinct from 'object' then return null; end if;
  t := public._ts_enum(d, 'tipo', array['catalogo', 'ofertas', 'categoria', 'coleccion', 'pagina', 'ancla', 'reservar', 'whatsapp', 'url', 'inicio'], null);
  if t is null then return null; end if;
  if t in ('catalogo', 'ofertas', 'reservar', 'whatsapp', 'inicio') then return jsonb_build_object('tipo', t); end if;
  if t = 'url' then
    v := public._ts_url(d, 'valor', 300);
    return case when v ~ '^https://[^\s<>"]+$' then jsonb_build_object('tipo', t, 'valor', v) end;
  end if;
  if t = 'categoria' then v := public._ts_txt(d, 'valor', 60); return case when v is not null then jsonb_build_object('tipo', t, 'valor', v) end; end if;
  v := lower(coalesce(public._ts_txt(d, 'valor', 70), ''));
  return case when v ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then jsonb_build_object('tipo', t, 'valor', v) end;
end $$;

create or replace function public._ts_botones(b jsonb, maximo integer default 2) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare el jsonb; o jsonb := '[]'::jsonb; t text; d jsonb;
begin
  if jsonb_typeof(b) is distinct from 'array' then return o; end if;
  for el in select * from jsonb_array_elements(b) limit maximo loop
    if jsonb_typeof(el) <> 'object' then continue; end if;
    t := public._ts_txt(el, 'texto', 30); d := public._ts_destino(el -> 'destino');
    if t is not null and d is not null then
      o := o || jsonb_build_array(jsonb_build_object('texto', t, 'destino', d, 'estilo', public._ts_enum(el, 'estilo', array['primario', 'secundario', 'enlace'], 'primario')));
    end if;
  end loop;
  return o;
end $$;

-- 3) Bloques: el validador anterior queda como base y este agrega lo común ---------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_ts_bloque_v2' and pronamespace = 'public'::regnamespace) then
    alter function public._ts_bloque(jsonb, integer) rename to _ts_bloque_v2;
  end if;
end $$;

create or replace function public._ts_bloque(b jsonb, idx integer) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare
  t text := case when jsonb_typeof(b -> 'tipo') = 'string' then b ->> 'tipo' end;
  bid text := case when jsonb_typeof(b -> 'id') = 'string' and (b ->> 'id') ~ '^[a-z0-9-]{1,16}$' then b ->> 'id' else 'b' || idx end;
  vis boolean := coalesce(case when jsonb_typeof(b -> 'visible') = 'boolean' then (b ->> 'visible')::boolean end, true);
  o jsonb; est jsonb; img text;
begin
  if jsonb_typeof(b) is distinct from 'object' or t is null then return null; end if;
  if t = 'contenido' then
    img := public._ts_url(b, 'imagen_url', 600);
    o := jsonb_build_object('id', bid, 'tipo', t, 'visible', vis,
      'nivel', public._ts_enum(b, 'nivel', array['h1', 'h2', 'h3'], 'h2'),
      'imagen_pos', case when img is null then 'ninguna' else public._ts_enum(b, 'imagen_pos', array['ninguna', 'arriba', 'izquierda', 'derecha'], 'derecha') end,
      'imagen_forma', public._ts_enum(b, 'imagen_forma', array['original', 'cuadrada', 'horizontal', 'vertical'], 'horizontal'),
      'tamano', public._ts_enum(b, 'tamano', array['normal', 'grande'], 'normal'),
      'botones', public._ts_botones(b -> 'botones', 2))
      || jsonb_strip_nulls(jsonb_build_object('antetitulo', public._ts_txt(b, 'antetitulo', 60), 'titulo', public._ts_txt(b, 'titulo', 120), 'texto', public._ts_txt(b, 'texto', 3000), 'imagen_url', img));
  else
    o := public._ts_bloque_v2(b, idx);
    if o is null then return null; end if;
    if t = 'productos' then
      o := o || jsonb_build_object('movil', case when (b ->> 'movil') = '1' then 1 else 2 end, 'estilo', public._ts_enum(b, 'estilo', array['grilla', 'carrusel'], 'grilla'));
    elsif t = 'galeria' then
      o := o || jsonb_build_object('movil', case when (b ->> 'movil') = '1' then 1 else 2 end, 'forma', public._ts_enum(b, 'forma', array['cuadrada', 'vertical', 'horizontal', 'mosaico'], 'cuadrada'));
    end if;
  end if;
  est := public._ts_estilo(b -> 'est');
  if est is not null then o := o || jsonb_build_object('est', est); end if;
  return o;
end $$;

-- 4) Diseño: nuevos tokens ------------------------------------------------------------------------------------------------------
create or replace function public._ts_diseno(d jsonb) returns jsonb
language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'fondo', public._ts_color(d, 'fondo'),
    'texto', public._ts_color(d, 'texto'),
    'superficie', public._ts_color(d, 'superficie'),
    'radio', public._ts_enum(d, 'radio', array['cuadrado','suave','redondo','pildora'], null),
    'boton', public._ts_enum(d, 'boton', array['relleno','contorno'], null),
    'fuente_titulos', public._ts_enum(d, 'fuente_titulos', array['sans','serif','redondeada','display','mono','geometrica','editorial'], null),
    'fuente_texto', public._ts_enum(d, 'fuente_texto', array['sans','serif'], null),
    'ancho', public._ts_enum(d, 'ancho', array['normal','amplio'], null),
    'espaciado', public._ts_enum(d, 'espaciado', array['compacto','normal','amplio'], null),
    'aspecto', public._ts_enum(d, 'aspecto', array['1 / 1','4 / 5','3 / 4','16 / 10'], null),
    'descripcion', case when jsonb_typeof(d -> 'descripcion') = 'boolean' then d -> 'descripcion' end,
    'cabecera', public._ts_enum(d, 'cabecera', array['izquierda','centro'], null),
    'tarjeta', public._ts_enum(d, 'tarjeta', array['borde','sombra','plana'], null),
    'escala', public._ts_enum(d, 'escala', array['chica','media','grande'], null),
    'peso', public._ts_enum(d, 'peso', array['normal','negrita','black'], null),
    'mayusculas', case when jsonb_typeof(d -> 'mayusculas') = 'boolean' then d -> 'mayusculas' end))
$$;

-- 5) Pie de página: hasta 3 columnas de hasta 8 enlaces ------------------------------------------------------------------------
create or replace function public._ts_pie(p jsonb) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare el jsonb; o jsonb := '[]'::jsonb; t text; enl jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' then return o; end if;
  for el in select * from jsonb_array_elements(p) limit 3 loop
    if jsonb_typeof(el) <> 'object' then continue; end if;
    t := coalesce(public._ts_txt(el, 'titulo', 30), '');
    enl := (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(public._ts_menu(el -> 'enlaces')) x limit 8) s);
    if t <> '' or jsonb_array_length(enl) > 0 then o := o || jsonb_build_array(jsonb_build_object('titulo', t, 'enlaces', enl)); end if;
  end loop;
  return o;
end $$;

-- 6) Guardar el tema: suma encabezado y pie, y admite temas más grandes (estilos por sección) ----------------------------------
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
  update public.delivery_comercios set tienda_tema = v where id = p_comercio;
end $function$;

alter table public.delivery_tienda_borradores drop constraint if exists delivery_tienda_borradores_tema_check;
alter table public.delivery_tienda_borradores add constraint delivery_tienda_borradores_tema_check check (jsonb_typeof(tema) = 'object' and length(tema::text) <= 160000);

create or replace function public.tienda_borrador_guardar(p_comercio uuid, p_tema jsonb) returns timestamptz
language plpgsql security definer set search_path to 'public' as $$
declare v_at timestamptz := now();
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(p_tema::text) > 160000 then raise exception 'La tienda es demasiado grande'; end if;
  insert into public.delivery_tienda_borradores (comercio_id, tema, actualizado_por, updated_at) values (p_comercio, p_tema, auth.uid(), v_at)
    on conflict (comercio_id) do update set tema = excluded.tema, actualizado_por = excluded.actualizado_por, updated_at = excluded.updated_at;
  return v_at;
end $$;
