import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { SmartImage } from "@/components/delivery/SmartImage";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartItem, useCart } from "@/contexts/CartContext";
import { money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Cuánto falta para el envío gratis (null si la tienda no tiene esa promo) y qué porcentaje del camino se hizo. */
export function progresoEnvio(subtotal: number, envioGratisDesde: number | null | undefined): { falta: number; pct: number } | null {
  const meta = Number(envioGratisDesde);
  if (!Number.isFinite(meta) || meta <= 0) return null;
  const falta = Math.max(0, meta - subtotal);
  return { falta, pct: Math.min(100, Math.round((subtotal / meta) * 100)) };
}

const detalle = (item: CartItem) => item.opciones.map((o) => o.nombre).join(" · ");

/** Carrito lateral de la tienda: ver y ajustar el pedido sin salir de la página, con barra de progreso hacia el envío gratis. */
export function MiniCart({ storeId, envioGratisDesde, pedidoMinimo, trigger, style, scope }: { storeId: string; envioGratisDesde?: number | null; pedidoMinimo?: number | null; trigger: ReactNode; style?: React.CSSProperties; /** Variables de color de la tienda: el panel se dibuja fuera de ella y las necesita. */ scope?: React.CSSProperties }) {
  const { groupOf, groups, updateQuantity } = useCart();
  const { items: lineas, subtotal: total } = groupOf(storeId);
  const store = groups.find((g) => g.store.id === storeId)?.store ?? null;
  const unidades = lineas.reduce((n, i) => n + i.cantidad, 0);
  const envio = progresoEnvio(total, envioGratisDesde);
  const minimo = Number(pedidoMinimo) > 0 ? Math.max(0, Number(pedidoMinimo) - total) : 0;

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" style={scope}>
        <SheetHeader className="border-b p-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-xl font-extrabold"><ShoppingBag className="h-5 w-5" />Tu pedido</SheetTitle>
          <SheetDescription>{lineas.length ? `${unidades} ${unidades === 1 ? "producto" : "productos"} de ${store?.nombre}` : "Todavía no agregaste nada"}</SheetDescription>
        </SheetHeader>

        {envio && lineas.length > 0 && (
          <div className="border-b bg-muted/50 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4" />{envio.falta > 0 ? <>Sumá {money(envio.falta)} más y el envío es gratis</> : <>¡Tenés envío gratis!</>}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={envio.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso hacia el envío gratis">
              <div className={cn("h-full rounded-full transition-all", envio.falta > 0 ? "bg-foreground" : "bg-success")} style={{ width: `${envio.pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {lineas.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground"><ShoppingBag className="h-10 w-10" /><p className="font-semibold">Tu carrito está vacío</p></div>
          ) : (
            <ul className="divide-y">
              {lineas.map((item) => (
                <li key={item.lineId} className="flex gap-3 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><SmartImage src={item.imagen_url} width={160} alt="" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-snug">{item.nombre}</p>
                    {detalle(item) && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{detalle(item)}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border">
                        <button type="button" aria-label="Quitar uno" className="flex h-8 w-8 items-center justify-center" onClick={() => updateQuantity(item.lineId, item.cantidad - 1)}>{item.cantidad === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button>
                        <span className="w-6 text-center text-sm font-extrabold tabular-nums" aria-live="polite">{item.cantidad}</span>
                        <button type="button" aria-label="Agregar uno" className="flex h-8 w-8 items-center justify-center disabled:opacity-40" disabled={item.cantidad >= 50} onClick={() => updateQuantity(item.lineId, item.cantidad + 1)}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <span className="font-extrabold tabular-nums">{money(item.precio * item.cantidad)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lineas.length > 0 && (
          <SheetFooter className="flex-col gap-3 border-t p-5 sm:flex-col sm:space-x-0">
            <div className="flex items-center justify-between text-base"><span className="font-semibold">Subtotal</span><span className="text-xl font-black tabular-nums">{money(total)}</span></div>
            {minimo > 0 && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">Te faltan {money(minimo)} para el pedido mínimo.</p>}
            <p className="text-xs text-muted-foreground">El costo de envío y los descuentos se calculan al finalizar.</p>
            <Link to="/app/carrito" className="flex h-12 items-center justify-center text-base font-bold" style={style}>Finalizar compra</Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
