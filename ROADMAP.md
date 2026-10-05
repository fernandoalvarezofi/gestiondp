# WOREF — Hoja de ruta de transformación

> Complementa `ARCHITECTURE.md`. Principio rector: **una plataforma con un Core común y módulos especializados**, construida **de forma incremental, aditiva y compatible** con lo que ya funciona.
> Tamaños: **S** (≈ días), **M** (≈ 1–2 semanas), **L** (≈ varias semanas). Son órdenes de magnitud para priorizar, no compromisos.

## Reglas que valen para todas las fases

1. Nada destructivo: ni borrar tablas/columnas ni renombrar `delivery_*`. Se agrega, se rellena, se migra el uso y **recién después** se retira lo viejo (con aprobación).
2. Cada migración: aditiva, con prueba en transacción reversible, verificación posterior y registro en el repo **con el mismo nombre con el que se aplica**.
3. Cada fase termina con: tests, revisión de seguridad (RLS, `SECURITY DEFINER`, permisos), compatibilidad (la app actual sigue andando) y documentación actualizada.
4. **Antes de cada feature** se responde la lista anti feature-creep (módulo, reutilización del Core, multi-tenancy, seguridad, pagos, estados, mobile, marketplace, ¿hace falta ahora?). Si rompe la arquitectura, se propone la solución antes de programar.
5. Lógica crítica **solo en backend** (SQL/Edge). El front consume servicios.

---

## FASE 0 — Cierre de auditoría y saneamiento (prioridad absoluta)

**Objetivo:** que el punto de partida sea seguro y trazable.

| Ítem | Qué | Tamaño |
|---|---|---|
| 0.1 ✅ **HECHO 2026-10-05** — **Cerrar T1**: dejar de exponer `perfiles` a `anon` y limitar columnas (teléfono solo a uno mismo y a quien tenga una relación legítima: comercio del pedido, repartidor asignado, soporte). Exponer nombre/avatar mediante vista o función `perfil_publico`. | S |
| 0.2 ✅ **HECHO 2026-10-05** (comisión y frecuencia de liquidación; `propietario_id` se mantiene por depender de él las políticas) — **Cerrar T2**: ocultar `comision_pct`, `liquidacion_frecuencia`, `propietario_id`, `motivo_rechazo` y coordenadas exactas a `anon` (vista `tiendas_publicas` o permisos de columna). Probar que el front público sigue funcionando (storefront, búsqueda, tarjetas). | S |
| 0.3 ✅ **HECHO 2026-10-05** (la línea base de `base_perfiles_y_roles` se reconstruyó desde la base real) — Conciliar migraciones **repo ↔ base**: mover las 51 migraciones UUID heredadas a `supabase/legacy/` (documentadas como NO aplicadas), verificar las 3 migraciones sin equivalente por nombre, y fijar una convención: el nombre del archivo = nombre aplicado. | S |
| 0.4 ◐ **`search_path` hecho**; la protección de contraseñas filtradas es un ajuste del panel de Supabase (Authentication → Passwords) que debe activar el dueño — Activar protección de contraseñas filtradas y fijar `search_path` en `_ts_*`. | S |
| 0.5 ✅ **HECHO 2026-10-05** — suite `supabase/tests/001_exposicion.sql` (pasando) + lectura manual de las funciones privilegiadas y de las políticas de escritura: sin accesos cruzados (ver `ARCHITECTURE.md` T4, T10–T12); quedan 3 mejoras menores — Revisión **función por función** de las 212 `SECURITY DEFINER` y política por política de las 102 de RLS (cerrar la cobertura pendiente de la auditoría). Generar tests de RLS (suite con roles anon/usuario/comercio/repartidor/admin). | M |
| 0.6 ◐ **HECHO**: `types.ts` regenerado desde la base real (64 tablas, antes era de otra app), `README.md` reescrito y creada la capa `src/services/` (primer servicio: `profile.ts`). **Falta** reemplazar `db as any` por tipos módulo por módulo — Regenerar `types.ts` desde la base real; reemplazar `db as any` por tipos (módulo por módulo, sin big-bang). Reescribir `README.md`. | M |
| 0.7 ◐ El CI ya tenía tipos, ESLint, pruebas y compilación; se corrigió un error de lint heredado (`require` en Tailwind) y se agregaron **guardas de código** (`src/test/exposicion.test.ts`) que fallan si vuelve la exposición de datos. **Falta**: correr las pruebas SQL en el CI (necesita una base de pruebas, no producción) y un E2E mínimo con Playwright (login → pedido → estado) — CI: agregar `typecheck`, tests de RLS y un E2E mínimo con Playwright. | M |

