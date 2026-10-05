-- FASE 0 (1/3): funciones nuevas, aditivas. Se aplicaron ANTES de publicar el front que las usa.
-- Revertir: drop function public.delivery_mi_perfil(); drop function public.delivery_admin_comercios();

-- Perfil propio con teléfono: la única vía para leer el teléfono (la lectura directa de la columna se cierra en 2/3).
create or replace function public.delivery_mi_perfil() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('nombre', p.nombre, 'telefono', p.telefono, 'avatar_url', p.avatar_url, 'username', p.username)
                     from public.perfiles p where p.id = auth.uid()), 'null'::jsonb)
$$;
revoke all on function public.delivery_mi_perfil() from public, anon;
grant execute on function public.delivery_mi_perfil() to authenticated;

-- Listado completo de comercios para administración (incluye comisión y frecuencia de liquidación, que dejan de ser públicas).
create or replace function public.delivery_admin_comercios() returns setof public.delivery_comercios
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Solo administradores'; end if;
  return query select * from public.delivery_comercios order by created_at desc;
end $$;
revoke all on function public.delivery_admin_comercios() from public, anon;
grant execute on function public.delivery_admin_comercios() to authenticated;
