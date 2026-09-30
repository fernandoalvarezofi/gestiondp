CREATE TYPE public.delivery_categoria AS ENUM ('comida', 'supermercado', 'farmacia', 'tiendas');
CREATE TYPE public.delivery_estado_pedido AS ENUM ('pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado');

CREATE TABLE public.delivery_comercios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  categoria public.delivery_categoria NOT NULL,
  descripcion text,
  direccion text NOT NULL,
  imagen_url text,
  logo_url text,
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  tiempo_min integer NOT NULL DEFAULT 20,
  tiempo_max integer NOT NULL DEFAULT 35,
  costo_envio numeric(12,2) NOT NULL DEFAULT 0,
  pedido_minimo numeric(12,2) NOT NULL DEFAULT 0,
  esta_abierto boolean NOT NULL DEFAULT true,
  destacado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_comercios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_comercios TO authenticated;
GRANT ALL ON public.delivery_comercios TO service_role;
ALTER TABLE public.delivery_comercios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comercios visibles para todos" ON public.delivery_comercios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Propietarios crean comercios" ON public.delivery_comercios FOR INSERT TO authenticated WITH CHECK (propietario_id = auth.uid());
CREATE POLICY "Propietarios actualizan comercios" ON public.delivery_comercios FOR UPDATE TO authenticated USING (propietario_id = auth.uid()) WITH CHECK (propietario_id = auth.uid());
CREATE POLICY "Propietarios eliminan comercios" ON public.delivery_comercios FOR DELETE TO authenticated USING (propietario_id = auth.uid());

CREATE TABLE public.delivery_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  categoria text NOT NULL DEFAULT 'Destacados',
  imagen_url text,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  precio_anterior numeric(12,2),
  stock integer,
  disponible boolean NOT NULL DEFAULT true,
  destacado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_productos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_productos TO authenticated;
GRANT ALL ON public.delivery_productos TO service_role;
ALTER TABLE public.delivery_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Productos visibles para todos" ON public.delivery_productos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Propietarios crean productos" ON public.delivery_productos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
CREATE POLICY "Propietarios actualizan productos" ON public.delivery_productos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
CREATE POLICY "Propietarios eliminan productos" ON public.delivery_productos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));

CREATE TABLE public.delivery_direcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  alias text NOT NULL DEFAULT 'Casa',
  direccion text NOT NULL,
  detalle text,
  ciudad text NOT NULL DEFAULT 'Buenos Aires',
  latitud numeric(10,7),
  longitud numeric(10,7),
  instrucciones text,
  predeterminada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_direcciones TO authenticated;
GRANT ALL ON public.delivery_direcciones TO service_role;
ALTER TABLE public.delivery_direcciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus direcciones" ON public.delivery_direcciones FOR SELECT TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "Usuarios crean sus direcciones" ON public.delivery_direcciones FOR INSERT TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "Usuarios actualizan sus direcciones" ON public.delivery_direcciones FOR UPDATE TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "Usuarios eliminan sus direcciones" ON public.delivery_direcciones FOR DELETE TO authenticated USING (perfil_id = auth.uid());

CREATE TABLE public.delivery_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  comercio_id uuid NOT NULL REFERENCES public.delivery_comercios(id) ON DELETE RESTRICT,
  direccion_id uuid REFERENCES public.delivery_direcciones(id) ON DELETE SET NULL,
  direccion_entrega text NOT NULL,
  estado public.delivery_estado_pedido NOT NULL DEFAULT 'pendiente',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  costo_envio numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  metodo_pago text NOT NULL DEFAULT 'efectivo',
  notas text,
  entrega_estimada timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_pedidos TO authenticated;
GRANT ALL ON public.delivery_pedidos TO service_role;
ALTER TABLE public.delivery_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes ven sus pedidos" ON public.delivery_pedidos FOR SELECT TO authenticated USING (cliente_id = auth.uid());
CREATE POLICY "Comercios ven pedidos recibidos" ON public.delivery_pedidos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
CREATE POLICY "Clientes crean pedidos" ON public.delivery_pedidos FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "Clientes cancelan pendientes" ON public.delivery_pedidos FOR UPDATE TO authenticated USING (cliente_id = auth.uid() AND estado = 'pendiente') WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "Comercios actualizan pedidos" ON public.delivery_pedidos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));

CREATE TABLE public.delivery_pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.delivery_pedidos(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.delivery_productos(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_pedido_items TO authenticated;
GRANT ALL ON public.delivery_pedido_items TO service_role;
ALTER TABLE public.delivery_pedido_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes ven items de sus pedidos" ON public.delivery_pedido_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.id = pedido_id AND p.cliente_id = auth.uid()));
CREATE POLICY "Comercios ven items recibidos" ON public.delivery_pedido_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_pedidos p JOIN public.delivery_comercios c ON c.id = p.comercio_id WHERE p.id = pedido_id AND c.propietario_id = auth.uid()));
CREATE POLICY "Clientes agregan items a sus pedidos" ON public.delivery_pedido_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_pedidos p WHERE p.id = pedido_id AND p.cliente_id = auth.uid() AND p.estado = 'pendiente'));

