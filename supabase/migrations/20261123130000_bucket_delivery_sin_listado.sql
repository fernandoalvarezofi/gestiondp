-- Bucket público "delivery" (fotos de productos, tiendas y perfiles): las imágenes se sirven por URL pública sin pasar por RLS,
-- así que la política de lectura solo habilitaba LISTAR el bucket entero vía API (lo que expone los ids de usuario de cada carpeta).
-- Se reemplaza por lectura de la carpeta propia, que es lo que necesita storage.remove() para borrar las fotos de uno.
drop policy if exists "Fotos delivery visibles" on storage.objects;
create policy "Fotos delivery: cada uno lista su carpeta" on storage.objects for select
  using (bucket_id = 'delivery' and (storage.foldername(name))[1] = (select auth.uid())::text);
