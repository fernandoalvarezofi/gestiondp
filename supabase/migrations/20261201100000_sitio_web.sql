-- Creador de sitios web: un comercio puede ser "tienda" (vende en línea y aparece en el Market) o "sitio" (página web del
-- negocio: presentación, servicios, contenido y formulario de consultas al CRM, sin catálogo, carrito ni pedidos).
-- Comparte todo con las tiendas: tabla, editor, temas, páginas, versiones, publicación, CRM y permisos del equipo.
-- Migración aditiva: las tiendas existentes quedan como "tienda" y no cambian en nada.

alter table public.delivery_comercios
  add column if not exists tipo_sitio text not null default 'tienda';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_comercios_tipo_sitio_check') then
    alter table public.delivery_comercios add constraint delivery_comercios_tipo_sitio_check check (tipo_sitio in ('tienda', 'sitio'));
  end if;
end $$;
-- La lectura es por columnas (ver COMERCIO_COLS): la nueva se suma explícitamente. La escritura sigue la regla de siempre
-- (solo quien tiene el permiso "ajustes" del local, por RLS).
grant select (tipo_sitio) on public.delivery_comercios to anon, authenticated;

-- Un sitio web no vende: el servidor rechaza pedidos aunque alguien arme la llamada a mano.
create or replace function public.delivery_pedido_solo_tiendas()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from public.delivery_comercios where id = new.comercio_id and tipo_sitio = 'sitio') then
    raise exception 'Este negocio tiene un sitio web informativo y no recibe pedidos en línea';
  end if;
  return new;
end $$;
-- Los disparadores BEFORE corren por orden alfabético: este va primero para que el rechazo diga su motivo.
drop trigger if exists delivery_pedido_solo_tiendas on public.delivery_pedidos;
drop trigger if exists a00_pedido_solo_tiendas on public.delivery_pedidos;
create trigger a00_pedido_solo_tiendas before insert on public.delivery_pedidos
  for each row execute function public.delivery_pedido_solo_tiendas();

-- Guardar el tema: a las tiendas se les agrega el catálogo si falta (como siempre); a los sitios no.
do $$
declare v_def text; v_nueva text;
begin
  v_def := pg_get_functiondef('public.delivery_guardar_tienda_tema(uuid, jsonb)'::regprocedure);
  if position('tipo_sitio' in v_def) > 0 then return; end if;
  v_nueva := replace(v_def,
    'if not tiene_catalogo then bloques',
    'if not tiene_catalogo and coalesce((select c.tipo_sitio from public.delivery_comercios c where c.id = p_comercio), ''tienda'') = ''tienda'' then bloques');
  if v_nueva = v_def then raise exception 'No se encontró la línea del catálogo en delivery_guardar_tienda_tema'; end if;
  execute v_nueva;
end $$;

