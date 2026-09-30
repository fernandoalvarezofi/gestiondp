# Giro completo a plataforma de entregas

## Objetivo
Transformar Woref en una aplicación argentina de entregas con identidad propia, inspirada en la facilidad de uso de Rappi pero sin copiar su marca o interfaz.

## Primera versión funcional
- Reemplazar el inicio actual por un catálogo directo con ubicación, buscador, categorías, promociones y comercios cercanos.
- Incluir comida, supermercados, farmacias y tiendas.
- Crear navegación enfocada en Inicio, Buscar, Pedidos, Carrito y Perfil, adaptada a móvil y escritorio.
- Permitir abrir un comercio, explorar productos, agregar cantidades al carrito y confirmar un pedido.
- Añadir vistas de pedidos del cliente y un panel para que cada comercio gestione catálogo, disponibilidad y pedidos.
- Reutilizar cuentas y estructuras comerciales existentes cuando sean compatibles; los datos inmobiliarios y sociales no se borrarán en esta primera etapa para evitar pérdida de información.

## Diseño aprobado
- Coral `#FF5A4E`, fondo cálido `#FFF7F2`, verde profundo `#14332B` y blanco.
- Outfit en títulos y Figtree en textos.
- Inicio en grilla, tarjetas compactas, promociones visibles y comercios con foto, valoración, tiempo y costo de entrega.
- Movimiento breve y elástico, con reducción de movimiento respetada.

## Datos y seguridad
- Crear entidades específicas para comercios, categorías, productos, direcciones, carritos, pedidos y estados de pedido.
- Todos los usuarios autenticados podrán descubrir comercios y productos; cada cliente controlará sus direcciones y pedidos; cada comercio controlará únicamente su catálogo y sus pedidos.
- Mantener roles separados y validación del lado del servidor para la administración comercial.

## Verificación
- Probar el recorrido completo: descubrir comercio → agregar productos → revisar carrito → crear pedido → verlo en pedidos.
- Probar la gestión comercial básica.
- Revisar visualmente en móvil y escritorio, además de errores de compilación y consola.
