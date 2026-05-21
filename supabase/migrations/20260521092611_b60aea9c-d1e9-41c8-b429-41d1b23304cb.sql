
-- Categorías
CREATE TABLE public.marketplace_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  icono text,
  color text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_public_read" ON public.marketplace_categorias FOR SELECT USING (true);

-- Vendedor
CREATE TABLE public.vendedor_perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio_comercial text,
  payout_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  entrega_automatica boolean NOT NULL DEFAULT true,
  total_ventas int NOT NULL DEFAULT 0,
  total_productos int NOT NULL DEFAULT 0,
  rating_promedio numeric(3,2) NOT NULL DEFAULT 0,
  total_reviews int NOT NULL DEFAULT 0,
  verificado boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedor_perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendedor_public_read" ON public.vendedor_perfiles FOR SELECT USING (true);
CREATE POLICY "vendedor_self_insert" ON public.vendedor_perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "vendedor_self_update" ON public.vendedor_perfiles FOR UPDATE USING (auth.uid() = id);

-- Productos
CREATE TABLE public.marketplace_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.marketplace_categorias(id),
  titulo text NOT NULL,
  slug text NOT NULL UNIQUE,
  descripcion text NOT NULL,
  resumen text,
  tipo text NOT NULL DEFAULT 'archivo',
  precio numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  portada_url text,
  galeria jsonb NOT NULL DEFAULT '[]'::jsonb,
  demo_url text,
  tags text[],
  estado text NOT NULL DEFAULT 'activo',
  destacado boolean NOT NULL DEFAULT false,
  total_ventas int NOT NULL DEFAULT 0,
  total_vistas int NOT NULL DEFAULT 0,
  rating_promedio numeric(3,2) NOT NULL DEFAULT 0,
  total_reviews int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_productos_vendedor ON public.marketplace_productos(vendedor_id);
CREATE INDEX idx_mp_productos_categoria ON public.marketplace_productos(categoria_id);
CREATE INDEX idx_mp_productos_estado ON public.marketplace_productos(estado);
ALTER TABLE public.marketplace_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "productos_public_read" ON public.marketplace_productos FOR SELECT USING (estado = 'activo' OR auth.uid() = vendedor_id);
CREATE POLICY "productos_vendedor_insert" ON public.marketplace_productos FOR INSERT WITH CHECK (auth.uid() = vendedor_id);
CREATE POLICY "productos_vendedor_update" ON public.marketplace_productos FOR UPDATE USING (auth.uid() = vendedor_id);
CREATE POLICY "productos_vendedor_delete" ON public.marketplace_productos FOR DELETE USING (auth.uid() = vendedor_id);

-- Órdenes (antes que archivos porque archivos referencia esta tabla en su RLS)
CREATE TABLE public.marketplace_ordenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comprador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.marketplace_productos(id),
  monto numeric(12,2) NOT NULL,
  moneda text NOT NULL,
  metodo_pago text NOT NULL,
  payment_link text,
  estado text NOT NULL DEFAULT 'pendiente',
  comprador_nota text,
  vendedor_nota text,
  token_descarga uuid DEFAULT gen_random_uuid(),
  pagada_at timestamptz,
  entregada_at timestamptz,
  cancelada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_ordenes_comprador ON public.marketplace_ordenes(comprador_id);
CREATE INDEX idx_mp_ordenes_vendedor ON public.marketplace_ordenes(vendedor_id);
CREATE INDEX idx_mp_ordenes_producto ON public.marketplace_ordenes(producto_id);
ALTER TABLE public.marketplace_ordenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ordenes_partes_read" ON public.marketplace_ordenes FOR SELECT USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id);
CREATE POLICY "ordenes_comprador_insert" ON public.marketplace_ordenes FOR INSERT WITH CHECK (auth.uid() = comprador_id);
CREATE POLICY "ordenes_partes_update" ON public.marketplace_ordenes FOR UPDATE USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id);

-- Archivos privados
CREATE TABLE public.marketplace_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.marketplace_productos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint,
  mime_type text,
  contenido_externo text,
  tipo text NOT NULL DEFAULT 'archivo',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archivos_vendedor_all" ON public.marketplace_archivos FOR ALL
  USING (auth.uid() = (SELECT vendedor_id FROM public.marketplace_productos WHERE id = producto_id))
  WITH CHECK (auth.uid() = (SELECT vendedor_id FROM public.marketplace_productos WHERE id = producto_id));
CREATE POLICY "archivos_comprador_read" ON public.marketplace_archivos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketplace_ordenes o WHERE o.producto_id = marketplace_archivos.producto_id AND o.comprador_id = auth.uid() AND o.estado IN ('pagada','entregada')));

