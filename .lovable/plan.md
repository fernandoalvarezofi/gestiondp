Tanda grande, dividida en 4 bloques. Voy a ejecutar **bloque 1 (Marketplace) entero ahora**, y después seguís dándome luz verde para 2, 3 y 4.

---

## Bloque 1 — Marketplace digital (estilo MercadoLibre, pero solo digital)

### Modelo de pago "a la MercadoLibre"
Cada vendedor configura **sus propios métodos de pago** en su perfil de vendedor. El comprador elige uno al checkout y se va al link del vendedor. Woref no toca plata (cero fricción legal, cero KYC, escala global desde día 1).

Métodos soportados por vendedor:
- Stripe / Payment Link
- MercadoPago link
- PayPal.me
- Gumroad / Lemon Squeezy / Paddle link
- Transferencia (CBU/CVU/USDT)
- "Coordinar por DM"

Cuando se completa el pago, el vendedor marca la orden como pagada y **el sistema libera la entrega digital automáticamente** (archivo, link, código de licencia, acceso a curso).

### Tablas nuevas
- `marketplace_categorias` — categorías fijas (Diseño, Código, IA, Cursos, Plantillas, Webs, Servicios, Software, Audio, Video, etc.)
- `marketplace_productos` — título, descripción, precio, moneda, categoria, tipo (`archivo` | `licencia` | `servicio` | `curso` | `web` | `ia`), portada, galería, demo_url, estado
- `marketplace_archivos` — archivos privados que se entregan tras compra (storage bucket privado)
- `vendedor_perfiles` — bio comercial, payout_methods (jsonb con todos los links del vendedor), entrega_automatica, total_ventas, rating
- `marketplace_ordenes` — comprador_id, vendedor_id, producto_id, monto, moneda, metodo_pago, estado (`pendiente`|`pagada`|`entregada`|`cancelada`|`disputa`), token_descarga
- `marketplace_reviews` — orden_id, rating, comentario, respuesta_vendedor
- `marketplace_favoritos` — wishlist
- Bucket privado `marketplace-archivos` + bucket público `marketplace-portadas`

### Páginas nuevas
- `/lin/mercado` — grid de productos con filtros (categoría, precio, rating, tipo), búsqueda, orden por relevancia/recientes/precio
- `/lin/mercado/:slug` — ficha producto: galería, descripción rich, precio, vendedor, reviews, botón **"Comprar"** que abre sheet con métodos de pago del vendedor
- `/lin/vendedor/configurar` — configurar payout methods + perfil de vendedor
- `/lin/vendedor/productos` — CRUD productos
- `/lin/vendedor/ordenes` — gestión: marcar como pagada, subir entrega, contestar reviews
- `/lin/mis-compras` — historial + descargas seguras
- Entrada en el AppSidebar: **"Mercado"** con ícono `Store`

### Flujo de compra completo
1. Click "Comprar" → sheet muestra métodos del vendedor con iconos
2. Comprador elige uno → se crea `marketplace_ordenes` con estado `pendiente` → abre link en nueva tab
3. Vendedor recibe notificación → marca como `pagada` desde su panel
4. Sistema dispara notif al comprador con link de descarga firmado (signed URL del bucket privado, 7 días)
5. Comprador descarga + puede dejar review

### Seguridad
- RLS estricto: productos públicos visibles, archivos privados solo accesibles vía signed URL post-pago
- Edge function `generar-descarga` que valida orden pagada antes de generar signed URL
- Validación Zod en checkout

---

## Bloque 2 — Profesionalización visual global (siguiente turno)
- Rediseño feed estilo Twitter/X con composer inline
- Iconografía Lucide reemplazada por íconos premium con micro-animaciones
- PostCard pulido: hover states, action bar refinada
- Perfil con cover, tabs animadas, layout editorial
- Sidebar con badges, indicadores de actividad, dark mode opcional

## Bloque 3 — Notificaciones reales + Web Push
- Centro de notificaciones con agrupación inteligente
- Badges en sidebar (mensajes, notif, ordenes)
- Service Worker + Web Push API (suscripción + edge function para enviar)
- Permisos opt-in con UX prolija

## Bloque 4 — Stories pro tipo Instagram
- Visor fullscreen con barra de progreso por segmento
- Reacciones rápidas, replies inline, stickers, menciones
- Vista de espectadores (quién vio)
- Highlights persistentes en perfil

---

## Lo que ejecuto ahora (Bloque 1)
Migración con todas las tablas + RLS + triggers + buckets, 6 páginas nuevas, edge function de descarga segura, integración en sidebar y perfil. Productos demo seed para que no quede vacío.

Confirma y arranco. Después seguimos con 2, 3, 4 uno por uno para que cada bloque quede sólido y no a medias.