**Riesgos:** 0.1/0.2 pueden romper pantallas públicas si algo dependía de esas columnas → se prueba con la suite E2E y con el usuario anon antes de aplicar.
**Salida:** ningún dato personal ni interno legible por anon; repo y base conciliados; tipos reales; CI con seguridad.

---

## FASE 1 — WOREF CORE

**Objetivo:** que Woref tenga una base **independiente de delivery**: negocio, tienda, cliente, dirección, roles y permisos.

**Diseño (aditivo):**
- `core_businesses(id, nombre, owner_user_id, estado, …)`.
- `core_business_members(business_id, user_id, rol, estado)` con roles `BUSINESS_OWNER, BUSINESS_ADMIN, MANAGER, OPERATOR, SELLER`.
- `delivery_comercios.business_id` (nullable) y `parent_store_id` para sucursales. **Relleno**: un negocio por cada `propietario_id` existente y las sucursales ya copiadas se agrupan por propietario.
- Roles de plataforma separados de los de negocio (`PLATFORM_ADMIN` fuera de `delivery_permiso`; ver fase 12/administración).
- `delivery_permiso(comercio, permiso)` pasa a leer primero `core_business_members` y cae al modelo viejo (`propietario_id`, `delivery_comercio_equipo`) hasta migrar todo.
- `delivery_mi_acceso()` devuelve **todos** los negocios/tiendas del usuario (hoy solo uno).
- Dirección y `GeoPoint` como tipo de dominio común (`latitude`, `longitude`, `address`).

**AVANCE 2026-10-05 — Paso 1 HECHO** (migración `20261029100000_core_negocios.sql`, probado con `supabase/tests/002_negocios.sql`): tablas `core_businesses` y `core_business_members` con RLS (solo lectura; escritura únicamente por funciones/disparadores), `delivery_comercios.business_id` y `parent_store_id`, relleno de lo existente (un negocio por dueño, vínculo `owner`), disparador que mete cada comercio nuevo en el negocio de su dueño, `delivery_crear_sucursal` enlaza la sucursal con su origen, función `delivery_mis_negocios()` y servicio `src/services/business.ts`. **No cambió ningún permiso**. **Paso 2 HECHO** (migración `20261030100000_core_permisos_negocio.sql`, probado con la matriz de `supabase/tests/003_permisos_negocio.sql`): `delivery_permiso`, `delivery_puede_ver_finanzas`, `delivery_mi_acceso` y `delivery_mis_comercios` reconocen también los roles del negocio (owner/admin: todo; manager: como el encargado; operator: pedidos; seller: pedidos y catálogo) con el modelo viejo intacto como respaldo; funciones para que SOLO el dueño invite (por email, sin revelar si hay cuenta), cambie roles y quite integrantes, con auditoría (`core_agregar_integrante`, `core_responder_invitacion`, `core_cambiar_rol`, `core_quitar_integrante`, `core_listar_integrantes`, `core_mis_invitaciones`); el invitado no tiene permisos hasta aceptar. Gestionar el equipo viejo, los datos legales/de cobro y las sucursales sigue siendo solo del dueño. **Paso 3 HECHO:** pantalla "Equipo de todo el negocio" en `/app/comercio/equipo` (`BusinessTeam.tsx`: el dueño invita por email, cambia roles y quita; el administrador lo ve) e invitaciones del negocio en el perfil (`TeamInvitations.tsx`); probado de punta a punta en el navegador con dos cuentas (invitar → aceptar → entrar al panel con el rol → subir de rol → quitar → pierde el acceso). **Paso 4 HECHO** (migración `20261031100000_core_resumen_negocios.sql`, pruebas `supabase/tests/004_resumen_negocios.sql`): el selector del panel agrupa las tiendas por negocio y la pantalla de sucursales muestra cada negocio con sus totales de 30 días (`delivery_resumen_negocios()`, solo dueño y administrador; el gerente ve las tiendas pero no las ventas); probado en el navegador con dos negocios (uno propio y otro como administrador). **Paso 5 RESUELTO (2026-10-05) — decisión de diseño: NO se retira el equipo por tienda.** `delivery_comercio_equipo` hoy tiene 0 filas, pero expresa algo que el modelo del negocio no puede: dar acceso a **una sola tienda** (por ejemplo, un encargado de una sucursal). Los roles del negocio valen en **todas** las tiendas; migrar el equipo por tienda al negocio **ampliaría** accesos de forma silenciosa. Quedan dos capas complementarias, ambas auditadas y con pruebas: (a) roles del negocio = todas las tiendas; (b) equipo por tienda = acceso acotado a un local. La pantalla del panel ya las muestra por separado y con el alcance explicado. **FASE 1 (Core) COMPLETA.** Si más adelante se quisiera unificar, habría que agregar alcance por tienda a `core_business_members`, no mover filas.

