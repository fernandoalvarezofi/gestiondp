-- AUDITORÍA Y ERRORES EN UNA BASE APARTE (proyecto "woref-admin").
-- Esta base solo conserva un buffer de envío: cada evento se firma (HMAC-SHA256) y se manda a la función `ingest` de la
-- base de administración; allí quedan encadenados y de solo-agregar. Ninguna cuenta de la app puede leer ni escribir
-- estas tablas por la API. Los secretos (`admin_ingest_url`, `admin_ingest_secret`) viven en `app_config`, nunca en el repo.

alter table public.delivery_auditoria add column if not exists enviado_at timestamptz, add column if not exists lote bigint, add column if not exists lote_at timestamptz;
alter table public.delivery_errores add column if not exists enviado_at timestamptz, add column if not exists lote bigint, add column if not exists lote_at timestamptz;
create index if not exists delivery_auditoria_pendientes_idx on public.delivery_auditoria (id) where enviado_at is null;
create index if not exists delivery_errores_pendientes_idx on public.delivery_errores (id) where enviado_at is null;

create or replace function public.delivery_admin_enviar() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_secret text; v_body jsonb; v_ts text; v_sig text; v_rid bigint;
  ids_a bigint[]; ids_e bigint[]; a jsonb; e jsonb;
begin
  if not pg_try_advisory_xact_lock(7260002) then return; end if;
  select valor into v_url from public.app_config where clave = 'admin_ingest_url';
  select valor into v_secret from public.app_config where clave = 'admin_ingest_secret';
  if v_url is null or v_secret is null then return; end if;

  -- 1) Confirmar los lotes que la otra base recibió (respuesta 200).
  update public.delivery_auditoria t set enviado_at = now() from net._http_response r where t.lote = r.id and t.enviado_at is null and r.status_code = 200;
  update public.delivery_errores t set enviado_at = now() from net._http_response r where t.lote = r.id and t.enviado_at is null and r.status_code = 200;
  -- 2) Liberar para reintento los que fallaron o no tuvieron respuesta en 3 minutos.
  update public.delivery_auditoria t set lote = null, lote_at = null
   where t.enviado_at is null and t.lote is not null
     and (exists (select 1 from net._http_response r where r.id = t.lote and coalesce(r.status_code, 0) <> 200) or t.lote_at < now() - interval '3 minutes');
  update public.delivery_errores t set lote = null, lote_at = null
   where t.enviado_at is null and t.lote is not null
     and (exists (select 1 from net._http_response r where r.id = t.lote and coalesce(r.status_code, 0) <> 200) or t.lote_at < now() - interval '3 minutes');

  -- 3) Armar y enviar el próximo lote (hasta 200 de cada tipo).
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb), coalesce(array_agg(x.id), '{}'::bigint[]) into a, ids_a
    from (select id, created_at, actor_id, accion, entidad, entidad_id, detalle from public.delivery_auditoria where enviado_at is null and lote is null order by id limit 200) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb), coalesce(array_agg(x.id), '{}'::bigint[]) into e, ids_e
    from (select id, created_at, huella, mensaje, stack, url, agente, usuario_id from public.delivery_errores where enviado_at is null and lote is null order by id limit 200) x;
  if jsonb_array_length(a) = 0 and jsonb_array_length(e) = 0 then return; end if;

  v_body := jsonb_build_object('auditoria', a, 'errores', e);
  v_ts := (extract(epoch from now())::bigint)::text;
  v_sig := encode(extensions.hmac(v_ts || '.' || v_body::text, v_secret, 'sha256'), 'hex');
  select net.http_post(url := v_url, body := v_body, headers := jsonb_build_object('Content-Type', 'application/json', 'x-woref-ts', v_ts, 'x-woref-sig', v_sig)) into v_rid;
  update public.delivery_auditoria set lote = v_rid, lote_at = now() where id = any (ids_a);
  update public.delivery_errores set lote = v_rid, lote_at = now() where id = any (ids_e);
end $$;
revoke all on function public.delivery_admin_enviar() from public, anon, authenticated;

-- Cada acción de administración se envía enseguida; si falla, el trabajo programado reintenta.
create or replace function public.delivery_auditoria_enviar_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.delivery_admin_enviar();
  exception when others then
    null; -- un problema de envío nunca debe impedir la acción de administración
  end;
  return null;
end $$;
revoke all on function public.delivery_auditoria_enviar_trg() from public, anon, authenticated;

drop trigger if exists delivery_auditoria_enviar on public.delivery_auditoria;
create trigger delivery_auditoria_enviar after insert on public.delivery_auditoria
  for each statement execute function public.delivery_auditoria_enviar_trg();

select cron.schedule('delivery-admin-enviar', '* * * * *', 'select public.delivery_admin_enviar()');
select cron.schedule('delivery-admin-purgar', '40 3 * * *', 'delete from public.delivery_auditoria where enviado_at < now() - interval ''14 days''; delete from public.delivery_errores where enviado_at < now() - interval ''7 days''');

-- Cierre de la lectura local: la auditoría y los errores se consultan solo desde la Consola (base de administración).
drop function if exists public.delivery_admin_auditoria(text, integer);
drop function if exists public.delivery_admin_errores(integer);
drop policy if exists "Auditoría: solo administración" on public.delivery_auditoria;
alter table public.delivery_auditoria enable row level security;
alter table public.delivery_errores enable row level security;
revoke all on public.delivery_auditoria, public.delivery_errores from anon, authenticated;
