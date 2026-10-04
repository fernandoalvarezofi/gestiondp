-- Constructor de tienda: bloques y diseño global, validados en el servidor (misma lógica que src/lib/storefront.ts).

-- ---- Ayudas de validación (solo las usan las funciones de abajo)
create or replace function public._ts_txt(v jsonb, k text, max_len int) returns text language sql immutable as $$
  select nullif(left(btrim(case when jsonb_typeof(v -> k) = 'string' then v ->> k else '' end), max_len), '')
$$;
create or replace function public._ts_url(v jsonb, k text, max_len int) returns text language sql immutable as $$
  select case when jsonb_typeof(v -> k) = 'string' and (v ->> k) ~* '^https://' and length(v ->> k) <= max_len then v ->> k end
$$;
create or replace function public._ts_enum(v jsonb, k text, opts text[], def text) returns text language sql immutable as $$
  select case when jsonb_typeof(v -> k) = 'string' and (v ->> k) = any (opts) then v ->> k else def end
$$;
create or replace function public._ts_int(v jsonb, k text, lo int, hi int, def int) returns int language sql immutable as $$
  select case when jsonb_typeof(v -> k) = 'number' then least(hi, greatest(lo, round((v ->> k)::numeric)::int)) else def end
$$;
create or replace function public._ts_color(v jsonb, k text) returns text language sql immutable as $$
  select case when jsonb_typeof(v -> k) = 'string' and (v ->> k) ~ '^#[0-9A-Fa-f]{6}$' then upper(v ->> k) end
$$;

-- ---- Un bloque: solo claves conocidas de su tipo, con formato y largo validados. Devuelve null si no se reconoce.
create or replace function public._ts_bloque(b jsonb, idx int) returns jsonb language plpgsql immutable as $$
declare
  t text := case when jsonb_typeof(b -> 'tipo') = 'string' then b ->> 'tipo' end;
  bid text := case when jsonb_typeof(b -> 'id') = 'string' and (b ->> 'id') ~ '^[a-z0-9-]{1,16}$' then b ->> 'id' else 'b' || idx end;
  vis boolean := coalesce(case when jsonb_typeof(b -> 'visible') = 'boolean' then (b ->> 'visible')::boolean end, true);
  base jsonb;
  altos text[] := array['chico','medio','grande'];
  ali text[] := array['izquierda','centro'];
  enl text[] := array['catalogo','whatsapp','url'];
  items jsonb;