CREATE INDEX delivery_comercios_categoria_idx ON public.delivery_comercios(categoria, esta_abierto);
CREATE INDEX delivery_productos_comercio_idx ON public.delivery_productos(comercio_id, disponible);
CREATE INDEX delivery_pedidos_cliente_idx ON public.delivery_pedidos(cliente_id, created_at DESC);
CREATE INDEX delivery_pedidos_comercio_idx ON public.delivery_pedidos(comercio_id, created_at DESC);
CREATE INDEX delivery_pedido_items_pedido_idx ON public.delivery_pedido_items(pedido_id);

CREATE TRIGGER delivery_comercios_updated_at BEFORE UPDATE ON public.delivery_comercios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER delivery_productos_updated_at BEFORE UPDATE ON public.delivery_productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER delivery_direcciones_updated_at BEFORE UPDATE ON public.delivery_direcciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER delivery_pedidos_updated_at BEFORE UPDATE ON public.delivery_pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.delivery_comercios (nombre, slug, categoria, descripcion, direccion, imagen_url, rating, tiempo_min, tiempo_max, costo_envio, pedido_minimo, destacado) VALUES
('La Esquina Burger', 'la-esquina-burger', 'comida', 'Hamburguesas artesanales, papas y combos.', 'Av. Corrientes 1847, CABA', '/delivery/burger.jpg', 4.8, 20, 30, 1290, 6000, true),
('Pizzería San Telmo', 'pizzeria-san-telmo', 'comida', 'Pizza porteña al molde y empanadas.', 'Defensa 742, CABA', '/delivery/pizza.jpg', 4.7, 25, 40, 990, 5000, true),
('Mercado Fresco', 'mercado-fresco', 'supermercado', 'Almacén, frescos y compras para toda la semana.', 'Av. Santa Fe 3250, CABA', '/delivery/market.jpg', 4.6, 30, 50, 1490, 10000, true),
('Farmacia Central 24h', 'farmacia-central-24h', 'farmacia', 'Cuidado personal, farmacia y bienestar.', 'Av. Rivadavia 2450, CABA', '/delivery/pharmacy.jpg', 4.9, 15, 25, 790, 3000, true),
('Casa & Más', 'casa-y-mas', 'tiendas', 'Artículos para el hogar, librería y regalos.', 'Thames 1682, CABA', '/delivery/store.jpg', 4.5, 35, 55, 1590, 7000, false);

INSERT INTO public.delivery_productos (comercio_id, nombre, descripcion, categoria, imagen_url, precio, precio_anterior, destacado)
SELECT id, 'Combo Doble', 'Doble carne, cheddar, papas y bebida.', 'Combos', '/delivery/burger-product.jpg', 10900, 13500, true FROM public.delivery_comercios WHERE slug = 'la-esquina-burger'
UNION ALL SELECT id, 'Clásica completa', 'Carne, cheddar, lechuga, tomate y salsa especial.', 'Hamburguesas', '/delivery/classic-burger.jpg', 7600, NULL, false FROM public.delivery_comercios WHERE slug = 'la-esquina-burger'
UNION ALL SELECT id, 'Papas con cheddar', 'Papas crocantes, cheddar y verdeo.', 'Acompañamientos', '/delivery/fries.jpg', 4900, NULL, false FROM public.delivery_comercios WHERE slug = 'la-esquina-burger'
UNION ALL SELECT id, 'Pizza grande de muzzarella', 'Salsa de tomate, muzzarella y aceitunas.', 'Pizzas', '/delivery/pizza-product.jpg', 12500, NULL, true FROM public.delivery_comercios WHERE slug = 'pizzeria-san-telmo'
UNION ALL SELECT id, 'Docena de empanadas', 'Sabores surtidos a elección.', 'Empanadas', '/delivery/empanadas.jpg', 16800, 19000, true FROM public.delivery_comercios WHERE slug = 'pizzeria-san-telmo'
UNION ALL SELECT id, 'Canasta de frutas', 'Selección de frutas frescas de estación.', 'Frutas y verduras', '/delivery/fruit.jpg', 8900, NULL, true FROM public.delivery_comercios WHERE slug = 'mercado-fresco'
UNION ALL SELECT id, 'Leche entera 1L', 'Leche larga vida.', 'Lácteos', '/delivery/milk.jpg', 1750, NULL, false FROM public.delivery_comercios WHERE slug = 'mercado-fresco'
UNION ALL SELECT id, 'Protector solar FPS 50', 'Protección alta, resistente al agua.', 'Cuidado personal', '/delivery/sunscreen.jpg', 14200, 16500, true FROM public.delivery_comercios WHERE slug = 'farmacia-central-24h'
UNION ALL SELECT id, 'Kit de primeros auxilios', 'Elementos esenciales para el hogar.', 'Salud', '/delivery/first-aid.jpg', 9800, NULL, false FROM public.delivery_comercios WHERE slug = 'farmacia-central-24h'
UNION ALL SELECT id, 'Set de mate', 'Mate, bombilla y yerbera.', 'Regalos', '/delivery/mate.jpg', 18500, NULL, true FROM public.delivery_comercios WHERE slug = 'casa-y-mas';