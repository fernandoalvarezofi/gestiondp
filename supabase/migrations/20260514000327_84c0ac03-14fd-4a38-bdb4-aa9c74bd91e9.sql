-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Limpiar trigger de auth si existe
drop trigger if exists on_auth_user_created on auth.users;

-- Limpiar tablas anteriores
drop table if exists public.consultas cascade;
drop table if exists public.estadisticas_publicacion cascade;
drop table if exists public.resenas cascade;
drop table if exists public.notificaciones cascade;
drop table if exists public.mensajes cascade;
drop table if exists public.conversaciones cascade;
drop table if exists public.seguidos cascade;
drop table if exists public.favoritos cascade;
drop table if exists public.repostes cascade;
drop table if exists public.comentarios cascade;
drop table if exists public.likes cascade;
drop table if exists public.media_publicacion cascade;
drop table if exists public.publicaciones cascade;
drop table if exists public.highlight_items cascade;
drop table if exists public.highlights cascade;
drop table if exists public.perfiles cascade;
drop table if exists public.barrios cascade;
drop table if exists public.ciudades cascade;

drop type if exists public.tipo_notificacion cascade;
drop type if exists public.estado_publicacion cascade;
drop type if exists public.tipo_propiedad cascade;
drop type if exists public.tipo_operacion cascade;
drop type if exists public.tipo_publicacion cascade;
drop type if exists public.tipo_usuario cascade;
drop type if exists public.formato_publicacion cascade;
drop type if exists public.estado_proyecto cascade;
drop type if exists public.tipo_miembro_comunidad cascade;

-- Enums
create type public.tipo_usuario as enum ('emprendedor','empresa','inversor','marca','freelancer','atleta','creador','profesional','institucion');
create type public.tipo_publicacion as enum ('update','proyecto','oportunidad','recurso','idea','logro','lanzamiento','busco_socio','busco_colaborador','hiring','contenido_corto','contenido_largo','video_corto','video_largo','encuesta','general');
create type public.formato_publicacion as enum ('texto','imagen','video_corto','video_largo','articulo','proyecto','encuesta','recurso');
create type public.estado_publicacion as enum ('activa','borrador','pausada','eliminada');
create type public.estado_proyecto as enum ('idea','en_desarrollo','lanzado','pausado','completado','buscando_equipo','buscando_inversion');
create type public.tipo_notificacion as enum ('nuevo_seguidor','like','comentario','respuesta_comentario','reposteo','mencion','nuevo_mensaje','match','invitacion_proyecto','invitacion_comunidad','oportunidad','nuevo_miembro_proyecto');
create type public.tipo_miembro_comunidad as enum ('miembro','moderador','admin');

-- Perfiles
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  username text unique not null,
  avatar_url text, portada_url text, bio text, actualmente text,
  ubicacion text, sitio_web text, instagram text, twitter text, linkedin text, youtube text,
  tipo public.tipo_usuario not null default 'emprendedor',
  skills text[], intereses text[], industria text, que_ofrece text, que_busca text,
  score integer not null default 0,
  verificado boolean not null default false,
  activo boolean not null default true,
  mensajes_privados boolean not null default true,
  mostrar_ubicacion boolean not null default false,
  total_seguidores integer not null default 0,
  total_siguiendo integer not null default 0,
  total_publicaciones integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_username text; final_username text; counter int := 0;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), '[^a-z0-9]+', '', 'g'));
  if length(base_username) < 3 then base_username := split_part(new.email,'@',1); end if;
  final_username := base_username;
  while exists (select 1 from public.perfiles where username = final_username) loop
    counter := counter + 1; final_username := base_username || counter::text;
  end loop;
  insert into public.perfiles (id, nombre, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), final_username)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger perfiles_updated_at before update on public.perfiles for each row execute procedure public.set_updated_at();

