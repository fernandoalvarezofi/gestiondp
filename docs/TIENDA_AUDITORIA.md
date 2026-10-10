# Mi tienda: auditoría y arquitectura objetivo

Fecha: 2026-10-09. Referentes usados como criterio: WordPress/Gutenberg (edición y contenido), constructores visuales (estilos por sección),
Shopify y Tiendanube (temas, secciones, administración) y WooCommerce (relación catálogo ↔ contenido).

## 1. Problemas estructurales encontrados

| # | Problema | Dónde | Consecuencia |
|---|----------|-------|--------------|
| E1 | El esquema de cada bloque está escrito cuatro veces: tipo TS, `normalizeBloque`, `_ts_bloque_v1` (SQL) y el `switch` del render. El validador SQL descarta toda propiedad que no conoce. | `lib/storefront.ts`, `_ts_bloque*`, `StorefrontView.tsx` | Cualquier propiedad común (fondo, márgenes, visibilidad) había que agregarla tipo por tipo. Por eso cada bloque tenía controles distintos y casi ninguno de diseño. |
| E2 | No existe un estilo de sección. Fondo, espaciado, ancho y alineación están fijos en el código de cada bloque (solo `texto` y `cta` tienen “fondo”). | render | No se pueden armar sitios distintos: solo se cambian textos y colores de la plantilla. |
| E3 | Inicio y páginas son dos sistemas: el inicio vive en `tienda_tema` con borrador, publicación y versiones; las páginas se guardan directo en línea (sin borrador ni versiones), en otra pantalla, con otro editor y con un límite distinto. | `PagesPanel`, `tienda_pagina_guardar` | Editar una página publicada cambia la web en el acto; restaurar una versión no restaura páginas; la experiencia no es un sitio. |
| E4 | “Usar este tema” reemplaza todos los bloques de la página de inicio. | `aplicarPlantilla` | Cambiar de tema borra el contenido. Los temas son generadores de bloques, no sistemas de diseño. |
| E5 | Encabezado y pie no son componentes editables: el pie se arma solo; el encabezado tiene dos opciones. | `StoreFooter`, header en `StorefrontView` | No hay control sobre navegación secundaria, columnas del pie ni el comportamiento del encabezado. |
| E6 | Cada bloque define su propio enlace (`enlace_tipo` con 3 o 4 valores). No se puede enlazar a una página, una colección o una sección. | tipos | Botones inconsistentes y sin destinos reales de la tienda. |
| E7 | No hay secciones reutilizables ni patrones. | — | Rehacer lo mismo en cada página. |
| E8 | No hay controles por dispositivo (ocultar en celular, columnas en celular). | — | Las páginas no se pueden ajustar al celular. |
| E9 | Historial de edición solo del inicio; los cambios en páginas no tienen deshacer. | `MerchantStorefront` | Pérdida de cambios. |
| E10 | Tokens de diseño limitados (color de acento, fondo, texto, radio, fuentes) y aplicados a mano en cada bloque. No hay superficie, borde, escala ni estilo de tarjeta. | `estiloTienda` | Los temas solo difieren en la portada. |

## 2. Matriz de brechas (constructor)

| Capacidad (criterio verificable) | Antes | Solución | Estado |
|---|---|---|---|
| Estilo común por sección: fondo (color, oscuro, imagen), márgenes, ancho, alineación, visibilidad por dispositivo, ancla | No | Contrato `est` validado una vez (TS + `_ts_estilo` en SQL) y aplicado por un único marco en el render | En curso |
| Árbol del sitio: páginas → encabezado / secciones / pie, con selección desde el árbol o la vista previa | Lista plana del inicio | Editor nuevo con árbol, lienzo e inspector (Contenido / Estilo) | En curso |
| Editar cualquier página con el mismo editor | Dos editores | Las páginas usan el mismo árbol, inspector e historial | En curso |
| Borrador y publicación de todo el sitio (inicio + páginas) | Solo inicio | `borrador` por página; `tienda_publicar` publica tema y páginas en una transacción | En curso |
| Versiones de todo el sitio | Solo inicio | Las versiones guardan también las páginas; restaurar las vuelve a borrador | En curso |
| Destinos de enlace unificados (página, colección, categoría, sección, reservar, WhatsApp, URL) | No | Tipo `Destino` y bloque de contenido flexible | En curso |
| Bloque de contenido flexible (título con nivel, texto con formato, imagen en 4 posiciones, 2 botones) | No | Bloque `contenido` | En curso |
| Secciones guardadas y patrones | No | Tabla `delivery_tienda_secciones` + patrones de fábrica | En curso |
| Encabezado y pie editables | No | `cabecera` y `pie_config` en el tema | En curso |
| Temas que no borran contenido | No | Aplicar tema cambia diseño y estructura global; reemplazar el inicio es opcional | En curso |
| Tokens globales (superficie, borde, escala y peso de títulos, mayúsculas, estilo de tarjeta) | Parcial | Nuevos tokens en `diseno`, variables CSS `--sf-*` | En curso |
| Copiar / pegar secciones entre páginas | No | Portapapeles del editor | En curso |
| Edición de texto directamente sobre el lienzo | No | — | Pendiente |
| Contenedores anidados libres (filas/columnas arbitrarias) | No | Se decidió no hacerlo en esta etapa: el bloque `columnas` y `contenido` cubren los casos comunes sin romper el render en celular | Pendiente |
| Plantillas por tipo de contenido (plantilla de ficha de producto, de colección) | No | — | Pendiente |

## 3. Arquitectura objetivo

```
Editor (MerchantStorefront + builder/*)
  └─ estado único del sitio: { tema, paginas[id] } con historial (deshacer/rehacer) y autoguardado
       ├─ tema  → tienda_borrador_guardar (borrador del inicio y del diseño global)
       └─ página → tienda_pagina_borrador_guardar (borrador por página)
Publicar → tienda_publicar: valida (delivery_guardar_tienda_tema + _tp_aplicar), aplica tema y páginas, guarda versión (tema + páginas)
Esquema → lib/storefront.ts (tipos + normalizeBloque + normalizeEstilo) ≡ SQL (_ts_bloque + _ts_estilo)
Render  → StorefrontView: un marco (SeccionMarco) por sección aplica `est`; cada bloque solo dibuja su contenido
```

Reglas: todo lo que se guarda se valida en el servidor; el navegador vuelve a normalizar antes de usarlo en estilos o enlaces;
las tiendas existentes siguen funcionando sin migrar datos (los campos nuevos son opcionales).

## 4. Back office (resumen de la auditoría)

| Módulo | Hay | Falta para un flujo completo |
|---|---|---|
| Productos | Variantes, opciones, estados (publicado/borrador/archivado), acciones masivas, colecciones, historial, importación, stock | Atributos filtrables por la tienda, precio de comparación por variante, edición en tabla |
| Pedidos | Tablero por estado, historial con búsqueda en el servidor, devoluciones, idempotencia | Incidencias por pedido, etiqueta de envío |
| Clientes | CRM con ficha, actividad, seguimientos, segmentos, consultas desde la tienda | Etiquetas libres y exportación |
| Marketing | Cupones con restricciones, campañas, suscriptores | Descuentos automáticos (sin cupón) |
| Contenido y SEO | SEO global y por página, canónica, JSON-LD de la tienda, dominio | Datos estructurados de producto en la ficha, sitemap con páginas |
| Analítica | Visitas, ventas por canal | Comparación entre períodos |
| Configuración | Datos, horarios, zonas, pagos, equipo | Impuestos (no aplica a monotributo; pendiente de decisión) |
