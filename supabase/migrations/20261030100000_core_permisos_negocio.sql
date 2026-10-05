-- FASE 1 (Core), paso 2: los permisos reconocen los roles del NEGOCIO.
-- El modelo anterior (propietario_id + delivery_comercio_equipo) sigue intacto como respaldo: esto solo AGREGA una vía más.
-- Roles del negocio y lo que pueden hacer en TODAS las tiendas del negocio:
--   owner / admin : todo (pedidos, catálogo, promociones, opiniones, estadísticas, ajustes, finanzas, equipo)
--   manager       : pedidos, catálogo, promociones, opiniones, estadísticas, ajustes   (como el "encargado" actual)
--   operator      : pedidos                                                           (como el "operador" actual)
--   seller        : pedidos y catálogo
-- Gestionar el equipo, los datos legales/de cobro y las sucursales sigue siendo exclusivo del dueño (propietario).
-- Revertir: restaurar las definiciones anteriores de delivery_permiso, delivery_puede_ver_finanzas, delivery_mi_acceso y delivery_mis_comercios.

create or replace function public.delivery_permiso(p_comercio uuid, p_permiso text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.delivery_comercios c where c.id = p_comercio and c.propietario_id = auth.uid())
    or exists (
      select 1 from public.delivery_comercio_equipo e
      where e.comercio_id = p_comercio and e.user_id = auth.uid() and e.estado = 'activo'
        and ((e.rol = 'operador' and p_permiso = 'pedidos')
          or (e.rol = 'encargado' and p_permiso in ('pedidos', 'catalogo', 'promociones', 'opiniones', 'estadisticas', 'ajustes')))
    )
    or exists (
      select 1 from public.delivery_comercios c
      join public.core_business_members m on m.business_id = c.business_id
      where c.id = p_comercio and m.user_id = auth.uid() and m.estado = 'activo'
        and (m.rol in ('owner', 'admin')
          or (m.rol = 'manager' and p_permiso in ('pedidos', 'catalogo', 'promociones', 'opiniones', 'estadisticas', 'ajustes'))
          or (m.rol = 'operator' and p_permiso = 'pedidos')
          or (m.rol = 'seller' and p_permiso in ('pedidos', 'catalogo')))
    ), false)
$$;

create or replace function public.delivery_puede_ver_finanzas(p_comercio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.delivery_comercios c where c.id = p_comercio and c.propietario_id = auth.uid())
    or exists (
      select 1 from public.delivery_comercios c
      join public.core_business_members m on m.business_id = c.business_id
      where c.id = p_comercio and m.user_id = auth.uid() and m.estado = 'activo' and m.rol in ('owner', 'admin'))
$$;

-- Acceso del usuario a un comercio (para armar el panel): suma el de las membresías del negocio.
create or replace function public.delivery_mi_acceso(p_comercio uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('comercio_id', x.id, 'rol', x.rol, 'permisos', case x.rol
        when 'dueno' then '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes","finanzas","equipo"]'::jsonb
        when 'encargado' then '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes"]'::jsonb
        when 'vendedor' then '["pedidos","catalogo"]'::jsonb
        else '["pedidos"]'::jsonb end)
    from (
      select c.id, 'dueno'::text as rol, 0 as orden, c.created_at from public.delivery_comercios c where c.propietario_id = auth.uid() and (p_comercio is null or c.id = p_comercio)
      union all
      select e.comercio_id, e.rol, 1, e.created_at from public.delivery_comercio_equipo e where e.user_id = auth.uid() and e.estado = 'activo' and (p_comercio is null or e.comercio_id = p_comercio)
      union all
      select c.id, case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end, 2, c.created_at
        from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
       where m.user_id = auth.uid() and m.estado = 'activo' and (p_comercio is null or c.id = p_comercio)
      order by orden, created_at limit 1
    ) x
  ), 'null'::jsonb)
$$;

