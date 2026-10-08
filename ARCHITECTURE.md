# WOREF — Arquitectura (actual y objetivo)

> Auditoría del 2026-10-05. Solo lectura: no se modificó código ni base de datos para producirla.
> Todo lo marcado **[verificado]** se comprobó contra el código o la base real; lo marcado **[no verificado]** quedó fuera del alcance de esta pasada y está listado en la sección "Cobertura de la auditoría".

---

## 0. Resumen ejecutivo

Woref hoy es una **plataforma de delivery multi-comercio** (pedidos, repartidores, liquidaciones) que ya incorporó, de forma orgánica, piezas de otras verticales: constructor de tiendas online, ficha de producto con preguntas y reputación (marketplace "por tienda"), mensajería entre personas, remises, directorio de comercios, club de puntos, un panel de administración y una **consola del dueño en una base separada**.

Lo valioso: una base de datos con **lógica crítica en el servidor** (pedidos, stock, cupones, liquidaciones, libro contable inmutable, máquina de estados de pedido), RLS en el 100 % de las tablas, y un front que mayormente solo llama a esas funciones.

Lo que impide que Woref sea "una plataforma" y no "una app de delivery con extras":

1. **No existe la entidad Business/Organization.** `delivery_comercios` es a la vez negocio, tienda y sucursal. Un usuario "con varios negocios" no está modelado.
2. **Tres tuberías operativas paralelas** (pedido→repartidor, envío→repartidor, viaje→conductor) con columnas, estados y pantallas duplicadas. No hay entidad `Job` común.
3. **Pagos acoplados al pedido** (`pago_estado`, `pago_id` dentro de `delivery_pedidos`); no hay tabla de pagos ni abstracción de proveedor.
4. **El "marketplace" es por tienda**, no multi-vendedor: no hay búsqueda ni catálogo global de publicaciones, y las categorías son 4 valores fijos.
5. **Capa de datos sin tipos** (`db = supabase as any`): `types.ts` generado pertenece a **otra app** (red social/comunidades) y no refleja esta base.
6. **El rol admin vive en la misma base que los usuarios** (migración a base separada solo hecha para auditoría/errores/métricas).
7. **Hallazgo de seguridad P0:** cualquier visitante sin sesión puede leer `perfiles` completo, **incluidos los teléfonos** (ver §T).

Nada de esto requiere reconstruir. Requiere **agregar un Core por encima**, mover de a poco, y respetar los nombres `delivery_*` mientras tanto.

---

## A. Arquitectura actual

```
Navegador / PWA / Android (Capacitor)
   │  React 18 + Vite + TS + Tailwind + shadcn/Radix
   │  React Router · React Query (poco) · Leaflet
   ▼
Vercel
   ├─ SPA estática (rewrites a /index.html)
   ├─ api/tienda.js  → HTML con Open Graph para bots (/t/:slug, /t/:slug/p/:id)
   └─ build: scripts/generate-sitemap.mjs (sitemap con comercios aprobados)
   ▼
Supabase "woref-delivery" (trramubtuzmwtnybudoj)
   ├─ Postgres: 64 tablas · 251 funciones (212 SECURITY DEFINER) · 56 triggers
   │            102 políticas RLS · 159 índices · 3 enums · 0 vistas · 10 cron jobs
   ├─ Auth (email/contraseña + Google vía @lovable.dev/cloud-auth-js) · MFA (TOTP) para admin
   ├─ Storage: buckets delivery (público), entregas (privado), verificaciones (privado)
   ├─ Edge Functions (7 desplegadas): enviar-push, push-soporte, push-viaje, push-campana,
   │            mp-crear-preferencia, mp-webhook, ruta        (og-preview está en el repo, no desplegada)
   ├─ pg_net + pg_cron: notificaciones push, cancelación de impagos, vencimiento de pedidos,
   │            liquidación automática, controles de selfie, envío de auditoría/métricas
   ▼
Supabase "woref-admin" (bfttmxxtojpbqaafwutb)  ← base SEPARADA del dueño
   ├─ auditoria_eventos (hash encadenado, solo-agregar) · errores_app · metricas_diarias
   ├─ admins (con 2FA obligatorio) · config (secretos)
   └─ Edge Function ingest (firma HMAC-SHA256, ventana de 5 min)
Mercado Pago ← mp-crear-preferencia / mp-webhook
```

Volumen real hoy (todo es chico): 2 usuarios en auth, 19 comercios (la mayoría demo), 64 productos, 2 pedidos, 1 repartidor, 69 filas de directorio.

## B. Mapa de carpetas

