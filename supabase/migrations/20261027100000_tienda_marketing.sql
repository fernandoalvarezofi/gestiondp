-- Marketing de la tienda online: suscriptores por email y bloques nuevos (newsletter, políticas, oferta con cuenta regresiva, video).

create table if not exists public.delivery_tienda_suscriptores (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.delivery_comercios(id) on delete cascade,
  email text not null check (length(email) between 6 and 160),
  creado_at timestamptz not null default now()
);
create unique index if not exists delivery_tienda_suscriptores_unico on public.delivery_tienda_suscriptores (comercio_id, lower(email));
create index if not exists delivery_tienda_suscriptores_fecha on public.delivery_tienda_suscriptores (comercio_id, creado_at desc);
alter table public.delivery_tienda_suscriptores enable row level security;
revoke all on public.delivery_tienda_suscriptores from anon, authenticated;
grant select, delete on public.delivery_tienda_suscriptores to authenticated;
create policy "Suscriptores: ven quienes gestionan la tienda" on public.delivery_tienda_suscriptores for select to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));
create policy "Suscriptores: borran quienes gestionan la tienda" on public.delivery_tienda_suscriptores for delete to authenticated using (public.delivery_permiso(comercio_id, 'ajustes'));

-- Alta pública desde la tienda: valida el email, ignora repetidos sin revelarlo y limita el volumen por tienda (anti-abuso).
create or replace function public.delivery_tienda_suscribir(p_comercio uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,100}\.[a-z]{2,24}$' then raise exception 'Escribí un email válido'; end if;
  if not exists (select 1 from public.delivery_comercios where id = p_comercio and aprobado and activo) then raise exception 'La tienda no está disponible'; end if;
  if (select count(*) from public.delivery_tienda_suscriptores where comercio_id = p_comercio and creado_at > now() - interval '1 hour') >= 40 then
    raise exception 'Demasiados registros en este momento. Probá más tarde';
  end if;
  insert into public.delivery_tienda_suscriptores (comercio_id, email) values (p_comercio, v_email) on conflict do nothing;
end $$;
revoke all on function public.delivery_tienda_suscribir(uuid, text) from public;
grant execute on function public.delivery_tienda_suscribir(uuid, text) to anon, authenticated;

-- Bloques nuevos en la validación del servidor (misma lógica que src/lib/storefront.ts). Se extiende la definición vigente.
do $mig$
declare d text; n text; extra text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = '_ts_bloque';
  extra := $br$
    when 'newsletter' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24)));
    when 'politicas' then
      select coalesce(jsonb_agg(jsonb_build_object('t', e.t, 'x', e.x)), '[]'::jsonb) into items
      from (select public._ts_txt(el, 't', 40) t, public._ts_txt(el, 'x', 600) x from jsonb_array_elements(case when jsonb_typeof(b -> 'items') = 'array' then b -> 'items' else '[]'::jsonb end) el limit 4) e where e.t is not null and e.x is not null;
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80))) || jsonb_build_object('items', items);
    when 'oferta' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200), 'boton', public._ts_txt(b,'boton',24),
        'hasta', case when jsonb_typeof(b -> 'hasta') = 'string' and (b ->> 'hasta') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$' then left(b ->> 'hasta', 30) end,
        'enlace_tipo', public._ts_enum(b,'enlace_tipo',enl,'catalogo'), 'enlace_url', public._ts_url(b,'enlace_url',300)));
    when 'video' then
      return base || jsonb_strip_nulls(jsonb_build_object('titulo', public._ts_txt(b,'titulo',80), 'texto', public._ts_txt(b,'texto',200),
        'url', case when jsonb_typeof(b -> 'url') = 'string' and (b ->> 'url') ~* '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[A-Za-z0-9_-]{5,20}([&?][A-Za-z0-9_=&-]*)?$' then left(b ->> 'url', 200) end));
$br$;
  n := replace(d, E'    else\n      return null;', extra || E'    else\n      return null;');
  if n = d then raise exception 'No se pudo extender _ts_bloque: la definición vigente cambió'; end if;
  execute n;
end $mig$;
