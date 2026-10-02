-- KDS virtual: pantalla de cocina que ordena los pedidos por el momento óptimo para empezar a prepararlos.

-- El comercio marca "listo" un pedido con envío sin cambiar de estado (el repartidor lo retira desde el local).
CREATE OR REPLACE FUNCTION public.delivery_marcar_listo(p_pedido uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.delivery_pedidos;
BEGIN
  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND OR NOT (coalesce(public.delivery_permiso(p.comercio_id, 'pedidos'), false) OR coalesce(public.has_role(auth.uid(), 'admin'::app_role), false)) THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF p.tipo_entrega <> 'delivery' THEN RAISE EXCEPTION 'Los pedidos para retirar se marcan listos desde el tablero'; END IF;
  IF p.estado <> 'preparando' THEN RAISE EXCEPTION 'Primero hay que empezar a prepararlo'; END IF;
  IF p.listo_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.delivery_pedidos SET listo_at = now() WHERE id = p_pedido;
  INSERT INTO public.delivery_pedido_eventos (pedido_id, evento, actor_id, actor_rol)
    VALUES (p_pedido, 'listo', auth.uid(), public.delivery_actor_rol(p.comercio_id, p.cliente_id, p.repartidor_id));
END $$;
REVOKE ALL ON FUNCTION public.delivery_marcar_listo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_marcar_listo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_kds(p_comercio uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.delivery_comercios; v_hist numeric; v_factor numeric := public.delivery_ajuste('factor_ruta', 1.35); v_result jsonb;
BEGIN
  IF NOT (coalesce(public.delivery_permiso(p_comercio, 'pedidos'), false) OR coalesce(public.has_role(auth.uid(), 'admin'::app_role), false)) THEN
    RAISE EXCEPTION 'No tenés permiso sobre este comercio';
  END IF;
  SELECT * INTO s FROM public.delivery_comercios WHERE id = p_comercio;
  v_hist := public.delivery_prep_real_min(p_comercio);
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.iniciar_at), '[]'::jsonb) INTO v_result FROM (
    SELECT p.id, p.estado, p.tipo_entrega, p.created_at, p.confirmado_at, p.preparando_at, p.listo_at, p.programado_para, p.notas,
      p.llegada_comercio_at, p.repartidor_id, (SELECT split_part(pf.nombre, ' ', 1) FROM public.perfiles pf WHERE pf.id = p.repartidor_id) AS repartidor,
      x.prep_min,
      CASE
        WHEN p.estado <> 'confirmado' THEN coalesce(p.preparando_at, p.confirmado_at)
        WHEN p.programado_para IS NOT NULL THEN p.programado_para - make_interval(mins => (x.prep_min + x.transito + CASE WHEN p.tipo_entrega = 'delivery' THEN 3 ELSE 0 END)::int)
        WHEN p.repartidor_id IS NOT NULL AND p.tipo_entrega = 'delivery' THEN
          CASE WHEN p.llegada_comercio_at IS NOT NULL THEN now() - make_interval(mins => x.prep_min::int)
            ELSE now() + make_interval(mins => x.pickup::int) - make_interval(mins => x.prep_min::int) END
        ELSE coalesce(p.confirmado_at, p.created_at)
      END AS iniciar_at,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'notas', i.notas, 'opciones', i.opciones) ORDER BY i.nombre), '[]'::jsonb)
        FROM public.delivery_pedido_items i WHERE i.pedido_id = p.id) AS items
    FROM public.delivery_pedidos p
    CROSS JOIN LATERAL (
      SELECT (CASE WHEN v_hist IS NULL THEN coalesce(p.preparacion_min, s.tiempo_preparacion_min, 20) ELSE round((coalesce(p.preparacion_min, s.tiempo_preparacion_min, 20) + v_hist) / 2) END + coalesce(p.demora_extra_min, 0))::numeric AS prep_min,
        CASE WHEN p.tipo_entrega = 'delivery' THEN coalesce(p.distancia_km, 2) / public.delivery_velocidad_repartidor(p.repartidor_id) * 60 ELSE 0 END AS transito,
        coalesce((SELECT public.delivery_distancia_km(u.latitud, u.longitud, s.latitud, s.longitud) * v_factor / public.delivery_velocidad_repartidor(p.repartidor_id) * 60
          FROM public.delivery_ubicaciones u WHERE u.repartidor_id = p.repartidor_id AND u.updated_at > now() - interval '3 minutes' AND s.latitud IS NOT NULL
            AND public.delivery_distancia_km(u.latitud, u.longitud, s.latitud, s.longitud) < 80), 4) AS pickup
    ) x
    WHERE p.comercio_id = p_comercio AND p.estado IN ('confirmado', 'preparando', 'listo')
      AND p.pago_estado NOT IN ('pendiente', 'rechazado')
  ) t;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.delivery_kds(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_kds(uuid) TO authenticated;
