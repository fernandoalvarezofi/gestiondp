-- TIENDA ONLINE COMO PLATAFORMA: constructor con borrador en el servidor, versiones restaurables, páginas y landings,
-- menú de navegación, SEO e indexación, píxeles de analítica, plantillas nuevas, dominio propio, cupones con reglas,
-- consentimiento de suscriptores, analítica real y panel de preparación para publicar.
--  * El borrador vive en delivery_tienda_borradores (solo lo ve el equipo con permiso "ajustes"). Publicar = validar en el servidor
--    (delivery_guardar_tienda_tema) + guardar versión. La tienda pública nunca muestra un borrador a medio hacer.
--  * Cada publicación queda en delivery_tienda_versiones (se guardan las últimas 40). Restaurar trae la versión al borrador.
--  * Páginas (delivery_tienda_paginas): informativas (texto con formato simple) y landings de campaña (bloques validados con las
--    mismas reglas que la portada). Solo se escriben por función, que valida y sanea todo.
--  * Dominio propio: el local lo solicita con un código de verificación; un administrador lo activa cuando el dominio ya apunta a
--    Woref (requiere agregarlo al proyecto de Vercel y el registro DNS: ver docs/TIENDAS.md). tienda_por_dominio() resuelve el host.
--  * Cupones: vigencia desde/hasta y alcance por productos o secciones; el pedido calcula el descuento solo sobre lo que aplica.
-- Revertir: drop table delivery_tienda_borradores, delivery_tienda_versiones, delivery_tienda_paginas, delivery_tienda_dominios cascade;
--   drop function tienda_*, _ts_menu; restaurar delivery_guardar_tienda_tema y _ts_bloque de 20261028130000, delivery_validar_cupon de 3
--   argumentos dentro de delivery_crear_pedido; alter table delivery_cupones drop inicia_at, aplica_a, productos, secciones.

