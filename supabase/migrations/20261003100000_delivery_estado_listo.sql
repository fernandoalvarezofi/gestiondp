-- Etapa 6 (parte 1): nuevo estado "listo" (pedido listo para retirar en el local).
ALTER TYPE public.delivery_estado_pedido ADD VALUE IF NOT EXISTS 'listo' AFTER 'preparando';
