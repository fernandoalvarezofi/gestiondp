-- Preferencias de pedido de cada cliente: se aplican solas al armar el pedido.
ALTER TABLE public.delivery_preferencias
  ADD COLUMN IF NOT EXISTS pago_preferido text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS propina_default integer NOT NULL DEFAULT 500 CHECK (propina_default BETWEEN 0 AND 5000),
  ADD COLUMN IF NOT EXISTS entrega_sin_contacto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrega_instrucciones text CHECK (entrega_instrucciones IS NULL OR char_length(entrega_instrucciones) <= 200);

ALTER TABLE public.delivery_preferencias DROP CONSTRAINT IF EXISTS delivery_preferencias_pago_preferido_check;
ALTER TABLE public.delivery_preferencias ADD CONSTRAINT delivery_preferencias_pago_preferido_check CHECK (pago_preferido IN ('auto', 'efectivo', 'mercadopago'));
