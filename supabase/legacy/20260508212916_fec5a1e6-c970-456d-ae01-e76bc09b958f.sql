
-- ============================================================
-- LINQUEÑO — Reemplazo completo del módulo inmobiliario
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ─────────────── DROP del módulo inmo previo ───────────────
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.imagenes_publicacion cascade;
drop table if exists public.consultas cascade;
drop table if exists public.favoritos cascade;
drop table if exists public.comentarios cascade;
drop table if exists public.publicaciones cascade;
drop table if exists public.perfiles_inmo cascade;
drop table if exists public.barrios cascade;
drop table if exists public.ciudades cascade;

drop type if exists public.tipo_usuario_inmo cascade;
drop type if exists public.estado_publicacion cascade;
drop type if exists public.tipo_propiedad cascade;
drop type if exists public.tipo_operacion cascade;

-- ─────────────── ENUMS ───────────────
create type public.tipo_usuario as enum (
  'vecino','dueno_directo','inmobiliaria','agente_independiente',
  'negocio','profesional','institucion'
);

create type public.tipo_publicacion as enum (
  'propiedad','empleo','servicio','evento','venta_objeto',
  'agro','novedad_local','busqueda','general'
);

create type public.tipo_operacion as enum (
  'venta','alquiler','alquiler_temporario','local_comercial','oficina','campo_rural'
);

create type public.tipo_propiedad as enum (
  'casa','departamento','ph','local','oficina','galpon',
  'terreno','campo','chacra','quinta','otro'
);

create type public.estado_publicacion as enum (
  'activa','pausada','vendida','alquilada','finalizada','eliminada'
);

create type public.tipo_notificacion as enum (
  'nuevo_seguidor','like_publicacion','comentario_publicacion',
  'respuesta_comentario','reposteo','mencion','nuevo_mensaje','publicacion_destacada'
);