```
/                     package.json, vite/tailwind/ts/vitest config, vercel.json, capacitor.config.ts
android/              proyecto Capacitor (app "Woref Repartidor", appId app.woref.repartidor)
api/tienda.js         función serverless: Open Graph de tiendas y productos
public/               manifest/íconos, push-sw.js, sitemap.xml, robots.txt, llms.txt
scripts/              generate-sitemap.mjs
supabase/
  config.toml
  migrations/         101 archivos (¡mezcla dos proyectos! ver §S)
  functions/          8 funciones Edge
  admin-db/           001..003 .sql + functions/ingest (base de administración)
src/
  App.tsx             todas las rutas (lazy)
  main.tsx            arranque, PWA, monitoreo
  pages/              Landing, Auth, Console, Storefront*, Legal… + pages/delivery/** (cliente, comercio, repartidor, admin)
  components/         169 archivos: ui/ (shadcn), delivery/, merchant/, courier/, admin/, storefront/, account/, maps/, …
  contexts/           AuthContext, CartContext, FavoritesContext
  hooks/              13 (roles, tarifas, ETA, push, ubicación del repartidor…)
  lib/                56 archivos: dominio (delivery.ts, storefront.ts, marketplace.ts, wallet.ts, geo.ts…) + 25 con tests
  integrations/       supabase/client.ts, types.ts (obsoleto), lovable/
```

## C. Mapa del frontend

> **Actualizado (2026-10-08):** la navegación ahora está separada por contextos (Cliente, Comercio, Repartidor, Conductor, Administración), con guardas por ruta y menús centralizados. Ver [docs/NAVEGACION.md](docs/NAVEGACION.md).

| Zona | Ruta base | Qué es |
|---|---|---|
| Público | `/`, `/auth`, `/terminos`, `/privacidad`, `/arrepentimiento` | Landing, acceso, legales |
| Tienda online pública | `/t/:slug`, `/t/:slug/p/:id` | Constructor de bloques + ficha de producto + preguntas |
| Cliente (app) | `/app`, `/buscar`, `/categoria/:id`, `/tienda/:slug`, `/carrito`, `/pedidos`, `/favoritos`, `/promociones`, `/club`, `/directorio`, `/servicios`, `/perfil/*`, `/ayuda` | Inicio estilo PedidosYa |
| Mensajería | `/app/enviar`, `/app/envios/:id` | Envío de paquetes entre personas |
| Movilidad | `/app/remis`, `/app/remis/:id` | Viajes con conductor |
| Comercio | `/app/comercio/*` | Pedidos, menú, tienda online, preguntas, promos, campañas, sucursales, opiniones, estadísticas, finanzas, equipo, configuración |
| Repartidor | `/app/repartidor/*` | Ofertas, ganancias, incentivos, historial |
| Administración | `/app/admin/*` | Operación, comercios, repartidores, liquidaciones, contabilidad, soporte… |
| Consola del dueño | `/consola` | Base separada: auditoría, errores, negocio (login y 2FA propios) |

Observaciones **[verificado]**: 113 archivos llaman a `db.from()/db.rpc()` directamente (95 en pages/components): 162 `from` + 161 `rpc`. No hay capa `services/`; la UI conoce nombres de tablas. Hay **un solo archivo de dominio grande** (`lib/delivery.ts`, 475 líneas) y componentes grandes (StorefrontView 662, Cart 517, MerchantOrders 447).

## D. Mapa del backend

- **No hay servidor propio.** El backend es Postgres (RPC `SECURITY DEFINER`) + 7 Edge Functions + 1 función serverless de Vercel.
- La lógica de negocio crítica está **en SQL** (bien): `delivery_crear_pedido`, `delivery_actualizar_estado` (con `delivery_pedido_fsm`), cupones, stock, liquidaciones, libro, despacho, tarifas por zona.
- Edge Functions:
  - `mp-crear-preferencia` (JWT): crea la preferencia de Mercado Pago validando que el pedido sea del usuario.
  - `mp-webhook` (sin JWT): **no confía en el cuerpo**; consulta el pago a la API de MP y valida el monto.
  - `enviar-push`, `push-soporte`, `push-viaje`, `push-campana` (sin JWT): autenticadas con secreto compartido `x-woref-secret` desde triggers `pg_net`.
  - `ruta` (JWT): cálculo de rutas.
- Vercel `api/tienda.js`: solo lectura pública con clave publicable.

## E. Mapa de Supabase

- 99 migraciones aplicadas (por nombre; ver §S para la divergencia con el repo).
- 10 cron jobs: cancelar impagos (5 min), vencer pedidos sin respuesta y ajustes (1 min), limpiar errores, cerrar soporte inactivo, liquidar automático (09:00), controles de selfie (10:00), enviar auditoría (1 min), purgar auditoría enviada, enviar métricas (hora).
- Buckets: `delivery` (público, 5 MB, imágenes), `entregas` (privado, 3 MB), `verificaciones` (privado, 6 MB, incluye PDF) con políticas por carpeta del usuario y por pedido.

## F. Mapa de tablas (64) agrupadas por dominio

