-- El canal con el repartidor solo existe cuando el pedido tiene un repartidor asignado.
CREATE OR REPLACE FUNCTION public.delivery_enviar_mensaje(p_pedido uuid, p_canal text, p_texto text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rol text;
  p public.delivery_pedidos;
  v_texto text := trim(regexp_replace(coalesce(p_texto, ''), '[[:cntrl:]]', ' ', 'g'));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión'; END IF;
  IF p_canal NOT IN ('comercio', 'repartidor') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
  v_rol := public.delivery_rol_en_chat(p_pedido, p_canal);
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No participás de esta conversación'; END IF;
  IF char_length(v_texto) < 1 THEN RAISE EXCEPTION 'Escribí un mensaje'; END IF;
  IF char_length(v_texto) > 500 THEN RAISE EXCEPTION 'El mensaje es demasiado largo (máximo 500 caracteres)'; END IF;

  SELECT * INTO p FROM public.delivery_pedidos WHERE id = p_pedido;
  IF p_canal = 'repartidor' AND p.repartidor_id IS NULL THEN RAISE EXCEPTION 'Todavía no hay un repartidor asignado a este pedido'; END IF;
  IF p.pago_estado IN ('pendiente', 'rechazado') AND p.estado = 'pendiente' THEN
    RAISE EXCEPTION 'El pedido todavía no fue confirmado';
  END IF;
  IF p.estado IN ('entregado', 'cancelado') AND coalesce(p.entregado_at, p.cancelado_at, p.updated_at) < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'La conversación de este pedido ya está cerrada. Si necesitás ayuda, hacé un reclamo.';
  END IF;

  IF (SELECT count(*) FROM public.delivery_mensajes WHERE autor_id = v_uid AND created_at > now() - interval '1 minute') >= 15 THEN
    RAISE EXCEPTION 'Estás enviando mensajes muy rápido. Esperá un momento.';
  END IF;

  INSERT INTO public.delivery_mensajes (pedido_id, canal, autor_id, texto) VALUES (p_pedido, p_canal, v_uid, v_texto) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.delivery_enviar_mensaje(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_enviar_mensaje(uuid, text, text) TO authenticated;
