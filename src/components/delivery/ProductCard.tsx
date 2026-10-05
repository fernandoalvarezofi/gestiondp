import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Insignia } from "@/lib/marketplace";
import { SmartImage } from "./SmartImage";
import { Check, Minus, Plus } from "lucide-react";
import { Stars } from "@/components/market/Stars";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CartStore, useCart } from "@/contexts/CartContext";
import { ChosenOption, DeliveryProduct, img, money, precioDesde, ProductGroup, ProductVariant, sortGroups, tagLabels, variantesDisponibles } from "@/lib/delivery";
import { cn } from "@/lib/utils";

function discount(product: DeliveryProduct) {
  if (!product.precio_anterior || product.precio_anterior <= product.precio) return null;
  return Math.round((1 - product.precio / product.precio_anterior) * 100);
}

const groupHint = (group: ProductGroup) => {
  if (group.minimo > 0 && group.maximo === group.minimo) return group.minimo === 1 ? "Elegí 1" : `Elegí ${group.minimo}`;
  if (group.minimo > 0) return `Elegí de ${group.minimo} a ${group.maximo}`;
  return group.maximo === 1 ? "Opcional" : `Opcional · hasta ${group.maximo}`;
};

export function ProductCard({ product, store, disabled, variant = "row", badges, href }: { product: DeliveryProduct; store: CartStore; disabled?: boolean; variant?: "row" | "tile" | "shop"; /** Insignias (oferta, nuevo, últimas unidades, más vendido). */ badges?: Insignia[]; /** Si se indica, tocar la tarjeta abre la ficha del producto en vez del detalle emergente. */ href?: string }) {
  const { quantityOf, decrementProduct, addItem } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const quantity = quantityOf(product.id);
  const off = discount(product);
  const conVariantes = Boolean(product.usa_variantes);
  const outOfStock = !product.disponible || product.stock === 0 || (conVariantes && variantesDisponibles(product).length === 0);
  const unavailable = disabled || outOfStock;
  const groups = useMemo(() => sortGroups(product.grupos), [product.grupos]);
  const hasOptions = conVariantes || groups.some((group) => group.opciones.some((option) => option.disponible));
  const needsChoice = conVariantes || groups.some((group) => group.minimo > 0);

  const quickAdd = () => {
    // Si hay que elegir algo (tamaño, punto…), se abre el detalle en vez de agregar directo.
    if (needsChoice) { setOpen(true); return; }
    if (!addItem(product, store)) toast.error("Tu carrito ya tiene 5 comercios. Terminá o quitá uno para sumar otro.");
    else toast.success("Agregado al carrito");
  };

  const control = !unavailable && (quantity > 0 ? (
    <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between rounded-full bg-card p-0.5 shadow-pop" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label="Quitar uno" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted" onClick={() => decrementProduct(product.id)}><Minus className="h-4 w-4" /></button>
      <span className="text-sm font-black tabular-nums">{quantity}</span>
      <button type="button" aria-label="Agregar uno" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={() => (hasOptions ? setOpen(true) : quickAdd())}><Plus className="h-4 w-4" /></button>
    </div>
  ) : (
    <button type="button" aria-label={`Agregar ${product.nombre}`} className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-primary shadow-pop transition-transform active:scale-90" onClick={(event) => { event.stopPropagation(); quickAdd(); }}>
      <Plus className="h-5 w-5" strokeWidth={2.6} />
    </button>
  ));

  // Segunda foto: se muestra al pasar el mouse (solo si hay una distinta de la principal).
  const segundaFoto = (product.imagenes ?? []).find((url) => url && url !== product.imagen_url) ?? null;
  const ultimas = !outOfStock && product.stock != null && product.stock > 0 && product.stock <= 5 ? product.stock : null;

  // Escritorio: botón ancho que sube desde abajo (como Tiendanube). Celular: queda el "+" redondo de siempre.
  const shopControl = unavailable ? null : quantity > 0 ? control : (
    <>
      <div className="md:hidden">{control}</div>
      <button type="button" className="absolute inset-x-2 bottom-2 hidden translate-y-[140%] items-center justify-center gap-1.5 rounded-[var(--sf-radius-button,9999px)] py-2.5 text-sm font-bold opacity-0 shadow-pop transition-all duration-300 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex"
        style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)" }} onClick={(event) => { event.stopPropagation(); quickAdd(); }}>
        <Plus className="h-4 w-4" strokeWidth={2.6} />{needsChoice ? "Elegir opciones" : "Agregar al carrito"}
      </button>
    </>
  );

  const price = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-black">{needsChoice ? "Desde " : ""}{money(precioDesde(product))}</span>
      {off && <span className="text-xs font-semibold text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
      {off && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">-{off}%</span>}
    </div>
  );

  return (
    <>
      {variant === "shop" ? (
        <article className={cn("group cursor-pointer", outOfStock && "opacity-60")} onClick={() => { if (href) navigate(href); else if (!unavailable) setOpen(true); }}>
          <div className="relative overflow-hidden bg-muted" style={{ borderRadius: "var(--sf-radius, 1rem)", aspectRatio: "var(--sf-aspect, 4 / 5)" }}>
            <SmartImage src={product.imagen_url} width={640} alt={product.nombre} className={cn("transition-all duration-500", segundaFoto ? "group-hover:opacity-0" : "group-hover:scale-105")} />
            {segundaFoto && <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"><SmartImage src={segundaFoto} width={640} alt="" className="transition-transform duration-500 group-hover:scale-105" /></div>}
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {outOfStock && <span className="rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">Sin stock</span>}
              {!outOfStock && (badges ?? (off ? [{ id: "oferta", texto: `${off}% OFF` } as Insignia] : [])).map((badge) => (
                <span key={badge.id} className={cn("rounded-full px-2 py-0.5 text-[11px] font-black shadow-sm", badge.id === "oferta" ? "" : badge.id === "masvendido" ? "bg-[#FFE14D] text-black" : badge.id === "nuevo" ? "bg-[#4FE3B8] text-black" : "bg-black/75 text-white")} style={badge.id === "oferta" ? { background: "var(--sf-accent)", color: "var(--sf-on-accent)" } : undefined}>{badge.texto}</span>
              ))}
            </div>
            {shopControl}
          </div>
          <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{href ? <Link to={href} onClick={(event) => event.stopPropagation()} className="hover:underline">{product.nombre}</Link> : product.nombre}</h3>
          <div className="mt-1 text-sm">{price}</div>
          {!!product.rating_count && product.rating_avg != null && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Stars value={Number(product.rating_avg)} size={12} /><span>({product.rating_count})</span></p>}
          {off && <p className="mt-0.5 text-xs font-semibold text-muted-foreground">Ahorrás {money(Number(product.precio_anterior) - Number(product.precio))}</p>}
          {ultimas && <p className="mt-0.5 text-xs font-bold text-destructive">¡Últimas {ultimas} unidades!</p>}
        </article>
      ) : variant === "tile" ? (
        <article className={cn("w-[150px] shrink-0 cursor-pointer snap-start", outOfStock && "opacity-60")} onClick={() => !unavailable && setOpen(true)}>
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            <SmartImage src={product.imagen_url} width={320} alt={product.nombre} />
            {control}
          </div>
          <div className="mt-2 text-sm">{price}</div>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug">{product.nombre}</h3>
        </article>
      ) : (
        <article className={cn("group flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-brand-orange", outOfStock && "opacity-60")} onClick={() => !unavailable && setOpen(true)}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-extrabold leading-snug">{product.nombre}</h3>
            {product.descripcion && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{product.descripcion}</p>}
            <div className="mt-2 text-[15px]">{price}</div>
            {!!product.etiquetas?.length && <p className="mt-1.5 flex flex-wrap gap-1">{product.etiquetas.map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tagLabels[tag] ?? tag}</span>)}</p>}
            {outOfStock && <p className="mt-1 text-xs font-bold text-muted-foreground">Sin stock por ahora</p>}
          </div>
          <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-muted">
            <SmartImage src={product.imagen_url} width={300} alt={product.nombre} />
            {control}
          </div>
        </article>
      )}
      {open && <ProductDialog product={product} groups={groups} store={store} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProductDialog({ product, groups, store, onClose }: { product: DeliveryProduct; groups: ProductGroup[]; store: CartStore; onClose: () => void }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    // Preselecciona la primera opción de los grupos obligatorios de una sola elección (ej. tamaño).
    Object.fromEntries(groups.filter((group) => group.minimo === 1 && group.maximo === 1).map((group) => [group.id, group.opciones.filter((option) => option.disponible).slice(0, 1).map((option) => option.id)])),
  );
  const variantes = useMemo(() => (product.usa_variantes ? [...(product.variantes || [])].sort((a, b) => a.orden - b.orden) : []), [product.usa_variantes, product.variantes]);
  const [varianteId, setVarianteId] = useState<string | null>(() => variantesDisponibles(product)[0]?.id ?? null);
  const variante: ProductVariant | null = variantes.find((v) => v.id === varianteId) ?? null;
  const maxQuantity = Math.min(variante ? (variante.stock ?? 50) : (product.stock ?? 50), 50);
  const basePrice = variante?.precio != null ? Number(variante.precio) : Number(product.precio);

  const chosen: ChosenOption[] = groups.flatMap((group) => group.opciones
    .filter((option) => (selected[group.id] || []).includes(option.id))
    .map((option) => ({ id: option.id, grupo: group.nombre, nombre: option.nombre, precio: Number(option.precio_extra) })));
  const unit = basePrice + chosen.reduce((total, option) => total + option.precio, 0);
  const missing = groups.find((group) => (selected[group.id] || []).length < group.minimo);

  const toggle = (group: ProductGroup, optionId: string) => {
    setSelected((current) => {
      const list = current[group.id] || [];
      if (group.maximo === 1) return { ...current, [group.id]: list.includes(optionId) && group.minimo === 0 ? [] : [optionId] };
      if (list.includes(optionId)) return { ...current, [group.id]: list.filter((id) => id !== optionId) };
      if (list.length >= group.maximo) return current;
      return { ...current, [group.id]: [...list, optionId] };
    });
  };

  const confirm = () => {
    if (missing) {
      toast.error(`Elegí una opción en “${missing.nombre}”`);
      document.getElementById(`grupo-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (variantes.length && !variante) { toast.error("Elegí una opción"); return; }
    const agregado = addItem(product, store, quantity, notes.trim() || undefined, chosen, variante ? { id: variante.id, nombre: variante.nombre, precio: variante.precio } : undefined);
    if (!agregado) { toast.error("Tu carrito ya tiene 5 comercios. Terminá o quitá uno para sumar otro."); return; }
    toast.success(`${quantity} × ${product.nombre} agregado`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className="overflow-y-auto">
          <div className="relative aspect-[4/3] w-full"><SmartImage src={product.imagen_url} width={900} alt={product.nombre} loading="eager" /></div>
          <div className="p-5">
            <DialogTitle className="text-2xl font-extrabold">{product.nombre}</DialogTitle>
            {product.descripcion && <DialogDescription className="mt-2">{product.descripcion}</DialogDescription>}
            <div className="mt-3 flex items-center gap-2">
              <span className="font-display text-xl font-extrabold">{money(basePrice)}</span>
              {product.precio_anterior && product.precio_anterior > product.precio && <span className="text-sm text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
            </div>

            {variantes.length > 0 && (
              <fieldset className="mt-6">
                <legend className="font-extrabold">Elegí una opción</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variantes.map((v) => {
                    const agotada = !v.disponible || v.stock === 0;
                    const active = v.id === varianteId;
                    return (
                      <button key={v.id} type="button" disabled={agotada} aria-pressed={active} onClick={() => { setVarianteId(v.id); setQuantity(1); }} className={cn("rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors", active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/60", agotada && "cursor-not-allowed opacity-45 line-through")}>
                        {v.nombre}
                      </button>
                    );
                  })}
                </div>
                {variante?.stock != null && variante.stock <= 5 && variante.stock > 0 && <p className="mt-2 text-xs font-bold text-destructive">¡Últimas {variante.stock} unidades!</p>}
              </fieldset>
            )}

            {groups.map((group) => {
              const picked = selected[group.id] || [];
              const full = group.maximo > 1 && picked.length >= group.maximo;
              return (
                <fieldset key={group.id} id={`grupo-${group.id}`} className="mt-6">
                  <legend className="flex w-full items-center justify-between gap-2">
                    <span className="font-extrabold">{group.nombre}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", group.minimo > 0 ? (picked.length >= group.minimo ? "bg-success/10 text-success" : "bg-foreground text-background") : "bg-muted text-muted-foreground")}>
                      {group.minimo > 0 && picked.length >= group.minimo ? "Listo" : groupHint(group)}
                    </span>
                  </legend>
                  <div className="mt-2 divide-y rounded-2xl border">
                    {group.opciones.map((option) => {
                      const active = picked.includes(option.id);
                      const blocked = !option.disponible || (!active && full);
                      return (
                        <button key={option.id} type="button" disabled={blocked} onClick={() => toggle(group, option.id)} className={cn("flex w-full items-center gap-3 px-3 py-3 text-left text-sm", blocked && "opacity-50")}>
                          <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center border-2", group.maximo === 1 ? "rounded-full" : "rounded-md", active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                            {active && (group.maximo === 1 ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : <Check className="h-3.5 w-3.5" />)}
                          </span>
                          <span className="flex-1 font-semibold">{option.nombre}{!option.disponible && " · agotado"}</span>
                          {Number(option.precio_extra) > 0 && <span className="text-muted-foreground">+{money(option.precio_extra)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            <label htmlFor={`notes-${product.id}`} className="mt-6 block text-sm font-bold">Instrucciones especiales</label>
            <Textarea id={`notes-${product.id}`} value={notes} maxLength={200} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: sin cebolla, cortada en 4…" className="mt-2 min-h-[64px] resize-none" />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t bg-card p-4">
          <div className="flex items-center gap-1 rounded-full border p-1">
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Menos"><Minus className="h-4 w-4" /></Button>
            <span className="w-6 text-center font-bold tabular-nums">{quantity}</span>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={quantity >= maxQuantity} onClick={() => setQuantity(quantity + 1)} aria-label="Más"><Plus className="h-4 w-4" /></Button>
          </div>
          <Button className={cn("h-11 flex-1 rounded-full text-base font-bold", missing && "opacity-80")} onClick={confirm}>
            Agregar {money(unit * quantity)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
