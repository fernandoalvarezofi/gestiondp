# Navegación por contextos (roles)

Woref es una sola cuenta con varios **contextos**: Cliente, Comercio, Repartidor, Conductor y Administración.
Cada contexto tiene su prefijo de rutas, su layout y su menú. La sesión es una sola: cambiar de contexto no cierra sesión.

## 1. Arquitectura anterior

- `AppLayout` (cliente) envolvía **todas** las rutas de `/app`, incluidos los paneles. Decidía auth y MFA y, si la ruta era un panel, no dibujaba nada propio. Además tenía una cabecera de panel que nunca se mostraba (código muerto).
- El menú "cambiar de panel" estaba copiado en 3 lugares (cabecera del cliente, cabecera muerta y pie de `PanelShell`) y otra vez en Ayuda del perfil.
- `useDeliveryRoles` hacía 4 consultas **cada vez** que se usaba (hasta 3 veces por pantalla).
- No había guardas por ruta. Administración se protegía dentro del componente, y una sección inexistente (`/app/admin/loquesea`) mostraba una pantalla vacía.
- **Conductor y repartidor estaban mezclados**: las ofertas y el viaje de remís aparecían en "Pedidos" del repartidor, y el alta de conductor estaba en su perfil.
- Administración era un solo componente de 365 líneas con 27 pestañas.
- "Servicios" del cliente mezclaba explorar, accesos a paneles y cuenta. "Mis pedidos" no mostraba los viajes.

## 2. Arquitectura nueva

```
AuthProvider → RolesProvider (roles una vez por sesión)
  /app  SessionGate (espera la sesión, MFA, pide ingresar si la ruta no es pública)
    ├─ ClientLayout        /app/*            Cliente
    ├─ MerchantLayout      /app/comercio/*   Comercio  (permiso por rol del equipo)
    ├─ CourierLayout       /app/repartidor/* Repartidor (entregas y envíos)
    ├─ DriverLayout        /app/conductor/*  Conductor  (viajes de remís)
    └─ RequireRole(admin) → AdminLayout  /app/admin/:seccion
```

**Por qué se mantienen los prefijos en español (no `/client`, `/merchant`…):** las notificaciones guardadas en la base, las funciones de push, la app de Android, los enlaces compartidos y el sitemap ya usan `/app/...`. Renombrar todo rompía enlaces sin ganar nada. Cada contexto sí quedó aislado bajo su prefijo; el único nuevo es `/app/conductor`. Las rutas viejas que cambiaron redirigen: `/app/servicios` → `/app/explorar` y `/app/admin/remises` → `/app/admin/conductores`.

## 3. Sistema de roles

`src/contexts/RolesContext.tsx` (`useDeliveryRoles()` sigue funcionando igual):

| Rol | De dónde sale |
|---|---|
| Admin | fila `admin` en `user_roles` (el servidor exige 2FA con `has_role`) |
| Comercio | `delivery_mi_acceso` (dueño o miembro del equipo/negocio) |
| Repartidor | `delivery_repartidores.activo` |
| Conductor | repartidor activo con `remis_estado = 'aprobado'` |

Los paneles llaman a `roles.refresh()` cuando detectan un cambio (crear un comercio, aprobación, etc.).

## 4. Sistema de contextos

`src/navigation/contexts.ts` es la única definición: id, nombre, prefijo, ícono, cómo saber si la cuenta lo tiene y cómo ofrecer sumarse.
- `contextFromPath(pathname)`: el contexto activo **sale de la URL**, así un enlace directo o una notificación abre en el contexto correcto.
- `contextsFor(roles)`: separa los contextos disponibles de los que se pueden ofrecer para sumarse. Administración nunca se ofrece.
- `rememberContext` / `lastContext`: recuerdan el último panel. La app de Android abre en ese panel.

**Seguridad:** las guardas (`SessionGate`, `RequireRole`, el bloqueo por permiso del comercio) solo deciden qué se dibuja. La autorización real la hace el servidor (RLS, `has_role` con aal2, `delivery_permiso`), así que escribir una URL a mano no da acceso a ningún dato.

## 5. Estructura de rutas

| Contexto | Rutas |
|---|---|
| Cliente | `/app`, `explorar`, `buscar`, `categoria/:id`, `tienda/:slug`, `carrito`, `pedidos`, `pedidos/:id`, `envios/:id`, `remis`, `remis/:id`, `enviar`, `turnos`, `turnos/locales`, `mensajes`, `notificaciones`, `favoritos`, `promociones`, `club`, `directorio`, `ayuda`, `ayuda/:id`, `perfil/:seccion?`. Ruta desconocida → 404 |
| Comercio | `/app/comercio` + `pedidos`, `devoluciones`, `turnos`, `mensajes`, `menu`, `tienda`, `preguntas`, `opiniones`, `promociones`, `campanas`, `finanzas`, `estadisticas`, `equipo`, `sucursales`, `configuracion/:seccion`, `nuevo` |
| Repartidor | `/app/repartidor` (trabajos) + `ganancias`, `incentivos`, `historial`, `perfil` |
| Conductor | `/app/conductor` (viajes) + `ganancias`, `historial`, `perfil` |
| Admin | `/app/admin` (resumen) + `/app/admin/:seccion` (ver `ADMIN_SECTIONS`) |

