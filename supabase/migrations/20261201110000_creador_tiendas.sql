-- Creador unificado (tienda online, carta digital con QR, servicios con turnos y sitio web) sobre "Mi tienda".
-- Tienda independiente como en Tiendanube: vende las 24 h, el comercio despacha (envío propio con seguimiento) y aparecer en la
-- app de delivery de Woref es opcional. Todo aditivo: las tiendas existentes quedan igual (en_market = true, sin envío propio).

alter table public.delivery_comercios
  add column if not exists en_market boolean not null default true,
  add column if not exists envio_propio boolean not null default false,
  add column if not exists envio_detalle text,
  -- Carta digital: false = muestra la carta (con precios) pero no toma pedidos en línea.
  add column if not exists pedidos_online boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_comercios_envio_detalle_check') then
    alter table public.delivery_comercios add constraint delivery_comercios_envio_detalle_check check (envio_detalle is null or char_length(envio_detalle) <= 140);
  end if;
end $$;
grant select (en_market, envio_propio, envio_detalle, pedidos_online) on public.delivery_comercios to anon, authenticated;
-- Un sitio web nunca va al Market.
update public.delivery_comercios set en_market = false where tipo_sitio = 'sitio' and en_market;

alter table public.delivery_pedidos add column if not exists envio_seguimiento text;
-- "envio": lo despacha el comercio (envío propio o correo).
alter table public.delivery_pedidos drop constraint if exists delivery_pedidos_tipo_entrega_check;
alter table public.delivery_pedidos add constraint delivery_pedidos_tipo_entrega_check check (tipo_entrega = any (array['delivery', 'retiro', 'envio']));