-- Reviews
CREATE TABLE public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_ordenes(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.marketplace_productos(id) ON DELETE CASCADE,
  comprador_id uuid NOT NULL REFERENCES auth.users(id),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario text,
  respuesta_vendedor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.marketplace_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_comprador_insert" ON public.marketplace_reviews FOR INSERT WITH CHECK (auth.uid() = comprador_id);
CREATE POLICY "reviews_partes_update" ON public.marketplace_reviews FOR UPDATE USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id);

-- Favoritos
CREATE TABLE public.marketplace_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.marketplace_productos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, producto_id)
);
ALTER TABLE public.marketplace_favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_self_all" ON public.marketplace_favoritos FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- Triggers updated_at
CREATE TRIGGER trg_mp_productos_updated BEFORE UPDATE ON public.marketplace_productos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mp_ordenes_updated BEFORE UPDATE ON public.marketplace_ordenes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mp_vendedor_updated BEFORE UPDATE ON public.vendedor_perfiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rating
CREATE OR REPLACE FUNCTION public.update_producto_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_productos SET
    rating_promedio = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.marketplace_reviews WHERE producto_id = COALESCE(NEW.producto_id, OLD.producto_id)),0),
    total_reviews = (SELECT COUNT(*) FROM public.marketplace_reviews WHERE producto_id = COALESCE(NEW.producto_id, OLD.producto_id))
  WHERE id = COALESCE(NEW.producto_id, OLD.producto_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_mp_review_rating AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_producto_rating();

-- Contador ventas al pagar
CREATE OR REPLACE FUNCTION public.update_ventas_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.estado <> 'pagada' AND NEW.estado = 'pagada' THEN
    UPDATE public.marketplace_productos SET total_ventas = total_ventas + 1 WHERE id = NEW.producto_id;
    UPDATE public.vendedor_perfiles SET total_ventas = total_ventas + 1 WHERE id = NEW.vendedor_id;
    NEW.pagada_at = now();
    INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, texto)
    VALUES (NEW.comprador_id, NEW.vendedor_id, 'nuevo_mensaje', 'Tu compra fue confirmada. Ya podés descargarla.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mp_ordenes_pagada BEFORE UPDATE ON public.marketplace_ordenes
  FOR EACH ROW EXECUTE FUNCTION public.update_ventas_count();

-- Notif nueva orden
CREATE OR REPLACE FUNCTION public.notify_nueva_orden()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificaciones (perfil_id, origen_id, tipo, texto)
  VALUES (NEW.vendedor_id, NEW.comprador_id, 'nuevo_mensaje', 'Tenés una nueva orden pendiente.');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mp_nueva_orden AFTER INSERT ON public.marketplace_ordenes
  FOR EACH ROW EXECUTE FUNCTION public.notify_nueva_orden();

-- Contador productos por vendedor
CREATE OR REPLACE FUNCTION public.update_vendedor_productos_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.vendedor_perfiles (id, total_productos) VALUES (NEW.vendedor_id, 1)
    ON CONFLICT (id) DO UPDATE SET total_productos = vendedor_perfiles.total_productos + 1;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.vendedor_perfiles SET total_productos = GREATEST(total_productos-1, 0) WHERE id = OLD.vendedor_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_mp_vendedor_count AFTER INSERT OR DELETE ON public.marketplace_productos
  FOR EACH ROW EXECUTE FUNCTION public.update_vendedor_productos_count();

-- Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace-portadas','marketplace-portadas', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace-archivos','marketplace-archivos', false) ON CONFLICT DO NOTHING;

CREATE POLICY "mp_portadas_read" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace-portadas');
CREATE POLICY "mp_portadas_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketplace-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp_portadas_update" ON storage.objects FOR UPDATE USING (bucket_id = 'marketplace-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp_portadas_delete" ON storage.objects FOR DELETE USING (bucket_id = 'marketplace-portadas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "mp_archivos_vendedor_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketplace-archivos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp_archivos_vendedor_read" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace-archivos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp_archivos_vendedor_delete" ON storage.objects FOR DELETE USING (bucket_id = 'marketplace-archivos' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO public.marketplace_categorias (nombre, slug, icono, color, orden) VALUES
  ('Diseño','diseno','Palette','#FD5F35',1),
  ('Código & Plantillas','codigo','Code','#3b82f6',2),
  ('IA & Automatización','ia','Sparkles','#8b5cf6',3),
  ('Cursos & Tutoriales','cursos','GraduationCap','#10b981',4),
  ('Webs & Landings','webs','Globe','#0ea5e9',5),
  ('Servicios','servicios','Briefcase','#f59e0b',6),
  ('Software & Licencias','software','Package','#6366f1',7),
  ('Marketing','marketing','TrendingUp','#ec4899',8),
  ('Audio & Música','audio','Music','#14b8a6',9),
  ('Video & Motion','video','Film','#ef4444',10),
  ('Fotos & Stock','fotos','Image','#84cc16',11),
  ('Ebooks & Guías','ebooks','BookOpen','#a855f7',12);