| Dominio objetivo | Tablas actuales |
|---|---|
| **Core / identidad** | `perfiles`, `user_roles`, `delivery_direcciones`, `delivery_identidad`, `delivery_documentos`, `delivery_preferencias`, `delivery_clientes_control`, `delivery_push_suscripciones` |
| **Business / Store** | `delivery_comercios` (39 columnas; incluye `tienda_tema` jsonb), `delivery_comercio_legal`, `delivery_comercio_equipo`, `delivery_zonas`, `delivery_secciones`, `delivery_tienda_visitas`, `delivery_tienda_suscriptores` |
| **Commerce** | `delivery_productos`, `delivery_producto_grupos`, `delivery_producto_opciones`, `delivery_producto_variantes`, `delivery_pedidos` (52 columnas), `delivery_pedido_items`, `delivery_pedido_eventos`, `delivery_pedido_ajustes`, `delivery_pedido_codigos`, `delivery_cupones`, `delivery_favoritos`, `delivery_arrepentimientos` |
| **Market (parcial)** | `delivery_producto_preguntas`, `delivery_resenas`, `delivery_directorio`, `delivery_directorio_interes` |
| **Logística / mensajería** | `delivery_envios`, `delivery_envio_codigos`, `delivery_rutas`, `delivery_ubicaciones` |
| **Movilidad** | `delivery_viajes`, `delivery_viaje_codigos` |
| **Network** | `delivery_repartidores` (también conductores), `delivery_metas`, `delivery_metas_logradas`, `delivery_turnos`, `delivery_turnos_reservas`, `delivery_conexiones`, `delivery_ofertas_rechazos` |
| **Pagos / dinero** | `delivery_libro` (inmutable), `delivery_liquidaciones`, `delivery_liquidacion_items`, `delivery_movimientos_repartidor`, `delivery_datos_cobro`, `app_config` (token de MP) |
| **Comunicación** | `delivery_mensajes`, `delivery_reclamos`, `delivery_reclamo_mensajes`, `delivery_soporte_respuestas` |
| **Marketing** | `delivery_campanas`, `delivery_campana_envios`, `delivery_club_premios`, `delivery_puntos`, `delivery_referidos`, `delivery_referido_codigos` |
| **Plataforma** | `delivery_ajustes` (parámetros públicos), `delivery_auditoria`, `delivery_errores`, `delivery_zona_interes` |

## G. Relaciones (clave)

```
auth.users ─1:1─ perfiles ─┬─< delivery_comercios (propietario_id)
                           ├─< delivery_pedidos (cliente_id, repartidor_id)
                           ├─< delivery_envios / delivery_viajes
                           └─1:1 delivery_repartidores
delivery_comercios ─┬─< delivery_productos ─┬─< producto_grupos ─< producto_opciones
                    │                       ├─< producto_variantes
                    │                       └─< producto_preguntas
                    ├─< delivery_pedidos ─┬─< pedido_items (→ productos, variantes)
                    │                     ├─< pedido_eventos / ajustes / codigos
                    │                     └─> delivery_liquidaciones ─< liquidacion_items
                    ├─< secciones · cupones · campañas · resenas · equipo · legal · suscriptores
delivery_libro (titular_tipo + titular_id + cuenta + tipo + monto)   ← sin FK a un único dueño
```

**Actualización 2026-10-05 (Fase 1, paso 1):** ya existen `core_businesses` y `core_business_members` (un negocio por dueño, con su vínculo `owner`), `delivery_comercios.business_id` y `parent_store_id` (la sucursal queda enlazada a su origen). **Actualización (Fase 1 completa):** los permisos se deciden con tres vías que conviven y están probadas: dueño (`propietario_id`), roles del negocio (`core_business_members`, valen en todas las tiendas) y equipo por tienda (`delivery_comercio_equipo`, acceso acotado a un local; se mantiene a propósito). Además hay selector de negocio, vista agregada y pantalla de equipo. Antes: la "sucursal" es otra fila de `delivery_comercios` (la copia `delivery_crear_sucursal`) y no existía `business`.

## H. RLS

- **100 % de las tablas con RLS** [verificado]. 9 tablas con RLS y **sin políticas** (acceso solo por funciones, correcto como deny-all): `app_config`, `delivery_auditoria`, `delivery_errores`, `delivery_campana_envios`, `delivery_clientes_control`, `delivery_comercio_equipo`, `delivery_ofertas_rechazos`, `delivery_rutas`, `delivery_tienda_visitas`.
- Patrón dominante bueno: políticas que delegan en `delivery_permiso(comercio, permiso)` y `has_role(uid,'admin')`.
- **Excepciones de lectura pública** (a revisar): `perfiles` (**incluye teléfono**), `delivery_comercios` (incluye `comision_pct`, `propietario_id`, `liquidacion_frecuencia`, `motivo_rechazo`), `delivery_ajustes` (parámetros de tarifas/comisiones), `delivery_resenas`, `delivery_producto_variantes` (stock), `delivery_turnos`.

