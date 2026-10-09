-- Rendimiento (avisos del linter de Supabase). No cambia datos ni permisos.

-- 1) Índices duplicados en pedidos: misma definición dos veces; cada escritura los mantenía a ambos.
drop index if exists public.delivery_pedidos_cliente_fecha_idx;   -- igual a delivery_pedidos_cliente_idx (cliente_id, created_at desc)
drop index if exists public.delivery_pedidos_comercio_fecha_idx;  -- igual a delivery_pedidos_comercio_idx (comercio_id, created_at desc)

-- 2) Políticas que evaluaban auth.uid() por cada fila: se envuelve en (select ...) para que se calcule una sola vez. Mismo criterio.
alter policy "admin lee arrepentimientos" on public.delivery_arrepentimientos using (public.has_role((select auth.uid()), 'admin'::app_role));
alter policy "Categorías activas visibles para todos" on public.categorias using (activa or public.has_role((select auth.uid()), 'admin'::app_role));
alter policy "Favoritos propios" on public.delivery_favoritos_producto using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));
alter policy "Mis notificaciones" on public.notificaciones using (usuario_id = (select auth.uid()));

-- 3) Claves foráneas que se usan en consultas o en borrados en cascada (las de auditoría "*_por" no hacen falta).
create index if not exists turnos_servicio_idx on public.turnos (servicio_id);
create index if not exists turnos_espera_comercio_idx on public.turnos_espera (comercio_id);
create index if not exists turnos_espera_cliente_idx on public.turnos_espera (cliente_id);
create index if not exists turnos_espera_profesional_idx on public.turnos_espera (profesional_id);
create index if not exists turno_eventos_comercio_idx on public.turno_eventos (comercio_id);
create index if not exists profesional_servicios_servicio_idx on public.profesional_servicios (servicio_id);
create index if not exists profesionales_usuario_idx on public.profesionales (usuario_id) where usuario_id is not null;
create index if not exists servicios_recurso_idx on public.servicios (recurso_id) where recurso_id is not null;
create index if not exists servicios_categoria_idx on public.servicios (categoria_id) where categoria_id is not null;
create index if not exists delivery_producto_cambios_producto_idx on public.delivery_producto_cambios (producto_id);
create index if not exists delivery_pedido_items_variante_idx on public.delivery_pedido_items (variante_id) where variante_id is not null;
create index if not exists delivery_favoritos_producto_producto_idx on public.delivery_favoritos_producto (producto_id);
create index if not exists delivery_metas_logradas_repartidor_idx on public.delivery_metas_logradas (repartidor_id);
create index if not exists comercio_cliente_notas_cliente_idx on public.comercio_cliente_notas (cliente_id);
create index if not exists delivery_directorio_comercio_idx on public.delivery_directorio (comercio_id) where comercio_id is not null;
create index if not exists msg_hilos_producto_idx on public.msg_hilos (producto_id) where producto_id is not null;
create index if not exists msg_reportes_hilo_idx on public.msg_reportes (hilo_id);
create index if not exists msg_lecturas_usuario_idx on public.msg_lecturas (usuario_id);
create index if not exists msg_bloqueos_cliente_idx on public.msg_bloqueos (cliente_id);
create index if not exists conversaciones_producto_idx on public.conversaciones (producto_id) where producto_id is not null;
