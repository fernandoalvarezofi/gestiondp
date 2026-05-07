-- ============================================================
-- MÓDULO: RED SOCIAL INMOBILIARIA — LINCOLN, BA
-- ============================================================

create extension if not exists "uuid-ossp";

-- 1. CIUDADES
create table public.ciudades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  provincia text not null default 'Buenos Aires',
  pais text not null default 'Argentina',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ciudades (nombre) values ('Lincoln');

-- 2. BARRIOS
create table public.barrios (
  id uuid primary key default gen_random_uuid(),
  ciudad_id uuid not null references public.ciudades(id) on delete cascade,
  nombre text not null,
  zona text,
  created_at timestamptz not null default now()
);

do $$
declare lincoln_id uuid;
begin
  select id into lincoln_id from public.ciudades where nombre = 'Lincoln' limit 1;
  insert into public.barrios (ciudad_id, nombre, zona) values
    (lincoln_id, 'Centro', 'Centro'),
    (lincoln_id, 'Barrio Norte / Luján', 'Norte'),
    (lincoln_id, 'Barrio Banco Provincia', 'Norte'),
    (lincoln_id, 'Barrio FONAVI / Jauretche', 'Norte'),
    (lincoln_id, 'Barrio Don Vicente', 'Norte'),
    (lincoln_id, 'Plan 100', 'Norte'),
    (lincoln_id, 'Lincoln Chico', 'Norte'),
    (lincoln_id, 'Barrio San José', 'Sur'),
    (lincoln_id, 'Barrio Eva Perón', 'Sur'),
    (lincoln_id, 'Barrio René Favaloro', 'Sur'),
    (lincoln_id, 'Barrio La Rural', 'Este'),
    (lincoln_id, 'Barrio La Loma', 'Este'),
    (lincoln_id, 'Barrio Jardín', 'Este'),
    (lincoln_id, 'Barrio Las Lomitas', 'Este'),
    (lincoln_id, 'Barrio Cura Brochero', 'Este'),
    (lincoln_id, 'Barrio Dr. Héctor Lannes', 'Este'),
    (lincoln_id, 'Barrio Sagrado Corazón', 'Oeste'),
    (lincoln_id, 'Barrio Cadal', 'Oeste'),
    (lincoln_id, 'Altos de Massey', 'Oeste'),
    (lincoln_id, 'Chacras del Oeste', 'Oeste'),
    (lincoln_id, 'Chacras de Alihuén', 'Oeste'),
    (lincoln_id, 'Barrio Obrero', 'Suroeste'),
    (lincoln_id, 'Barrio Eduardo Mango', 'Suroeste'),
    (lincoln_id, 'Barrio El Parque', 'Noroeste'),
    (lincoln_id, 'Barrio Plaza España', 'Noreste'),
    (lincoln_id, 'Barrio Docente', 'Noreste'),
    (lincoln_id, 'Barrio Cirigliano', 'Sur'),
    (lincoln_id, 'Puesta del Sol', 'Sur'),
    (lincoln_id, 'La Rotonda', 'Sur'),
    (lincoln_id, 'Manos Unidas', 'Sur'),
    (lincoln_id, 'Fundar', 'Norte'),
    (lincoln_id, 'Los Aromos', 'Sur'),
    (lincoln_id, 'Zona Rural Norte', 'Rural'),
    (lincoln_id, 'Zona Rural Sur', 'Rural'),
    (lincoln_id, 'Zona Rural Este', 'Rural'),
    (lincoln_id, 'Zona Rural Oeste', 'Rural'),
    (lincoln_id, 'Acceso Hipólito Yrigoyen', 'Rural'),
    (lincoln_id, 'Acceso Eva Perón', 'Rural'),
    (lincoln_id, 'Acceso Federico Cané', 'Rural');
end; $$;

-- 3. PERFILES INMOBILIARIOS (tabla nueva, no toca profiles del CRM)
create type public.tipo_usuario_inmo as enum ('dueno_directo','inmobiliaria','agente_independiente');

