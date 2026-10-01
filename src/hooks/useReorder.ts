import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { db, DeliveryOrder } from "@/lib/delivery";

/** Vuelve a cargar en el carrito los productos de un pedido anterior que sigan disponibles. */
export function useReorder() {
  const { addItem, clearCart } = useCart();
  return async (order: DeliveryOrder) => {
    const [{ data: store }, { data: products }] = await Promise.all([
      db.from("delivery_comercios").select("*").eq("id", order.comercio_id).maybeSingle(),
      db.from("delivery_productos").select("*").eq("comercio_id", order.comercio_id).eq("disponible", true),
    ]);
    if (!store) return toast.error("El comercio ya no está disponible");
    clearCart();
    let added = 0;
    for (const item of order.items || []) {
      const product = (products || []).find((candidate: { nombre: string }) => candidate.nombre === item.nombre);
      if (!product) continue;
      addItem(product, { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde }, item.cantidad, item.notas || undefined);
      added += 1;
    }
    if (!added) return toast.error("Los productos de este pedido ya no están disponibles");
    toast.success("Agregamos los productos a tu carrito");
    return true;
  };
}
