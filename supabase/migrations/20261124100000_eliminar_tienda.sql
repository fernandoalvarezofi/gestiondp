-- Eliminar una tienda (pedido del dueño de Woref: "que se pueda borrar manualmente cada tienda").
-- Regla: una tienda SIN pedidos ni turnos se elimina de verdad (con productos, diseño, etc.). Una tienda CON historial se
-- "da de baja": desaparece para los clientes y del panel, se archivan sus productos y se libera su dirección, pero los pedidos,
-- liquidaciones y reclamos quedan intactos (son registros contables y de clientes). Administración puede restaurarla.
-- Solo el dueño del negocio o un admin; hay que escribir el nombre de la tienda para confirmar.

alter table public.delivery_comercios add column if not exists eliminado_at timestamptz;
alter table public.delivery_comercios add column if not exists eliminado_por uuid references auth.users (id) on delete set null;
alter table public.delivery_comercios add column if not exists slug_anterior text;
create index if not exists delivery_comercios_eliminado_idx on public.delivery_comercios (eliminado_at) where eliminado_at is not null;

-- Una tienda dada de baja no se puede editar ni "revivir" desde la API: solo administración la restaura.
create or replace function public.delivery_proteger_comercio()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating := 0;
      NEW.total_resenas := 0;
      NEW.destacado := false;
      NEW.activo := true;
      NEW.aprobado := false;
      NEW.motivo_rechazo := NULL;
      NEW.comision_pct := public.delivery_ajuste('comision_default_pct', 12);
      NEW.pausado_hasta := NULL;
      NEW.eliminado_at := NULL;
      NEW.eliminado_por := NULL;
      NEW.slug_anterior := NULL;
    ELSE
      IF OLD.eliminado_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta tienda está dada de baja. Si querés recuperarla, escribinos desde Ayuda.';
      END IF;
      NEW.rating := OLD.rating;
      NEW.total_resenas := OLD.total_resenas;
      NEW.destacado := OLD.destacado;
      NEW.activo := OLD.activo;
      NEW.aprobado := OLD.aprobado;
      NEW.motivo_rechazo := OLD.motivo_rechazo;
      NEW.propietario_id := OLD.propietario_id;
      NEW.comision_pct := OLD.comision_pct;
      NEW.pausado_hasta := OLD.pausado_hasta;
      NEW.eliminado_at := OLD.eliminado_at;
      NEW.eliminado_por := OLD.eliminado_por;
      NEW.slug_anterior := OLD.slug_anterior;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ¿Quién puede eliminar? El dueño (propietario o "owner" del negocio) o un admin. Encargados y empleados no.
create or replace function public._puede_eliminar_tienda(p_comercio uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.delivery_comercios c where c.id = p_comercio and c.propietario_id = auth.uid())
    or exists (select 1 from public.delivery_comercios c join public.core_business_members m on m.business_id = c.business_id
               where c.id = p_comercio and m.user_id = auth.uid() and m.estado = 'activo' and m.rol = 'owner'), false)
$$;
revoke all on function public._puede_eliminar_tienda(uuid) from public, anon, authenticated;

