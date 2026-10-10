-- Mi tienda v2: el borrador de las páginas no se publica. Se aplica después de que el front lee las páginas del editor por RPC.
revoke select on public.delivery_tienda_paginas from anon, authenticated;
grant select (id, comercio_id, tipo, clase, slug, titulo, contenido, bloques, estado, seo_titulo, seo_descripcion, imagen_url, orden, publicada_at, updated_at, created_at)
  on public.delivery_tienda_paginas to anon, authenticated;
