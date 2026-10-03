import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Resumen del pedido a la derecha del menú (solo en pantallas anchas): se ve qué se lleva y cuánto falta para el mínimo. */
export function StoreCartPanel({ storeId, storeName, minimum, className }: { storeId: string; storeName: string; minimum: number; className?: string }) {
  const { store, items, subtotal, updateQuantity } = useCart();
  const mine = store?.id === storeId ? items : [];
  const other = store && store.id !== storeId && items.length > 0 ? store : null;
  const missing = Math.max(minimum - subtotal, 0);

  return (
    <aside aria-label="Tu pedido" className={cn("rounded-3xl border bg-card p-4 shadow-soft", className)}>
      <h2 className="flex items-center gap-2 text-lg font-black"><ShoppingBag className="h-5 w-5 text-primary" />Tu pedido</h2>
      {other && <p className="mt-2 rounded-xl bg-warning/15 p-2.5 text-xs font-semibold">Tenés productos de <Link to={`/app/tienda/${other.slug}`} className="font-extrabold underline">{other.nombre}</Link>. Si agregás algo de {storeName}, se reemplazan.</p>}
      {mine.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Todavía no agregaste nada. Tocá el <span className="font-bold text-primary">+</span> de un producto para empezar.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y">
            {mine.map((item) => (
              <li key={item.lineId} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.nombre}</p>
                  {item.opciones.length > 0 && <p className="truncate text-xs text-muted-foreground">{item.opciones.map((option) => option.nombre).join(", ")}</p>}
                  <p className="text-sm font-extrabold">{money(item.precio * item.cantidad)}</p>
                </div>
                <div className="flex shrink-0 items-center rounded-full border">
                  <button type="button" aria-label={`Quitar uno de ${item.nombre}`} onClick={() => updateQuantity(item.lineId, item.cantidad - 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="min-w-5 text-center text-sm font-extrabold tabular-nums">{item.cantidad}</span>
                  <button type="button" aria-label={`Agregar uno de ${item.nombre}`} onClick={() => updateQuantity(item.lineId, item.cantidad + 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t pt-3 text-sm"><span className="font-semibold text-muted-foreground">Subtotal</span><span className="font-display text-lg font-black">{money(subtotal)}</span></div>
          {missing > 0 && <p className="mt-2 rounded-xl bg-warning/15 p-2.5 text-xs font-semibold">Te faltan {money(missing)} para el pedido mínimo.</p>}
          <Link to="/app/carrito" className="mt-3 flex h-12 items-center justify-center rounded-full bg-primary text-[15px] font-extrabold text-primary-foreground shadow-pop transition-transform active:scale-[0.99]">Ir a pagar</Link>
        </>
      )}
    </aside>
  );
}
