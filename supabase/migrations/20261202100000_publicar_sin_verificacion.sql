-- Negocios informativos públicos sin verificación (decisión del dueño, 2026-10-10).
-- Una página web, una agenda de turnos (se paga en el lugar) o una carta digital sin pedidos no cobran nada por Woref:
-- quedan públicas al crearse, sin esperar la aprobación con CUIT. Para vender (pedidos online o estar en la app de
-- delivery) sigue haciendo falta que administración verifique al titular.
--  * `verificado`: lo aprobó administración (con datos legales). Es la fuente de verdad de la verificación.
--  * `aprobado`: visible al público. Para el dueño se calcula: verificado, o informativo y sin rechazo.
-- No destructiva: agrega una columna y reemplaza dos funciones.

alter table public.delivery_comercios add column if not exists verificado boolean not null default false;
update public.delivery_comercios set verificado = aprobado where verificado is distinct from aprobado;
grant select (verificado) on public.delivery_comercios to anon, authenticated;

-- Informativo: no toma pedidos por Woref ni está en la app de delivery.
create or replace function public.comercio_es_informativo(p_tipo text, p_pedidos boolean, p_market boolean)
returns boolean language sql immutable set search_path = public as $$
  select p_tipo = 'sitio' or (not coalesce(p_pedidos, true) and not coalesce(p_market, true));
$$;

CREATE OR REPLACE FUNCTION public.delivery_proteger_comercio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating := 0;
      NEW.total_resenas := 0;
      NEW.destacado := false;
      NEW.activo := true;
      NEW.verificado := false;
      NEW.motivo_rechazo := NULL;
      NEW.aprobado := public.comercio_es_informativo(NEW.tipo_sitio, NEW.pedidos_online, NEW.en_market);
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
      NEW.verificado := OLD.verificado;
      NEW.motivo_rechazo := OLD.motivo_rechazo;
      -- Si deja de ser informativo (activa pedidos, la tienda o la app de delivery) sin estar verificado, vuelve a revisión.
      NEW.aprobado := OLD.verificado
        OR (OLD.motivo_rechazo IS NULL AND public.comercio_es_informativo(NEW.tipo_sitio, NEW.pedidos_online, NEW.en_market));
      NEW.propietario_id := OLD.propietario_id;
      NEW.comision_pct := OLD.comision_pct;
      NEW.pausado_hasta := OLD.pausado_hasta;
      NEW.eliminado_at := OLD.eliminado_at;
      NEW.eliminado_por := OLD.eliminado_por;
      NEW.slug_anterior := OLD.slug_anterior;
    END IF;
  ELSIF current_user = 'authenticated' AND TG_OP = 'UPDATE' AND NEW.aprobado IS DISTINCT FROM OLD.aprobado AND NEW.verificado IS NOT DISTINCT FROM OLD.verificado THEN
    -- Administración cambió la aprobación directamente: la verificación la acompaña.
    NEW.verificado := NEW.aprobado;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.delivery_moderar_comercio(p_comercio uuid, p_aprobado boolean, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo un administrador puede aprobar comercios'; END IF;
  IF p_aprobado AND NOT EXISTS (SELECT 1 FROM public.delivery_comercio_legal WHERE comercio_id = p_comercio) THEN
    RAISE EXCEPTION 'Faltan los datos legales del comercio (CUIT y razón social)';
  END IF;
  UPDATE public.delivery_comercios
    SET aprobado = p_aprobado, verificado = p_aprobado,
        motivo_rechazo = CASE WHEN p_aprobado THEN NULL ELSE coalesce(nullif(left(trim(coalesce(p_motivo, '')), 300), ''), 'No cumple las condiciones de Woref') END
  WHERE id = p_comercio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comercio no encontrado'; END IF;
END $function$;

-- Negocios informativos ya creados que esperaban revisión (sin rechazo): pasan a ser públicos.
update public.delivery_comercios set aprobado = true
where not aprobado and not verificado and motivo_rechazo is null and eliminado_at is null
  and public.comercio_es_informativo(tipo_sitio, pedidos_online, en_market);
