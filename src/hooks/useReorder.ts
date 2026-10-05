import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { COMERCIO_COLS, db, DeliveryOrder, DeliveryProduct, productSelect, sortGroups } from "@/lib/delivery";

/** Vuelve a cargar en el carrito los productos de un pedido anterior que sigan disponibles, con sus opciones. */
export function useReorder() {
  const { replaceCart } = useCart();
  return async (order: DeliveryOrder) => {
    const [{ data: store }, { data: products }] = await Promise.all([
      db.from("delivery_comercios").select(COMERCIO_COLS).eq("id", order.comercio_id).maybeSingle(),
      db.from("delivery_productos").select(productSelect).eq("comercio_id", order.comercio_id).eq("disponible", true),
    ]);
    if (!store) return toast.error("El comercio ya no está disponible");
    let skippedOptions = false;
    const lines = (order.items || []).flatMap((item) => {
      const product = ((products || []) as DeliveryProduct[]).find((candidate) => candidate.nombre === item.nombre);
      if (!product) return [];
      // Solo se repiten opciones que siguen existiendo y disponibles; si faltan, el cliente las vuelve a elegir.
      const available = new Map(sortGroups(product.grupos).flatMap((group) => group.opciones.filter((option) => option.disponible).map((option) => [option.id, { id: option.id, grupo: group.nombre, nombre: option.nombre, precio: Number(option.precio_extra) }] as const)));
      const opciones = (item.opciones || []).flatMap((option) => (available.has(option.id) ? [available.get(option.id)!] : []));
      if (opciones.length !== (item.opciones || []).length) skippedOptions = true;
      return [{ product, cantidad: item.cantidad, notas: item.notas || undefined, opciones }];
    });
    if (!lines.length) return toast.error("Los productos de este pedido ya no están disponibles");
    const ok = replaceCart({ id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url }, lines);
    if (!ok) return toast.error("Tu carrito ya tiene 5 comercios. Terminá o quitá uno para sumar otro.");
    toast.success(skippedOptions ? "Agregamos tu pedido al carrito. Algunas opciones cambiaron: revisalas." : "Agregamos los productos a tu carrito");
    return true;
  };
}
