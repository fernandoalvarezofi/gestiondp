import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CartStore, useCart } from "@/contexts/CartContext";
import { DeliveryProduct, img, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

function discount(product: DeliveryProduct) {
  if (!product.precio_anterior || product.precio_anterior <= product.precio) return null;
  return Math.round((1 - product.precio / product.precio_anterior) * 100);
}

export function ProductCard({ product, store, disabled }: { product: DeliveryProduct; store: CartStore; disabled?: boolean }) {
  const { quantityOf, updateQuantity, addItem } = useCart();
  const [open, setOpen] = useState(false);
  const quantity = quantityOf(product.id);
  const off = discount(product);
  const unavailable = disabled || !product.disponible || product.stock === 0;

  const quickAdd = () => {
    const sameStore = addItem(product, store);
    if (!sameStore) toast.info(`Vaciamos tu carrito anterior para pedir en ${store.nombre}`);
  };

  return (
    <>
      <article
        className={cn("group flex cursor-pointer gap-3 rounded-2xl border bg-card p-3 transition-shadow hover:shadow-soft", unavailable && "opacity-60")}
        onClick={() => !unavailable && setOpen(true)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug">{product.nombre}</h3>
          {product.descripcion && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.descripcion}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-display font-extrabold">{money(product.precio)}</span>
            {off && <span className="text-xs text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
            {off && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">-{off}%</span>}
          </div>
          {unavailable && <p className="mt-1 text-xs font-bold text-muted-foreground">Sin stock por ahora</p>}
        </div>
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
          <img src={img(product.imagen_url, 300)} alt={product.nombre} loading="lazy" className="h-full w-full object-cover" />
          {!unavailable && (quantity > 0 ? (
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between rounded-full bg-card p-0.5 shadow-pop" onClick={(event) => event.stopPropagation()}>
              <button type="button" aria-label="Quitar uno" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted" onClick={() => updateQuantity(product.id, quantity - 1)}><Minus className="h-4 w-4" /></button>
              <span className="text-sm font-bold tabular-nums">{quantity}</span>
              <button type="button" aria-label="Agregar uno" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={quickAdd}><Plus className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" aria-label={`Agregar ${product.nombre}`} className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop transition-transform active:scale-90" onClick={(event) => { event.stopPropagation(); quickAdd(); toast.success("Agregado al carrito"); }}>
              <Plus className="h-5 w-5" />
            </button>
          ))}
        </div>
      </article>
      <ProductDialog product={product} store={store} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ProductDialog({ product, store, open, onOpenChange }: { product: DeliveryProduct; store: CartStore; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const maxQuantity = Math.min(product.stock ?? 50, 50);

  const confirm = () => {
    const sameStore = addItem(product, store, quantity, notes.trim() || undefined);
    toast.success(sameStore ? `${quantity} × ${product.nombre} agregado` : `Empezaste un carrito nuevo en ${store.nombre}`);
    setQuantity(1);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <img src={img(product.imagen_url, 900)} alt={product.nombre} className="aspect-[4/3] w-full object-cover" />
        <div className="p-5">
          <DialogTitle className="text-2xl font-extrabold">{product.nombre}</DialogTitle>
          {product.descripcion && <DialogDescription className="mt-2">{product.descripcion}</DialogDescription>}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-display text-xl font-extrabold">{money(product.precio)}</span>
            {product.precio_anterior && product.precio_anterior > product.precio && <span className="text-sm text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
          </div>
          <label htmlFor={`notes-${product.id}`} className="mt-5 block text-sm font-bold">Instrucciones especiales</label>
          <Textarea id={`notes-${product.id}`} value={notes} maxLength={200} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: sin cebolla, bien cocido…" className="mt-2 min-h-[72px] resize-none" />
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border p-1">
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Menos"><Minus className="h-4 w-4" /></Button>
              <span className="w-6 text-center font-bold tabular-nums">{quantity}</span>
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={quantity >= maxQuantity} onClick={() => setQuantity(quantity + 1)} aria-label="Más"><Plus className="h-4 w-4" /></Button>
            </div>
            <Button className="h-11 flex-1 rounded-full text-base font-bold" onClick={confirm}>
              Agregar {money(product.precio * quantity)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
