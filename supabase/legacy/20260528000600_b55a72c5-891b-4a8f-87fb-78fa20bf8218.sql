ALTER TABLE public.marketplace_productos
  ADD CONSTRAINT marketplace_productos_vendedor_perfil_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.perfiles(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_ordenes
  ADD CONSTRAINT marketplace_ordenes_comprador_perfil_fkey
  FOREIGN KEY (comprador_id) REFERENCES public.perfiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT marketplace_ordenes_vendedor_perfil_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.perfiles(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_reviews
  ADD CONSTRAINT marketplace_reviews_comprador_perfil_fkey
  FOREIGN KEY (comprador_id) REFERENCES public.perfiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT marketplace_reviews_vendedor_perfil_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.perfiles(id) ON DELETE CASCADE;