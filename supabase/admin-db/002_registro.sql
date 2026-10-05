-- Solo se puede crear una cuenta mientras la configuración inicial está abierta (hay código de primer uso pendiente).
-- Durante esa ventana la cuenta queda confirmada (el código de primer uso es la verificación real). Después, el registro se cierra.
create or replace function public.controlar_registro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.config where clave = 'bootstrap_hash') then
    raise exception 'El registro está cerrado';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;
revoke all on function public.controlar_registro() from public, anon, authenticated;

drop trigger if exists controlar_registro on auth.users;
create trigger controlar_registro before insert on auth.users for each row execute function public.controlar_registro();