Sin sesión solo se ve lo público del cliente: inicio, explorar, buscar, categorías, tiendas, carrito, promociones y directorio.

## 6. Componentes de navegación

| Componente | Archivo | Uso |
|---|---|---|
| Menús como datos | `src/navigation/menus.ts` | `CLIENT_TABS`, `MERCHANT_SECTIONS` (con permiso por sección), `courierNav`, `driverNav`, `ADMIN_SECTIONS` |
| Selector de contexto | `src/navigation/ContextSwitcher.tsx` | `ContextMenuItems` (menús desplegables) y `ContextSwitcherCard` (Mi cuenta) |
| Guardas | `src/navigation/guards.tsx` | `SessionGate`, `RequireRole`, `Forbidden` (403) |
| Layout cliente | `src/components/layouts/ClientLayout.tsx` | cabecera, barra inferior (Inicio · Explorar · Pedidos · Mensajes · Cuenta), carrito flotante |
| Layout de paneles | `src/components/panel/PanelShell.tsx` | barra lateral en escritorio, cajón y barra inferior en el celular, cabecera con acciones y avisos |

El carrito no va en la barra inferior: 5 pestañas es el máximo cómodo en un celular, y el carrito ya está arriba y en la barra flotante "Ver mi pedido" (igual que en PedidosYa o Rappi).

## 7. Archivos

**Creados:** `src/navigation/{contexts.ts, menus.ts, guards.tsx, ContextSwitcher.tsx, navigation.test.ts}`, `src/contexts/RolesContext.tsx`, `src/pages/delivery/courier/useWorkerSession.ts`, `src/pages/delivery/driver/{DriverLayout,DriverPages}.tsx`, `src/pages/delivery/admin/AdminSections.tsx`, este documento.

**Movidos (con historial):** `components/AppLayout.tsx` → `components/layouts/ClientLayout.tsx`; `pages/delivery/Services.tsx` → `Explore.tsx`; `pages/delivery/AdminDashboard.tsx` → `admin/AdminLayout.tsx`.

**Modificados:** `App.tsx` (árbol de rutas), `PanelShell`, `MerchantLayout`, `CourierLayout`, `CourierPages`, `Profile`, `HelpSection`, `Orders` (suma viajes y filtros), `RemisManager` (prop `view`), `RemisEnrollment` (texto), `AppFooter`, `lib/navigation.ts` y su test, `useDeliveryRoles`, `supabase/functions/push-viaje` (los avisos de viaje abren `/app/conductor`).

**Eliminados:** ninguno de funcionalidad. Solo se borró el código muerto de la cabecera de panel dentro de `AppLayout` y los menús duplicados.

## 8. Funcionalidad preservada

Todas las pantallas y acciones anteriores siguen en su lugar: alta guiada del comercio, sucursales y selector de negocio, permisos por rol del equipo, ofertas y lotes del repartidor, envíos, selfie de control, metas y turnos, billetera, alta de conductor con documentos, las 27 secciones de administración con sus datos y acciones, MFA y avisos push.

## 9. Pendiente

- **Separación de conductor y repartidor en el servidor:** hay un único `disponible`. Si alguien es las dos cosas y se conecta, el servidor le sigue ofreciendo entregas aunque esté en el panel de conductor (las ve al volver al panel de repartidor). Para separarlo del todo hace falta un "modo de trabajo" en `delivery_repartidores` que lean `delivery_ofertas_visibles`, `delivery_candidato_oferta` y `despacho_candidatos`. Es un cambio de despacho que hay que aprobar.
- Pantallas pedidas que no existían y **no se inventaron**: Clientes y Reservas como secciones propias del comercio, Mapa del repartidor y del conductor (hoy el mapa está dentro del trabajo en curso), Analytics y Seguridad como secciones aparte en administración (hoy son Resumen, Auditoría y Errores), Mensajes de conductor.
- Las notificaciones (`/app/notificaciones`) son una sola lista por cuenta y se ven en el layout del cliente.
- Breadcrumbs en administración (hoy hay título de sección y botón Volver).

## 10. Cómo agregar un rol o contexto nuevo

1. Sumarlo a `APP_CONTEXTS` en `src/navigation/contexts.ts`: id, prefijo, `has(roles)` y `join`.
2. Si depende de un dato nuevo, agregarlo en `RolesContext` (una consulta más en `refresh`).
3. Definir su menú en `src/navigation/menus.ts`.
4. Crear `pages/delivery/<contexto>/<Contexto>Layout.tsx` con `PanelShell` y sus páginas.
5. Agregar la rama de rutas en `App.tsx` (con `RequireRole` si no tiene pantalla para sumarse) y su inicio a `PANELS` (automático: sale de `APP_CONTEXTS`).
6. Proteger los datos en el servidor (RLS o RPC). La guarda del frontend no alcanza.
7. Sumar casos a `src/navigation/navigation.test.ts`.
