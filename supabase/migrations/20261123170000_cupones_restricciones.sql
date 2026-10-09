-- Cupones: reglas que antes solo validaba el formulario. Con la API directa se podía crear un 150 % o un mínimo negativo.
-- Se verificó que ningún cupón existente las viola.
alter table public.delivery_cupones
  add constraint delivery_cupones_porcentaje_max check (tipo <> 'porcentaje' or valor <= 100),
  add constraint delivery_cupones_tope_min check (tope is null or tope >= 0),
  add constraint delivery_cupones_minimo_min check (minimo is null or minimo >= 0),
  add constraint delivery_cupones_usos_max_min check (usos_max is null or usos_max >= 1),
  add constraint delivery_cupones_vigencia check (inicia_at is null or vence_at is null or vence_at > inicia_at);
-- El stock de un producto no puede quedar negativo (las variantes ya lo exigían). Si dos ventas simultáneas compiten por la
-- última unidad, la segunda falla en vez de vender algo que no existe. Se verificó que no hay productos en negativo.
alter table public.delivery_productos add constraint delivery_productos_stock_no_negativo check (stock is null or stock >= 0);