**Archivos afectados (previstos):** `useDeliveryRoles`, `MerchantLayout` y contexto de comercio, `MerchantBranches`, `MerchantTeam`, `StoreOnboarding`, nuevas `services/core/*`. **Migraciones:** 3–4, todas aditivas. **Riesgos:** permisos (el cambio de `delivery_permiso` es el punto más sensible) → pruebas de RLS por rol antes y después, despliegue con el modelo viejo como respaldo. **Salida:** un usuario puede pertenecer a varios negocios con roles distintos y todo lo existente sigue igual.
**Tamaño:** L.

---

## FASE 2 — COMMERCE

**Objetivo:** catálogo, inventario, carrito, checkout y órdenes **independientes de "delivery"**.
- Categorías jerárquicas (`categories`) y atributos; `delivery_productos.categoria` (texto libre) se mantiene como sección del comercio.
- Inventario con movimientos (`stock_movements`): hoy el stock se modifica directo en pedidos/cancelaciones; pasar a registrar movimientos (auditable) manteniendo `stock`.
- Checkout: separar **Order** (qué se compra) de **Fulfillment** (cómo llega: retiro, delivery, envío) y de **Payment**. Hoy `delivery_pedidos` tiene 52 columnas con todo mezclado → se introducen entidades hijas **sin** quitar columnas (vistas/compatibilidad).
- Devoluciones (`returns`) y reembolsos conectados a Payments.
**Tamaño:** L. **Riesgo:** `delivery_crear_pedido` es el corazón del sistema → se toca solo con tests de integración que cubran stock, cupón, saldo, variantes, retiro y programados.

## FASE 3 — WOREF STORE

**Objetivo:** el constructor se vuelve un sistema de **sitio completo**.
- Páginas por tienda (`store_pages`): Inicio, Colección (`/t/:slug/c/:categoria`), Ofertas, Buscar, Nosotros, Contacto, Políticas.
- Navegación de la tienda (menú, categorías desplegables) y cabecera/pie configurables.
- **Plantillas realmente distintas**: layout + tipografías reales + contenido de ejemplo completo por plantilla; ampliar el catálogo de plantillas.
- SEO por tienda (títulos, descripciones, Open Graph por página, sitemap con colecciones) y **dominios propios**.
- Productos organizados por sección desde el propio editor.
- Validación única: pasar de doble implementación (TS + SQL) a un esquema compartido y versionado.
**Tamaño:** L. *(**Avance 2026-10-05:** bloques de marketing, carrito lateral, pie y WhatsApp; **páginas internas** por tienda (`/t/:slug/c/:categoria`, `/ofertas`, `/buscar`) con menú de categorías, menú móvil, ruta de navegación y buscador con sugerencias; pestaña **Productos** (carga por sección) dentro del editor; **7 plantillas** (Boutique, Atelier, Galería, Urbano, Impacto, Mercado, Gourmet) con página completa de ejemplo, tipografías reales (Playfair, Fraunces, Space Grotesk, Nunito, Bebas Neue, Space Mono, Lora) y bloque nuevo "cinta de anuncios". **Falta de la Fase 3:** dominios propios, SEO por página (sitemap con colecciones), tarjetas de producto con segunda foto y compra rápida, editor visual de páginas adicionales.)*

## FASE 4 — WOREF MARKET

