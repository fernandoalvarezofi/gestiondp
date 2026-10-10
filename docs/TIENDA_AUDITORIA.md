# Mi tienda: auditoría, arquitectura y estado

Actualizado: 2026-10-10. Referentes usados como criterio: WordPress/Gutenberg (edición y contenido), constructores visuales (estilos por
sección), Shopify y Tiendanube (temas, secciones, plantillas, administración) y WooCommerce (relación catálogo ↔ contenido).

## 1. Problemas estructurales encontrados

| # | Problema | Consecuencia | Estado |
|---|----------|--------------|--------|
| E1 | El esquema de cada bloque estaba escrito cuatro veces (tipo TS, `normalizeBloque`, `_ts_bloque_v1` en SQL, `switch` del render) y el validador SQL descartaba toda propiedad que no conocía. | Ninguna propiedad común (fondo, márgenes, visibilidad) era posible sin tocar cada tipo. | Resuelto: contrato común `est` validado una vez en TS (`storefrontSecciones.ts`) y en SQL (`_ts_estilo`), aplicado por un único marco en el render. |
| E2 | No existía estilo de sección: fondo, espaciado, ancho y alineación estaban fijos en el código de cada bloque. | Solo se podían cambiar textos y colores. | Resuelto. |
| E3 | Inicio y páginas eran dos sistemas: las páginas se guardaban directo en línea, sin borrador ni versiones, con otro editor. | Editar una página publicada cambiaba la web en el acto; restaurar no reponía páginas. | Resuelto: borrador por página, publicación y versiones del sitio completo. |
| E4 | "Usar este tema" reemplazaba todos los bloques del inicio. | Cambiar de tema borraba contenido. | Resuelto: el tema cambia el sistema de diseño; reemplazar el inicio es opcional. |
| E5 | Encabezado y pie no eran editables. | Sin control de navegación secundaria ni comportamiento del encabezado. | Resuelto: encabezado fijo/transparente, menú, anuncio, buscador; pie con 3 columnas de enlaces. |
| E6 | Cada bloque tenía su propio tipo de enlace (3 o 4 destinos). | Botones inconsistentes, sin enlazar páginas, colecciones ni secciones. | Resuelto en el bloque nuevo `contenido` (destinos unificados). Los bloques viejos conservan su enlace propio. |
| E7 | Sin secciones reutilizables ni patrones. | Rehacer lo mismo en cada página. | Resuelto. |
| E8 | Sin controles por dispositivo. | No se podía ajustar el celular. | Resuelto: visibilidad por dispositivo en toda sección; columnas en celular en productos y galería. |
| E9 | Historial de edición solo del inicio. | Pérdida de cambios en páginas. | Resuelto: un solo historial para todo el sitio. |
| E10 | Tokens de diseño mínimos y aplicados a mano en cada bloque. | Los temas solo diferían en la portada. | Resuelto: superficie, estilo de tarjeta, escala/peso/mayúsculas de títulos, volcados a las variables de color de la app. |
| E11 | La ficha de producto tenía su propio encabezado simplificado, sin menú, buscador ni pie, y una estructura fija. | Navegación inconsistente; sin plantilla de producto. | Resuelto: la ficha usa el encabezado y pie del sitio y una plantilla de secciones editable. |
| E12 | El carrito validaba cupones sin mandar los productos. | En cupones por sección/producto el total mostrado podía diferir del cobrado. | Resuelto. |

## 2. Matriz de capacidades del constructor (estado verificado)

