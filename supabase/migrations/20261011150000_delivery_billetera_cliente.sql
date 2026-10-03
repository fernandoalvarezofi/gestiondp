-- Billetera virtual del cliente: saldo en el libro contable, reintegros automáticos y uso del saldo al pedir.

ALTER TABLE public.delivery_pedidos ADD COLUMN IF NOT EXISTS saldo_usado numeric NOT NULL DEFAULT 0 CHECK (saldo_usado >= 0);

CREATE OR REPLACE FUNCTION public.delivery_saldo_cliente(p_cliente uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(sum(monto), 0) FROM public.delivery_libro WHERE titular_tipo = 'cliente' AND titular_id = p_cliente AND cuenta = 'billetera'
$$;
REVOKE ALL ON FUNCTION public.delivery_saldo_cliente(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_billetera_cliente() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión'; END IF;
  RETURN jsonb_build_object('saldo', public.delivery_saldo_cliente(v_uid),
    'movimientos', coalesce((SELECT jsonb_agg(jsonb_build_object('fecha', m.fecha, 'tipo', m.tipo, 'monto', m.monto, 'pedido_id', m.pedido_id, 'detalle', m.detalle) ORDER BY m.fecha DESC, m.id DESC)
      FROM (SELECT * FROM public.delivery_libro WHERE titular_tipo = 'cliente' AND titular_id = v_uid AND cuenta = 'billetera' ORDER BY fecha DESC, id DESC LIMIT 60) m), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.delivery_billetera_cliente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_billetera_cliente() TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_cargar_billetera(p_cliente uuid, p_monto numeric, p_motivo text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_monto IS NULL OR p_monto < 100 OR p_monto > 200000 OR p_monto <> floor(p_monto) THEN RAISE EXCEPTION 'El monto tiene que ser un entero de $100 a $200.000'; END IF;
  IF char_length(trim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Indicá el motivo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_cliente) THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  INSERT INTO public.delivery_libro (titular_tipo, titular_id, cuenta, tipo, monto, detalle)
    VALUES ('cliente', p_cliente, 'billetera', 'carga_admin', p_monto, jsonb_build_object('motivo', left(trim(p_motivo), 200), 'por', auth.uid()));
  RETURN public.delivery_saldo_cliente(p_cliente);
END $$;
REVOKE ALL ON FUNCTION public.delivery_admin_cargar_billetera(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_cargar_billetera(uuid, numeric, text) TO authenticated;

-- Pedido cancelado: se devuelve a la billetera lo que se había usado
CREATE OR REPLACE FUNCTION public.delivery_billetera_cancelacion_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.saldo_usado > 0 THEN
    INSERT INTO public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, detalle)
      VALUES (NEW.id, 'cliente', NEW.cliente_id, 'billetera', 'reintegro_cancelacion', NEW.saldo_usado, jsonb_build_object('motivo', NEW.motivo_cancelacion))
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_pedidos_billetera_cancel ON public.delivery_pedidos;
CREATE TRIGGER delivery_pedidos_billetera_cancel AFTER UPDATE OF estado ON public.delivery_pedidos FOR EACH ROW WHEN (NEW.estado = 'cancelado' AND OLD.estado IS DISTINCT FROM 'cancelado') EXECUTE FUNCTION public.delivery_billetera_cancelacion_trg();

-- Reintegro de soporte: se acredita solo a la billetera (salvo pedidos pagados online, que se devuelven por Mercado Pago)
CREATE OR REPLACE FUNCTION public.delivery_billetera_reintegro_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_metodo text; v_extra numeric := NEW.reembolso_monto - coalesce(OLD.reembolso_monto, 0);
BEGIN
  IF v_extra <= 0 THEN RETURN NEW; END IF;
  IF NEW.pedido_id IS NOT NULL THEN SELECT metodo_pago INTO v_metodo FROM public.delivery_pedidos WHERE id = NEW.pedido_id; END IF;
  IF v_metodo = 'mercadopago' THEN RETURN NEW; END IF;
  INSERT INTO public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, referencia, detalle)
    VALUES (NULL, 'cliente', NEW.cliente_id, 'billetera', 'reintegro_soporte', v_extra, NEW.id::text, jsonb_build_object('pedido_id', NEW.pedido_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_reclamos_billetera ON public.delivery_reclamos;
CREATE TRIGGER delivery_reclamos_billetera AFTER UPDATE OF reembolso_monto ON public.delivery_reclamos FOR EACH ROW EXECUTE FUNCTION public.delivery_billetera_reintegro_trg();

-- Ajuste de un pedido (falta de stock): el total se recalcula descontando lo pagado con billetera, y el excedente vuelve al saldo.
CREATE OR REPLACE FUNCTION public.delivery_recalcular_pedido(p_pedido uuid, p_delta_subtotal numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.delivery_pedidos; v_sub numeric; v_serv numeric; v_desc numeric; v_full numeric; v_usado numeric; v_total numeric; v_exceso numeric;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  v_sub := greatest(p.subtotal + p_delta_subtotal, 0);
  v_serv := round(v_sub * public.delivery_ajuste('tarifa_servicio_pct', 5) / 100);
  v_desc := least(p.descuento, v_sub);
  v_full := greatest(v_sub + p.costo_envio + v_serv + p.propina - v_desc, 0);
  v_usado := least(p.saldo_usado, v_full);
  v_exceso := p.saldo_usado - v_usado;
  v_total := v_full - v_usado;
  UPDATE public.delivery_pedidos SET subtotal = v_sub, tarifa_servicio = v_serv, descuento = v_desc, total = v_total, saldo_usado = v_usado,
    efectivo_paga_con = CASE WHEN efectivo_paga_con IS NOT NULL AND efectivo_paga_con >= v_total THEN efectivo_paga_con ELSE NULL END
  WHERE id = p_pedido;
  IF v_exceso > 0 THEN
    INSERT INTO public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto, referencia)
      VALUES (NULL, 'cliente', p.cliente_id, 'billetera', 'reintegro_ajuste', v_exceso, p_pedido::text);
  END IF;
END $$;

-- Pedir usando el saldo de la billetera
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.delivery_crear_pedido(uuid,jsonb,text,uuid,text,numeric,text,text,text,numeric,numeric,text,timestamptz,numeric)'::regprocedure) INTO d;
  IF position('p_usar_saldo' IN d) > 0 THEN RETURN; END IF;
  d := replace(d, 'p_paga_con numeric DEFAULT NULL::numeric)', 'p_paga_con numeric DEFAULT NULL::numeric, p_usar_saldo boolean DEFAULT false)');
  d := replace(d, 'v_tarifa jsonb;', 'v_tarifa jsonb; v_usar numeric := 0;');
  d := replace(d, E'  v_total := greatest(v_subtotal + v_envio + v_servicio + v_propina - v_descuento, 0);\n',
    E'  v_total := greatest(v_subtotal + v_envio + v_servicio + v_propina - v_descuento, 0);\n  IF p_usar_saldo AND v_total > 0 THEN\n    PERFORM pg_advisory_xact_lock(hashtext(''billetera:'' || v_uid::text));\n    v_usar := least(public.delivery_saldo_cliente(v_uid), v_total);\n    v_total := v_total - v_usar;\n  END IF;\n');
  d := replace(d, 'efectivo_paga_con, tarifa_detalle' || E'\n  ) VALUES (', 'efectivo_paga_con, tarifa_detalle, saldo_usado' || E'\n  ) VALUES (');
  d := replace(d, 'CASE WHEN v_retiro THEN NULL ELSE v_tarifa END' || E'\n  ) RETURNING id INTO v_pedido;',
    E'CASE WHEN v_retiro THEN NULL ELSE v_tarifa END, v_usar\n  ) RETURNING id INTO v_pedido;\n  IF v_usar > 0 THEN\n    INSERT INTO public.delivery_libro (pedido_id, titular_tipo, titular_id, cuenta, tipo, monto) VALUES (v_pedido, ''cliente'', v_uid, ''billetera'', ''pago_pedido'', -v_usar);\n  END IF;');
  IF position('v_usar := least' IN d) = 0 OR position('saldo_usado' IN d) = 0 OR position('pago_pedido' IN d) = 0 OR position('v_usar numeric' IN d) = 0 OR position('p_usar_saldo boolean' IN d) = 0 THEN RAISE EXCEPTION 'patch crear_pedido'; END IF;
  EXECUTE 'DROP FUNCTION public.delivery_crear_pedido(uuid,jsonb,text,uuid,text,numeric,text,text,text,numeric,numeric,text,timestamptz,numeric)';
  EXECUTE d;
  EXECUTE 'REVOKE ALL ON FUNCTION public.delivery_crear_pedido(uuid,jsonb,text,uuid,text,numeric,text,text,text,numeric,numeric,text,timestamptz,numeric,boolean) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.delivery_crear_pedido(uuid,jsonb,text,uuid,text,numeric,text,text,text,numeric,numeric,text,timestamptz,numeric,boolean) TO authenticated';
END $mig$;

-- La conciliación cuenta lo pagado con billetera como parte de lo cobrado
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.delivery_admin_contabilidad(date,date)'::regprocedure) INTO d;
  IF position('p.total + p.saldo_usado' IN d) = 0 THEN
    d := replace(d, 'SELECT p.id, (p.entregado_at AT TIME ZONE v_tz)::date AS dia, p.total, p.metodo_pago', 'SELECT p.id, (p.entregado_at AT TIME ZONE v_tz)::date AS dia, p.total + p.saldo_usado AS total, p.metodo_pago');
    IF position('p.total + p.saldo_usado' IN d) = 0 THEN RAISE EXCEPTION 'patch contabilidad'; END IF;
    EXECUTE d;
  END IF;
END $mig$;

-- Eliminar la cuenta con saldo en la billetera haría perder ese dinero: se pide usarlo o contactar a soporte.
DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname = 'delivery_eliminar_cuenta' AND p.pronamespace = 'public'::regnamespace;
  IF d IS NOT NULL AND position('billetera' IN d) = 0 THEN
    d := replace(d, E'BEGIN\n', E'BEGIN\n  IF public.delivery_saldo_cliente(auth.uid()) > 0 THEN RAISE EXCEPTION ''Tenés saldo en tu billetera. Usalo en tu próximo pedido o escribinos a soporte antes de eliminar la cuenta.''; END IF;\n');
    IF position('billetera' IN d) = 0 THEN RAISE EXCEPTION 'patch eliminar_cuenta'; END IF;
    EXECUTE d;
  END IF;
END $mig$;