-- Qué pasaría si se elimina: lo usa la pantalla para explicar las consecuencias antes de confirmar.
create or replace function public.delivery_tienda_eliminacion_resumen(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_c record; v_pedidos int; v_activos int; v_turnos int; v_turnos_futuros int; v_sin_liquidar int; v_productos int; v_sucursales int;
begin
  if not public._puede_eliminar_tienda(p_comercio) then raise exception 'Solo el dueño del negocio puede eliminar la tienda'; end if;
  select id, nombre, eliminado_at into v_c from public.delivery_comercios where id = p_comercio;
  if v_c.id is null then raise exception 'La tienda no existe'; end if;
  select count(*), count(*) filter (where estado in ('pendiente','confirmado','preparando','listo','en_camino')),
         count(*) filter (where estado = 'entregado' and liquidacion_id is null)
    into v_pedidos, v_activos, v_sin_liquidar from public.delivery_pedidos where comercio_id = p_comercio;
  select count(*), count(*) filter (where estado in ('pendiente','confirmado') and inicio > now())
    into v_turnos, v_turnos_futuros from public.turnos where comercio_id = p_comercio;
  select count(*) into v_productos from public.delivery_productos where comercio_id = p_comercio;
  select count(*) into v_sucursales from public.delivery_comercios where parent_store_id = p_comercio and eliminado_at is null;
  return jsonb_build_object(
    'nombre', v_c.nombre,
    'modo', case when v_pedidos = 0 and v_turnos = 0 then 'eliminar' else 'baja' end,
    'pedidos', v_pedidos, 'pedidos_activos', v_activos, 'turnos', v_turnos, 'turnos_futuros', v_turnos_futuros,
    'sin_liquidar', v_sin_liquidar, 'productos', v_productos, 'sucursales', v_sucursales,
    'bloqueos', to_jsonb(array_remove(array[
      case when v_activos > 0 then format('Tenés %s %s en curso: terminalos o cancelalos primero.', v_activos, case when v_activos = 1 then 'pedido' else 'pedidos' end) end,
      case when v_turnos_futuros > 0 then format('Tenés %s %s por venir: cancelalos primero (les avisamos a los clientes).', v_turnos_futuros, case when v_turnos_futuros = 1 then 'turno' else 'turnos' end) end,
      case when v_sin_liquidar > 0 and not public.has_role(auth.uid(), 'admin'::app_role) then format('Hay %s %s entregados sin liquidar: pedile a administración el cierre antes de dar de baja la tienda.', v_sin_liquidar, case when v_sin_liquidar = 1 then 'pedido' else 'pedidos' end) end
    ], null))
  );
end $$;

create or replace function public.delivery_eliminar_tienda(p_comercio uuid, p_confirmacion text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_res jsonb; v_c record;
begin
  -- Evita dos eliminaciones simultáneas de la misma tienda y que entre un pedido nuevo mientras tanto.
  perform 1 from public.delivery_comercios where id = p_comercio for update;
  v_res := public.delivery_tienda_eliminacion_resumen(p_comercio);
  select id, nombre, slug, eliminado_at into v_c from public.delivery_comercios where id = p_comercio;
  if v_c.eliminado_at is not null then raise exception 'La tienda ya está dada de baja'; end if;
  if lower(btrim(coalesce(p_confirmacion, ''))) <> lower(btrim(v_c.nombre)) then
    raise exception 'Escribí el nombre exacto de la tienda para confirmar';
  end if;
  if jsonb_array_length(v_res->'bloqueos') > 0 then raise exception '%', v_res->'bloqueos'->>0; end if;

  if v_res->>'modo' = 'eliminar' then
    -- Sin pedidos ni turnos: se borra todo lo de la tienda (productos, diseño, cupones, etc., por cascada).
    delete from public.delivery_comercios where id = p_comercio;
    return jsonb_build_object('resultado', 'eliminada', 'nombre', v_c.nombre);
  end if;

  -- Con historial: baja lógica. Se libera la dirección para que el nombre pueda volver a usarse.
  update public.delivery_productos set estado = 'archivado' where comercio_id = p_comercio and estado <> 'archivado';
  update public.delivery_comercios
     set eliminado_at = now(), eliminado_por = auth.uid(), activo = false, esta_abierto = false, destacado = false,
         slug_anterior = slug, slug = left(slug, 60) || '-baja-' || substr(replace(id::text, '-', ''), 1, 8)
   where id = p_comercio;
  return jsonb_build_object('resultado', 'baja', 'nombre', v_c.nombre);
end $$;

-- Administración: restaurar una tienda dada de baja (vuelve oculta, para revisarla y reactivarla a mano).
create or replace function public.delivery_admin_restaurar_tienda(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_slug text;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  select id, nombre, slug, slug_anterior, eliminado_at into v_c from public.delivery_comercios where id = p_comercio for update;
  if v_c.id is null or v_c.eliminado_at is null then raise exception 'La tienda no está dada de baja'; end if;
  v_slug := coalesce(v_c.slug_anterior, v_c.slug);
  if exists (select 1 from public.delivery_comercios where slug = v_slug and id <> p_comercio) then v_slug := v_c.slug; end if;
  update public.delivery_comercios set eliminado_at = null, eliminado_por = null, slug = v_slug, slug_anterior = null where id = p_comercio;
  return jsonb_build_object('nombre', v_c.nombre, 'slug', v_slug, 'aviso', 'Quedó oculta: activala desde Comercios cuando esté lista.');
end $$;

revoke all on function public.delivery_tienda_eliminacion_resumen(uuid) from public, anon;
grant execute on function public.delivery_tienda_eliminacion_resumen(uuid) to authenticated;
revoke all on function public.delivery_eliminar_tienda(uuid, text) from public, anon;
grant execute on function public.delivery_eliminar_tienda(uuid, text) to authenticated;
revoke all on function public.delivery_admin_restaurar_tienda(uuid) from public, anon;
grant execute on function public.delivery_admin_restaurar_tienda(uuid) to authenticated;

-- El panel deja de listar las tiendas dadas de baja (el historial sigue disponible para administración).
create or replace function public.delivery_mis_comercios()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'nombre', x.nombre, 'logo_url', x.logo_url, 'direccion', x.direccion, 'rol', x.rol, 'aprobado', x.aprobado, 'esta_abierto', x.esta_abierto,
      'negocio_id', x.business_id, 'negocio', b.nombre, 'parent_store_id', x.parent_store_id
    ) order by x.orden, b.nombre, x.created_at), '[]'::jsonb)
  from (
    select c.id, c.nombre, c.logo_url, c.direccion, 'dueno'::text as rol, 0 as orden, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.delivery_comercios c where c.propietario_id = auth.uid() and c.eliminado_at is null
    union all
    select c.id, c.nombre, c.logo_url, c.direccion, e.rol, 1, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.delivery_comercio_equipo e join public.delivery_comercios c on c.id = e.comercio_id
     where e.user_id = auth.uid() and e.estado = 'activo' and c.propietario_id is distinct from auth.uid() and c.eliminado_at is null
    union all
    select c.id, c.nombre, c.logo_url, c.direccion,
           case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end,
           2, c.created_at, c.aprobado, c.esta_abierto, c.business_id, c.parent_store_id
      from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
     where m.user_id = auth.uid() and m.estado = 'activo' and c.propietario_id is distinct from auth.uid() and c.eliminado_at is null
       and not exists (select 1 from public.delivery_comercio_equipo e where e.comercio_id = c.id and e.user_id = auth.uid() and e.estado = 'activo')
  ) x
  left join public.core_businesses b on b.id = x.business_id