**Objetivo:** marketplace multi-vendedor sobre el **mismo catálogo**.
- `listings` (publicaciones) con canales por producto: Market, Store o ambos.
- `SearchService` (primero Postgres con `pg_trgm`/FTS; interfaz que permita cambiar de motor): texto, categoría, vendedor, precio, ubicación, disponibilidad, reputación, atributos.
- Favoritos persistentes, preguntas/respuestas (ya existen), reputación del vendedor (ya existe) y **opiniones por producto** vinculadas a compra.
- Carrito y checkout multi-vendedor (una orden por vendedor), **comisiones de marketplace** registradas en el libro, protección al comprador y reclamos.
**Tamaño:** L. **Riesgo:** dinero y confianza → depende de la fase 5 para registrar comisiones correctamente.

## FASE 5 — PAYMENTS

**Objetivo:** un `PaymentService` central.
- `payments(id, referencia_tipo, referencia_id, proveedor, estado, monto, moneda, external_id, …)` y `PaymentProvider` (Mercado Pago primero; Stripe solo como interfaz, no implementado).
- Estados validados en backend (`PaymentStatus`), webhook con verificación de firma `x-signature` e idempotencia por `external_id`.
- **Wallet**: sobre `delivery_libro` (ya inmutable): `wallet`, `wallet_transactions`, balances derivados. Regla: **ningún saldo se modifica sin asiento**.
- Comisiones, liquidaciones y payouts existentes se reapuntan al servicio; reembolsos y contracargos como flujo propio.
**Tamaño:** L. **Riesgo:** alto (dinero) → el esquema actual de liquidaciones se mantiene en paralelo hasta conciliar.

**Estado (2026-10-05):**
- ✅ Paso 1 — `pagos` + `pagos_eventos` (historial inmutable), `pago_aplicar_notificacion` (máquina de estados, monto, idempotencia, orden de avisos), `mp-webhook` v2 con firma `x-signature`, pantalla de cobros y clave del webhook en Administración → Pagos. Pruebas: `supabase/tests/005_pagos.sql`, `src/test/mpFirma.test.ts`. No toca libro ni liquidaciones.
- ⏳ Paso 2 — asientos del libro para cobros/reintegros (revisar antes `delivery_libro_pedido`: hoy es devengado al entregar). Paso 3 — flujo de reintegros y contracargos desde la app. Paso 4 — interfaz `PaymentProvider` y wallet.

## FASE 6 — LOGISTICS

- `shipments`, `packages`, `pickups`, `providers` de logística.
- Tracking común: `trackable_entities` → `location_events` → `current_location` → ETA (reutilizando `delivery_ubicaciones`).
- `delivery_envios` (mensajería entre personas) pasa a ser un caso de `shipment` sin perder funcionalidad.
**Tamaño:** M–L.

## FASE 7 — NETWORK + DISPATCH

- `providers` con tipos COURIER/DRIVER/MESSENGER/TRANSPORTER/LOGISTICS_PROVIDER; perfil, vehículo, documentos, zonas, disponibilidad, reputación, ganancias, historial. Reutiliza `delivery_repartidores` (no se renombra).
- **`jobs`** (DELIVERY, RIDE, SHIPPING, PICKUP, SERVICE, OTHER) creados por evento desde pedidos, envíos y viajes.
- **Dispatch Engine** en backend: candidatos → filtros (disponibilidad, zona, capacidad) → distancia/ETA/costo → score → oferta → aceptación/rechazo → asignación. Reglas configurables; **sin lógica en React**. Se extrae lo que hoy está repartido en `delivery_despacho_avanzado` y las funciones de ofertas.
**Tamaño:** L.

## FASE 8 — MOBILITY

- `rides` con estados `REQUESTED → SEARCHING → DRIVER_ASSIGNED → DRIVER_ARRIVING → PASSENGER_ONBOARD → IN_PROGRESS → COMPLETED/CANCELLED`, validados en backend.
- Vehículos y categorías, viaje inmediato y programado, tarifas por zona. **Sin tarifa dinámica** hasta que el flujo base esté sólido.
- `delivery_viajes` se mantiene y se mapea a `rides`/`jobs`.
**Tamaño:** M–L.

## FASE 9 — SERVICES