-- Validación de bloques: plantillas nuevas (estudio, taller), bloque de servicios con turnos y productos por colección o novedades.
create or replace function public._ts_bloque(b jsonb, idx integer)
 returns jsonb language plpgsql immutable set search_path to 'public', 'pg_temp' as $function$
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
      return base || jsonb_strip_nulls(jsonb_build_object('estilo', public._ts_enum(b,'estilo',array['boutique','galeria','impacto','gourmet','atelier','urbano','mercado','estudio','taller','simple'],'simple'), 'imagen_url', public._ts_url(b,'imagen_url',600), 'titulo', public._ts_txt(b,'titulo',80), 'subtitulo', public._ts_txt(b,'subtitulo',200), 'boton', public._ts_txt(b,'boton',24), 'alineacion', public._ts_enum(b,'alineacion',ali,'izquierda'), 'alto', public._ts_enum(b,'alto',altos,'grande'), 'oscurecer', public._ts_int(b,'oscurecer',0,80,55)));
    when 'texto' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',800), 'alineacion', public._ts_enum(b,'alineacion',ali,'centro'), 'fondo', public._ts_enum(b,'fondo',array['ninguno','suave','color'],'ninguno')));
    when 'imagen_texto' then
      return base || jsonb_strip_nulls(jsonb_build_object('imagen_url', public._ts_url(b,'imagen_url',600), 'lado', public._ts_enum(b,'lado',array['izquierda','derecha'],'izquierda'), 'titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',600), 'boton', public._ts_txt(b,'boton',24), 'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'banner' then
      return base || jsonb_strip_nulls(jsonb_build_object('imagen_url', public._ts_url(b,'imagen_url',600), 'titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24), 'alto', public._ts_enum(b,'alto',altos,'medio'), 'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'colecciones' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'estilo', public._ts_enum(b,'estilo',array['tarjetas','circulos','lista'],'tarjetas')));
    when 'productos' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'fuente', public._ts_enum(b,'fuente',array['destacados','categoria','todos','coleccion','nuevos','ofertas'],'destacados'), 'categoria', public._ts_txt(b,'categoria',60),
        'coleccion', case when jsonb_typeof(b -> 'coleccion') = 'string' and (b ->> 'coleccion') ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then left(b ->> 'coleccion', 70) end,
        'cantidad', public._ts_int(b,'cantidad',2,12,4), 'columnas', public._ts_int(b,'columnas',2,5,4)));
    when 'catalogo' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'columnas', public._ts_int(b,'columnas',2,5,4), 'filtros', coalesce(case when jsonb_typeof(b -> 'filtros') = 'boolean' then (b ->> 'filtros')::boolean end, true)));
    when 'servicios' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'cantidad', public._ts_int(b,'cantidad',1,12,6), 'estilo', public._ts_enum(b,'estilo',array['tarjetas','lista'],'tarjetas')));
    when 'galeria' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('url', e.u, 'texto', e.x))), '[]'::jsonb) into items
      from (select public._ts_url(el, 'url', 600) u, public._ts_txt(el, 'texto', 80) x from jsonb_array_elements(case when jsonb_typeof(b -> 'imagenes') = 'array' then b -> 'imagenes' else '[]'::jsonb end) el limit 8) e where e.u is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'columnas', public._ts_int(b,'columnas',2,4,3))) || jsonb_build_object('imagenes', items);
    when 'confianza' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('icono', e.ic, 'titulo', e.ti, 'texto', e.tx))), '[]'::jsonb) into items
      from (select public._ts_enum(el,'icono',array['envio','pago','calidad','tiempo','soporte','local'],'calidad') ic, public._ts_txt(el, 'titulo', 40) ti, public._ts_txt(el, 'texto', 90) tx from jsonb_array_elements(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el limit 4) e where e.ti is not null;
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
    when 'newsletter' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24)));
    when 'politicas' then
      select coalesce(jsonb_agg(jsonb_build_object('t', e.t, 'x', e.x)), '[]'::jsonb) into items
      from (select public._ts_txt(el, 't', 40) t, public._ts_txt(el, 'x', 600) x from jsonb_array_elements(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el limit 4) e where e.t is not null and e.x is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80))) || jsonb_build_object('items', items);
    when 'oferta' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24),
        'hasta', case when jsonb_typeof(b -> 'hasta') = 'string' and (b ->> 'hasta') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$' then left(b ->> 'hasta', 30) end,
        'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'video' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200),
        'url', case when jsonb_typeof(b -> 'url') = 'string' and (b ->> 'url') ~* '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[A-Za-z0-9_-]{5,20}([&?][A-Za-z0-9_=&-]*)?$' then left(b ->> 'url', 200) end));
    when 'cinta' then
      select coalesce(jsonb_agg(f.x), '[]'::jsonb) into items
        from (select e.x from (select public._ts_txt(jsonb_build_object('t', el), 't', 60) x from jsonb_array_elements_text(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el) e where e.x is not null limit 6) f;
      return base || jsonb_build_object('items', items, 'estilo', public._ts_enum(b, 'estilo', array['acento','oscuro','claro'], 'acento'));
    else
      return null;
  end case;
end $function$;

-- Menú de navegación de la tienda (hasta 12 enlaces).
create or replace function public._ts_menu(m jsonb) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare el jsonb; v jsonb := '[]'::jsonb; t text; txt text; dst text;
begin
  if jsonb_typeof(m) is distinct from 'array' then return '[]'::jsonb; end if;
  for el in select * from jsonb_array_elements(m) limit 12 loop
    if jsonb_typeof(el) <> 'object' then continue; end if;
    t := el->>'tipo'; txt := left(btrim(coalesce(el->>'texto', '')), 30); dst := left(btrim(coalesce(el->>'destino', '')), 200);
    if t not in ('inicio', 'catalogo', 'ofertas', 'categoria', 'coleccion', 'pagina', 'reservar', 'url') or txt = '' then continue; end if;
    if t in ('coleccion', 'pagina') and dst !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then continue; end if;
    if t = 'categoria' and (dst = '' or char_length(dst) > 60) then continue; end if;
    if t = 'url' and dst !~ '^https://[^\s<>"]+$' then continue; end if;
    v := v || jsonb_build_object('texto', txt, 'tipo', t, 'destino', case when t in ('inicio', 'catalogo', 'ofertas', 'reservar') then null else dst end);
  end loop;
  return v;
end $$;

create or replace function public.delivery_guardar_tienda_tema(p_comercio uuid, p_tema jsonb)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v jsonb := '{}'::jsonb; k text; val text; item text; sec jsonb := '[]'::jsonb; bloques jsonb := '[]'::jsonb; b jsonb; n int := 0; tiene_catalogo boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
  if not coalesce(public.delivery_permiso(p_comercio, 'ajustes'), false) then raise exception 'No tenés permiso para editar la tienda'; end if;
  if jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(p_tema::text) > 80000 then raise exception 'La tienda es demasiado grande'; end if;

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
  foreach k in array array['mostrar_opiniones', 'indexar', 'mostrar_busqueda'] loop
    if (p_tema->>k) in ('true','false') then v := v || jsonb_build_object(k, (p_tema->>k)::boolean); end if;
  end loop;
  val := p_tema->>'catalogo_orden';
  if val is not null then
    if val not in ('relevancia','recientes','precio_asc','precio_desc','nombre') then raise exception 'Orden del catálogo inválido'; end if;
    v := v || jsonb_build_object('catalogo_orden', val);
  end if;
  if p_tema ? 'menu' then v := v || jsonb_build_object('menu', public._ts_menu(p_tema->'menu')); end if;

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
    if jsonb_typeof(p_tema->'bloques') is distinct from 'array' or jsonb_array_length(p_tema->'bloques') > 30 then raise exception 'Demasiados bloques (máximo 30)'; end if;
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

-- Borrador y versiones ---------------------------------------------------------------------------------------------------
create table if not exists public.delivery_tienda_borradores (
  comercio_id uuid primary key references public.delivery_comercios (id) on delete cascade,
  tema jsonb not null check (jsonb_typeof(tema) = 'object' and length(tema::text) <= 80000),
  actualizado_por uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.delivery_tienda_versiones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  tema jsonb not null,
  nota text check (nota is null or char_length(nota) <= 120),
  publicado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists delivery_tienda_versiones_idx on public.delivery_tienda_versiones (comercio_id, created_at desc);
alter table public.delivery_tienda_borradores enable row level security;
alter table public.delivery_tienda_versiones enable row level security;
revoke all on public.delivery_tienda_borradores, public.delivery_tienda_versiones from anon, authenticated;
grant select on public.delivery_tienda_borradores, public.delivery_tienda_versiones to authenticated;
grant all on public.delivery_tienda_borradores, public.delivery_tienda_versiones to service_role;
drop policy if exists "Borrador de la tienda para el equipo" on public.delivery_tienda_borradores;
create policy "Borrador de la tienda para el equipo" on public.delivery_tienda_borradores for select to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));
drop policy if exists "Versiones de la tienda para el equipo" on public.delivery_tienda_versiones;
create policy "Versiones de la tienda para el equipo" on public.delivery_tienda_versiones for select to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));