| Capacidad | Estado | Cómo se verifica |
|---|---|---|
| Estilo común por sección (fondo color/oscuro/marca/foto, márgenes 0–6, ancho, alineación, dispositivo, ancla) | Operativo | `storefrontSecciones.test.ts`, SQL `026`, E2E editor |
| Editor a pantalla completa: estructura (estilos globales, páginas, encabezado, secciones, pie), lienzo real por dispositivo, propiedades Contenido/Estilo | Operativo | E2E escritorio y celular |
| Selección desde la vista previa, arrastrar para ordenar, duplicar, copiar/pegar entre páginas, atajos de teclado, deshacer/rehacer | Operativo | E2E (deshacer/rehacer) |
| Páginas con borrador, visibles/ocultas, publicación del sitio completo en una transacción | Operativo | SQL `026`, E2E |
| Versiones del sitio completo (tema + páginas); restaurar como borrador | Operativo | SQL `026` |
| El público no puede leer borradores | Operativo | SQL `026` (permiso de columna) |
| Bloque de contenido flexible (antetítulo, título h1/h2/h3, texto con formato, imagen en 3 posiciones y 4 formas, 2 botones con destino) | Operativo | tests, E2E |
| Patrones de fábrica (12) y Mis secciones (guardadas por tienda) | Operativo | tests, SQL `026` |
| Temas como sistemas de diseño sin borrar contenido | Operativo | E2E |
| Encabezado fijo/transparente y columnas de pie | Operativo | SQL `026`, E2E |
| Plantilla de ficha de producto (secciones bajo cada producto, hasta 12) | Operativo | E2E ficha |
| Edición de texto directamente sobre el lienzo | Pendiente | — |
| Contenedores anidados libres (filas/columnas arbitrarias) | Pendiente (decisión: `columnas` + `contenido` cubren lo común sin romper el celular) | — |
| Plantillas por colección / por página de búsqueda | Pendiente | — |
| Destinos unificados en los bloques viejos (banner, oferta, imagen con texto) | Pendiente | — |

## 3. Arquitectura

```
Editor (MerchantStorefront + builder/SiteEditor)
  └─ estado único del sitio (useSitio): { tema, paginas[] } con historial y autoguardado por partes
       ├─ tema   → tienda_borrador_guardar (diseño, inicio, encabezado, pie, plantilla de producto)
       └─ página → tienda_pagina_borrador_guardar (borrador por página; las nuevas nacen ocultas)
Publicar → tienda_publicar: valida (delivery_guardar_tienda_tema + _tp_validar), aplica tema y páginas, versiona ambos
Esquema → lib/storefront.ts + lib/storefrontSecciones.ts  ≡  SQL _ts_bloque + _ts_estilo + _ts_destino + _ts_botones
Render  → StorefrontView: un marco por sección aplica `est`; la ficha de producto entra como `principal`
Datos públicos → hooks/useTiendaPublica (una sola carga para inicio, páginas y ficha)
```

## 4. Back office (auditoría y cambios)

| Módulo | Había | Cambiado ahora | Brecha que queda |
|---|---|---|---|
| Productos | Variantes, opciones, estados, acciones masivas, colecciones, historial, importación/exportación, stock | Edición rápida en tabla (precio, precio anterior, stock, disponibilidad, estado; productos y variantes) con validación por celda y guardado transaccional; stock con historial (SQL `027`) | Atributos filtrables en la tienda |
| Marketing | Cupones con mínimo, tope, vigencia, usos, alcance | Descuentos automáticos (sin código, el mejor vigente, alcance por secciones, fecha de inicio); la liquidación los carga al comercio (SQL `028`) | Combinación de descuentos, “lleve 2 pague 1” |
| Pedidos | Tablero por estado, historial con búsqueda en el servidor, devoluciones, idempotencia | — | Incidencias por pedido, etiqueta de envío |
| Clientes | CRM con ficha, actividad, seguimientos, segmentos, etiquetas, consultas desde la tienda | — | Exportación |
| Analítica | Comparación con el período anterior, ventas por canal, horas pico, productos | — | Embudo de la tienda online (visitas → carrito → compra) |
| Contenido y SEO | SEO global y por página, canónica, JSON-LD de tienda y producto, dominio | — | Sitemap con páginas propias |