- `services`, `professionals`, `availability`, `appointments`, `reservations`, órdenes de servicio.
- Reutiliza Core (Business/Store), Payments y Communication; no reutiliza tablas de pedidos.
**Tamaño:** L.

## FASE 10 — COMMUNICATION

- `notifications` (in-app) + canales push/email; WhatsApp como canal futuro desacoplado del dominio.
- Eventos: `ORDER_CREATED`, `PAYMENT_APPROVED`, `SHIPMENT_CREATED`, `DRIVER_ASSIGNED`, `DELIVERY_STARTED/COMPLETED`, `RIDE_REQUESTED/ACCEPTED`, `MESSAGE_RECEIVED`.
- `conversations` (usuario ↔ vendedor) **separado** de la mensajería logística (persona → paquete → persona).
**Tamaño:** M.

## FASE 11 — ANALYTICS

- Métricas por dominio (ventas, clientes, marketplace, logística, conductores, tiendas); continúa el canal firmado hacia la base del dueño con **solo agregados**.
- Tableros de negocio por tienda y de plataforma.
**Tamaño:** M.

## FASE 12 — AUTOMATIZACIÓN + IA

- Automatizaciones (reglas sobre eventos), CRM/segmentación, lealtad.
- Capa de IA separada con **herramientas controladas** (RPC/Edge con permisos): Business, Marketing, Customer, Operations y Analytics agents. Nunca acceso directo ni ilimitado a la base.
**Tamaño:** L (incremental).

---

## Plataforma transversal (en paralelo)

| Tema | Acción |
|---|---|
| **Administración separada** | Completar la fase 2 de la base del dueño: órdenes firmadas desde la consola (aprobar/pausar comercios, comisión), 2FA, y retirar el rol `admin` de la base de usuarios **solo con la cuenta de consola activa**. Diseño ya definido (función `delivery_consola_comando` con HMAC + nonce). |
| Observabilidad | Logs y auditoría de pagos, permisos, cambios de estado, asignaciones, cancelaciones, reembolsos y movimientos financieros (parte ya existe vía auditoría). |
| Mobile | Mantener Capacitor; todo el negocio vía servicios/RPC (nada solo-navegador); reconstruir el APK con la marca nueva cuando se retome. |
| PWA | Mantener; no cachear respuestas de API (hoy correcto). |
| Rendimiento | Revisar planes e índices cuando haya volumen; hoy los datos son chicos. |

---

## Orden recomendado (secuencia de menor a mayor riesgo)

1. **Fase 0** completa (seguridad y trazabilidad). *Primero 0.1 y 0.2.*
2. En paralelo, **Fase 3 (Store)** puede seguir porque es aditiva y está aislada.
3. **Fase 1 (Core)** → habilita todo lo demás.
4. **Fase 5 (Payments)** antes de Market y de comisiones.
5. **Fase 2 (Commerce)** y **Fase 4 (Market)**.
6. **Fases 6–8** (Logistics, Network+Dispatch, Mobility) usando Job.
7. **Fases 9–12**.

## Aplicación de la regla anti feature-creep al trabajo en curso

El trabajo en curso ("tienda como sitio web completo": páginas de colección, ofertas, búsqueda, plantillas) → **módulo STORE**; reutiliza Core (tienda, productos); no requiere entidades nuevas de dominio; no toca pagos ni estados de pedido; es compatible con mobile y con el marketplace futuro (las colecciones y la búsqueda se diseñan sobre el mismo catálogo). **Se puede continuar** dentro de la Fase 3 sin esperar al resto.

## Decisiones que necesita del dueño

1. **P0:** autorizar el cierre de T1/T2 (exposición de teléfonos y datos internos). Es un cambio chico y reversible, pero modifica permisos de producción.
2. ¿Un negocio puede tener tiendas con **dominios y catálogos distintos**, o comparten catálogo por defecto? (define el modelo de `Business → Store → Catalog`).
3. Comisión de marketplace: ¿porcentaje único o por categoría/vendedor? ¿Quién paga el costo del medio de pago?
4. Alcance geográfico inicial del Market (ciudad única o nacional): afecta envíos y búsqueda por ubicación.
5. Confirmar qué hacer con las migraciones heredadas (51 archivos del proyecto original): archivarlas en `supabase/legacy/` (recomendado).