-- Cada publicación guarda una versión (las últimas 40 por local).
create or replace function public.tienda_version_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tienda_tema is distinct from old.tienda_tema then
    insert into public.delivery_tienda_versiones (comercio_id, tema, nota, publicado_por) values (new.id, new.tienda_tema, nullif(current_setting('woref.tienda_nota', true), ''), auth.uid());
    delete from public.delivery_tienda_versiones where comercio_id = new.id and id not in (select id from public.delivery_tienda_versiones where comercio_id = new.id order by created_at desc limit 40);
  end if;
  return null;
end $$;
drop trigger if exists tienda_version_registrar on public.delivery_comercios;
create trigger tienda_version_registrar after update of tienda_tema on public.delivery_comercios for each row execute function public.tienda_version_registrar();

create or replace function public.tienda_borrador_guardar(p_comercio uuid, p_tema jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_at timestamptz := now();
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(p_tema::text) > 80000 then raise exception 'La tienda es demasiado grande'; end if;
  insert into public.delivery_tienda_borradores (comercio_id, tema, actualizado_por, updated_at) values (p_comercio, p_tema, auth.uid(), v_at)
    on conflict (comercio_id) do update set tema = excluded.tema, actualizado_por = excluded.actualizado_por, updated_at = excluded.updated_at;
  return v_at;
end $$;

create or replace function public.tienda_borrador_descartar(p_comercio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  delete from public.delivery_tienda_borradores where comercio_id = p_comercio;
end $$;

-- Publicar: valida en el servidor, publica, registra la versión con una nota y borra el borrador.
create or replace function public.tienda_publicar(p_comercio uuid, p_tema jsonb default null, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_tema jsonb := p_tema;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if v_tema is null then select tema into v_tema from public.delivery_tienda_borradores where comercio_id = p_comercio; end if;
  if v_tema is null then raise exception 'No hay cambios para publicar'; end if;
  perform set_config('woref.tienda_nota', left(coalesce(btrim(p_nota), ''), 120), true);
  perform public.delivery_guardar_tienda_tema(p_comercio, v_tema);
  delete from public.delivery_tienda_borradores where comercio_id = p_comercio;
end $$;

create or replace function public.tienda_restaurar_version(p_version uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.delivery_tienda_versiones;
begin
  select * into v from public.delivery_tienda_versiones where id = p_version;
  if not found or not public.delivery_permiso(v.comercio_id, 'ajustes') then raise exception 'Versión no encontrada'; end if;
  perform public.tienda_borrador_guardar(v.comercio_id, v.tema);
  return v.tema;
end $$;

-- Páginas y landings ------------------------------------------------------------------------------------------------------
create table if not exists public.delivery_tienda_paginas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  tipo text not null default 'informativa' check (tipo in ('informativa', 'landing')),
  clase text not null default 'otra' check (clase in ('nosotros', 'contacto', 'faq', 'envios', 'cambios', 'privacidad', 'condiciones', 'campana', 'marca', 'otra')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 90),
  contenido text check (contenido is null or char_length(contenido) <= 20000),
  bloques jsonb not null default '[]'::jsonb check (jsonb_typeof(bloques) = 'array'),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  seo_titulo text check (seo_titulo is null or char_length(seo_titulo) <= 70),
  seo_descripcion text check (seo_descripcion is null or char_length(seo_descripcion) <= 170),
  imagen_url text check (imagen_url is null or (imagen_url ~ '^https://' and char_length(imagen_url) <= 600)),
  orden integer not null default 0,
  publicada_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (comercio_id, slug)
);
create index if not exists delivery_tienda_paginas_idx on public.delivery_tienda_paginas (comercio_id, estado, orden);
alter table public.delivery_tienda_paginas enable row level security;
revoke all on public.delivery_tienda_paginas from anon, authenticated;
grant select on public.delivery_tienda_paginas to anon, authenticated;
grant delete on public.delivery_tienda_paginas to authenticated;
grant all on public.delivery_tienda_paginas to service_role;
drop policy if exists "Páginas publicadas visibles" on public.delivery_tienda_paginas;
create policy "Páginas publicadas visibles" on public.delivery_tienda_paginas for select to anon, authenticated
  using ((estado = 'publicada' and exists (select 1 from public.delivery_comercios c where c.id = comercio_id and c.activo and c.aprobado)) or public.delivery_permiso(comercio_id, 'ajustes'));
drop policy if exists "Páginas eliminadas por el equipo" on public.delivery_tienda_paginas;
create policy "Páginas eliminadas por el equipo" on public.delivery_tienda_paginas for delete to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));

create or replace function public.tienda_pagina_guardar(p_comercio uuid, p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_slug text; v_tipo text; v_bloques jsonb := '[]'::jsonb; b jsonb; n int := 0; v_estado text; v_img text;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 60000 then raise exception 'Datos inválidos'; end if;
  v_tipo := coalesce(p->>'tipo', 'informativa');
  if v_tipo not in ('informativa', 'landing') then raise exception 'Tipo de página inválido'; end if;
  v_slug := lower(btrim(coalesce(p->>'slug', '')));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 70 then raise exception 'La dirección de la página solo admite letras minúsculas, números y guiones'; end if;
  if char_length(btrim(coalesce(p->>'titulo', ''))) not between 2 and 90 then raise exception 'El título tiene que tener entre 2 y 90 caracteres'; end if;
  if exists (select 1 from public.delivery_tienda_paginas where comercio_id = p_comercio and slug = v_slug and id is distinct from v_id) then raise exception 'Ya tenés una página con esa dirección'; end if;
  v_estado := coalesce(p->>'estado', 'borrador');
  if v_estado not in ('borrador', 'publicada') then raise exception 'Estado inválido'; end if;
  v_img := nullif(btrim(coalesce(p->>'imagen_url', '')), '');
  if v_img is not null and (v_img !~ '^https://' or length(v_img) > 600) then raise exception 'La imagen tiene que ser una dirección https'; end if;
  if jsonb_typeof(p->'bloques') = 'array' then
    if jsonb_array_length(p->'bloques') > 20 then raise exception 'Una página admite hasta 20 secciones'; end if;
    for b in select jsonb_array_elements(p->'bloques') loop
      n := n + 1; b := public._ts_bloque(b, n);
      if b is not null and b->>'tipo' <> 'catalogo' then v_bloques := v_bloques || jsonb_build_array(b); end if;
    end loop;
  end if;
  if v_id is null then
    insert into public.delivery_tienda_paginas (comercio_id, tipo, clase, slug, titulo, contenido, bloques, estado, seo_titulo, seo_descripcion, imagen_url, orden, publicada_at)
      values (p_comercio, v_tipo, coalesce(nullif(p->>'clase', ''), 'otra'), v_slug, btrim(p->>'titulo'), left(nullif(p->>'contenido', ''), 20000), v_bloques, v_estado,
              left(nullif(btrim(coalesce(p->>'seo_titulo', '')), ''), 70), left(nullif(btrim(coalesce(p->>'seo_descripcion', '')), ''), 170), v_img,
              coalesce((p->>'orden')::int, 0), case when v_estado = 'publicada' then now() end)
      returning id into v_id;
  else
    update public.delivery_tienda_paginas set tipo = v_tipo, clase = coalesce(nullif(p->>'clase', ''), clase), slug = v_slug, titulo = btrim(p->>'titulo'),
           contenido = left(nullif(p->>'contenido', ''), 20000), bloques = v_bloques, estado = v_estado,
           seo_titulo = left(nullif(btrim(coalesce(p->>'seo_titulo', '')), ''), 70), seo_descripcion = left(nullif(btrim(coalesce(p->>'seo_descripcion', '')), ''), 170),
           imagen_url = v_img, orden = coalesce((p->>'orden')::int, orden),
           publicada_at = case when v_estado = 'publicada' and publicada_at is null then now() else publicada_at end, updated_at = now()
     where id = v_id and comercio_id = p_comercio;
    if not found then raise exception 'Página no encontrada'; end if;
  end if;
  return v_id;
end $$;

-- Dominio propio ----------------------------------------------------------------------------------------------------------
create table if not exists public.delivery_tienda_dominios (
  comercio_id uuid primary key references public.delivery_comercios (id) on delete cascade,
  dominio text not null unique check (dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' and char_length(dominio) <= 120),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'rechazado')),
  token text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  nota text check (nota is null or char_length(nota) <= 300),
  revisado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.delivery_tienda_dominios enable row level security;
revoke all on public.delivery_tienda_dominios from anon, authenticated;
grant select on public.delivery_tienda_dominios to authenticated;
grant all on public.delivery_tienda_dominios to service_role;
drop policy if exists "Dominio visible para el equipo y admin" on public.delivery_tienda_dominios;
create policy "Dominio visible para el equipo y admin" on public.delivery_tienda_dominios for select to authenticated
  using (public.delivery_permiso(comercio_id, 'ajustes') or public.has_role((select auth.uid()), 'admin'::app_role));

create or replace function public.tienda_dominio_solicitar(p_comercio uuid, p_dominio text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_dom text := lower(btrim(regexp_replace(coalesce(p_dominio, ''), '^https?://|/.*$', '', 'g'))); r public.delivery_tienda_dominios;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso'; end if;
  if v_dom = '' then delete from public.delivery_tienda_dominios where comercio_id = p_comercio; return null; end if;
  if v_dom !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' then raise exception 'Escribí un dominio válido (por ejemplo, mitienda.com.ar)'; end if;
  if v_dom like '%woref%' or v_dom like '%vercel.app' then raise exception 'Ese dominio no se puede usar'; end if;
  if exists (select 1 from public.delivery_tienda_dominios where dominio = v_dom and comercio_id <> p_comercio) then raise exception 'Ese dominio ya está pedido por otra tienda'; end if;
  insert into public.delivery_tienda_dominios (comercio_id, dominio) values (p_comercio, v_dom)
    on conflict (comercio_id) do update set dominio = excluded.dominio, estado = 'pendiente', nota = null, updated_at = now(), token = encode(extensions.gen_random_bytes(12), 'hex')
    returning * into r;
  return jsonb_build_object('dominio', r.dominio, 'estado', r.estado, 'token', r.token);
end $$;

create or replace function public.tienda_dominio_revisar(p_comercio uuid, p_estado text, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administración'; end if;
  if p_estado not in ('activo', 'rechazado', 'pendiente') then raise exception 'Estado inválido'; end if;
  update public.delivery_tienda_dominios set estado = p_estado, nota = left(p_nota, 300), revisado_por = auth.uid(), updated_at = now() where comercio_id = p_comercio;
end $$;

-- Público: qué tienda corresponde a un dominio activo (solo devuelve el slug).
create or replace function public.tienda_por_dominio(p_host text) returns text
language sql stable security definer set search_path = public as $$
  select c.slug from public.delivery_tienda_dominios d join public.delivery_comercios c on c.id = d.comercio_id
   where d.estado = 'activo' and c.activo and c.aprobado and d.dominio = lower(regexp_replace(coalesce(p_host, ''), '^www\.|:\d+$', '', 'g')) limit 1
$$;

-- Suscriptores con consentimiento explícito -------------------------------------------------------------------------------
alter table public.delivery_tienda_suscriptores add column if not exists consentimiento_at timestamptz;
create or replace function public.delivery_tienda_suscribir(p_comercio uuid, p_email text, p_consentimiento boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not coalesce(p_consentimiento, false) then raise exception 'Para suscribirte tenés que aceptar recibir novedades'; end if;
  if v_email !~ '^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,100}\.[a-z]{2,24}$' then raise exception 'Escribí un email válido'; end if;
  if not exists (select 1 from public.delivery_comercios where id = p_comercio and aprobado and activo) then raise exception 'La tienda no está disponible'; end if;
  if (select count(*) from public.delivery_tienda_suscriptores where comercio_id = p_comercio and creado_at > now() - interval '1 hour') >= 40 then raise exception 'Demasiados registros en este momento. Probá más tarde'; end if;
  insert into public.delivery_tienda_suscriptores (comercio_id, email, consentimiento_at) values (p_comercio, v_email, now())
    on conflict do nothing;
end $$;

-- Cupones con vigencia y alcance --------------------------------------------------------------------------------------------
alter table public.delivery_cupones
  add column if not exists inicia_at timestamptz,
  add column if not exists aplica_a text not null default 'todo' check (aplica_a in ('todo', 'productos', 'secciones')),
  add column if not exists productos uuid[] not null default '{}' check (cardinality(productos) <= 200),
  add column if not exists secciones text[] not null default '{}' check (cardinality(secciones) <= 50);

create or replace function public.delivery_validar_cupon(p_codigo text, p_comercio uuid, p_subtotal numeric, p_items jsonb)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare c public.delivery_cupones; v_descuento numeric := 0; v_envio boolean := false; v_base numeric := p_subtotal; v_item jsonb; v_prod public.delivery_productos; v_precio numeric;
begin
  select * into c from public.delivery_cupones where codigo = upper(trim(p_codigo)) and activo limit 1;
  if not found then return jsonb_build_object('valido', false, 'mensaje', 'El cupón no existe o no está activo'); end if;
  if c.cliente_id is not null and c.cliente_id is distinct from auth.uid() then return jsonb_build_object('valido', false, 'mensaje', 'El cupón no existe o no está activo'); end if;
  if c.inicia_at is not null and c.inicia_at > now() then return jsonb_build_object('valido', false, 'mensaje', 'El cupón todavía no está vigente'); end if;
  if c.vence_at is not null and c.vence_at < now() then return jsonb_build_object('valido', false, 'mensaje', 'El cupón venció'); end if;
  if c.comercio_id is not null and c.comercio_id <> p_comercio then return jsonb_build_object('valido', false, 'mensaje', 'El cupón no aplica a este comercio'); end if;
  if c.usos_max is not null and c.usos >= c.usos_max then return jsonb_build_object('valido', false, 'mensaje', 'El cupón alcanzó su límite de usos'); end if;
  if p_subtotal < c.minimo then return jsonb_build_object('valido', false, 'mensaje', 'Compra mínima de $' || to_char(c.minimo, 'FM999G999G999')); end if;
  if c.un_uso_por_cliente and exists (select 1 from public.delivery_pedidos p where p.cliente_id = auth.uid() and p.cupon_codigo = c.codigo and p.estado <> 'cancelado') then
    return jsonb_build_object('valido', false, 'mensaje', 'Ya usaste este cupón');
  end if;
  -- Alcance: el descuento se calcula solo sobre los productos alcanzados (precio vigente por cantidad).
  if c.aplica_a <> 'todo' then
    v_base := 0;
    if jsonb_typeof(p_items) = 'array' then
      for v_item in select * from jsonb_array_elements(p_items) loop
        select * into v_prod from public.delivery_productos where id = nullif(v_item->>'producto_id', '')::uuid and comercio_id = p_comercio;
        continue when not found;
        if (c.aplica_a = 'productos' and v_prod.id = any(c.productos)) or (c.aplica_a = 'secciones' and v_prod.categoria = any(c.secciones)) then
          v_precio := v_prod.precio;
          if v_prod.usa_variantes and nullif(v_item->>'variante_id', '') is not null then
            select coalesce(v.precio, v_prod.precio) into v_precio from public.delivery_producto_variantes v where v.id = (v_item->>'variante_id')::uuid and v.producto_id = v_prod.id;
          end if;
          v_base := v_base + coalesce(v_precio, 0) * greatest(least(coalesce((v_item->>'cantidad')::int, 1), 50), 1);
        end if;
      end loop;
    end if;
    if v_base <= 0 then return jsonb_build_object('valido', false, 'mensaje', 'El cupón no aplica a los productos de tu carrito'); end if;
  end if;
  if c.tipo = 'porcentaje' then
    v_descuento := round(v_base * c.valor / 100);
    if c.tope is not null then v_descuento := least(v_descuento, c.tope); end if;
  elsif c.tipo = 'monto' then
    v_descuento := least(c.valor, v_base);
  else
    v_envio := true;
  end if;
  return jsonb_build_object('valido', true, 'codigo', c.codigo, 'descuento', v_descuento, 'envio_gratis', v_envio, 'mensaje', c.descripcion, 'alcance', c.aplica_a);
end $function$;

-- La versión de 3 argumentos sigue funcionando para cupones de alcance total.
create or replace function public.delivery_validar_cupon(p_codigo text, p_comercio uuid, p_subtotal numeric)
 returns jsonb language sql stable security definer set search_path to 'public' as $$ select public.delivery_validar_cupon(p_codigo, p_comercio, p_subtotal, null::jsonb) $$;
revoke all on function public.delivery_validar_cupon(text, uuid, numeric, jsonb) from public, anon;
grant execute on function public.delivery_validar_cupon(text, uuid, numeric, jsonb) to authenticated;

-- El pedido valida el cupón con sus ítems (cambio puntual dentro de delivery_crear_pedido, sin reescribirla).
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'delivery_crear_pedido' limit 1;
  if v_def is not null and position('delivery_validar_cupon(p_cupon, p_comercio, v_subtotal)' in v_def) > 0 then
    execute replace(v_def, 'delivery_validar_cupon(p_cupon, p_comercio, v_subtotal)', 'delivery_validar_cupon(p_cupon, p_comercio, v_subtotal, p_items)');
  end if;
end $$;

-- Analítica de la tienda (datos reales de pedidos, visitas y catálogo) ----------------------------------------------------
create or replace function public.tienda_analitica(p_comercio uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'America/Argentina/Buenos_Aires'; v_dias int := p_hasta - p_desde + 1;
begin
  if not public.delivery_permiso(p_comercio, 'estadisticas') and not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or v_dias > 366 then raise exception 'Rango de fechas inválido (hasta un año)'; end if;
  return (
    with ped as (
      select p.* from public.delivery_pedidos p where p.comercio_id = p_comercio and (p.created_at at time zone tz)::date between p_desde and p_hasta
    ), ok as (select * from ped where estado <> 'cancelado'),
    prev as (select count(*) n, coalesce(sum(subtotal), 0) ventas from public.delivery_pedidos p where p.comercio_id = p_comercio and estado <> 'cancelado'
              and (p.created_at at time zone tz)::date between p_desde - v_dias and p_desde - 1),
    vis as (select coalesce(sum(visitas), 0) n from public.delivery_tienda_visitas where comercio_id = p_comercio and dia between p_desde and p_hasta)
    select jsonb_build_object(
      'pedidos', (select count(*) from ok),
      'cancelados', (select count(*) from ped where estado = 'cancelado'),
      'ventas', (select coalesce(sum(subtotal), 0) from ok),
      'descuentos', (select coalesce(sum(descuento), 0) from ok),
      'ticket_promedio', (select coalesce(round(avg(subtotal)), 0) from ok),
      'clientes', (select count(distinct cliente_id) from ok),
      'clientes_recurrentes', (select count(*) from (select cliente_id from ok group by cliente_id having count(*) > 1) x),
      'visitas', (select n from vis),
      'conversion', (select case when vis.n > 0 then round((select count(*) from ok)::numeric * 100 / vis.n, 2) end from vis),
      'anterior', (select jsonb_build_object('pedidos', n, 'ventas', ventas) from prev),
      'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d::date, 'pedidos', coalesce(x.n, 0), 'ventas', coalesce(x.v, 0), 'visitas', coalesce(vv.visitas, 0)) order by d)
                  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
                  left join (select (created_at at time zone tz)::date dia, count(*) n, sum(subtotal) v from ok group by 1) x on x.dia = d::date
                  left join public.delivery_tienda_visitas vv on vv.comercio_id = p_comercio and vv.dia = d::date), '[]'::jsonb),
      'por_canal', coalesce((select jsonb_object_agg(coalesce(canal, 'app'), n) from (select canal, count(*) n from ok group by canal) x), '{}'::jsonb),
      'por_entrega', coalesce((select jsonb_object_agg(coalesce(tipo_entrega, 'delivery'), n) from (select tipo_entrega, count(*) n from ok group by tipo_entrega) x), '{}'::jsonb),
      'por_pago', coalesce((select jsonb_object_agg(metodo_pago, n) from (select metodo_pago, count(*) n from ok group by metodo_pago) x), '{}'::jsonb),
      'top_productos', coalesce((select jsonb_agg(x order by (x->>'unidades')::int desc) from (
          select jsonb_build_object('producto_id', i.producto_id, 'nombre', coalesce(pr.nombre, min(i.nombre)), 'unidades', sum(i.cantidad), 'ventas', sum(i.cantidad * i.precio_unitario)) x
            from public.delivery_pedido_items i join ok on ok.id = i.pedido_id left join public.delivery_productos pr on pr.id = i.producto_id
           group by i.producto_id, pr.nombre order by sum(i.cantidad) desc limit 10) q), '[]'::jsonb),
      'cupones', coalesce((select jsonb_agg(jsonb_build_object('codigo', cupon_codigo, 'usos', n, 'descuento', d) order by n desc) from (select cupon_codigo, count(*) n, sum(descuento) d from ok where cupon_codigo is not null group by cupon_codigo) x), '[]'::jsonb),
      'sin_ventas', (select count(*) from public.delivery_productos pr where pr.comercio_id = p_comercio and pr.estado = 'publicado'
                      and not exists (select 1 from public.delivery_pedido_items i join ok on ok.id = i.pedido_id where i.producto_id = pr.id)),
      'suscriptores_nuevos', (select count(*) from public.delivery_tienda_suscriptores s where s.comercio_id = p_comercio and (s.creado_at at time zone tz)::date between p_desde and p_hasta)
    ));
end $$;

-- Preparación para publicar: lo que falta, con datos reales.
create or replace function public.tienda_preparacion(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.delivery_comercios; t jsonb; v_pub int; v_foto int; v_pag int;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso'; end if;
  select * into c from public.delivery_comercios where id = p_comercio;
  t := coalesce((select tema from public.delivery_tienda_borradores where comercio_id = p_comercio), c.tienda_tema, '{}'::jsonb);
  select count(*) filter (where estado = 'publicado'), count(*) filter (where estado = 'publicado' and imagen_url is null) into v_pub, v_foto from public.delivery_productos where comercio_id = p_comercio;
  select count(*) into v_pag from public.delivery_tienda_paginas where comercio_id = p_comercio and estado = 'publicada';
  return jsonb_build_array(
    jsonb_build_object('clave', 'aprobado', 'ok', c.aprobado and c.activo, 'titulo', 'Local aprobado y activo', 'detalle', case when c.aprobado then 'Tu local está aprobado.' else 'Woref tiene que aprobar tu local antes de que la tienda se vea.' end, 'grave', true),
    jsonb_build_object('clave', 'productos', 'ok', v_pub > 0, 'titulo', 'Productos publicados', 'detalle', v_pub || ' publicados', 'grave', true),
    jsonb_build_object('clave', 'fotos', 'ok', v_foto = 0, 'titulo', 'Todos los productos con foto', 'detalle', case when v_foto = 0 then 'Bien.' else v_foto || ' productos sin foto' end, 'grave', false),
    jsonb_build_object('clave', 'logo', 'ok', c.logo_url is not null, 'titulo', 'Logo del local', 'detalle', case when c.logo_url is null then 'Subilo en Ajustes del local.' else 'Cargado.' end, 'grave', false),
    jsonb_build_object('clave', 'portada', 'ok', coalesce(t->>'banner_url', '') <> '' or exists (select 1 from jsonb_array_elements(coalesce(t->'bloques', '[]'::jsonb)) b where b->>'tipo' = 'portada' and coalesce(b->>'imagen_url', '') <> ''), 'titulo', 'Imagen de portada', 'detalle', 'Una foto grande y de buena calidad para la portada.', 'grave', false),
    jsonb_build_object('clave', 'contacto', 'ok', c.telefono is not null or coalesce(t->>'whatsapp', '') <> '', 'titulo', 'Contacto', 'detalle', 'Teléfono o WhatsApp para que te escriban.', 'grave', false),
    jsonb_build_object('clave', 'horarios', 'ok', c.horarios is not null and c.horarios::text not in ('{}', '[]', 'null'), 'titulo', 'Horarios de atención', 'detalle', 'Se muestran en la tienda y definen cuándo se puede pedir.', 'grave', true),
    jsonb_build_object('clave', 'seo', 'ok', coalesce(t->>'seo_descripcion', '') <> '', 'titulo', 'Descripción para buscadores', 'detalle', 'Así aparece tu tienda en Google y al compartirla.', 'grave', false),
    jsonb_build_object('clave', 'politicas', 'ok', exists (select 1 from public.delivery_tienda_paginas where comercio_id = p_comercio and estado = 'publicada' and clase in ('envios', 'cambios')), 'titulo', 'Políticas de envío y de cambios', 'detalle', v_pag || ' páginas publicadas', 'grave', false),
    jsonb_build_object('clave', 'borrador', 'ok', not exists (select 1 from public.delivery_tienda_borradores where comercio_id = p_comercio), 'titulo', 'Cambios publicados', 'detalle', 'Hay cambios en borrador sin publicar.', 'grave', false)
  );
end $$;

revoke all on function public.tienda_borrador_guardar(uuid, jsonb), public.tienda_borrador_descartar(uuid), public.tienda_publicar(uuid, jsonb, text), public.tienda_restaurar_version(uuid),
  public.tienda_pagina_guardar(uuid, uuid, jsonb), public.tienda_dominio_solicitar(uuid, text), public.tienda_dominio_revisar(uuid, text, text),
  public.tienda_analitica(uuid, date, date), public.tienda_preparacion(uuid) from public, anon;
grant execute on function public.tienda_borrador_guardar(uuid, jsonb), public.tienda_borrador_descartar(uuid), public.tienda_publicar(uuid, jsonb, text), public.tienda_restaurar_version(uuid),
  public.tienda_pagina_guardar(uuid, uuid, jsonb), public.tienda_dominio_solicitar(uuid, text), public.tienda_dominio_revisar(uuid, text, text),
  public.tienda_analitica(uuid, date, date), public.tienda_preparacion(uuid) to authenticated;
revoke all on function public.tienda_por_dominio(text), public.delivery_tienda_suscribir(uuid, text, boolean) from public;
grant execute on function public.tienda_por_dominio(text), public.delivery_tienda_suscribir(uuid, text, boolean) to anon, authenticated;
revoke all on function public.tienda_version_registrar() from public, anon, authenticated;
