-- FASE 1 (Core), paso 1: la entidad NEGOCIO.
-- Hasta ahora un comercio era a la vez negocio, tienda y sucursal. Acá se agrega, sin cambiar ningún permiso existente:
--   * core_businesses: el negocio (una persona o empresa que puede tener varias tiendas/sucursales);
--   * core_business_members: quién pertenece a cada negocio y con qué rol (owner, admin, manager, operator, seller);
--   * delivery_comercios.business_id y parent_store_id (sucursal de otra tienda), ambos opcionales.
-- Todo es aditivo y reversible; los datos existentes se rellenan (un negocio por cada dueño actual).
-- Revertir: alter table public.delivery_comercios drop column business_id, drop column parent_store_id; drop table public.core_business_members, public.core_businesses cascade;

create table if not exists public.core_businesses (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists core_businesses_owner_idx on public.core_businesses (owner_user_id);

create table if not exists public.core_business_members (
  business_id uuid not null references public.core_businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('owner', 'admin', 'manager', 'operator', 'seller')),
  estado text not null default 'activo' check (estado in ('activo', 'invitado', 'suspendido')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists core_business_members_user_idx on public.core_business_members (user_id);

drop trigger if exists core_businesses_updated_at on public.core_businesses;
create trigger core_businesses_updated_at before update on public.core_businesses for each row execute function public.update_updated_at_column();

alter table public.delivery_comercios
  add column if not exists business_id uuid references public.core_businesses (id) on delete set null,
  add column if not exists parent_store_id uuid references public.delivery_comercios (id) on delete set null;
create index if not exists delivery_comercios_business_idx on public.delivery_comercios (business_id);
create index if not exists delivery_comercios_parent_idx on public.delivery_comercios (parent_store_id);

-- Rol del usuario actual dentro de un negocio (null si no pertenece). Es la única pieza que decide el acceso a los datos del negocio.
create or replace function public.core_rol_en_negocio(p_business uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.rol from public.core_business_members m
   where m.business_id = p_business and m.user_id = auth.uid() and m.estado = 'activo'
$$;
revoke all on function public.core_rol_en_negocio(uuid) from public, anon;
grant execute on function public.core_rol_en_negocio(uuid) to authenticated;

-- RLS: los integrantes ven su negocio y sus propios vínculos; los dueños y administradores ven a todos los integrantes.
-- Las escrituras se hacen solo por funciones y disparadores (no hay políticas de INSERT/UPDATE/DELETE).
alter table public.core_businesses enable row level security;
alter table public.core_business_members enable row level security;
revoke all on public.core_businesses, public.core_business_members from anon, authenticated;
grant select on public.core_businesses, public.core_business_members to authenticated;
grant all on public.core_businesses, public.core_business_members to service_role;

drop policy if exists "Negocio: lo ven sus integrantes y la administración" on public.core_businesses;
create policy "Negocio: lo ven sus integrantes y la administración" on public.core_businesses for select to authenticated
  using (public.core_rol_en_negocio(id) is not null or public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Integrantes: cada uno ve los suyos; dueños y admins ven todos" on public.core_business_members;
create policy "Integrantes: cada uno ve los suyos; dueños y admins ven todos" on public.core_business_members for select to authenticated
  using (user_id = (select auth.uid()) or public.core_rol_en_negocio(business_id) in ('owner', 'admin') or public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Relleno de lo existente: un negocio por cada dueño actual (con el nombre de su primer comercio) y su vínculo de dueño.
insert into public.core_businesses (owner_user_id, nombre)
select c.propietario_id, left((array_agg(c.nombre order by c.created_at))[1], 120)
  from public.delivery_comercios c
 where c.propietario_id is not null
   and not exists (select 1 from public.core_businesses b where b.owner_user_id = c.propietario_id)
 group by c.propietario_id;

insert into public.core_business_members (business_id, user_id, rol)
select b.id, b.owner_user_id, 'owner' from public.core_businesses b
on conflict do nothing;

update public.delivery_comercios c set business_id = b.id
  from public.core_businesses b
 where b.owner_user_id = c.propietario_id and c.business_id is null;

-- Todo comercio nuevo queda dentro del negocio de su dueño (se crea si todavía no tiene).
create or replace function public.core_asegurar_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_business uuid;
begin
  if new.business_id is null and new.propietario_id is not null then
    select id into v_business from public.core_businesses where owner_user_id = new.propietario_id order by created_at limit 1;
    if v_business is null then
      insert into public.core_businesses (owner_user_id, nombre) values (new.propietario_id, left(new.nombre, 120)) returning id into v_business;
      insert into public.core_business_members (business_id, user_id, rol) values (v_business, new.propietario_id, 'owner') on conflict do nothing;
    end if;
    new.business_id := v_business;
  end if;
  return new;
end $$;
revoke all on function public.core_asegurar_negocio() from public, anon, authenticated;
drop trigger if exists core_asegurar_negocio on public.delivery_comercios;
create trigger core_asegurar_negocio before insert on public.delivery_comercios for each row execute function public.core_asegurar_negocio();

-- Mis negocios con sus tiendas (para cuentas con más de un negocio o varias sucursales).
create or replace function public.delivery_mis_negocios() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'nombre', b.nombre, 'rol', m.rol, 'estado', b.estado,
      'tiendas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'parent_store_id', c.parent_store_id, 'aprobado', c.aprobado, 'esta_abierto', c.esta_abierto) order by c.created_at)
                             from public.delivery_comercios c where c.business_id = b.id), '[]'::jsonb)
    ) order by b.created_at), '[]'::jsonb)
  from public.core_business_members m
  join public.core_businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.estado = 'activo'
$$;
revoke all on function public.delivery_mis_negocios() from public, anon;
grant execute on function public.delivery_mis_negocios() to authenticated;

-- Las sucursales nuevas quedan enlazadas a su tienda de origen.
do $mig$
declare d text; n text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'delivery_crear_sucursal';
  n := replace(d, 'INSERT INTO public.delivery_comercios (id, propietario_id, nombre,', 'INSERT INTO public.delivery_comercios (id, parent_store_id, propietario_id, nombre,');
  n := replace(n, 'VALUES (v_id, v_uid, v_nombre,', 'VALUES (v_id, p_origen, v_uid, v_nombre,');
  if n = d or position('parent_store_id' in n) = 0 or position('v_id, p_origen, v_uid' in n) = 0 then
    raise exception 'No se pudo enlazar la sucursal con su tienda de origen: la definición vigente cambió';
  end if;
  execute n;
end $mig$;