begin
  if jsonb_typeof(b) is distinct from 'object' or t is null then return null; end if;
  base := jsonb_build_object('id', bid, 'tipo', t, 'visible', vis);
  case t
    when 'portada' then
      return base || jsonb_strip_nulls(jsonb_build_object('estilo', public._ts_enum(b,'estilo',array['boutique','galeria','impacto','gourmet','simple'],'simple'), 'imagen_url', public._ts_url(b,'imagen_url',600), 'titulo', public._ts_txt(b,'titulo',80), 'subtitulo', public._ts_txt(b,'subtitulo',200), 'boton', public._ts_txt(b,'boton',24), 'alineacion', public._ts_enum(b,'alineacion',ali,'izquierda'), 'alto', public._ts_enum(b,'alto',altos,'grande'), 'oscurecer', public._ts_int(b,'oscurecer',0,80,55)));
    when 'texto' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',800), 'alineacion', public._ts_enum(b,'alineacion',ali,'centro'), 'fondo', public._ts_enum(b,'fondo',array['ninguno','suave','color'],'ninguno')));
    when 'imagen_texto' then
      return base || jsonb_strip_nulls(jsonb_build_object('imagen_url', public._ts_url(b,'imagen_url',600), 'lado', public._ts_enum(b,'lado',array['izquierda','derecha'],'izquierda'), 'titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',600), 'boton', public._ts_txt(b,'boton',24), 'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'banner' then
      return base || jsonb_strip_nulls(jsonb_build_object('imagen_url', public._ts_url(b,'imagen_url',600), 'titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24), 'alto', public._ts_enum(b,'alto',altos,'medio'), 'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'colecciones' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'estilo', public._ts_enum(b,'estilo',array['tarjetas','circulos','lista'],'tarjetas')));
    when 'productos' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'fuente', public._ts_enum(b,'fuente',array['destacados','categoria','todos'],'destacados'), 'categoria', public._ts_txt(b,'categoria',60), 'cantidad', public._ts_int(b,'cantidad',2,12,4), 'columnas', public._ts_int(b,'columnas',2,5,4)));
    when 'catalogo' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'columnas', public._ts_int(b,'columnas',2,5,4), 'filtros', coalesce(case when jsonb_typeof(b -> 'filtros') = 'boolean' then (b ->> 'filtros')::boolean end, true)));
    when 'galeria' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('url', e.u, 'texto', e.x))), '[]'::jsonb) into items
      from (select public._ts_url(el, 'url', 600) u, public._ts_txt(el, 'texto', 80) x from jsonb_array_elements(case when jsonb_typeof(b -> 'imagenes') = 'array' then b -> 'imagenes' else '[]'::jsonb end) el limit 8) e where e.u is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'columnas', public._ts_int(b,'columnas',2,4,3))) || jsonb_build_object('imagenes', items);
    when 'confianza' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('icono', public._ts_enum(el,'icono',array['envio','pago','calidad','tiempo','soporte','local'],'calidad'), 'titulo', e.ti, 'texto', e.tx))), '[]'::jsonb) into items
      from (select el, public._ts_txt(el, 'titulo', 40) ti, public._ts_txt(el, 'texto', 90) tx from jsonb_array_elements(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el limit 4) e where e.ti is not null;
      return base || jsonb_build_object('items', items);
    when 'faq' then
      select coalesce(jsonb_agg(jsonb_build_object('p', e.p, 'r', e.r)), '[]'::jsonb) into items
      from (select public._ts_txt(el, 'p', 120) p, public._ts_txt(el, 'r', 400) r from jsonb_array_elements(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el limit 8) e where e.p is not null and e.r is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80))) || jsonb_build_object('items', items);
    when 'opiniones' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80)));
    when 'contacto' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80)));
    when 'separador' then
      return base || jsonb_build_object('alto', public._ts_enum(b,'alto',altos,'medio'), 'linea', coalesce(case when jsonb_typeof(b -> 'linea') = 'boolean' then (b ->> 'linea')::boolean end, true));
    else
      return null;
  end case;
end $$;

-- ---- Diseño global
create or replace function public._ts_diseno(d jsonb) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'fondo', public._ts_color(d, 'fondo'),
    'texto', public._ts_color(d, 'texto'),
    'radio', public._ts_enum(d, 'radio', array['cuadrado','suave','redondo','pildora'], null),
    'boton', public._ts_enum(d, 'boton', array['relleno','contorno'], null),
    'fuente_titulos', public._ts_enum(d, 'fuente_titulos', array['sans','serif','redondeada','display','mono'], null),
    'fuente_texto', public._ts_enum(d, 'fuente_texto', array['sans','serif'], null),
    'ancho', public._ts_enum(d, 'ancho', array['normal','amplio'], null),
    'espaciado', public._ts_enum(d, 'espaciado', array['compacto','normal','amplio'], null),
    'aspecto', public._ts_enum(d, 'aspecto', array['1 / 1','4 / 5','3 / 4','16 / 10'], null),
    'descripcion', case when jsonb_typeof(d -> 'descripcion') = 'boolean' then d -> 'descripcion' end,
    'cabecera', public._ts_enum(d, 'cabecera', array['izquierda','centro'], null)))
$$;

revoke all on function public._ts_txt(jsonb, text, int), public._ts_url(jsonb, text, int), public._ts_enum(jsonb, text, text[], text), public._ts_int(jsonb, text, int, int, int), public._ts_color(jsonb, text), public._ts_bloque(jsonb, int), public._ts_diseno(jsonb) from public, anon, authenticated;
