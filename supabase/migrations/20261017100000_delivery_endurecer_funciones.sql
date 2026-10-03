-- Las funciones de disparadores no se llaman desde la API: se les quita el permiso de ejecución a visitantes y cuentas.
REVOKE EXECUTE ON FUNCTION public.delivery_antifraude_pedido(), public.delivery_billetera_cancelacion_trg(), public.delivery_billetera_reintegro_trg(), public.delivery_club_sumar(), public.delivery_conexiones_trg(),
  public.delivery_libro_liquidacion_trg(), public.delivery_libro_movimiento_trg(), public.delivery_libro_trg(), public.delivery_libro_viaje_trg(), public.delivery_metas_trg(), public.delivery_notificar_ajuste(),
  public.delivery_notificar_envio(), public.delivery_notificar_soporte(), public.delivery_notificar_viaje(), public.delivery_pedido_eta_trg(), public.delivery_pedido_log(), public.delivery_reclamo_inicial(), public.delivery_reclamo_preparar()
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.delivery_turno_inicio(public.delivery_turnos) SET search_path = public;
ALTER FUNCTION public.delivery_turno_fin(public.delivery_turnos) SET search_path = public;