## I. Autenticación

- Supabase Auth; `AuthContext`. Google mediante `@lovable.dev/cloud-auth-js`, **habilitado solo en dominios de Lovable** (`Auth.tsx` lo restringe por hostname): **en `woref.vercel.app` el acceso con Google no está disponible**. `previewAuthStorage.ts` y `integrations/lovable/` son restos de la plataforma original. Decisión pendiente: configurar Google OAuth directo en Supabase y retirar la dependencia.
- Registro: trigger `controlar_registro` solo en la base de administración; en la base de usuarios hay `cerrar_handle_new_user` (perfil automático).
- MFA TOTP para `has_role(...,'admin')` en la sesión propia (`delivery_mfa_ok`). **Importante:** `delivery_mfa_ok()` devuelve verdadero si la sesión es `aal2` **o si el usuario no tiene ningún factor verificado**: el 2FA se exige solo a quien ya lo activó, **no obliga a activarlo** (ver T13).
- "Protección contra contraseñas filtradas": **desactivada** (aviso del analizador de Supabase).

## J. Permisos

- Roles globales: `user_roles.role ∈ {admin, manager, rep}` (`manager` no se usa en el front).
- Roles de comercio: `dueno` (= `propietario_id`), `encargado`, `operador` en `delivery_comercio_equipo`. Permisos: `pedidos, catalogo, promociones, opiniones, estadisticas, ajustes, finanzas, equipo`.
- Repartidor/conductor: existencia y `activo` en `delivery_repartidores`.
- `delivery_mi_acceso()` **devuelve un solo comercio** (`LIMIT 1`): el modelo de acceso no soporta bien "un usuario en varios negocios".
- `delivery_permiso()` concede **todo al admin global**: el rol de plataforma y el de negocio se mezclan en la misma función.

## K. Mercado Pago

- Credencial en `app_config.mp_access_token` (sin políticas → inaccesible por la API; se carga con `delivery_admin_guardar_mp`).
- Flujo: pedido con `metodo_pago='mercadopago'` → `mp-crear-preferencia` → redirección → `mp-webhook` actualiza `pago_estado`/`pago_id`. Reintegros: estado `a_reintegrar` y marcado manual.
- Buenas prácticas ya presentes: reconsulta del pago a MP, validación de monto, orden de estados, cancelación de impagos a los 30 min.
- Faltantes: no se verifica `x-signature` de MP; no hay tabla de transacciones de pago (el `pago_id` vive en el pedido); un solo proveedor cableado; sin conciliación; sin contracargos como flujo propio.

## L. Marketplace actual

Existe **"marketplace por tienda"**: ficha de producto (`/t/:slug/p/:id`) con galería, preguntas y respuestas con anti-abuso, reputación calculada del vendedor (`delivery_vendedor_resumen`), insignias, catálogo con filtros/orden, variantes con stock, precios escalonados. La búsqueda actual (`Search.tsx`) es `ILIKE` sobre comercios y productos (máx. 24 resultados, con escape de caracteres de filtro de PostgREST), sin ranking ni índice de texto **[verificado]**. **No existe**: catálogo global multi-vendedor, búsqueda transversal con relevancia, categorías jerárquicas y atributos, favoritos de productos en base (hoy local), carrito multi-vendedor, protección al comprador, devoluciones.

## M. Store Builder actual

`tienda_tema` (jsonb) con plantillas, diseño (colores, tipografías, radios), y hasta 24 **bloques** (portada, banner, colecciones, productos, catálogo, imagen+texto, texto, galería, ventajas, FAQ, opiniones, contacto, separador, oferta con cuenta regresiva, suscripción por email, políticas, video). Validación **duplicada** en `src/lib/storefront.ts` y SQL `_ts_*` (consistente, con tests). Editor visual con vista previa por `postMessage`. Carrito lateral, pie completo, WhatsApp, visitas, QR. **Falta**: páginas múltiples (colección, ofertas, búsqueda), dominios propios, SEO por tienda más allá de Open Graph, temas realmente distintos entre sí.

## N. Delivery actual

Pedido → comercio acepta (plazo configurable) → prepara (KDS) → listo → asignación (oferta con tiempo, lotes, rechazos) → en camino → entregado con código y foto. Tarifas por zona/distancia, tarifa dinámica, retiro en local, pedidos programados, ajustes por faltante de stock con reemplazo, cupones, saldo a favor, propina, ETA. Estados: enum `delivery_estado_pedido` + función FSM **[verificado]**.

## O. Repartidores

`delivery_repartidores` mezcla repartidor y conductor (`acepta_remis`, `remis_estado`). Verificación de identidad (`delivery_identidad`, `delivery_documentos`), controles de selfie, ofertas con rechazos, metas e incentivos, turnos reservables, billetera (`delivery_movimientos_repartidor`), app Android (Capacitor) con geolocalización en segundo plano.

## P. Administración

