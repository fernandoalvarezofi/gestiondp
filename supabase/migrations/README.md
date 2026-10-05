# Migraciones de Woref

Solo contiene migraciones **de la base de Woref** (`woref-delivery`). Reglas:

1. **Aditivas e incrementales.** Nada destructivo (borrar tablas/columnas, renombrar `delivery_*`) sin aprobación explícita y copia previa.
2. **Mismo nombre que la migración aplicada.** El nombre del archivo (sin el prefijo de fecha) debe coincidir con el nombre con el que se aplicó en Supabase, para poder conciliar repo ↔ base.
3. **Probar antes**: en transacción reversible; verificar después (permisos, RLS, datos).
4. Cuando una migración cambia permisos de columna (`GRANT SELECT (...)`), toda columna nueva y pública de esa tabla necesita su propio `GRANT` — ver `delivery_comercios` y `perfiles`.
5. Las migraciones heredadas de otro proyecto viven en `supabase/legacy/` y **no se aplican**.

## Correspondencia con lo aplicado (conciliación del 2026-10-05)

- `20261001210911_delivery_base.sql` — es la base de delivery (tipos `delivery_categoria`/`delivery_estado_pedido` y las primeras tablas). Era un archivo con nombre UUID del proyecto original; se aplicó como `delivery_base` y se renombró para que coincida.
- `20261001210805_base_perfiles_y_roles.sql` — **reconstruida** el 2026-10-05 desde la definición real (tablas `perfiles` y `user_roles`, tipo `app_role`, `has_role`, `update_updated_at_column`, alta automática de usuarios). La original, aplicada como `base_perfiles_y_roles`, no se conservó como archivo; la reconstrucción es idempotente y no cambia la base actual.
- `delivery_billetera_cliente`, `delivery_comision_12` y `delivery_libro_contable` están **aplicadas** (los objetos que crean existen en la base) aunque en el historial de Supabase figuran bajo otros nombres.
- Las migraciones `fase0_*`, `delivery_variantes*`, `admin_metricas`, `tienda_marketing` y `tienda_bloques_nuevos` se aplicaron con la herramienta de Supabase; los archivos del repo contienen el mismo SQL.