-- Pedido: nuevo tipo de entrega "envio" (lo despacha el comercio). Sin radio, sin zonas ni repartidores de Woref, sin propina,
-- y sin exigir que el local esté "abierto" en este momento (la tienda online vende siempre; se despacha después).
-- "delivery" (repartidores de Woref) solo para tiendas que están en el Market.
do $$
declare v_def text; v_nueva text;
  pares text[][] := array[
    array['IF p_tipo_entrega IS NULL OR p_tipo_entrega NOT IN (''delivery'', ''retiro'') THEN',
          'IF p_tipo_entrega IS NULL OR p_tipo_entrega NOT IN (''delivery'', ''retiro'', ''envio'') THEN'],
    array['IF v_retiro AND NOT v_store.acepta_retiro THEN RAISE EXCEPTION ''Este comercio no ofrece retiro en el local''; END IF;',
          'IF v_retiro AND NOT v_store.acepta_retiro THEN RAISE EXCEPTION ''Este comercio no ofrece retiro en el local''; END IF;
  IF NOT v_store.pedidos_online THEN RAISE EXCEPTION ''Este local muestra su carta pero no toma pedidos en línea''; END IF;
  IF p_tipo_entrega = ''envio'' AND NOT v_store.envio_propio THEN RAISE EXCEPTION ''Esta tienda no hace envíos a domicilio''; END IF;
  IF p_tipo_entrega = ''delivery'' AND NOT v_store.en_market THEN RAISE EXCEPTION ''Esta tienda no trabaja con los repartidores de Woref''; END IF;
  IF p_tipo_entrega = ''envio'' THEN v_propina := 0; END IF;'],
    array['IF NOT v_store.esta_abierto OR NOT public.delivery_abierto_ahora(v_store.horarios) THEN',
          'IF NOT v_store.esta_abierto OR (p_tipo_entrega <> ''envio'' AND NOT public.delivery_abierto_ahora(v_store.horarios)) THEN'],
    array['IF v_store.latitud IS NOT NULL AND v_store.longitud IS NOT NULL THEN
      IF v_lat IS NULL OR v_lng IS NULL',
          'IF p_tipo_entrega = ''delivery'' AND v_store.latitud IS NOT NULL AND v_store.longitud IS NOT NULL THEN
      IF v_lat IS NULL OR v_lng IS NULL'],
    array['v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);
    IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN',
          'v_envio := public.delivery_costo_envio(v_store.costo_envio, v_store.costo_por_km, v_km);
    IF p_tipo_entrega = ''delivery'' AND v_lat IS NOT NULL AND v_lng IS NOT NULL THEN']
  ];
  i int;
begin
  v_def := pg_get_functiondef('public.delivery_crear_pedido(uuid, jsonb, text, uuid, text, numeric, text, text, text, numeric, numeric, text, timestamptz, numeric, boolean)'::regprocedure);
  if position('envio_propio' in v_def) > 0 then return; end if;
  v_nueva := v_def;
  for i in 1 .. array_length(pares, 1) loop
    if position(pares[i][1] in v_nueva) = 0 then raise exception 'delivery_crear_pedido: no se encontró el tramo %', i; end if;
    v_nueva := replace(v_nueva, pares[i][1], pares[i][2]);
  end loop;
  execute v_nueva;
end $$;

-- Libro: en un envío propio el costo del envío es del comercio (no margen de Woref) y el cobro lo hace el comercio.
do $$
declare v_def text; v_nueva text;
  pares text[][] := array[
    array['v_margen := p.costo_envio - v_genv;',
          'v_margen := CASE WHEN p.tipo_entrega = ''envio'' THEN 0 ELSE p.costo_envio - v_genv END;'],
    array['(''comercio'', p.comercio_id, ''ventas'', ''cobrado_directo'', CASE WHEN p.tipo_entrega = ''retiro'' AND',
          '(''comercio'', p.comercio_id, ''ventas'', ''envio_propio'', CASE WHEN p.tipo_entrega = ''envio'' THEN p.costo_envio ELSE 0 END, NULL),
    (''comercio'', p.comercio_id, ''ventas'', ''cobrado_directo'', CASE WHEN p.tipo_entrega IN (''retiro'', ''envio'') AND']
  ];
  i int;
begin
  v_def := pg_get_functiondef('public.delivery_libro_pedido(uuid)'::regprocedure);
  if position('envio_propio' in v_def) > 0 then return; end if;
  v_nueva := v_def;
  for i in 1 .. array_length(pares, 1) loop
    if position(pares[i][1] in v_nueva) = 0 then raise exception 'delivery_libro_pedido: no se encontró el tramo %', i; end if;
    v_nueva := replace(v_nueva, pares[i][1], pares[i][2]);
  end loop;
  execute v_nueva;
end $$;

-- El comercio despacha un pedido con envío propio: pasa a "en camino" con el número o enlace de seguimiento.
create or replace function public.pedido_despachar(p_pedido uuid, p_seguimiento text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare p public.delivery_pedidos; v_seg text := nullif(btrim(coalesce(p_seguimiento, '')), '');
begin
  select * into p from public.delivery_pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not public.delivery_permiso(p.comercio_id, 'pedidos') then raise exception 'No tenés permiso para despachar este pedido'; end if;
  if p.tipo_entrega <> 'envio' then raise exception 'Solo los pedidos con envío de la tienda se despachan así'; end if;
  if p.estado not in ('confirmado', 'preparando') then raise exception 'Primero aceptá el pedido'; end if;
  if v_seg is not null and (char_length(v_seg) > 200 or (v_seg ~* '^[a-z]+:' and v_seg !~* '^https://')) then raise exception 'El seguimiento es un código o un enlace https'; end if;
  update public.delivery_pedidos set estado = 'en_camino', preparando_at = coalesce(preparando_at, now()), en_camino_at = now(), envio_seguimiento = v_seg where id = p_pedido;
end $$;
revoke all on function public.pedido_despachar(uuid, text) from public, anon;
grant execute on function public.pedido_despachar(uuid, text) to authenticated;

-- Alta unificada: tienda online, carta digital (restaurantes), servicios con turnos o sitio web, en UNA transacción, con los permisos de quien llama.
-- Idempotente por id (el cliente lo genera y lo guarda en su borrador).
create or replace function public.negocio_crear(p_id uuid, p_tipo text, p_datos jsonb, p_tema jsonb, p_paginas jsonb default '[]'::jsonb,
  p_productos jsonb default '[]'::jsonb, p_servicios jsonb default '[]'::jsonb, p_agenda jsonb default null)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid(); v_ex_id uuid; v_ex_dueno uuid; v_ex_slug text; v_nombre text; v_slug text; v_categoria text; p jsonb; n int := 0;
  v_tienda boolean := p_tipo in ('tienda', 'carta'); v_pedidos boolean := true; v_prof uuid; v_serv uuid; v_dia int; v_desde time; v_hasta time;
  v_envio numeric; v_gratis numeric;
begin
  if v_uid is null then raise exception 'Iniciá sesión para crear tu negocio'; end if;
  if p_id is null then raise exception 'Falta el identificador'; end if;
  if p_tipo is null or p_tipo not in ('tienda', 'carta', 'servicios', 'sitio') then raise exception 'Tipo de negocio inválido'; end if;
  select id, propietario_id, slug into v_ex_id, v_ex_dueno, v_ex_slug from public.delivery_comercios where id = p_id;
  if v_ex_id is not null then
    if v_ex_dueno is distinct from v_uid then raise exception 'No se pudo crear el negocio'; end if;
    return jsonb_build_object('id', v_ex_id, 'slug', v_ex_slug, 'creado', false);
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' or jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if jsonb_typeof(coalesce(p_paginas, '[]')) <> 'array' or jsonb_array_length(coalesce(p_paginas, '[]')) > 6 then raise exception 'Demasiadas páginas iniciales'; end if;
  if jsonb_typeof(coalesce(p_productos, '[]')) <> 'array' or jsonb_array_length(coalesce(p_productos, '[]')) > 40 then raise exception 'Cargá hasta 40 productos al empezar'; end if;
  if jsonb_typeof(coalesce(p_servicios, '[]')) <> 'array' or jsonb_array_length(coalesce(p_servicios, '[]')) > 10 then raise exception 'Cargá hasta 10 servicios al empezar'; end if;
  if not v_tienda and jsonb_array_length(coalesce(p_productos, '[]')) > 0 then raise exception 'Solo una tienda o una carta cargan productos'; end if;

  v_nombre := btrim(coalesce(p_datos->>'nombre', ''));
  if char_length(v_nombre) not between 3 and 80 then raise exception 'El nombre del negocio tiene que tener entre 3 y 80 caracteres'; end if;
  v_slug := lower(btrim(coalesce(p_datos->>'slug', '')));
  if not public.delivery_slug_disponible(v_slug) then raise exception 'Esa dirección web no está disponible. Probá con otra'; end if;
  v_categoria := coalesce(nullif(p_datos->>'categoria', ''), 'tiendas');
  if v_categoria not in ('comida', 'supermercado', 'farmacia', 'tiendas') then v_categoria := 'tiendas'; end if;
  if char_length(coalesce(p_datos->>'rubro', '')) > 40 or char_length(coalesce(p_datos->>'descripcion', '')) > 300
     or char_length(coalesce(p_datos->>'telefono', '')) > 40 or char_length(coalesce(p_datos->>'direccion', '')) > 200
     or char_length(coalesce(p_datos->>'envio_detalle', '')) > 140 then
    raise exception 'Algún dato es demasiado largo';
  end if;
  v_envio := coalesce(nullif(p_datos->>'costo_envio', '')::numeric, 0);
  v_gratis := nullif(p_datos->>'envio_gratis_desde', '')::numeric;
  if v_envio < 0 or v_envio > 1000000 or (v_gratis is not null and (v_gratis < 0 or v_gratis > 100000000)) then raise exception 'Revisá el costo de envío'; end if;
  v_pedidos := not v_tienda or coalesce((p_datos->>'pedidos_online')::boolean, true);
  if v_tienda and v_pedidos and not coalesce((p_datos->>'envio_propio')::boolean, false) and not coalesce((p_datos->>'acepta_retiro')::boolean, false) then
    raise exception 'Elegí al menos una forma de entrega: envío a domicilio o retiro';
  end if;
  if (select count(*) from public.delivery_comercios where propietario_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Creaste varios negocios hoy. Probá de nuevo mañana o escribinos desde Ayuda';
  end if;

  insert into public.delivery_comercios (id, propietario_id, nombre, slug, categoria, rubro, descripcion, telefono, direccion, tipo_sitio, en_market,
      envio_propio, envio_detalle, costo_envio, costo_por_km, envio_gratis_desde, acepta_retiro, acepta_programados, pedidos_online)
  values (p_id, v_uid, v_nombre, v_slug, v_categoria::public.delivery_categoria, nullif(btrim(coalesce(p_datos->>'rubro', '')), ''),
          nullif(btrim(coalesce(p_datos->>'descripcion', '')), ''), nullif(btrim(coalesce(p_datos->>'telefono', '')), ''),
          btrim(coalesce(p_datos->>'direccion', '')), case when v_tienda then 'tienda' else 'sitio' end, false,
          v_tienda and coalesce((p_datos->>'envio_propio')::boolean, false), nullif(btrim(coalesce(p_datos->>'envio_detalle', '')), ''),
          case when v_tienda then v_envio else 0 end, 0, case when v_tienda then v_gratis end,
          v_tienda and coalesce((p_datos->>'acepta_retiro')::boolean, false), false, v_pedidos);

  perform public.delivery_guardar_tienda_tema(p_id, p_tema);
  for p in select value from jsonb_array_elements(coalesce(p_paginas, '[]')) loop
    n := n + 1;
    perform public.tienda_pagina_guardar(p_id, null, (p - 'estado' - 'orden') || jsonb_build_object('estado', 'publicada', 'orden', n));
  end loop;

  n := 0;
  for p in select value from jsonb_array_elements(coalesce(p_productos, '[]')) loop
    n := n + 1;
    if char_length(btrim(coalesce(p->>'nombre', ''))) not between 2 and 120 then raise exception 'Revisá el nombre del producto %', n; end if;
    if coalesce(nullif(p->>'precio', '')::numeric, -1) <= 0 or (p->>'precio')::numeric > 100000000 then raise exception 'Revisá el precio del producto %', n; end if;
    if coalesce(p->>'imagen_url', '') <> '' and (p->>'imagen_url') !~ '^https://' then raise exception 'La foto del producto % tiene que ser https', n; end if;
    insert into public.delivery_productos (comercio_id, nombre, descripcion, precio, categoria, imagen_url, orden, destacado)
      values (p_id, btrim(p->>'nombre'), nullif(left(btrim(coalesce(p->>'descripcion', '')), 300), ''), (p->>'precio')::numeric, left(coalesce(nullif(btrim(p->>'categoria'), ''), 'Destacados'), 60),
              nullif(p->>'imagen_url', ''), n, n <= 4);
  end loop;

  if jsonb_array_length(coalesce(p_servicios, '[]')) > 0 then
    if jsonb_typeof(p_agenda) is distinct from 'object' then raise exception 'Faltan los horarios de atención'; end if;
    if char_length(btrim(coalesce(p_agenda->>'profesional', ''))) not between 2 and 80 then raise exception 'Escribí quién atiende'; end if;
    insert into public.profesionales (comercio_id, nombre, usuario_id) values (p_id, btrim(p_agenda->>'profesional'), v_uid) returning id into v_prof;
    v_desde := (p_agenda->>'desde')::time; v_hasta := (p_agenda->>'hasta')::time;
    if v_desde is null or v_hasta is null or v_hasta <= v_desde then raise exception 'Revisá el horario de atención'; end if;
    if jsonb_typeof(p_agenda->'dias') <> 'array' or jsonb_array_length(p_agenda->'dias') = 0 then raise exception 'Elegí los días de atención'; end if;
    for v_dia in select distinct (x)::int from jsonb_array_elements_text(p_agenda->'dias') x loop
      if v_dia not between 0 and 6 then raise exception 'Día inválido'; end if;
      insert into public.disponibilidad (profesional_id, dia_semana, desde, hasta) values (v_prof, v_dia, v_desde, v_hasta);
    end loop;
    n := 0;
    for p in select value from jsonb_array_elements(p_servicios) loop
      n := n + 1;
      if char_length(btrim(coalesce(p->>'nombre', ''))) not between 2 and 80 then raise exception 'Revisá el nombre del servicio %', n; end if;
      if coalesce(nullif(p->>'duracion_min', '')::int, 0) not between 5 and 600 then raise exception 'La duración del servicio % va de 5 a 600 minutos', n; end if;
      if coalesce(nullif(p->>'precio', '')::numeric, 0) < 0 or coalesce(nullif(p->>'precio', '')::numeric, 0) > 100000000 then raise exception 'Revisá el precio del servicio %', n; end if;
      insert into public.servicios (comercio_id, nombre, duracion_min, precio, orden) values (p_id, btrim(p->>'nombre'), (p->>'duracion_min')::int, coalesce(nullif(p->>'precio', '')::numeric, 0), n)
        returning id into v_serv;
      insert into public.profesional_servicios (profesional_id, servicio_id) values (v_prof, v_serv);
    end loop;
  end if;
  return jsonb_build_object('id', p_id, 'slug', v_slug, 'creado', true);
end $$;
revoke all on function public.negocio_crear(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.negocio_crear(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- El alta de sitio de la primera versión pasa a ser un caso del alta unificada (misma firma, mismo comportamiento).
create or replace function public.sitio_crear(p_id uuid, p_datos jsonb, p_tema jsonb, p_paginas jsonb default '[]'::jsonb)
returns jsonb language sql set search_path to 'public' as $$
  select public.negocio_crear(p_id, 'sitio', p_datos, p_tema, p_paginas, '[]'::jsonb, '[]'::jsonb, null)
$$;
