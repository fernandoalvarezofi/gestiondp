-- BASE: perfiles, roles y alta automática de usuarios.
-- RECONSTRUIDA el 2026-10-05 a partir de la definición real de la base `woref-delivery` (la migración original, aplicada como
-- `base_perfiles_y_roles`, no se conservó como archivo). Es idempotente: sobre la base actual no cambia nada.
-- Versiones posteriores la modifican: `has_role` se redefine con la exigencia de 2FA en `delivery_mfa_admin`, y los permisos de
-- columna de `perfiles` se restringen en `fase0_cerrar_exposicion_perfiles_y_comercios`.

do $$ begin
  create type public.app_role as enum ('admin', 'manager', 'rep');
exception when duplicate_object then null; end $$;

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  username text not null unique,
  avatar_url text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null default 'rep',
  unique (user_id, role)
);

alter table public.perfiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.update_updated_at_column() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists perfiles_updated_at on public.perfiles;
create trigger perfiles_updated_at before update on public.perfiles for each row execute function public.update_updated_at_column();

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Al registrarse un usuario se crea su perfil (con un username único derivado del nombre o del email) y el rol por defecto.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base_username text; final_username text; counter int := 0;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]+', '', 'g'));
  if length(base_username) < 3 then base_username := 'usuario'; end if;
  final_username := base_username;
  while exists (select 1 from public.perfiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter;
  end loop;
  insert into public.perfiles (id, nombre, username) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), final_username);
  insert into public.user_roles (user_id, role) values (new.id, 'rep');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop policy if exists "Perfiles visibles" on public.perfiles;
create policy "Perfiles visibles" on public.perfiles for select to anon, authenticated using (true);
drop policy if exists "Cada uno edita su perfil" on public.perfiles;
create policy "Cada uno edita su perfil" on public.perfiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "Usuarios ven sus roles" on public.user_roles;
create policy "Usuarios ven sus roles" on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role));