-- Highlights
create table public.highlights (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null, icono text, color_fondo text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.highlight_items (
  id uuid primary key default uuid_generate_v4(),
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  imagen_url text, publicacion_id uuid,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- Publicaciones
create table public.publicaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  tipo public.tipo_publicacion not null default 'general',
  formato public.formato_publicacion not null default 'texto',
  estado public.estado_publicacion not null default 'activa',
  titulo text, cuerpo text, cuerpo_largo text, tags text[],
  imagen_url text, video_url text, video_duracion integer, thumbnail_url text,
  encuesta_opciones text[], encuesta_cierre timestamptz,
  rol_buscado text, modalidad text, pais text, industria_op text,
  vistas integer not null default 0,
  total_likes integer not null default 0,
  total_comentarios integer not null default 0,
  total_repostes integer not null default 0,
  total_guardados integer not null default 0,
  destacada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger publicaciones_updated_at before update on public.publicaciones for each row execute procedure public.set_updated_at();
create index on public.publicaciones (perfil_id, estado, created_at desc);
create index on public.publicaciones (tipo, estado, created_at desc);
create index on public.publicaciones (destacada, created_at desc);
create index on public.publicaciones using gin(to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(cuerpo,'')));
create index on public.publicaciones using gin(tags);

create table public.encuesta_votos (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  opcion_index integer not null,
  created_at timestamptz not null default now(),
  unique (publicacion_id, perfil_id)
);

create table public.media_publicacion (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  url text not null, tipo text not null default 'imagen',
  orden integer not null default 0, es_portada boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.media_publicacion (publicacion_id, orden);

-- Proyectos
create table public.proyectos (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null, slug text unique, descripcion text, portada_url text,
  categoria text, tags text[],
  estado public.estado_proyecto not null default 'en_desarrollo',
  progreso integer not null default 0 check (progreso between 0 and 100),
  sitio_web text, repo_url text, demo_url text, buscando text[],
  total_seguidores integer not null default 0,
  total_miembros integer not null default 0,
  destacado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger proyectos_updated_at before update on public.proyectos for each row execute procedure public.set_updated_at();
create index on public.proyectos (perfil_id);
create index on public.proyectos (estado, created_at desc);

create table public.proyecto_miembros (
  id uuid primary key default uuid_generate_v4(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  rol text not null default 'colaborador',
  es_fundador boolean not null default false,
  created_at timestamptz not null default now(),
  unique (proyecto_id, perfil_id)
);
create table public.proyecto_updates (
  id uuid primary key default uuid_generate_v4(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null, contenido text, imagen_url text,
  created_at timestamptz not null default now()
);
create table public.proyecto_seguidores (
  id uuid primary key default uuid_generate_v4(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (proyecto_id, perfil_id)
);

-- Comunidades
create table public.comunidades (
  id uuid primary key default uuid_generate_v4(),
  creador_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null, slug text unique not null, descripcion text,
  avatar_url text, portada_url text, tematica text, tags text[],
  privada boolean not null default false,
  total_miembros integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger comunidades_updated_at before update on public.comunidades for each row execute procedure public.set_updated_at();
create table public.comunidad_miembros (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  rol public.tipo_miembro_comunidad not null default 'miembro',
  created_at timestamptz not null default now(),
  unique (comunidad_id, perfil_id)
);
create table public.comunidad_canales (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  nombre text not null, descripcion text,
  tipo text not null default 'general',
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.comunidad_posts (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  canal_id uuid references public.comunidad_canales(id) on delete set null,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text, contenido text not null, imagen_url text,
  total_likes integer not null default 0,
  total_respuestas integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.comunidad_posts (comunidad_id, created_at desc);

-- Foro
create table public.foro_categorias (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null, slug text unique not null,
  descripcion text, icono text, color text,
  orden integer not null default 0
);
insert into public.foro_categorias (nombre, slug, descripcion, icono, color, orden) values
  ('Emprendimiento','emprendimiento','Preguntas sobre cómo arrancar y hacer crecer un negocio','ti-rocket','#534AB7',1),
  ('Inversiones','inversiones','Finanzas, inversión y capital','ti-chart-line','#0F6E56',2),
  ('Tecnología e IA','tecnologia','Desarrollo, IA, herramientas y tendencias tech','ti-cpu','#185FA5',3),
  ('Marketing y ventas','marketing','Estrategias de crecimiento y adquisición','ti-speakerphone','#BA7517',4),
  ('Diseño y creatividad','diseno','UX, branding, arte y creatividad','ti-palette','#993556',5),
  ('Carrera y freelance','carrera','Trabajo independiente y desarrollo profesional','ti-briefcase','#3B6D11',6),
  ('General','general','Todo lo que no encaja en otra categoría','ti-messages','#5F5E5A',7);

create table public.foro_posts (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  categoria_id uuid not null references public.foro_categorias(id),
  titulo text not null, contenido text not null, tags text[],
  total_likes integer not null default 0,
  total_respuestas integer not null default 0,
  total_vistas integer not null default 0,
  fijado boolean not null default false,
  resuelto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger foro_posts_updated_at before update on public.foro_posts for each row execute procedure public.set_updated_at();
create index on public.foro_posts (categoria_id, created_at desc);
create index on public.foro_posts using gin(to_tsvector('spanish', titulo || ' ' || contenido));

create table public.foro_respuestas (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.foro_posts(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  respuesta_a uuid references public.foro_respuestas(id) on delete cascade,
  contenido text not null, total_likes integer not null default 0,
  es_solucion boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.foro_respuestas (post_id, created_at);

create table public.foro_likes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  post_id uuid references public.foro_posts(id) on delete cascade,
  resp_id uuid references public.foro_respuestas(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is not null and resp_id is null) or (post_id is null and resp_id is not null))
);

-- Match
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  perfil_a_id uuid not null references public.perfiles(id) on delete cascade,
  perfil_b_id uuid not null references public.perfiles(id) on delete cascade,
  score numeric(5,2) not null default 0, motivo text[],
  created_at timestamptz not null default now(),
  unique (perfil_a_id, perfil_b_id),
  check (perfil_a_id < perfil_b_id)
);
create table public.match_acciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  objetivo_id uuid not null references public.perfiles(id) on delete cascade,
  accion text not null,
  created_at timestamptz not null default now(),
  unique (perfil_id, objetivo_id)
);

-- Likes
create table public.likes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid references public.publicaciones(id) on delete cascade,
  comunidad_post_id uuid references public.comunidad_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((publicacion_id is not null and comunidad_post_id is null) or (publicacion_id is null and comunidad_post_id is not null))
);
create or replace function public.update_likes_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP='INSERT' then
    if NEW.publicacion_id is not null then update public.publicaciones set total_likes=total_likes+1 where id=NEW.publicacion_id; end if;
    if NEW.comunidad_post_id is not null then update public.comunidad_posts set total_likes=total_likes+1 where id=NEW.comunidad_post_id; end if;
  elsif TG_OP='DELETE' then
    if OLD.publicacion_id is not null then update public.publicaciones set total_likes=greatest(total_likes-1,0) where id=OLD.publicacion_id; end if;
    if OLD.comunidad_post_id is not null then update public.comunidad_posts set total_likes=greatest(total_likes-1,0) where id=OLD.comunidad_post_id; end if;
  end if;
  return null;
end; $$;
create trigger likes_count_trigger after insert or delete on public.likes for each row execute procedure public.update_likes_count();

-- Comentarios
create table public.comentarios (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  respuesta_a uuid references public.comentarios(id) on delete cascade,
  contenido text not null, menciones text[],
  total_likes integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.comentarios (publicacion_id, created_at);
create or replace function public.update_comentarios_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP='INSERT' then update public.publicaciones set total_comentarios=total_comentarios+1 where id=NEW.publicacion_id;
  elsif TG_OP='DELETE' then update public.publicaciones set total_comentarios=greatest(total_comentarios-1,0) where id=OLD.publicacion_id; end if;
  return null;
end; $$;
create trigger comentarios_count_trigger after insert or delete on public.comentarios for each row execute procedure public.update_comentarios_count();

-- Repostes
create table public.repostes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  comentario text,
  created_at timestamptz not null default now(),
  unique (perfil_id, publicacion_id)
);
create or replace function public.update_repostes_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP='INSERT' then update public.publicaciones set total_repostes=total_repostes+1 where id=NEW.publicacion_id;
  elsif TG_OP='DELETE' then update public.publicaciones set total_repostes=greatest(total_repostes-1,0) where id=OLD.publicacion_id; end if;
  return null;
end; $$;
create trigger repostes_count_trigger after insert or delete on public.repostes for each row execute procedure public.update_repostes_count();

-- Favoritos
create table public.favoritos (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid references public.publicaciones(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Seguidos
create table public.seguidos (
  id uuid primary key default uuid_generate_v4(),
  seguidor_id uuid not null references public.perfiles(id) on delete cascade,
  seguido_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seguidor_id, seguido_id),
  check (seguidor_id != seguido_id)
);
create or replace function public.update_seguidores_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP='INSERT' then
    update public.perfiles set total_seguidores=total_seguidores+1 where id=NEW.seguido_id;
    update public.perfiles set total_siguiendo=total_siguiendo+1 where id=NEW.seguidor_id;
  elsif TG_OP='DELETE' then
    update public.perfiles set total_seguidores=greatest(total_seguidores-1,0) where id=OLD.seguido_id;
    update public.perfiles set total_siguiendo=greatest(total_siguiendo-1,0) where id=OLD.seguidor_id;
  end if;
  return null;
end; $$;
create trigger seguidos_count_trigger after insert or delete on public.seguidos for each row execute procedure public.update_seguidores_count();

create or replace function public.update_publicaciones_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP='INSERT' then update public.perfiles set total_publicaciones=total_publicaciones+1 where id=NEW.perfil_id;
  elsif TG_OP='DELETE' then update public.perfiles set total_publicaciones=greatest(total_publicaciones-1,0) where id=OLD.perfil_id; end if;
  return null;
end; $$;
create trigger publicaciones_count_trigger after insert or delete on public.publicaciones for each row execute procedure public.update_publicaciones_count();

-- Mensajería
create table public.conversaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_a_id uuid not null references public.perfiles(id) on delete cascade,
  perfil_b_id uuid not null references public.perfiles(id) on delete cascade,
  ultimo_mensaje text, ultimo_mensaje_at timestamptz,
  no_leidos_a integer not null default 0,
  no_leidos_b integer not null default 0,
  created_at timestamptz not null default now(),
  unique (perfil_a_id, perfil_b_id),
  check (perfil_a_id < perfil_b_id)
);
create index on public.conversaciones (perfil_a_id, ultimo_mensaje_at desc);
create index on public.conversaciones (perfil_b_id, ultimo_mensaje_at desc);

create table public.mensajes (
  id uuid primary key default uuid_generate_v4(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  remitente_id uuid not null references public.perfiles(id) on delete cascade,
  contenido text not null, imagen_url text,
  publicacion_id uuid references public.publicaciones(id),
  proyecto_id uuid references public.proyectos(id),
  leido boolean not null default false,
  leido_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.mensajes (conversacion_id, created_at);

create or replace function public.get_or_create_conversacion(user_a uuid, user_b uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv_id uuid; a_id uuid := least(user_a,user_b); b_id uuid := greatest(user_a,user_b);
begin
  select id into conv_id from public.conversaciones where perfil_a_id=a_id and perfil_b_id=b_id;
  if conv_id is null then
    insert into public.conversaciones (perfil_a_id, perfil_b_id) values (a_id,b_id) returning id into conv_id;
  end if;
  return conv_id;
end; $$;

create or replace function public.update_ultimo_mensaje()
returns trigger language plpgsql set search_path = public as $$
declare a_id uuid; b_id uuid;
begin
  select perfil_a_id, perfil_b_id into a_id, b_id from public.conversaciones where id=NEW.conversacion_id;
  update public.conversaciones set
    ultimo_mensaje=substring(NEW.contenido,1,80),
    ultimo_mensaje_at=NEW.created_at,
    no_leidos_a = case when a_id=NEW.remitente_id then no_leidos_a else no_leidos_a+1 end,
    no_leidos_b = case when b_id=NEW.remitente_id then no_leidos_b else no_leidos_b+1 end
  where id=NEW.conversacion_id;
  return NEW;
end; $$;
create trigger mensajes_update_conversacion after insert on public.mensajes for each row execute procedure public.update_ultimo_mensaje();

-- Notificaciones
create table public.notificaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  origen_id uuid references public.perfiles(id) on delete cascade,
  tipo public.tipo_notificacion not null,
  publicacion_id uuid references public.publicaciones(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  comunidad_id uuid references public.comunidades(id) on delete cascade,
  comentario_id uuid references public.comentarios(id) on delete cascade,
  leida boolean not null default false,
  texto text,
  created_at timestamptz not null default now()
);
create index on public.notificaciones (perfil_id, leida, created_at desc);

-- Reseñas
create table public.resenas (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  puntuacion integer not null check (puntuacion between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique (perfil_id, autor_id)
);

-- Estadísticas
create table public.estadisticas_publicacion (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  fecha date not null default current_date,
  vistas integer not null default 0,
  likes integer not null default 0,
  comentarios integer not null default 0,
  unique (publicacion_id, fecha)
);
create or replace function public.registrar_vista(p_publicacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.publicaciones set vistas=vistas+1 where id=p_publicacion_id;
  insert into public.estadisticas_publicacion (publicacion_id, fecha, vistas)
  values (p_publicacion_id, current_date, 1)
  on conflict (publicacion_id, fecha) do update set vistas=estadisticas_publicacion.vistas+1;
end; $$;

-- RLS
alter table public.perfiles enable row level security;
alter table public.highlights enable row level security;
alter table public.highlight_items enable row level security;
alter table public.publicaciones enable row level security;
alter table public.media_publicacion enable row level security;
alter table public.encuesta_votos enable row level security;
alter table public.proyectos enable row level security;
alter table public.proyecto_miembros enable row level security;
alter table public.proyecto_updates enable row level security;
alter table public.proyecto_seguidores enable row level security;
alter table public.comunidades enable row level security;
alter table public.comunidad_miembros enable row level security;
alter table public.comunidad_canales enable row level security;
alter table public.comunidad_posts enable row level security;
alter table public.foro_categorias enable row level security;
alter table public.foro_posts enable row level security;
alter table public.foro_respuestas enable row level security;
alter table public.foro_likes enable row level security;
alter table public.matches enable row level security;
alter table public.match_acciones enable row level security;
alter table public.likes enable row level security;
alter table public.comentarios enable row level security;
alter table public.repostes enable row level security;
alter table public.favoritos enable row level security;
alter table public.seguidos enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.notificaciones enable row level security;
alter table public.resenas enable row level security;
alter table public.estadisticas_publicacion enable row level security;

create policy "perfiles_publico" on public.perfiles for select using (activo = true);
create policy "publicaciones_pub" on public.publicaciones for select using (estado = 'activa' or auth.uid() = perfil_id);
create policy "media_pub" on public.media_publicacion for select using (true);
create policy "proyectos_pub" on public.proyectos for select using (true);
create policy "proyecto_miembros_pub" on public.proyecto_miembros for select using (true);
create policy "proyecto_updates_pub" on public.proyecto_updates for select using (true);
create policy "proyecto_seguidores_pub" on public.proyecto_seguidores for select using (true);
create policy "comunidades_pub" on public.comunidades for select using (privada = false);
create policy "comunidad_canales_pub" on public.comunidad_canales for select using (true);
create policy "comunidad_posts_pub" on public.comunidad_posts for select using (true);
create policy "foro_categorias_pub" on public.foro_categorias for select using (true);
create policy "foro_posts_pub" on public.foro_posts for select using (true);
create policy "foro_respuestas_pub" on public.foro_respuestas for select using (true);
create policy "likes_pub" on public.likes for select using (true);
create policy "comentarios_pub" on public.comentarios for select using (true);
create policy "repostes_pub" on public.repostes for select using (true);
create policy "seguidos_pub" on public.seguidos for select using (true);
create policy "resenas_pub" on public.resenas for select using (true);
create policy "highlights_pub" on public.highlights for select using (true);
create policy "highlight_items_pub" on public.highlight_items for select using (true);
create policy "encuesta_votos_pub" on public.encuesta_votos for select using (true);

create policy "perfiles_update" on public.perfiles for update using (auth.uid() = id);
create policy "perfiles_insert" on public.perfiles for insert with check (auth.uid() = id);

create policy "pub_insert" on public.publicaciones for insert with check (auth.uid() = perfil_id);
create policy "pub_update" on public.publicaciones for update using (auth.uid() = perfil_id);
create policy "pub_delete" on public.publicaciones for delete using (auth.uid() = perfil_id);

create policy "media_insert" on public.media_publicacion for insert with check (auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id));
create policy "media_delete" on public.media_publicacion for delete using (auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id));

create policy "proyectos_insert" on public.proyectos for insert with check (auth.uid() = perfil_id);
create policy "proyectos_update" on public.proyectos for update using (auth.uid() = perfil_id);
create policy "proyectos_delete" on public.proyectos for delete using (auth.uid() = perfil_id);
create policy "proyecto_miembros_insert" on public.proyecto_miembros for insert with check (auth.uid() = perfil_id);
create policy "proyecto_updates_insert" on public.proyecto_updates for insert with check (auth.uid() = perfil_id);
create policy "proyecto_seguidores_all" on public.proyecto_seguidores for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);

create policy "comunidades_insert" on public.comunidades for insert with check (auth.uid() = creador_id);
create policy "comunidades_update" on public.comunidades for update using (auth.uid() = creador_id);
create policy "comunidad_miembros_all" on public.comunidad_miembros for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);
create policy "comunidad_posts_insert" on public.comunidad_posts for insert with check (auth.uid() = perfil_id);
create policy "comunidad_posts_delete" on public.comunidad_posts for delete using (auth.uid() = perfil_id);
create policy "comunidad_miembros_pub" on public.comunidad_miembros for select using (true);

create policy "foro_posts_insert" on public.foro_posts for insert with check (auth.uid() = perfil_id);
create policy "foro_posts_update" on public.foro_posts for update using (auth.uid() = perfil_id);
create policy "foro_posts_delete" on public.foro_posts for delete using (auth.uid() = perfil_id);
create policy "foro_resp_insert" on public.foro_respuestas for insert with check (auth.uid() = perfil_id);
create policy "foro_resp_delete" on public.foro_respuestas for delete using (auth.uid() = perfil_id);
create policy "foro_likes_all" on public.foro_likes for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);

create policy "matches_ver" on public.matches for select using (auth.uid() = perfil_a_id or auth.uid() = perfil_b_id);
create policy "match_acciones_all" on public.match_acciones for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);

create policy "likes_insert" on public.likes for insert with check (auth.uid() = perfil_id);
create policy "likes_delete" on public.likes for delete using (auth.uid() = perfil_id);
create policy "comentarios_insert" on public.comentarios for insert with check (auth.uid() = perfil_id);
create policy "comentarios_delete" on public.comentarios for delete using (auth.uid() = perfil_id);
create policy "repostes_insert" on public.repostes for insert with check (auth.uid() = perfil_id);
create policy "repostes_delete" on public.repostes for delete using (auth.uid() = perfil_id);
create policy "favoritos_all" on public.favoritos for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);
create policy "seguidos_insert" on public.seguidos for insert with check (auth.uid() = seguidor_id);
create policy "seguidos_delete" on public.seguidos for delete using (auth.uid() = seguidor_id);
create policy "resenas_insert" on public.resenas for insert with check (auth.uid() = autor_id);
create policy "encuesta_votos_insert" on public.encuesta_votos for insert with check (auth.uid() = perfil_id);
create policy "highlights_all" on public.highlights for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);
create policy "highlight_items_all" on public.highlight_items for all using (auth.uid() = (select perfil_id from public.highlights where id = highlight_id)) with check (auth.uid() = (select perfil_id from public.highlights where id = highlight_id));

create policy "conv_ver" on public.conversaciones for select using (auth.uid() = perfil_a_id or auth.uid() = perfil_b_id);
create policy "conv_insert" on public.conversaciones for insert with check (auth.uid() = perfil_a_id or auth.uid() = perfil_b_id);
create policy "mensajes_ver" on public.mensajes for select using (
  auth.uid() = remitente_id or
  auth.uid() = (select perfil_a_id from public.conversaciones where id = conversacion_id) or
  auth.uid() = (select perfil_b_id from public.conversaciones where id = conversacion_id)
);
create policy "mensajes_insert" on public.mensajes for insert with check (auth.uid() = remitente_id);

create policy "notif_all" on public.notificaciones for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);

create policy "stats_ver" on public.estadisticas_publicacion for select using (auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id));

-- Buckets
insert into storage.buckets (id, name, public) values
  ('publicaciones','publicaciones',true),
  ('videos','videos',true),
  ('proyectos-media','proyectos-media',true),
  ('comunidades-media','comunidades-media',true)
on conflict (id) do nothing;

-- Realtime
alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.notificaciones;
alter publication supabase_realtime add table public.conversaciones;
alter publication supabase_realtime add table public.comentarios;
alter publication supabase_realtime add table public.comunidad_posts;

-- Vistas
create or replace view public.feed_woref as
select p.id, p.tipo, p.formato, p.titulo, p.cuerpo, p.cuerpo_largo,
  p.imagen_url, p.video_url, p.video_duracion, p.thumbnail_url,
  p.tags, p.encuesta_opciones, p.rol_buscado, p.modalidad,
  p.vistas, p.total_likes, p.total_comentarios, p.total_repostes,
  p.total_guardados, p.destacada, p.created_at,
  pf.nombre as autor_nombre, pf.username as autor_username,
  pf.avatar_url as autor_avatar, pf.tipo as autor_tipo,
  pf.verificado as autor_verificado, pf.score as autor_score
from public.publicaciones p
join public.perfiles pf on pf.id = p.perfil_id
where p.estado = 'activa'
order by p.destacada desc, p.created_at desc;