Dos superficies: (1) **`/app/admin`** en la misma base (operación, comercios, repartidores, liquidaciones, contabilidad, soporte, zonas, incentivos, pagos, plataforma) protegida por `has_role('admin')` + MFA; (2) **`/consola`** en base separada (auditoría con hash encadenado, errores, métricas). La separación total (fase 2) **no está hecha**: las acciones siguen en la base de usuarios.

## Q. PWA

`vite-plugin-pwa`: `autoUpdate`, `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`. Navegación `NetworkFirst` (3 s), imágenes de Storage `CacheFirst` (7 días). **Las respuestas de la API no se cachean** → no hay riesgo de datos comerciales obsoletos [verificado]. `push-sw.js` para notificaciones. Manifest "Woref — Delivery" (nombre a actualizar con la visión generalista).

## R. Capacitor

Una sola app: **"Woref Repartidor"** (`app.woref.repartidor`, `webDir: dist`, plugin de geolocalización en segundo plano). La ruta `/` redirige a `/app/repartidor` si es app nativa. Pendiente: reconstruir el APK con la marca nueva.

## S. Deuda técnica

1. ~~`types.ts` era de otra aplicación~~ **Resuelto 2026-10-05**: regenerado desde la base real (64 tablas). Sigue pendiente reemplazar `db = supabase as any` por el cliente tipado, módulo por módulo (la capa `src/services/` ya existe, con `profile.ts` como primer servicio).
2. ~~`supabase/migrations/` mezclaba dos historias~~ **Resuelto 2026-10-05**: las 52 migraciones del proyecto original (nunca aplicadas aquí) se archivaron en `supabase/legacy/` (con README de advertencia); una de ellas era en realidad la base de delivery y volvió a `migrations/` como `20261001210911_delivery_base.sql`. Las 3 migraciones dudosas (`delivery_billetera_cliente`, `delivery_comision_12`, `delivery_libro_contable`) **están aplicadas** (sus objetos existen). El archivo de la migración aplicada `base_perfiles_y_roles` no existía: se **reconstruyó** desde la base real (`20261001210805_base_perfiles_y_roles.sql`).
3. Las versiones/timestamps de migraciones del repo no coinciden con las aplicadas (se aplicaron con la herramienta de Supabase): no hay trazabilidad 1:1.
4. Sin **capa de servicios** en el front: 113 archivos tocan la base directamente.
5. Validaciones duplicadas cliente/servidor (tienda) y lógica de estados de envío/viaje con strings sueltos.
6. Componentes muy grandes (StorefrontView, Cart, MerchantOrders, StoreOnboarding).
7. ~~`README.md` era el de Lovable~~ **Resuelto 2026-10-05**: reescrito.
8. Sin pruebas de integración/RLS/E2E: 25 archivos de test unitario (≈114 tests, solo lógica de `lib/` y algunos componentes). `@playwright/test` está instalado pero sin suite.
9. `app_role` incluye `manager` sin uso; datos demo (`demo_comercios_lincoln`) conviven con producción.
10. Dependencia de `@lovable.dev/cloud-auth-js`; `previewAuthStorage.ts` generado por la plataforma original.
11. Advisories de npm: 2 moderados de `react-router` (requieren v7).