$function$;

create or replace function public.delivery_mi_acceso(p_comercio uuid default null::uuid)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce((
    select jsonb_build_object('comercio_id', x.id, 'rol', x.rol, 'permisos', case x.rol
        when 'dueno' then '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes","finanzas","equipo"]'::jsonb
        when 'encargado' then '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes"]'::jsonb
        when 'vendedor' then '["pedidos","catalogo"]'::jsonb
        else '["pedidos"]'::jsonb end)
    from (
      select c.id, 'dueno'::text as rol, 0 as orden, c.created_at from public.delivery_comercios c
       where c.propietario_id = auth.uid() and c.eliminado_at is null and (p_comercio is null or c.id = p_comercio)
      union all
      select e.comercio_id, e.rol, 1, e.created_at from public.delivery_comercio_equipo e join public.delivery_comercios c on c.id = e.comercio_id
       where e.user_id = auth.uid() and e.estado = 'activo' and c.eliminado_at is null and (p_comercio is null or e.comercio_id = p_comercio)
      union all
      select c.id, case m.rol when 'owner' then 'dueno' when 'admin' then 'encargado' when 'manager' then 'encargado' when 'seller' then 'vendedor' else 'operador' end, 2, c.created_at
        from public.core_business_members m join public.delivery_comercios c on c.business_id = m.business_id
       where m.user_id = auth.uid() and m.estado = 'activo' and c.eliminado_at is null and (p_comercio is null or c.id = p_comercio)
      order by orden, created_at limit 1
    ) x
  ), 'null'::jsonb)
$function$;

-- Vista de sucursales del negocio: tampoco lista las tiendas dadas de baja.
create or replace function public.delivery_resumen_negocios()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'nombre', b.nombre, 'rol', m.rol,
      'tiendas', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', c.id, 'nombre', c.nombre, 'direccion', c.direccion, 'aprobado', c.aprobado, 'esta_abierto', c.esta_abierto,
            'rating', c.rating, 'resenas', c.total_resenas, 'parent_store_id', c.parent_store_id,
            'pedidos', coalesce(p.pedidos, 0), 'ventas', coalesce(p.ventas, 0),
            'ticket', case when coalesce(p.pedidos, 0) > 0 then round(p.ventas / p.pedidos) else 0 end,
            'pendientes', (select count(*) from public.delivery_pedidos x where x.comercio_id = c.id and x.estado = 'pendiente')
          ) order by c.created_at)
          from public.delivery_comercios c
          left join lateral (select count(*) as pedidos, sum(subtotal) as ventas from public.delivery_pedidos x
                              where x.comercio_id = c.id and x.estado = 'entregado' and x.entregado_at > now() - interval '30 days') p on true
         where c.business_id = b.id and c.eliminado_at is null), '[]'::jsonb)
    ) order by b.created_at), '[]'::jsonb)
  from public.core_business_members m
  join public.core_businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.estado = 'activo' and m.rol in ('owner', 'admin')
$function$;