create table public.perfiles_inmo (
  id uuid primary key references auth.users(id) on delete cascade,
  ciudad_id uuid references public.ciudades(id),
  nombre text not null,
  slug text unique,
  avatar_url text,
  portada_url text,
  descripcion text,
  whatsapp text,
  instagram text,
  facebook text,
  sitio_web text,
  tipo public.tipo_usuario_inmo not null default 'dueno_directo',
  verificado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger perfiles_inmo_updated_at
  before update on public.perfiles_inmo
  for each row execute procedure public.update_updated_at_column();

-- 4. UNIFICAR handle_new_user (mantiene CRM + agrega perfil inmobiliario)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lincoln uuid;
  v_nombre text;
  v_slug text;
begin
  -- CRM existente
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    coalesce(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  insert into public.user_roles (user_id, role) values (NEW.id, 'rep');

  -- Perfil inmobiliario
  select id into v_lincoln from public.ciudades where nombre = 'Lincoln' limit 1;
  v_nombre := coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_slug := lower(regexp_replace(v_nombre, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text,1,6);

  insert into public.perfiles_inmo (id, ciudad_id, nombre, slug, avatar_url)
  values (NEW.id, v_lincoln, v_nombre, v_slug, coalesce(NEW.raw_user_meta_data->>'avatar_url',''));

  return NEW;
end; $$;

-- Asegurar trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Crear perfil inmobiliario para usuarios existentes
insert into public.perfiles_inmo (id, ciudad_id, nombre, slug, avatar_url)
select
  u.id,
  (select id from public.ciudades where nombre='Lincoln' limit 1),
  coalesce(p.full_name, split_part(u.email,'@',1), 'Usuario'),
  lower(regexp_replace(coalesce(p.full_name, split_part(u.email,'@',1), 'usuario'), '[^a-zA-Z0-9]+','-','g')) || '-' || substr(u.id::text,1,6),
  p.avatar_url
from auth.users u
left join public.profiles p on p.user_id = u.id
on conflict (id) do nothing;

-- 5. PUBLICACIONES
create type public.tipo_operacion as enum ('venta','alquiler','alquiler_temporario','local_comercial','oficina','campo_rural');
create type public.tipo_propiedad as enum ('casa','departamento','ph','local','oficina','galpon','terreno','campo','chacra','quinta','otro');
create type public.estado_publicacion as enum ('activa','pausada','vendida','alquilada','eliminada');

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles_inmo(id) on delete cascade,
  ciudad_id uuid not null references public.ciudades(id),
  barrio_id uuid references public.barrios(id),
  titulo text not null,
  descripcion text,
  tipo_operacion public.tipo_operacion not null,
  tipo_propiedad public.tipo_propiedad not null,
  estado public.estado_publicacion not null default 'activa',
  precio numeric(15,2),
  moneda text not null default 'ARS',
  precio_negociable boolean not null default false,
  expensas numeric(10,2),
  ambientes integer,
  dormitorios integer,
  banos integer,
  cochera boolean not null default false,
  superficie_total numeric(10,2),
  superficie_cubierta numeric(10,2),
  hectareas numeric(10,2),
  tipo_suelo text,
  tiene_galpon boolean not null default false,
  tiene_casa_campo boolean not null default false,
  acceso_pavimento boolean not null default false,
  gas_natural boolean not null default false,
  agua_corriente boolean not null default false,
  cloaca boolean not null default false,
  luz boolean not null default true,
  internet boolean not null default false,
  mostrar_direccion boolean not null default false,
  direccion text,
  referencia text,
  vistas integer not null default 0,
  destacada boolean not null default false,
  destacada_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger publicaciones_updated_at
  before update on public.publicaciones
  for each row execute procedure public.update_updated_at_column();

create index on public.publicaciones (ciudad_id);
create index on public.publicaciones (barrio_id);
create index on public.publicaciones (tipo_operacion);
create index on public.publicaciones (tipo_propiedad);
create index on public.publicaciones (estado);
create index on public.publicaciones (perfil_id);
create index on public.publicaciones (destacada, created_at desc);

-- 6. IMÁGENES
create table public.imagenes_publicacion (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  url text not null,
  tipo text not null default 'imagen',
  orden integer not null default 0,
  es_portada boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.imagenes_publicacion (publicacion_id, orden);

-- 7. COMENTARIOS
create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  perfil_id uuid not null references public.perfiles_inmo(id) on delete cascade,
  respuesta_a uuid references public.comentarios(id) on delete cascade,
  contenido text not null,
  created_at timestamptz not null default now()
);
create index on public.comentarios (publicacion_id, created_at);

-- 8. FAVORITOS
create table public.favoritos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles_inmo(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (perfil_id, publicacion_id)
);

-- 9. CONSULTAS
create table public.consultas (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  de_perfil_id uuid not null references public.perfiles_inmo(id) on delete cascade,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

-- 10. RLS
alter table public.ciudades enable row level security;
alter table public.barrios enable row level security;
alter table public.perfiles_inmo enable row level security;
alter table public.publicaciones enable row level security;
alter table public.imagenes_publicacion enable row level security;
alter table public.comentarios enable row level security;
alter table public.favoritos enable row level security;
alter table public.consultas enable row level security;

create policy "ciudades_lectura" on public.ciudades for select using (true);
create policy "barrios_lectura" on public.barrios for select using (true);

create policy "perfiles_inmo_lectura" on public.perfiles_inmo for select using (activo = true);
create policy "perfiles_inmo_insertar" on public.perfiles_inmo for insert with check (auth.uid() = id);
create policy "perfiles_inmo_editar" on public.perfiles_inmo for update using (auth.uid() = id);

create policy "publicaciones_lectura_publica" on public.publicaciones for select using (estado = 'activa' or auth.uid() = perfil_id);
create policy "publicaciones_insertar" on public.publicaciones for insert with check (auth.uid() = perfil_id);
create policy "publicaciones_editar" on public.publicaciones for update using (auth.uid() = perfil_id);
create policy "publicaciones_eliminar" on public.publicaciones for delete using (auth.uid() = perfil_id);

create policy "imagenes_lectura" on public.imagenes_publicacion for select using (true);
create policy "imagenes_insertar" on public.imagenes_publicacion for insert with check (
  auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id)
);
create policy "imagenes_eliminar" on public.imagenes_publicacion for delete using (
  auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id)
);

create policy "comentarios_lectura" on public.comentarios for select using (true);
create policy "comentarios_insertar" on public.comentarios for insert with check (auth.uid() = perfil_id);
create policy "comentarios_eliminar" on public.comentarios for delete using (auth.uid() = perfil_id);

create policy "favoritos_propios" on public.favoritos for all using (auth.uid() = perfil_id) with check (auth.uid() = perfil_id);

create policy "consultas_ver" on public.consultas for select using (
  auth.uid() = de_perfil_id or
  auth.uid() = (select perfil_id from public.publicaciones where id = publicacion_id)
);
create policy "consultas_insertar" on public.consultas for insert with check (auth.uid() = de_perfil_id);

-- 11. FUNCIÓN incrementar vistas
create or replace function public.incrementar_vistas(p_publicacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.publicaciones set vistas = vistas + 1 where id = p_publicacion_id;
end; $$;

-- 12. STORAGE BUCKETS
insert into storage.buckets (id, name, public) values
  ('propiedades','propiedades', true),
  ('avatares-inmo','avatares-inmo', true),
  ('portadas-inmo','portadas-inmo', true)
on conflict (id) do nothing;

-- Storage policies
create policy "propiedades_lectura" on storage.objects for select using (bucket_id = 'propiedades');
create policy "propiedades_insertar" on storage.objects for insert with check (bucket_id = 'propiedades' and auth.uid() is not null);
create policy "propiedades_borrar" on storage.objects for delete using (bucket_id = 'propiedades' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatares_inmo_lectura" on storage.objects for select using (bucket_id = 'avatares-inmo');
create policy "avatares_inmo_subir" on storage.objects for insert with check (bucket_id = 'avatares-inmo' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatares_inmo_actualizar" on storage.objects for update using (bucket_id = 'avatares-inmo' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "portadas_inmo_lectura" on storage.objects for select using (bucket_id = 'portadas-inmo');
create policy "portadas_inmo_subir" on storage.objects for insert with check (bucket_id = 'portadas-inmo' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "portadas_inmo_actualizar" on storage.objects for update using (bucket_id = 'portadas-inmo' and auth.uid()::text = (storage.foldername(name))[1]);