## T. Riesgos de seguridad

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| T1 | ~~P0 — Alta~~ | `perfiles` era legible por **anon** con el teléfono de todos los usuarios. **CERRADO 2026-10-05** (Fase 0): permisos de columna sin `telefono`; cada usuario lee el suyo con `delivery_mi_perfil()`. Verificado con prueba como anon/usuario y recorrido del front. | **Resuelto** |
| T2 | ~~Alta~~ | `delivery_comercios` exponía a anon `comision_pct` y `liquidacion_frecuencia`. **CERRADO 2026-10-05**: el front usa columnas públicas explícitas (`COMERCIO_COLS`) y administración lee todo con `delivery_admin_comercios()`. Siguen públicos a propósito: `propietario_id` (las políticas lo usan), `motivo_rechazo` (solo existe en comercios no públicos, que RLS oculta), coordenadas y teléfono del local. | **Resuelto** |
| T3 | Media | Admin de plataforma **dentro** de la base de usuarios (`has_role` + MFA). Un fallo de política afecta todo. Plan de separación en curso (fase 1 hecha). | Parcial |
| T4 | ~~Media~~ | 153 funciones `SECURITY DEFINER` ejecutables por usuarios y 15 por `anon`. **Revisión manual completa hecha el 2026-10-05** (las 100 con identificadores leídas una por una, las 34 `delivery_admin_*` verificadas con el chequeo de rol al inicio, y las 53 sin identificadores clasificadas): **no se encontraron accesos cruzados entre usuarios ni entre comercios**; todas validan propiedad o permiso (`auth.uid()`, `delivery_permiso`, `delivery_puede_ver_finanzas`, `delivery_pedido_puede_ver`, `delivery_rol_en_chat`, dueño por `propietario_id`) y las de dinero exigen MFA. Los disparadores `delivery_proteger_comercio`/`_repartidor` impiden que un dueño se apruebe, cambie su comisión o que un repartidor se marque como verificado. | **Resuelto** (con hallazgos menores T10–T12) |
| T13 | **Media** | El 2FA del administrador de la base de usuarios **no es obligatorio**: `delivery_mfa_ok()` lo exige solo si el admin ya enroló un factor. Una cuenta admin sin 2FA opera con contraseña sola. Corrección propuesta: exigir enrolamiento a los admin (y bloquear funciones sensibles hasta lograrlo), **después** de que el dueño active el suyo para no dejarlo afuera. (La consola `/consola` de la base separada sí lo exige siempre.) | Pendiente (requiere acción del dueño) |
| T10 | Baja | `delivery_validar_cupon` no limita intentos y sus mensajes distinguen "no existe", "venció" y "no aplica": permite adivinar códigos de cupón. Valor bajo (cupones comerciales), pero conviene un límite por usuario. | Pendiente |
| T11 | Baja | Las funciones abiertas a `anon` (`delivery_arrepentimiento_crear`, `delivery_reportar_error`, `delivery_tienda_visita`) tienen topes **globales** (500/día, 1000/hora) o ninguno: un atacante puede llenar el cupo o inflar visitas. No exponen datos. | Pendiente |
| T12 | Info | `delivery_comercios` borra en cascada productos, liquidaciones, reclamos y reseñas, pero `delivery_pedidos → delivery_comercios` es `RESTRICT`: un comercio con pedidos no se puede borrar (correcto). Si algún día se cambia esa regla, se pierde historial contable. Dejarlo documentado. | OK |
| T5 | Media | `mp-webhook` no verifica la firma `x-signature` de Mercado Pago (mitigado por la reconsulta a la API). | Resuelto en Fase 5 paso 1: verificación HMAC con tolerancia de 10 min; se activa al cargar la clave secreta del webhook en Administración → Pagos (hasta entonces el aviso sigue siendo reconsultado a la API). Falta que el dueño cargue la clave. |
| T6 | Media | Contraseñas filtradas: protección desactivada. | Pendiente (configuración) |
| T7 | ~~Baja~~ | `_ts_*` sin `search_path` fijo. **CERRADO 2026-10-05.** | **Resuelto** |
| T8 | Baja | `delivery_ajustes` es público: contiene tarifas y comisiones (`comision_default_pct`, `remis_comision_pct`…). No hay secretos, pero revela el modelo de comisión. | Decidir |
| T9 | Info | Claves: solo la publicable en el front y en `api/tienda.js` (correcto). Secretos (`mp_access_token`, `push_webhook_secret`, `admin_ingest_secret`) en `app_config`, sin políticas. | OK |

## U. Duplicaciones

- Dos interfaces de tienda: `pages/delivery/StoreDetail` (dentro de la app) y `pages/Storefront` + `components/storefront` (tienda pública).
- Tres flujos de "trabajo para un transportista" con UI y lógica propias: `OfferCard` (pedido), `EnvioCards`, `ViajeCards`; y en SQL `delivery_viajes_disponibles`, `delivery_envios_disponibles` y el despacho de pedidos.
- Tres detalles de seguimiento: `OrderDetail`, `EnvioDetail`, `RemisDetail`.
- Cálculo de comisión/ganancia repetido por tabla (`comision_pct`, `ganancia_repartidor/conductor`).
- Validación del tema de tienda en TS y SQL (intencional, mantenida con tests).
- Filtros/ordenamiento de catálogo en cliente, sin servicio de búsqueda.

## V. Código que debe mantenerse

- Todo el esquema transaccional de pedidos y la lógica SQL (stock, cupones, libro inmutable, FSM, liquidaciones).
- `delivery_libro` (ledger append-only): es la base del Wallet/Payments futuro.
- Constructor de tiendas y su validación doble.
- Base de administración separada y envío firmado (outbox con reintentos).
- Variantes, preguntas con anti-abuso, reputación derivada de datos reales.
- PWA y estrategia de caché.
- Tests existentes de `lib/`.

## W. Código que debería refactorizarse

- `lib/delivery.ts` → dividir por dominio (`commerce`, `market`, `store`, `logistics`…).
- Introducir `services/` y mover ahí las ~320 llamadas `db.*`.
- Regenerar `types.ts` desde la base real y eliminar `db as any` por etapas.
- `delivery_mi_acceso`/`delivery_permiso` → modelo con Business y membresías múltiples (con fallback al actual).
- Extraer de `delivery_pedidos` los grupos de columnas de pago, despacho y liquidación hacia entidades propias **sin** romper compatibilidad (vistas/columnas generadas en la transición).
- Componentes gigantes en piezas por responsabilidad.

