-- Los comercios de ejemplo pasan de Buenos Aires capital a Lincoln, Buenos Aires (donde opera Woref).
-- Son datos de prueba: las direcciones son de ejemplo y se reemplazan cuando se sumen comercios reales.
UPDATE public.delivery_comercios c SET
  direccion = v.direccion, latitud = v.lat, longitud = v.lng,
  radio_entrega_km = v.radio, costo_por_km = 150
FROM (VALUES
  ('bebidas-ya', 'Av. Massey 850, Lincoln, Buenos Aires', -34.8650, -61.5290, 6),
  ('brunch-club', 'Mitre 410, Lincoln, Buenos Aires', -34.8672, -61.5338, 6),
  ('cafe-nomade', 'Rivadavia 120, Lincoln, Buenos Aires', -34.8661, -61.5322, 6),
  ('casa-y-mas', 'Belgrano 560, Lincoln, Buenos Aires', -34.8690, -61.5360, 6),
  ('farma-vida', 'Av. Massey 1320, Lincoln, Buenos Aires', -34.8630, -61.5260, 4),
  ('farmacia-central-24h', 'Mitre 95, Lincoln, Buenos Aires', -34.8664, -61.5329, 6),
  ('helados-polar', 'Rivadavia 640, Lincoln, Buenos Aires', -34.8700, -61.5390, 4),
  ('la-esquina-burger', '25 de Mayo 300, Lincoln, Buenos Aires', -34.8655, -61.5345, 6),
  ('la-nonna-pastas', 'Sarmiento 240, Lincoln, Buenos Aires', -34.8680, -61.5310, 6),
  ('mercado-fresco', 'Av. Massey 560, Lincoln, Buenos Aires', -34.8640, -61.5310, 6),
  ('moda-urbana', 'Mitre 270, Lincoln, Buenos Aires', -34.8669, -61.5336, 6),
  ('parrilla-don-ramon', 'Alberdi 780, Lincoln, Buenos Aires', -34.8710, -61.5300, 6),
  ('pizzeria-san-telmo', 'Belgrano 150, Lincoln, Buenos Aires', -34.8676, -61.5350, 6),
  ('pollo-crocante', 'Cochrane 430, Lincoln, Buenos Aires', -34.8700, -61.5340, 6),
  ('sandwich-lab', 'Rivadavia 330, Lincoln, Buenos Aires', -34.8665, -61.5355, 6),
  ('super-ahorro-express', 'Av. Massey 100, Lincoln, Buenos Aires', -34.8660, -61.5330, 6),
  ('sushi-club-palermo', 'Alsina 220, Lincoln, Buenos Aires', -34.8686, -61.5330, 6),
  ('verde-bowl', 'Moreno 90, Lincoln, Buenos Aires', -34.8650, -61.5370, 6)
) AS v(slug, direccion, lat, lng, radio)
WHERE c.slug = v.slug AND c.propietario_id IS NULL;

-- Nombres que hacían referencia a barrios de Buenos Aires capital.
UPDATE public.delivery_comercios SET nombre = 'Pizzería La Plaza' WHERE slug = 'pizzeria-san-telmo' AND propietario_id IS NULL;
UPDATE public.delivery_comercios SET nombre = 'Sushi Club' WHERE slug = 'sushi-club-palermo' AND propietario_id IS NULL;