-- Preparación para publicar: la lista depende del tipo (a un sitio no se le piden productos, horarios ni políticas de envío).
create or replace function public.tienda_preparacion(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare c public.delivery_comercios; t jsonb; v_pub int; v_foto int; v_pag int; v_form boolean;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso'; end if;
  select * into c from public.delivery_comercios where id = p_comercio;
  t := coalesce((select tema from public.delivery_tienda_borradores where comercio_id = p_comercio), c.tienda_tema, '{}'::jsonb);
  select count(*) into v_pag from public.delivery_tienda_paginas where comercio_id = p_comercio and estado = 'publicada';
  if c.tipo_sitio = 'sitio' then
    v_form := coalesce(c.tienda_tema -> 'bloques', '[]'::jsonb) @> '[{"tipo":"formulario"}]'
      or exists (select 1 from public.delivery_tienda_paginas where comercio_id = p_comercio and estado = 'publicada' and bloques @> '[{"tipo":"formulario"}]');
    return jsonb_build_array(
      jsonb_build_object('clave', 'aprobado', 'ok', c.aprobado and c.activo, 'titulo', 'Sitio aprobado por Woref', 'detalle', case when c.aprobado then 'Tu sitio está aprobado.' else 'Woref revisa cada negocio antes de que su sitio sea público. Completá la verificación en Configuración.' end, 'grave', true),
      jsonb_build_object('clave', 'logo', 'ok', c.logo_url is not null, 'titulo', 'Logo del negocio', 'detalle', case when c.logo_url is null then 'Subilo en Configuración → Datos del negocio.' else 'Cargado.' end, 'grave', false),
      jsonb_build_object('clave', 'portada', 'ok', coalesce(t->>'banner_url', '') <> '' or exists (select 1 from jsonb_array_elements(coalesce(t->'bloques', '[]'::jsonb)) b where b->>'tipo' = 'portada' and coalesce(b->>'imagen_url', '') <> ''), 'titulo', 'Imagen de portada', 'detalle', 'Una foto propia y de buena calidad para la portada.', 'grave', false),
      jsonb_build_object('clave', 'contacto', 'ok', c.telefono is not null or coalesce(t->>'whatsapp', '') <> '', 'titulo', 'Teléfono o WhatsApp', 'detalle', 'Para que te puedan escribir o llamar.', 'grave', false),
      jsonb_build_object('clave', 'formulario', 'ok', v_form, 'titulo', 'Formulario de consultas publicado', 'detalle', 'Las consultas llegan a Clientes (CRM) como tareas para responder.', 'grave', false),
      jsonb_build_object('clave', 'paginas', 'ok', v_pag > 0, 'titulo', 'Páginas publicadas', 'detalle', v_pag || ' publicadas', 'grave', false),
      jsonb_build_object('clave', 'seo', 'ok', coalesce(t->>'seo_descripcion', '') <> '', 'titulo', 'Descripción para buscadores', 'detalle', 'Así aparece tu sitio en Google y al compartirlo.', 'grave', false),
      jsonb_build_object('clave', 'borrador', 'ok', not exists (select 1 from public.delivery_tienda_borradores where comercio_id = p_comercio), 'titulo', 'Cambios publicados', 'detalle', 'Hay cambios en borrador sin publicar.', 'grave', false)
    );
  end if;
  select count(*) filter (where estado = 'publicado'), count(*) filter (where estado = 'publicado' and imagen_url is null) into v_pub, v_foto from public.delivery_productos where comercio_id = p_comercio;
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

-- Alta de un sitio web en UNA transacción: negocio + diseño + páginas iniciales. Si algo falla no queda nada a medias.
-- Corre con los permisos de quien llama (SECURITY INVOKER): valen la RLS de alta, el disparador que protege los campos
-- de moderación (nace "en revisión") y los permisos de las funciones de la tienda.
-- Idempotente: el id lo genera el cliente y lo conserva en su borrador; reintentar (doble clic, recarga, red cortada
-- después de crear) devuelve el mismo sitio en vez de crear otro.
create or replace function public.sitio_crear(p_id uuid, p_datos jsonb, p_tema jsonb, p_paginas jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid(); v_ex_id uuid; v_ex_dueno uuid; v_ex_slug text; v_nombre text; v_slug text; v_categoria text; p jsonb; n int := 0;
begin
  if v_uid is null then raise exception 'Iniciá sesión para crear tu sitio'; end if;
  if p_id is null then raise exception 'Falta el identificador del sitio'; end if;
  -- Solo columnas con permiso de lectura (la tabla se lee por columnas).
  select id, propietario_id, slug into v_ex_id, v_ex_dueno, v_ex_slug from public.delivery_comercios where id = p_id;
  if v_ex_id is not null then
    if v_ex_dueno is distinct from v_uid then raise exception 'No se pudo crear el sitio'; end if;
    return jsonb_build_object('id', v_ex_id, 'slug', v_ex_slug, 'creado', false);
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' or jsonb_typeof(p_tema) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if jsonb_typeof(coalesce(p_paginas, '[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(p_paginas, '[]'::jsonb)) > 6 then raise exception 'Demasiadas páginas iniciales'; end if;

  v_nombre := btrim(coalesce(p_datos->>'nombre', ''));
  if char_length(v_nombre) not between 3 and 80 then raise exception 'El nombre del negocio tiene que tener entre 3 y 80 caracteres'; end if;
  v_slug := lower(btrim(coalesce(p_datos->>'slug', '')));
  if not public.delivery_slug_disponible(v_slug) then raise exception 'Esa dirección web no está disponible. Probá con otra'; end if;
  v_categoria := coalesce(nullif(p_datos->>'categoria', ''), 'tiendas');
  if v_categoria not in ('comida', 'supermercado', 'farmacia', 'tiendas') then v_categoria := 'tiendas'; end if;
  if char_length(coalesce(p_datos->>'rubro', '')) > 40 or char_length(coalesce(p_datos->>'descripcion', '')) > 300
     or char_length(coalesce(p_datos->>'telefono', '')) > 40 or char_length(coalesce(p_datos->>'direccion', '')) > 200 then
    raise exception 'Algún dato es demasiado largo';
  end if;
  -- Freno al abuso: cada negocio pasa por revisión manual.
  if (select count(*) from public.delivery_comercios where propietario_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Creaste varios negocios hoy. Probá de nuevo mañana o escribinos desde Ayuda';
  end if;

  insert into public.delivery_comercios (id, propietario_id, nombre, slug, categoria, rubro, descripcion, telefono, direccion, tipo_sitio, acepta_retiro, acepta_programados)
  values (p_id, v_uid, v_nombre, v_slug, v_categoria::public.delivery_categoria, nullif(btrim(coalesce(p_datos->>'rubro', '')), ''),
          nullif(btrim(coalesce(p_datos->>'descripcion', '')), ''), nullif(btrim(coalesce(p_datos->>'telefono', '')), ''),
          btrim(coalesce(p_datos->>'direccion', '')), 'sitio', false, false);

  perform public.delivery_guardar_tienda_tema(p_id, p_tema);
  for p in select value from jsonb_array_elements(coalesce(p_paginas, '[]'::jsonb)) loop
    n := n + 1;
    perform public.tienda_pagina_guardar(p_id, null, (p - 'estado' - 'orden') || jsonb_build_object('estado', 'publicada', 'orden', n));
  end loop;
  return jsonb_build_object('id', p_id, 'slug', v_slug, 'creado', true);
end $$;
revoke all on function public.sitio_crear(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sitio_crear(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Mis negocios: suma el tipo (tienda o sitio) y la dirección web, para que la Home y el panel sepan qué ofrecer.
create or replace function public.delivery_mis_comercios()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'nombre', x.nombre, 'logo_url', x.logo_url, 'direccion', x.direccion, 'rol', x.rol, 'aprobado', x.aprobado, 'esta_abierto', x.esta_abierto,
      'negocio_id', x.business_id, 'negocio', b.nombre, 'parent_store_id', x.parent_store_id, 'tipo_sitio', x.tipo_sitio, 'slug', x.slug
    ) order by x.orden, b.nombre, x.created_at), '[]'::jsonb)
  from (
    select c.id, c.nombre, c.logo_url, c.direccion, 'dueno'::text as rol, 0 as orden, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id, c.tipo_sitio, c.slug
      from public.delivery_comercios c where c.propietario_id = auth.uid() and c.eliminado_at is null
    union all
    select c.id, c.nombre, c.logo_url, c.direccion, e.rol, 1, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id, c.tipo_sitio, c.slug
      from public.delivery_comercio_equipo e join public.delivery_comercios c on c.id = e.comercio_id
     where e.user_id = auth.uid() and e.estado = 'activo' and c.propietario_id is distinct from auth.uid() and c.eliminado_at is null
    union all
    select c.id, c.nombre, c.logo_url, c.direccion,
           case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end,
           2, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id, c.tipo_sitio, c.slug
      from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
     where m.user_id = auth.uid() and m.estado = 'activo' and c.propietario_id is distinct from auth.uid() and c.eliminado_at is null
       and not exists (select 1 from public.delivery_comercio_equipo e where e.comercio_id = c.id and e.user_id = auth.uid() and e.estado = 'activo')
  ) x
  left join public.core_businesses b on b.id = x.business_id
$$;