## X. Código que debería dejar de desarrollarse

- Nuevas funciones de tienda dentro de `StoreDetail` (la tienda pública es la vía).
- Más tablas `delivery_*` para dominios nuevos (servicios, mercado global, pagos): deben nacer en el Core/dominio correspondiente.
- Más lógica de negocio dentro de componentes React.
- Nuevas migraciones sobre `perfiles`/`comercios` que agreguen columnas públicas.
- El `README` de Lovable y `previewAuthStorage.ts` (retirar cuando se confirme que no se usa Lovable).

## Y. Funcionalidades faltantes (frente a la visión)

Core: `Business`/`Organization`, membresías múltiples, roles de plataforma separados, direcciones como entidad geográfica común. Market: catálogo global, búsqueda, categorías y atributos, carrito multi-vendedor, comisiones de marketplace por venta, protección al comprador, devoluciones. Store: páginas múltiples, dominios, SEO. Services: todo (servicios, profesionales, agenda, turnos, reservas). Logistics: `Shipment`/`Package` genéricos, tracking común, proveedores. Network/Dispatch: motor independiente del tipo de trabajo. Mobility: estados completos de viaje, vehículos y categorías. Payments: servicio central, transacciones, payouts, reembolsos con libro. Comunicación: tabla de notificaciones, email transaccional, preparación para WhatsApp. Marketing: CRM y segmentación. Analytics: tableros por dominio. IA: capa de herramientas.

---

# ARQUITECTURA OBJETIVO

## 1. Principio

**Una plataforma, un Core, módulos con fronteras claras.** Cada módulo: sus tablas, sus estados, sus servicios, sus eventos; todos reutilizan Core (identidad, negocio, dirección, pago, notificación, reputación, geo).

```
                   WOREF
                     │
                  CORE (identidad · negocio · tienda · dirección · roles · permisos)
       ┌─────────────┼─────────────┐
   COMMERCE        MARKET        SERVICES
       └─────────────┼─────────────┘
                     │
               WOREF NETWORK  (prestadores: courier · driver · messenger · transporter)
        ┌────────────┼────────────┐
    LOGISTICS     DELIVERY      MOBILITY
                     │
                 DISPATCH  ←  JOB (DELIVERY · RIDE · SHIPPING · PICKUP · SERVICE)
                     │
                 PAYMENTS (ledger · wallet · comisiones · payouts)
                     │
              COMMUNICATION  →  ANALYTICS  →  AI
```

## 2. Core — entidades y su encaje con lo existente

| Entidad Core | Hoy | Estrategia |
|---|---|---|
| User | `auth.users` + `perfiles` | Mantener; separar datos públicos (nombre, avatar) de privados (teléfono) |
| Business | **no existe** | Crear `core_businesses` y `core_business_members`; `delivery_comercios.business_id` (nullable, relleno 1 a 1 con `propietario_id`) |
| Store | `delivery_comercios` + `tienda_tema` | Mantener la tabla; tratarla conceptualmente como Store/Branch; agregar `parent_id`/`business_id` |
| Customer | `perfiles` + `delivery_clientes_control` | Vista de dominio `customer` |
| Address | `delivery_direcciones` | Mantener; `GeoPoint` como tipo de dominio común |
| Role / Permission | `user_roles`, `delivery_comercio_equipo`, `delivery_permiso` | Nuevo modelo de membresías por Business; `delivery_permiso` lee el nuevo y cae al viejo |
| Provider | `delivery_repartidores` | Ver Network |
| Review | `delivery_resenas`, calificación en `delivery_viajes` | Tabla `reviews` genérica con sujeto tipado (producto/vendedor/prestador/viaje) |
| Notification / Conversation | push por triggers; `delivery_mensajes` | `notifications` + `conversations` separadas de la mensajería logística |
| Payment / Transaction | columnas en pedido + `delivery_libro` | Tabla `payments` + ledger existente como libro |
| Job | **no existe** | Ver §3 |

## 3. Job (operación física) — sin forzar un solo esquema

```
ORDER ──▶ FULFILLMENT ──▶ JOB(DELIVERY)
RIDE ───────────────────▶ JOB(RIDE)
SHIPMENT ──▶ PACKAGE ───▶ JOB(SHIPPING)
```

`jobs(id, tipo, origen GeoPoint, destino GeoPoint, estado, referencia_tipo, referencia_id, prestador_id, tarifa, ganancia, ...)`. `delivery_pedidos`, `delivery_envios` y `delivery_viajes` **siguen existiendo**; el Job es la capa operativa común que el Dispatch consume. Se crea por trigger/evento, sin romper el flujo actual.

## 4. Módulos

