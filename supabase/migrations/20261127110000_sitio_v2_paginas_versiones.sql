-- Mi tienda v2 (2/2): el sitio entero (inicio + páginas) se edita en borrador, se publica junto y se versiona junto.
-- También: biblioteca de secciones guardadas por tienda.

-- 1) Borrador por página. El público nunca lo ve: se cierran las columnas nuevas con permisos de columna. -----------------
alter table public.delivery_tienda_paginas add column if not exists borrador jsonb check (borrador is null or (jsonb_typeof(borrador) = 'object' and length(borrador::text) <= 120000));
alter table public.delivery_tienda_paginas add column if not exists borrador_at timestamptz;

-- (El cierre de las columnas de borrador al público va en 20261127120000, después de publicar el front.)

alter table public.delivery_tienda_versiones add column if not exists paginas jsonb check (paginas is null or jsonb_typeof(paginas) = 'array');

-- Validación de una página (la usa guardar y publicar). Devuelve la fila lista para escribir o lanza un error claro.
create or replace function public._tp_validar(p_comercio uuid, p_id uuid, p jsonb) returns jsonb
language plpgsql stable set search_path to 'public' as $$
declare v_slug text; v_tipo text; v_bloques jsonb := '[]'::jsonb; b jsonb; n int := 0; v_estado text; v_img text; v_clase text;
begin
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 120000 then raise exception 'Datos de la página inválidos'; end if;
  v_tipo := coalesce(p->>'tipo', 'informativa');
  if v_tipo not in ('informativa', 'landing') then raise exception 'Tipo de página inválido'; end if;
  v_clase := coalesce(nullif(p->>'clase', ''), 'otra');
  if v_clase not in ('nosotros', 'contacto', 'faq', 'envios', 'cambios', 'privacidad', 'condiciones', 'campana', 'marca', 'otra') then v_clase := 'otra'; end if;
  v_slug := lower(btrim(coalesce(p->>'slug', '')));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 70 then raise exception 'La dirección de la página "%" solo admite letras minúsculas, números y guiones', coalesce(p->>'titulo', ''); end if;
  if char_length(btrim(coalesce(p->>'titulo', ''))) not between 2 and 90 then raise exception 'El título de cada página tiene que tener entre 2 y 90 caracteres'; end if;
  if exists (select 1 from public.delivery_tienda_paginas where comercio_id = p_comercio and id is distinct from p_id
             and (slug = v_slug or borrador->>'slug' = v_slug)) then raise exception 'Ya tenés otra página con la dirección /%', v_slug; end if;
  v_estado := coalesce(p->>'estado', 'borrador');
  if v_estado not in ('borrador', 'publicada') then raise exception 'Estado inválido'; end if;
  v_img := nullif(btrim(coalesce(p->>'imagen_url', '')), '');
  if v_img is not null and (v_img !~ '^https://' or length(v_img) > 600) then raise exception 'La imagen de la página tiene que ser una dirección https'; end if;
  if jsonb_typeof(p->'bloques') = 'array' then
    if jsonb_array_length(p->'bloques') > 40 then raise exception 'Una página admite hasta 40 secciones'; end if;
    for b in select jsonb_array_elements(p->'bloques') loop
      n := n + 1; b := public._ts_bloque(b, n);
      if b is not null and b->>'tipo' <> 'catalogo' then v_bloques := v_bloques || jsonb_build_array(b); end if;
    end loop;
  end if;
  return jsonb_build_object('tipo', v_tipo, 'clase', v_clase, 'slug', v_slug, 'titulo', btrim(p->>'titulo'), 'contenido', left(nullif(p->>'contenido', ''), 20000),
    'bloques', v_bloques, 'estado', v_estado, 'seo_titulo', left(nullif(btrim(coalesce(p->>'seo_titulo', '')), ''), 70),
    'seo_descripcion', left(nullif(btrim(coalesce(p->>'seo_descripcion', '')), ''), 170), 'imagen_url', v_img, 'orden', coalesce(public._ts_int(p, 'orden', 0, 1000, 0), 0));
end $$;

-- Aplica (publica) una página ya validada.
create or replace function public._tp_aplicar(p_comercio uuid, p_id uuid, v jsonb) returns uuid
language plpgsql set search_path to 'public' as $$
declare v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.delivery_tienda_paginas (comercio_id, tipo, clase, slug, titulo, contenido, bloques, estado, seo_titulo, seo_descripcion, imagen_url, orden, publicada_at)
      values (p_comercio, v->>'tipo', v->>'clase', v->>'slug', v->>'titulo', v->>'contenido', v->'bloques', v->>'estado', v->>'seo_titulo', v->>'seo_descripcion', v->>'imagen_url',
              (v->>'orden')::int, case when v->>'estado' = 'publicada' then now() end)
      returning id into v_id;
  else
    update public.delivery_tienda_paginas set tipo = v->>'tipo', clase = v->>'clase', slug = v->>'slug', titulo = v->>'titulo', contenido = v->>'contenido', bloques = v->'bloques',
           estado = v->>'estado', seo_titulo = v->>'seo_titulo', seo_descripcion = v->>'seo_descripcion', imagen_url = v->>'imagen_url', orden = (v->>'orden')::int,
           publicada_at = case when v->>'estado' = 'publicada' and publicada_at is null then now() else publicada_at end,
           borrador = null, borrador_at = null, updated_at = now()
     where id = v_id and comercio_id = p_comercio;
    if not found then raise exception 'Página no encontrada'; end if;
  end if;
  return v_id;
