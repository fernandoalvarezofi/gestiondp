-- Alta de comercio: ¿está libre la dirección web (slug) de la tienda online? Solo personas con sesión.
create or replace function public.delivery_slug_disponible(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and length(p_slug) between 3 and 40
     and not exists (select 1 from public.delivery_comercios where slug = p_slug)
$$;

revoke all on function public.delivery_slug_disponible(text) from public, anon;
grant execute on function public.delivery_slug_disponible(text) to authenticated;