-- ─────────────── CIUDADES Y BARRIOS ───────────────
create table public.ciudades (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  provincia text not null default 'Buenos Aires',
  pais text not null default 'Argentina',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ciudades (nombre) values ('Lincoln');

create table public.barrios (
  id uuid primary key default uuid_generate_v4(),
  ciudad_id uuid not null references public.ciudades(id) on delete cascade,
  nombre text not null,
  zona text,
  created_at timestamptz not null default now()
);

do $$
declare lincoln_id uuid;
begin
  select id into lincoln_id from public.ciudades where nombre='Lincoln' limit 1;
  insert into public.barrios (ciudad_id, nombre, zona) values
    (lincoln_id,'Centro','Centro'),
    (lincoln_id,'Barrio Norte / Luján','Norte'),
    (lincoln_id,'Barrio Banco Provincia','Norte'),
    (lincoln_id,'Barrio FONAVI / Jauretche','Norte'),
    (lincoln_id,'Barrio Don Vicente','Norte'),
    (lincoln_id,'Plan 100','Norte'),
    (lincoln_id,'Lincoln Chico','Norte'),
    (lincoln_id,'Barrio San José','Sur'),
    (lincoln_id,'Barrio Eva Perón','Sur'),
    (lincoln_id,'Barrio René Favaloro','Sur'),
    (lincoln_id,'Barrio Cirigliano','Sur'),
    (lincoln_id,'Puesta del Sol','Sur'),
    (lincoln_id,'La Rotonda','Sur'),
    (lincoln_id,'Manos Unidas','Sur'),
    (lincoln_id,'Los Aromos','Sur'),
    (lincoln_id,'Barrio La Rural','Este'),
    (lincoln_id,'Barrio La Loma','Este'),
    (lincoln_id,'Barrio Jardín','Este'),
    (lincoln_id,'Barrio Las Lomitas','Este'),
    (lincoln_id,'Barrio Cura Brochero','Este'),
    (lincoln_id,'Barrio Dr. Héctor Lannes','Este'),
    (lincoln_id,'Barrio Sagrado Corazón','Oeste'),
    (lincoln_id,'Barrio Cadal','Oeste'),
    (lincoln_id,'Altos de Massey','Oeste'),
    (lincoln_id,'Chacras del Oeste','Oeste'),
    (lincoln_id,'Chacras de Alihuén','Oeste'),
    (lincoln_id,'Barrio Obrero','Suroeste'),
    (lincoln_id,'Barrio Eduardo Mango','Suroeste'),
    (lincoln_id,'Barrio El Parque','Noroeste'),
    (lincoln_id,'Barrio Plaza España','Noreste'),
    (lincoln_id,'Barrio Docente','Noreste'),
    (lincoln_id,'Fundar','Norte'),
    (lincoln_id,'Zona Rural Norte','Rural'),
    (lincoln_id,'Zona Rural Sur','Rural'),
    (lincoln_id,'Zona Rural Este','Rural'),
    (lincoln_id,'Zona Rural Oeste','Rural'),
    (lincoln_id,'Acceso Hipólito Yrigoyen','Rural'),
    (lincoln_id,'Acceso Eva Perón','Rural'),
    (lincoln_id,'Acceso Federico Cané','Rural');
end $$;

-- ─────────────── PERFILES ───────────────
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ciudad_id uuid references public.ciudades(id),
  nombre text not null,
  slug text unique,
  avatar_url text,
  portada_url text,
  descripcion text,
  whatsapp text,
  telefono text,
  instagram text,
  facebook text,
  sitio_web text,
  horario text,
  tipo public.tipo_usuario not null default 'vecino',
  verificado boolean not null default false,
  activo boolean not null default true,
  mensajes_privados boolean not null default true,
  mostrar_telefono boolean not null default true,
  total_seguidores integer not null default 0,
  total_siguiendo integer not null default 0,
  total_publicaciones integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger handle_new_user fusionado: CRM + Linqueño
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_lincoln uuid;
  v_nombre text;
  v_slug text;
begin
  -- CRM (existente)
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name',''),
    coalesce(new.raw_user_meta_data->>'avatar_url','')
  );
  insert into public.user_roles (user_id, role) values (new.id,'rep');

  -- Linqueño
  select id into v_lincoln from public.ciudades where nombre='Lincoln' limit 1;
  v_nombre := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_slug := lower(regexp_replace(v_nombre,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(new.id::text,1,6);

  insert into public.perfiles (id, ciudad_id, nombre, slug, avatar_url)
  values (new.id, v_lincoln, v_nombre, v_slug, coalesce(new.raw_user_meta_data->>'avatar_url',''));

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create trigger perfiles_updated_at before update on public.perfiles
  for each row execute procedure public.set_updated_at();

-- ─────────────── HIGHLIGHTS ───────────────
create table public.highlights (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null,
  icono text,
  color_fondo text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.highlight_items (
  id uuid primary key default uuid_generate_v4(),
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  imagen_url text,
  publicacion_id uuid,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────── PUBLICACIONES ───────────────
create table public.publicaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  ciudad_id uuid not null references public.ciudades(id),
  barrio_id uuid references public.barrios(id),
  tipo public.tipo_publicacion not null default 'general',
  estado public.estado_publicacion not null default 'activa',
  titulo text not null,
  descripcion text,
  precio numeric(15,2),
  moneda text not null default 'ARS',
  precio_negociable boolean not null default false,
  tags text[],
  tipo_operacion public.tipo_operacion,
  tipo_propiedad public.tipo_propiedad,
  expensas numeric(10,2),
  ambientes integer,
  dormitorios integer,
  banos integer,
  cochera boolean not null default false,
  superficie_total numeric(10,2),
  superficie_cubierta numeric(10,2),
  gas_natural boolean not null default false,
  agua_corriente boolean not null default false,
  cloaca boolean not null default false,
  luz boolean not null default true,
  internet boolean not null default false,
  hectareas numeric(10,2),
  tipo_suelo text,
  tiene_galpon boolean not null default false,
  tiene_casa_campo boolean not null default false,
  acceso_pavimento boolean not null default false,
  fecha_evento timestamptz,
  lugar_evento text,
  modalidad_empleo text,
  rubro text,
  mostrar_direccion boolean not null default false,
  direccion text,
  referencia text,
  vistas integer not null default 0,
  total_likes integer not null default 0,
  total_comentarios integer not null default 0,
  total_repostes integer not null default 0,
  destacada boolean not null default false,
  destacada_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger publicaciones_updated_at before update on public.publicaciones
  for each row execute procedure public.set_updated_at();

create index on public.publicaciones (ciudad_id, estado, created_at desc);
create index on public.publicaciones (perfil_id);
create index on public.publicaciones (tipo);
create index on public.publicaciones (destacada, created_at desc);
create index on public.publicaciones using gin(to_tsvector('spanish', titulo || ' ' || coalesce(descripcion,'')));

-- ─────────────── MEDIA ───────────────
create table public.media_publicacion (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  url text not null,
  tipo text not null default 'imagen',
  orden integer not null default 0,
  es_portada boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.media_publicacion (publicacion_id, orden);

-- ─────────────── LIKES ───────────────
create table public.likes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(perfil_id, publicacion_id)
);

create or replace function public.update_likes_count()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    update public.publicaciones set total_likes=total_likes+1 where id=NEW.publicacion_id;
  elsif TG_OP='DELETE' then
    update public.publicaciones set total_likes=greatest(total_likes-1,0) where id=OLD.publicacion_id;
  end if; return null;
end $$;

create trigger likes_count_trigger after insert or delete on public.likes
  for each row execute procedure public.update_likes_count();

-- ─────────────── COMENTARIOS ───────────────
create table public.comentarios (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  respuesta_a uuid references public.comentarios(id) on delete cascade,
  contenido text not null,
  menciones text[],
  created_at timestamptz not null default now()
);
create index on public.comentarios (publicacion_id, created_at);

create or replace function public.update_comentarios_count()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    update public.publicaciones set total_comentarios=total_comentarios+1 where id=NEW.publicacion_id;
  elsif TG_OP='DELETE' then
    update public.publicaciones set total_comentarios=greatest(total_comentarios-1,0) where id=OLD.publicacion_id;
  end if; return null;
end $$;

create trigger comentarios_count_trigger after insert or delete on public.comentarios
  for each row execute procedure public.update_comentarios_count();

-- ─────────────── REPOSTES ───────────────
create table public.repostes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  comentario text,
  created_at timestamptz not null default now(),
  unique(perfil_id, publicacion_id)
);

create or replace function public.update_repostes_count()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    update public.publicaciones set total_repostes=total_repostes+1 where id=NEW.publicacion_id;
  elsif TG_OP='DELETE' then
    update public.publicaciones set total_repostes=greatest(total_repostes-1,0) where id=OLD.publicacion_id;
  end if; return null;
end $$;

create trigger repostes_count_trigger after insert or delete on public.repostes
  for each row execute procedure public.update_repostes_count();

-- ─────────────── FAVORITOS ───────────────
create table public.favoritos (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(perfil_id, publicacion_id)
);

-- ─────────────── SEGUIDOS ───────────────
create table public.seguidos (
  id uuid primary key default uuid_generate_v4(),
  seguidor_id uuid not null references public.perfiles(id) on delete cascade,
  seguido_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(seguidor_id, seguido_id),
  check(seguidor_id != seguido_id)
);

create or replace function public.update_seguidores_count()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    update public.perfiles set total_seguidores=total_seguidores+1 where id=NEW.seguido_id;
    update public.perfiles set total_siguiendo=total_siguiendo+1 where id=NEW.seguidor_id;
  elsif TG_OP='DELETE' then
    update public.perfiles set total_seguidores=greatest(total_seguidores-1,0) where id=OLD.seguido_id;
    update public.perfiles set total_siguiendo=greatest(total_siguiendo-1,0) where id=OLD.seguidor_id;
  end if; return null;
end $$;

create trigger seguidos_count_trigger after insert or delete on public.seguidos
  for each row execute procedure public.update_seguidores_count();

create or replace function public.update_publicaciones_count()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    update public.perfiles set total_publicaciones=total_publicaciones+1 where id=NEW.perfil_id;
  elsif TG_OP='DELETE' then
    update public.perfiles set total_publicaciones=greatest(total_publicaciones-1,0) where id=OLD.perfil_id;
  end if; return null;
end $$;

create trigger publicaciones_count_trigger after insert or delete on public.publicaciones
  for each row execute procedure public.update_publicaciones_count();

-- ─────────────── MENSAJERÍA ───────────────
create table public.conversaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_a_id uuid not null references public.perfiles(id) on delete cascade,
  perfil_b_id uuid not null references public.perfiles(id) on delete cascade,
  ultimo_mensaje text,
  ultimo_mensaje_at timestamptz,
  no_leidos_a integer not null default 0,
  no_leidos_b integer not null default 0,
  created_at timestamptz not null default now(),
  unique(perfil_a_id, perfil_b_id),
  check(perfil_a_id < perfil_b_id)
);
create index on public.conversaciones (perfil_a_id, ultimo_mensaje_at desc);
create index on public.conversaciones (perfil_b_id, ultimo_mensaje_at desc);

create table public.mensajes (
  id uuid primary key default uuid_generate_v4(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  remitente_id uuid not null references public.perfiles(id) on delete cascade,
  contenido text not null,
  imagen_url text,
  publicacion_id uuid references public.publicaciones(id),
  leido boolean not null default false,
  leido_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.mensajes (conversacion_id, created_at);

create or replace function public.get_or_create_conversacion(user_a uuid, user_b uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  conv_id uuid;
  a_id uuid := least(user_a,user_b);
  b_id uuid := greatest(user_a,user_b);
begin
  select id into conv_id from public.conversaciones where perfil_a_id=a_id and perfil_b_id=b_id;
  if conv_id is null then
    insert into public.conversaciones (perfil_a_id, perfil_b_id) values (a_id,b_id)
    returning id into conv_id;
  end if;
  return conv_id;
end $$;

create or replace function public.update_ultimo_mensaje()
returns trigger language plpgsql set search_path=public as $$
declare a uuid; b uuid;
begin
  select perfil_a_id, perfil_b_id into a,b from public.conversaciones where id=NEW.conversacion_id;
  update public.conversaciones
  set ultimo_mensaje=substring(NEW.contenido,1,80),
      ultimo_mensaje_at=NEW.created_at,
      no_leidos_a = case when a=NEW.remitente_id then no_leidos_a else no_leidos_a+1 end,
      no_leidos_b = case when b=NEW.remitente_id then no_leidos_b else no_leidos_b+1 end
  where id=NEW.conversacion_id;
  return NEW;
end $$;

create trigger mensajes_update_conversacion after insert on public.mensajes
  for each row execute procedure public.update_ultimo_mensaje();

-- ─────────────── NOTIFICACIONES ───────────────
create table public.notificaciones (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  origen_id uuid references public.perfiles(id) on delete cascade,
  tipo public.tipo_notificacion not null,
  publicacion_id uuid references public.publicaciones(id) on delete cascade,
  comentario_id uuid references public.comentarios(id) on delete cascade,
  leida boolean not null default false,
  texto text,
  created_at timestamptz not null default now()
);
create index on public.notificaciones (perfil_id, leida, created_at desc);

-- Auto-notificar nuevos likes, comentarios, seguidores, repostes, mensajes
create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path=public as $$
declare dueno uuid;
begin
  select perfil_id into dueno from public.publicaciones where id=NEW.publicacion_id;
  if dueno is not null and dueno <> NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    values (dueno, NEW.perfil_id, 'like_publicacion', NEW.publicacion_id);
  end if;
  return NEW;
end $$;
create trigger notify_like_trigger after insert on public.likes
  for each row execute procedure public.notify_like();

create or replace function public.notify_comentario()
returns trigger language plpgsql security definer set search_path=public as $$
declare dueno uuid; padre uuid;
begin
  select perfil_id into dueno from public.publicaciones where id=NEW.publicacion_id;
  if dueno is not null and dueno <> NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id, comentario_id)
    values (dueno, NEW.perfil_id, 'comentario_publicacion', NEW.publicacion_id, NEW.id);
  end if;
  if NEW.respuesta_a is not null then
    select perfil_id into padre from public.comentarios where id=NEW.respuesta_a;
    if padre is not null and padre <> NEW.perfil_id and padre <> dueno then
      insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id, comentario_id)
      values (padre, NEW.perfil_id, 'respuesta_comentario', NEW.publicacion_id, NEW.id);
    end if;
  end if;
  return NEW;
end $$;
create trigger notify_comentario_trigger after insert on public.comentarios
  for each row execute procedure public.notify_comentario();

create or replace function public.notify_seguidor()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notificaciones (perfil_id, origen_id, tipo)
  values (NEW.seguido_id, NEW.seguidor_id, 'nuevo_seguidor');
  return NEW;
end $$;
create trigger notify_seguidor_trigger after insert on public.seguidos
  for each row execute procedure public.notify_seguidor();

create or replace function public.notify_reposte()
returns trigger language plpgsql security definer set search_path=public as $$
declare dueno uuid;
begin
  select perfil_id into dueno from public.publicaciones where id=NEW.publicacion_id;
  if dueno is not null and dueno <> NEW.perfil_id then
    insert into public.notificaciones (perfil_id, origen_id, tipo, publicacion_id)
    values (dueno, NEW.perfil_id, 'reposteo', NEW.publicacion_id);
  end if;
  return NEW;
end $$;
create trigger notify_reposte_trigger after insert on public.repostes
  for each row execute procedure public.notify_reposte();

-- ─────────────── RESEÑAS ───────────────
create table public.resenas (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  puntuacion integer not null check (puntuacion between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique(perfil_id, autor_id)
);
create index on public.resenas (perfil_id, created_at desc);

-- ─────────────── ESTADÍSTICAS ───────────────
create table public.estadisticas_publicacion (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  fecha date not null default current_date,
  vistas integer not null default 0,
  likes integer not null default 0,
  comentarios integer not null default 0,
  consultas integer not null default 0,
  unique(publicacion_id, fecha)
);

create or replace function public.registrar_vista(p_publicacion_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.publicaciones set vistas=vistas+1 where id=p_publicacion_id;
  insert into public.estadisticas_publicacion (publicacion_id, fecha, vistas)
  values (p_publicacion_id, current_date, 1)
  on conflict (publicacion_id, fecha) do update set vistas=estadisticas_publicacion.vistas+1;
end $$;

-- ─────────────── CONSULTAS ───────────────
create table public.consultas (
  id uuid primary key default uuid_generate_v4(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  de_perfil_id uuid not null references public.perfiles(id) on delete cascade,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.consultas (publicacion_id, leida);

create or replace function public.registrar_consulta()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.estadisticas_publicacion (publicacion_id, fecha, consultas)
  values (NEW.publicacion_id, current_date, 1)
  on conflict (publicacion_id, fecha) do update set consultas=estadisticas_publicacion.consultas+1;
  return NEW;
end $$;
create trigger consultas_estadistica_trigger after insert on public.consultas
  for each row execute procedure public.registrar_consulta();

-- ─────────────── RLS ───────────────
alter table public.ciudades enable row level security;
alter table public.barrios enable row level security;
alter table public.perfiles enable row level security;
alter table public.highlights enable row level security;
alter table public.highlight_items enable row level security;
alter table public.publicaciones enable row level security;
alter table public.media_publicacion enable row level security;
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
alter table public.consultas enable row level security;

create policy "ciudades_publico" on public.ciudades for select using (true);
create policy "barrios_publico" on public.barrios for select using (true);
create policy "perfiles_publico" on public.perfiles for select using (activo=true);
create policy "perfiles_editar" on public.perfiles for update using (auth.uid()=id);
create policy "perfiles_insertar" on public.perfiles for insert with check (auth.uid()=id);

create policy "highlights_publico" on public.highlights for select using (true);
create policy "highlights_all" on public.highlights for all using (auth.uid()=perfil_id) with check (auth.uid()=perfil_id);
create policy "highlight_items_pub" on public.highlight_items for select using (true);
create policy "highlight_items_all" on public.highlight_items for all
  using (auth.uid()=(select perfil_id from public.highlights where id=highlight_id))
  with check (auth.uid()=(select perfil_id from public.highlights where id=highlight_id));

create policy "publicaciones_pub" on public.publicaciones for select using (estado='activa' or auth.uid()=perfil_id);
create policy "publicaciones_insert" on public.publicaciones for insert with check (auth.uid()=perfil_id);
create policy "publicaciones_update" on public.publicaciones for update using (auth.uid()=perfil_id);
create policy "publicaciones_delete" on public.publicaciones for delete using (auth.uid()=perfil_id);

create policy "media_publico" on public.media_publicacion for select using (true);
create policy "media_insert" on public.media_publicacion for insert
  with check (auth.uid()=(select perfil_id from public.publicaciones where id=publicacion_id));
create policy "media_delete" on public.media_publicacion for delete
  using (auth.uid()=(select perfil_id from public.publicaciones where id=publicacion_id));

create policy "likes_publico" on public.likes for select using (true);
create policy "likes_insert" on public.likes for insert with check (auth.uid()=perfil_id);
create policy "likes_delete" on public.likes for delete using (auth.uid()=perfil_id);

create policy "comentarios_publico" on public.comentarios for select using (true);
create policy "comentarios_insert" on public.comentarios for insert with check (auth.uid()=perfil_id);
create policy "comentarios_delete" on public.comentarios for delete using (auth.uid()=perfil_id);

create policy "repostes_publico" on public.repostes for select using (true);
create policy "repostes_insert" on public.repostes for insert with check (auth.uid()=perfil_id);
create policy "repostes_delete" on public.repostes for delete using (auth.uid()=perfil_id);

create policy "favoritos_all" on public.favoritos for all using (auth.uid()=perfil_id) with check (auth.uid()=perfil_id);

create policy "seguidos_publico" on public.seguidos for select using (true);
create policy "seguidos_insert" on public.seguidos for insert with check (auth.uid()=seguidor_id);
create policy "seguidos_delete" on public.seguidos for delete using (auth.uid()=seguidor_id);

create policy "conversaciones_ver" on public.conversaciones for select
  using (auth.uid()=perfil_a_id or auth.uid()=perfil_b_id);
create policy "conversaciones_insert" on public.conversaciones for insert
  with check (auth.uid()=perfil_a_id or auth.uid()=perfil_b_id);
create policy "conversaciones_update" on public.conversaciones for update
  using (auth.uid()=perfil_a_id or auth.uid()=perfil_b_id);

create policy "mensajes_ver" on public.mensajes for select
  using (auth.uid()=remitente_id
    or auth.uid()=(select perfil_a_id from public.conversaciones where id=conversacion_id)
    or auth.uid()=(select perfil_b_id from public.conversaciones where id=conversacion_id));
create policy "mensajes_insert" on public.mensajes for insert with check (auth.uid()=remitente_id);

create policy "notificaciones_all" on public.notificaciones for all
  using (auth.uid()=perfil_id) with check (auth.uid()=perfil_id);

create policy "resenas_publico" on public.resenas for select using (true);
create policy "resenas_insert" on public.resenas for insert with check (auth.uid()=autor_id);
create policy "resenas_delete" on public.resenas for delete using (auth.uid()=autor_id);

create policy "estadisticas_ver" on public.estadisticas_publicacion for select
  using (auth.uid()=(select perfil_id from public.publicaciones where id=publicacion_id));

create policy "consultas_ver" on public.consultas for select
  using (auth.uid()=de_perfil_id or auth.uid()=(select perfil_id from public.publicaciones where id=publicacion_id));
create policy "consultas_insert" on public.consultas for insert with check (auth.uid()=de_perfil_id);
create policy "consultas_update" on public.consultas for update
  using (auth.uid()=(select perfil_id from public.publicaciones where id=publicacion_id));

-- ─────────────── REALTIME ───────────────
alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.notificaciones;
alter publication supabase_realtime add table public.conversaciones;
alter publication supabase_realtime add table public.comentarios;
alter publication supabase_realtime add table public.likes;

-- ─────────────── STORAGE BUCKETS ───────────────
insert into storage.buckets (id, name, public) values
  ('propiedades','propiedades',true),
  ('avatares','avatares',true),
  ('portadas','portadas',true),
  ('highlights','highlights',true),
  ('mensajes-media','mensajes-media',false)
on conflict (id) do nothing;

-- Storage policies
create policy "storage_propiedades_lectura" on storage.objects for select using (bucket_id='propiedades');
create policy "storage_propiedades_subir" on storage.objects for insert
  with check (bucket_id='propiedades' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_propiedades_borrar" on storage.objects for delete
  using (bucket_id='propiedades' and auth.uid()::text=(storage.foldername(name))[1]);

create policy "storage_avatares_lectura" on storage.objects for select using (bucket_id='avatares');
create policy "storage_avatares_subir" on storage.objects for insert
  with check (bucket_id='avatares' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_avatares_borrar" on storage.objects for delete
  using (bucket_id='avatares' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_avatares_update" on storage.objects for update
  using (bucket_id='avatares' and auth.uid()::text=(storage.foldername(name))[1]);

create policy "storage_portadas_lectura" on storage.objects for select using (bucket_id='portadas');
create policy "storage_portadas_subir" on storage.objects for insert
  with check (bucket_id='portadas' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_portadas_update" on storage.objects for update
  using (bucket_id='portadas' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_portadas_borrar" on storage.objects for delete
  using (bucket_id='portadas' and auth.uid()::text=(storage.foldername(name))[1]);

create policy "storage_highlights_lectura" on storage.objects for select using (bucket_id='highlights');
create policy "storage_highlights_subir" on storage.objects for insert
  with check (bucket_id='highlights' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_highlights_borrar" on storage.objects for delete
  using (bucket_id='highlights' and auth.uid()::text=(storage.foldername(name))[1]);

create policy "storage_mensajes_lectura" on storage.objects for select
  using (bucket_id='mensajes-media' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "storage_mensajes_subir" on storage.objects for insert
  with check (bucket_id='mensajes-media' and auth.uid()::text=(storage.foldername(name))[1]);
