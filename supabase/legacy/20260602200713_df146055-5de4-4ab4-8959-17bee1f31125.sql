create or replace function public.delete_community_as_owner(_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.comunidades
    where id = _community_id
      and creador_id = auth.uid()
  ) then
    raise exception 'No autorizado para eliminar esta comunidad';
  end if;

  delete from public.comunidad_post_reacciones
  where post_id in (
    select id from public.comunidad_posts where comunidad_id = _community_id
  );

  delete from public.comunidad_posts
  where comunidad_id = _community_id;

  delete from public.comunidad_miembros
  where comunidad_id = _community_id;

  delete from public.comunidad_canales
  where comunidad_id = _community_id;

  delete from public.comunidad_categorias
  where comunidad_id = _community_id;

  delete from public.comunidad_roles
  where comunidad_id = _community_id;

  delete from public.comunidades
  where id = _community_id
    and creador_id = auth.uid();
end;
$$;

grant execute on function public.delete_community_as_owner(uuid) to authenticated;
grant execute on function public.delete_community_as_owner(uuid) to anon;