-- Tiendas a las que tiene acceso (propias, por equipo de la tienda o por el negocio).
create or replace function public.delivery_mis_comercios() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'logo_url', x.logo_url, 'direccion', x.direccion, 'rol', x.rol, 'aprobado', x.aprobado, 'esta_abierto', x.esta_abierto) order by x.orden, x.created_at), '[]'::jsonb)
  from (
    select c.id, c.nombre, c.logo_url, c.direccion, 'dueno'::text as rol, 0 as orden, c.created_at, c.aprobado, c.esta_abierto
      from public.delivery_comercios c where c.propietario_id = auth.uid()
    union all
    select c.id, c.nombre, c.logo_url, c.direccion, e.rol, 1, c.created_at, c.aprobado, c.esta_abierto
      from public.delivery_comercio_equipo e join public.delivery_comercios c on c.id = e.comercio_id
     where e.user_id = auth.uid() and e.estado = 'activo' and c.propietario_id is distinct from auth.uid()
    union all
    select c.id, c.nombre, c.logo_url, c.direccion,
           case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end,
           2, c.created_at, c.aprobado, c.esta_abierto
      from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
     where m.user_id = auth.uid() and m.estado = 'activo' and c.propietario_id is distinct from auth.uid()
       and not exists (select 1 from public.delivery_comercio_equipo e where e.comercio_id = c.id and e.user_id = auth.uid() and e.estado = 'activo')
  ) x
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Equipo del negocio: solo el DUEÑO invita, cambia roles y quita. Cada cambio queda en la auditoría.
create or replace function public.core_agregar_integrante(p_business uuid, p_email text, p_rol text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_user uuid;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión'; end if;
  if public.core_rol_en_negocio(p_business) is distinct from 'owner' then raise exception 'Solo el dueño del negocio puede invitar personas'; end if;
  if p_rol not in ('admin', 'manager', 'operator', 'seller') then raise exception 'Rol inválido'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'Ingresá un email válido'; end if;
  if (select count(*) from public.core_business_members where business_id = p_business) >= 25 then raise exception 'El negocio puede tener hasta 25 integrantes'; end if;
  -- No se revela si el email tiene o no cuenta: la respuesta es la misma.
  select u.id into v_user from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null limit 1;
  if v_user is not null and not exists (select 1 from public.core_business_members where business_id = p_business and user_id = v_user) then
    insert into public.core_business_members (business_id, user_id, rol, estado) values (p_business, v_user, p_rol, 'invitado');
    insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
      values (auth.uid(), 'core.integrante_invitado', 'negocio', p_business::text, jsonb_build_object('usuario', v_user, 'rol', p_rol));
  end if;
end $$;

create or replace function public.core_responder_invitacion(p_business uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión'; end if;
  if p_acepta then
    update public.core_business_members set estado = 'activo' where business_id = p_business and user_id = auth.uid() and estado = 'invitado';
  else
    delete from public.core_business_members where business_id = p_business and user_id = auth.uid() and estado = 'invitado';
  end if;
  if not found then raise exception 'La invitación ya no está disponible'; end if;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), case when p_acepta then 'core.invitacion_aceptada' else 'core.invitacion_rechazada' end, 'negocio', p_business::text, '{}'::jsonb);
end $$;

create or replace function public.core_cambiar_rol(p_business uuid, p_user uuid, p_rol text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.core_rol_en_negocio(p_business) is distinct from 'owner' then raise exception 'Solo el dueño del negocio puede cambiar roles'; end if;
  if p_rol not in ('admin', 'manager', 'operator', 'seller') then raise exception 'Rol inválido'; end if;
  update public.core_business_members set rol = p_rol where business_id = p_business and user_id = p_user and rol <> 'owner';
  if not found then raise exception 'No se puede cambiar el rol de esa persona'; end if;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), 'core.rol_cambiado', 'negocio', p_business::text, jsonb_build_object('usuario', p_user, 'rol', p_rol));
end $$;

create or replace function public.core_quitar_integrante(p_business uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión'; end if;
  if not (p_user = auth.uid() or public.core_rol_en_negocio(p_business) = 'owner') then raise exception 'No podés quitar a esta persona'; end if;
  delete from public.core_business_members where business_id = p_business and user_id = p_user and rol <> 'owner';
  if not found then raise exception 'No se puede quitar a esa persona (el dueño no se puede quitar)'; end if;
  insert into public.delivery_auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), 'core.integrante_quitado', 'negocio', p_business::text, jsonb_build_object('usuario', p_user));
end $$;

-- Integrantes de un negocio (solo dueño y administradores) y mis invitaciones pendientes.
create or replace function public.core_listar_integrantes(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.core_rol_en_negocio(p_business) not in ('owner', 'admin') then raise exception 'Sin permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'rol', m.rol, 'estado', m.estado, 'nombre', pf.nombre, 'created_at', m.created_at) order by m.created_at)
      from public.core_business_members m left join public.perfiles pf on pf.id = m.user_id where m.business_id = p_business), '[]'::jsonb);
end $$;

create or replace function public.core_mis_invitaciones() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('business_id', b.id, 'negocio', b.nombre, 'rol', m.rol, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
    from public.core_business_members m join public.core_businesses b on b.id = m.business_id
   where m.user_id = auth.uid() and m.estado = 'invitado'
$$;

revoke all on function public.core_agregar_integrante(uuid, text, text), public.core_responder_invitacion(uuid, boolean), public.core_cambiar_rol(uuid, uuid, text),
  public.core_quitar_integrante(uuid, uuid), public.core_listar_integrantes(uuid), public.core_mis_invitaciones() from public, anon;
grant execute on function public.core_agregar_integrante(uuid, text, text), public.core_responder_invitacion(uuid, boolean), public.core_cambiar_rol(uuid, uuid, text),
  public.core_quitar_integrante(uuid, uuid), public.core_listar_integrantes(uuid), public.core_mis_invitaciones() to authenticated;