end $$;

-- Guardado directo (compatibilidad con la pantalla anterior): valida y publica la página en el acto.
create or replace function public.tienda_pagina_guardar(p_comercio uuid, p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  return public._tp_aplicar(p_comercio, p_id, public._tp_validar(p_comercio, p_id, p));
end $$;

-- Borrador de una página. Si la página es nueva, se crea oculta (estado borrador) y su contenido vive solo en el borrador.
create or replace function public.tienda_pagina_borrador_guardar(p_comercio uuid, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_id uuid := p_id; v_at timestamptz := now();
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  v := public._tp_validar(p_comercio, p_id, p);
  if v_id is null then
    if (select count(*) from public.delivery_tienda_paginas where comercio_id = p_comercio) >= 60 then raise exception 'Llegaste al máximo de 60 páginas'; end if;
    insert into public.delivery_tienda_paginas (comercio_id, tipo, clase, slug, titulo, estado, borrador, borrador_at)
      values (p_comercio, v->>'tipo', v->>'clase', v->>'slug', v->>'titulo', 'borrador', v, v_at)
      returning id into v_id;
  else
    update public.delivery_tienda_paginas set borrador = v, borrador_at = v_at where id = v_id and comercio_id = p_comercio;
    if not found then raise exception 'Página no encontrada'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'at', v_at);
end $$;

create or replace function public.tienda_pagina_borrador_descartar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.delivery_tienda_paginas;
begin
  select * into r from public.delivery_tienda_paginas where id = p_id;
  if not found or not public.delivery_permiso(r.comercio_id, 'ajustes') then raise exception 'Página no encontrada'; end if;
  -- Una página que nunca se publicó solo existe como borrador: descartarla es borrarla.
  if r.publicada_at is null and r.estado = 'borrador' and (r.bloques = '[]'::jsonb and r.contenido is null) then
    delete from public.delivery_tienda_paginas where id = p_id;
  else
    update public.delivery_tienda_paginas set borrador = null, borrador_at = null where id = p_id;
  end if;
end $$;

-- Páginas para el editor (con su borrador). El público no puede leer el borrador.
create or replace function public.tienda_paginas_editor(p_comercio uuid) returns setof jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  return query select to_jsonb(p) from public.delivery_tienda_paginas p where p.comercio_id = p_comercio order by p.orden, p.titulo;
end $$;

-- 2) Publicar todo el sitio en una transacción: tema (si hay borrador o viene uno) + cada página con borrador. -----------------
create or replace function public.tienda_publicar(p_comercio uuid, p_tema jsonb default null, p_nota text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_tema jsonb := p_tema; r record; n int := 0; v_ver uuid;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if v_tema is null then select tema into v_tema from public.delivery_tienda_borradores where comercio_id = p_comercio; end if;
  perform set_config('woref.tienda_nota', left(coalesce(btrim(p_nota), ''), 120), true);
  if v_tema is not null then
    perform public.delivery_guardar_tienda_tema(p_comercio, v_tema);
    delete from public.delivery_tienda_borradores where comercio_id = p_comercio;
    n := n + 1;
  end if;
  for r in select id, borrador from public.delivery_tienda_paginas where comercio_id = p_comercio and borrador is not null for update loop
    perform public._tp_aplicar(p_comercio, r.id, public._tp_validar(p_comercio, r.id, r.borrador));
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'No hay cambios para publicar'; end if;
  -- La versión guarda el sitio completo: si el tema cambió, el disparador ya creó la fila de esta transacción.
  select id into v_ver from public.delivery_tienda_versiones where comercio_id = p_comercio and created_at = now() order by created_at desc limit 1;
  if v_ver is null then
    insert into public.delivery_tienda_versiones (comercio_id, tema, nota, publicado_por)
      select id, coalesce(tienda_tema, '{}'::jsonb), nullif(left(coalesce(btrim(p_nota), ''), 120), ''), auth.uid() from public.delivery_comercios where id = p_comercio
      returning id into v_ver;
    delete from public.delivery_tienda_versiones where comercio_id = p_comercio and id not in (select id from public.delivery_tienda_versiones where comercio_id = p_comercio order by created_at desc limit 40);
  end if;
  update public.delivery_tienda_versiones set paginas = (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'clase', clase, 'slug', slug, 'titulo', titulo, 'contenido', contenido, 'bloques', bloques, 'estado', estado,
      'seo_titulo', seo_titulo, 'seo_descripcion', seo_descripcion, 'imagen_url', imagen_url, 'orden', orden) order by orden, titulo), '[]'::jsonb)
    from public.delivery_tienda_paginas where comercio_id = p_comercio and (publicada_at is not null or estado = 'publicada'))
  where id = v_ver;
