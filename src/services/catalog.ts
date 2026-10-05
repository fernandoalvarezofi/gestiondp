import { CartStore } from "@/contexts/CartContext";
import { COMERCIO_COLS, db, DeliveryProduct, DeliveryStore, productSelect } from "@/lib/delivery";

export type ProductoConComercio = { product: DeliveryProduct; store: DeliveryStore };

/** Trae productos (con opciones y variantes) y su comercio, en el mismo orden de los identificadores pedidos. Descarta lo que ya no existe. */
export async function fetchProductosConComercio(ids: string[]): Promise<ProductoConComercio[]> {
  const unicos = [...new Set(ids)].slice(0, 200);
  if (unicos.length === 0) return [];
  const { data: prods } = await db.from("delivery_productos").select(productSelect).in("id", unicos);
  const productos = (prods ?? []) as DeliveryProduct[];
  const storeIds = [...new Set(productos.map((p) => p.comercio_id))];
  const { data: coms } = storeIds.length ? await db.from("delivery_comercios").select(COMERCIO_COLS).in("id", storeIds) : { data: [] };
  const porId = new Map(productos.map((p) => [p.id, p]));
  const porStore = new Map(((coms ?? []) as DeliveryStore[]).map((s) => [s.id, s]));
  return unicos.flatMap((id) => { const product = porId.get(id); const store = product && porStore.get(product.comercio_id); return product && store ? [{ product, store }] : []; });
}

export const cartStoreDe = (s: DeliveryStore): CartStore => ({ id: s.id, nombre: s.nombre, slug: s.slug, costo_envio: s.costo_envio, pedido_minimo: s.pedido_minimo, envio_gratis_desde: s.envio_gratis_desde, imagen_url: s.imagen_url });
