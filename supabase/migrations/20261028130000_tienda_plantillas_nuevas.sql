-- FASE 3: plantillas nuevas (Atelier, Urbano, Mercado), dos estilos de letra y el bloque "cinta de anuncios".
-- Se aplicó en cuatro migraciones (tienda_fuentes_nuevas, tienda_plantillas_nuevas_y_cinta, tienda_cinta_filtra_antes_de_limitar); acá queda el SQL reunido y final.
-- Todo se valida en el servidor con la misma lógica que src/lib/storefront.ts.

do $mig$
declare d text; n text; extra text;
begin
  -- 1) estilos de letra del diseño
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = '_ts_diseno';
  n := replace(d, 'array[''sans'',''serif'',''redondeada'',''display'',''mono'']', 'array[''sans'',''serif'',''redondeada'',''display'',''mono'',''geometrica'',''editorial'']');
  if n = d then raise exception 'No se pudo extender _ts_diseno: la definición vigente cambió'; end if;
  execute n;

  -- 2) plantillas permitidas al guardar el tema
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'delivery_guardar_tienda_tema';
  n := replace(d, '(''boutique'',''galeria'',''impacto'',''gourmet'')', '(''boutique'',''galeria'',''impacto'',''gourmet'',''atelier'',''urbano'',''mercado'')');
  if n = d then raise exception 'No se pudo extender delivery_guardar_tienda_tema: la definición vigente cambió'; end if;
  execute n;

  -- 3) estilos de portada nuevos y bloque "cinta"
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = '_ts_bloque';
  n := replace(d, 'array[''boutique'',''galeria'',''impacto'',''gourmet'',''simple'']', 'array[''boutique'',''galeria'',''impacto'',''gourmet'',''atelier'',''urbano'',''mercado'',''simple'']');
  if n = d then raise exception 'No se pudo extender los estilos de portada'; end if;
  extra := $br$
    when 'cinta' then
      select coalesce(jsonb_agg(f.x), '[]'::jsonb) into items
        from (select e.x from (select public._ts_txt(jsonb_build_object('t', el), 't', 60) x from jsonb_array_elements_text(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el) e where e.x is not null limit 6) f;
      return base || jsonb_build_object('items', items, 'estilo', public._ts_enum(b, 'estilo', array['acento','oscuro','claro'], 'acento'));
$br$;
  d := n;
  n := replace(d, E'    else\n      return null;', extra || E'    else\n      return null;');
  if n = d then raise exception 'No se pudo agregar el bloque cinta'; end if;
  execute n;
end $mig$;