end $$;

-- 3) Restaurar una versión: el tema y las páginas vuelven como borrador (nada cambia en línea hasta publicar). -----------------
create or replace function public.tienda_restaurar_version(p_version uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.delivery_tienda_versiones; pg jsonb; v_id uuid;
begin
  select * into v from public.delivery_tienda_versiones where id = p_version;
  if not found or not public.delivery_permiso(v.comercio_id, 'ajustes') then raise exception 'Versión no encontrada'; end if;
  perform public.tienda_borrador_guardar(v.comercio_id, v.tema);
  if v.paginas is not null then
    -- Páginas que no existían en esa versión: se ocultan al publicar.
    update public.delivery_tienda_paginas p set borrador = (to_jsonb(p) - 'borrador' - 'borrador_at' - 'id' - 'comercio_id') || jsonb_build_object('estado', 'borrador'), borrador_at = now()
     where p.comercio_id = v.comercio_id and p.estado = 'publicada'
       and not exists (select 1 from jsonb_array_elements(v.paginas) x where (x->>'id')::uuid = p.id);
    for pg in select * from jsonb_array_elements(v.paginas) loop
      v_id := (pg->>'id')::uuid;
      if exists (select 1 from public.delivery_tienda_paginas where id = v_id and comercio_id = v.comercio_id) then
        update public.delivery_tienda_paginas set borrador = pg - 'id', borrador_at = now() where id = v_id;
      elsif not exists (select 1 from public.delivery_tienda_paginas where comercio_id = v.comercio_id and (slug = pg->>'slug' or borrador->>'slug' = pg->>'slug')) then
        insert into public.delivery_tienda_paginas (comercio_id, tipo, clase, slug, titulo, estado, borrador, borrador_at)
          values (v.comercio_id, pg->>'tipo', pg->>'clase', pg->>'slug', pg->>'titulo', 'borrador', pg - 'id', now());
      end if;
    end loop;
  end if;
  return v.tema;
end $$;

-- 4) Secciones guardadas (biblioteca de la tienda). ------------------------------------------------------------------------------
create table if not exists public.delivery_tienda_secciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  bloque jsonb not null check (jsonb_typeof(bloque) = 'object' and length(bloque::text) <= 20000),
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists delivery_tienda_secciones_idx on public.delivery_tienda_secciones (comercio_id, created_at desc);
alter table public.delivery_tienda_secciones enable row level security;
revoke all on public.delivery_tienda_secciones from anon, authenticated;
grant select on public.delivery_tienda_secciones to authenticated;
grant all on public.delivery_tienda_secciones to service_role;
drop policy if exists "Secciones guardadas para el equipo" on public.delivery_tienda_secciones;
create policy "Secciones guardadas para el equipo" on public.delivery_tienda_secciones for select to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));

create or replace function public.tienda_seccion_guardar(p_comercio uuid, p_nombre text, p_bloque jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare b jsonb; v_id uuid;
begin
  if not public.delivery_permiso(p_comercio, 'ajustes') then raise exception 'No tenés permiso para editar la tienda'; end if;
  if char_length(btrim(coalesce(p_nombre, ''))) not between 2 and 60 then raise exception 'Poné un nombre de 2 a 60 caracteres'; end if;
  b := public._ts_bloque(p_bloque, 1);
  if b is null then raise exception 'Esa sección no se puede guardar'; end if;
  if b->>'tipo' = 'catalogo' then raise exception 'El catálogo completo no se guarda como sección'; end if;
  if (select count(*) from public.delivery_tienda_secciones where comercio_id = p_comercio) >= 50 then raise exception 'Llegaste al máximo de 50 secciones guardadas'; end if;
  insert into public.delivery_tienda_secciones (comercio_id, nombre, bloque, creado_por) values (p_comercio, btrim(p_nombre), b, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.tienda_seccion_borrar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c uuid;
begin
  select comercio_id into c from public.delivery_tienda_secciones where id = p_id;
  if c is null or not public.delivery_permiso(c, 'ajustes') then raise exception 'Sección no encontrada'; end if;
  delete from public.delivery_tienda_secciones where id = p_id;
end $$;

revoke all on function public._tp_validar(uuid, uuid, jsonb), public._tp_aplicar(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.tienda_pagina_borrador_guardar(uuid, uuid, jsonb), public.tienda_pagina_borrador_descartar(uuid), public.tienda_paginas_editor(uuid),
  public.tienda_seccion_guardar(uuid, text, jsonb), public.tienda_seccion_borrar(uuid) from public, anon;
grant execute on function public.tienda_pagina_borrador_guardar(uuid, uuid, jsonb), public.tienda_pagina_borrador_descartar(uuid), public.tienda_paginas_editor(uuid),
  public.tienda_seccion_guardar(uuid, text, jsonb), public.tienda_seccion_borrar(uuid) to authenticated;