- **MARKET**: sellers (= Business/Store), `listings` sobre el mismo catálogo de `delivery_productos` (un producto puede publicarse en Market, en su Store o en ambos mediante canales), categorías jerárquicas y atributos, búsqueda tras un `SearchService` (primero Postgres: `pg_trgm`/FTS), reputación, preguntas, favoritos en base, comisiones.
- **COMMERCE**: producto, variantes (hecho), inventario, carrito, checkout, órdenes, cupones, devoluciones.
- **STORE**: temas, páginas, secciones, bloques, colecciones, dominios, SEO (evolución del builder actual).
- **SERVICES**: `services`, `professionals`, `availability`, `appointments`.
- **LOGISTICS**: `shipments`, `packages`, `pickups`, tracking común.
- **NETWORK**: `providers` con tipo (COURIER/DRIVER/MESSENGER/TRANSPORTER/LOGISTICS_PROVIDER), documentos, vehículos, zonas, disponibilidad, reputación, ganancias.
- **DISPATCH**: motor en backend (Postgres/Edge): candidatos → filtros → score → oferta → aceptación → asignación; reglas configurables, no en React.
- **MOBILITY**: rides con máquina de estados REQUESTED → … → COMPLETED/CANCELLED, vehículos, tarifas.
- **PAYMENTS**: `PaymentService` + `PaymentProvider` (Mercado Pago primero), `transactions`, `wallet`, `wallet_transactions`, comisiones, liquidaciones, payouts, reembolsos — todo contra el libro inmutable.
- **COMMUNICATION**: notificaciones por canal (in-app/push/email; WhatsApp futuro), eventos de dominio.
- **ANALYTICS**: vistas/materializaciones por dominio; hoy hay estadísticas de comercio y métricas del dueño.
- **AI**: capa separada que consume herramientas controladas (RPC/Edge con permisos), nunca la base completa.
- **PLATFORM**: admin separado, billing, seguridad, auditoría, monitoreo, feature flags, API, integraciones.

## 5. Eventos y estados

Eventos de dominio simples (tabla `domain_events` + triggers/Edge): `OrderCreated → PaymentRequested → PaymentApproved → ShipmentCreated → JobCreated → DispatchRequested → CourierAssigned → DeliveryStarted → DeliveryCompleted → OrderCompleted`. Sin Kafka.

Máquinas de estados explícitas y validadas en backend: `OrderStatus`, `RideStatus`, `ShipmentStatus`, `JobStatus`, `PaymentStatus`. Hoy solo el pedido tiene FSM en SQL; envíos y viajes usan strings.

## 6. Estructura de código objetivo (incremental)

```
src/
  app/            rutas, providers, layout
  features/       auth · commerce · market · store · logistics · mobility · services · payments · network · messaging · analytics · admin
  components/     ui y piezas compartidas
  services/       único lugar que habla con Supabase (db.from / db.rpc)
  domain/         tipos y reglas puras (estados, GeoPoint, dinero)
  lib/            utilidades
  types/          tipos generados de la base real
```

Se migra por módulo, empezando por lo nuevo; `lib/delivery.ts` se divide sin romper imports (re-exports temporales).

## 7. Reglas de compatibilidad

1. **No renombrar** tablas `delivery_*`; crear Core encima (columnas nuevas nullable, tablas nuevas, vistas de dominio).
2. Migraciones **aditivas**, con relleno de datos y verificación; ninguna destructiva sin copia y aprobación.
3. El front sigue funcionando en cada paso; los cambios de modelo se hacen primero en la base con compatibilidad y recién después en la UI.
4. Antes de aplicar cualquier migración: conciliar repo ↔ base (ver ROADMAP, fase 0).

---

## Cobertura de la auditoría (qué se hizo y qué no)

**Hecho y verificado:** estructura del repo y dependencias; rutas; conteo de llamadas a la base desde la UI; 64 tablas con RLS y número de políticas; 251 funciones y su clasificación (`SECURITY DEFINER`, permisos de `anon`/`authenticated`, `search_path`); comprobación automática de verificación del llamante en todas las funciones privilegiadas; las 4 funciones sin verificación aparente revisadas a mano (delegan correctamente); políticas públicas y permisos de columnas de `perfiles` y `delivery_comercios` con **prueba real como anon**; buckets y políticas de Storage; 7 Edge Functions (autenticación de cada una) y lectura completa de `mp-webhook` y `mp-crear-preferencia`; cron jobs; analizador de seguridad de Supabase; migraciones aplicadas frente al repo (por nombre); `types.ts` frente a la base; PWA, Capacitor, Vercel.

**No verificado todavía (siguiente pasada):** lectura función por función de las 212 `SECURITY DEFINER` (solo clasificación automática + 4 revisadas); política por política de las 102 de RLS (se revisaron las públicas y las que usan `true`); contenido exacto de las 3 migraciones sin equivalente por nombre; implementación de `Search.tsx` y de los filtros del catálogo; consultas de rendimiento (planes, índices faltantes); `og-preview` (no desplegada); flujo de reintegros y contracargos de punta a punta; cumplimiento legal (consumidor, datos personales).
