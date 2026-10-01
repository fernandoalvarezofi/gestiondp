import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Check, CreditCard, Landmark, Loader2, MapPin, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AddressForm, AddressList, fullAddress, SavedAddress, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { db, errorMessage, img, MetodoPago, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type CouponResult = { valido: boolean; codigo?: string; descuento?: number; envio_gratis?: boolean; mensaje: string };

const payments: { id: MetodoPago; label: string; hint: string; icon: typeof Banknote }[] = [
  { id: "efectivo", label: "Efectivo", hint: "Pagás al recibir", icon: Banknote },
  { id: "tarjeta", label: "Tarjeta", hint: "Débito o crédito al recibir (posnet)", icon: CreditCard },
  { id: "transferencia", label: "Transferencia", hint: "Te pasamos el alias al confirmar", icon: Landmark },
];
const tips = [0, 500, 1000, 1500];

export default function Cart() {
  const { store, items, subtotal, updateQuantity, clearCart, address, setAddress } = useCart();
  const { addresses, reload } = useSavedAddresses();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<MetodoPago>("efectivo");
  const [tip, setTip] = useState(500);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    db.from("perfiles").select("telefono").eq("id", user.id).maybeSingle().then(({ data }: { data: { telefono: string | null } | null }) => {
      if (data?.telefono) setPhone((current) => current || data.telefono || "");
    });
  }, [user]);

  useEffect(() => {
    if (!address && addresses.length) {
      const preferred = addresses.find((item) => item.predeterminada) || addresses[0];
      setAddress({ id: preferred.id, alias: preferred.alias, direccion: fullAddress(preferred) });
    }
  }, [address, addresses, setAddress]);

  // Si cambia el carrito, el cupón aplicado puede dejar de ser válido: se vuelve a validar.
  useEffect(() => {
    if (!coupon?.valido || !store || !coupon.codigo) return;
    db.rpc("delivery_validar_cupon", { p_codigo: coupon.codigo, p_comercio: store.id, p_subtotal: subtotal }).then(({ data }: { data: CouponResult | null }) => {
      if (data) setCoupon(data);
    });
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    if (!store) return null;
    const freeByStore = store.envio_gratis_desde !== null && store.envio_gratis_desde !== undefined && subtotal >= Number(store.envio_gratis_desde);
    const shipping = freeByStore || (coupon?.valido && coupon.envio_gratis) ? 0 : Number(store.costo_envio);
    const service = Math.round(subtotal * 0.05);
    const discount = coupon?.valido ? Number(coupon.descuento || 0) : 0;
    return { shipping, service, discount, total: Math.max(subtotal + shipping + service + tip - discount, 0), missing: Math.max(Number(store.pedido_minimo || 0) - subtotal, 0) };
  }, [store, subtotal, coupon, tip]);

  if (!store || !items.length || !summary) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <EmptyState icon={<ShoppingBag className="h-7 w-7" />} title="Tu carrito está vacío" text="Explorá comercios y agregá lo que quieras pedir." action={<Button asChild className="rounded-full"><Link to="/app">Ver comercios</Link></Button>} />
      </div>
    );
  }

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    const { data, error } = await db.rpc("delivery_validar_cupon", { p_codigo: couponInput.trim(), p_comercio: store.id, p_subtotal: subtotal });
    setCheckingCoupon(false);
    if (error) return toast.error(errorMessage(error));
    setCoupon(data);
    if (data?.valido) toast.success("Cupón aplicado"); else toast.error(data?.mensaje || "Cupón inválido");
  };

  const checkout = async () => {
    if (!address?.direccion) return toast.error("Elegí una dirección de entrega");
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Dejanos un teléfono de contacto para coordinar la entrega");
    if (summary.missing > 0) return toast.error(`Te faltan ${money(summary.missing)} para el pedido mínimo`);
    setSubmitting(true);
    const { data: orderId, error } = await db.rpc("delivery_crear_pedido", {
      p_comercio: store.id,
      p_items: items.map((item) => ({ producto_id: item.id, cantidad: item.cantidad, notas: item.notas || null })),
      p_direccion: address.direccion,
      p_direccion_id: address.id || null,
      p_metodo_pago: payment,
      p_propina: tip,
      p_cupon: coupon?.valido ? coupon.codigo : null,
      p_notas: notes.trim() || null,
      p_telefono: phone.trim(),
    });
    setSubmitting(false);
    if (error || !orderId) return toast.error(errorMessage(error, "No pudimos crear el pedido"));
    clearCart();
    toast.success("¡Pedido confirmado! El comercio ya lo recibió.");
    navigate(`/app/pedidos/${orderId}`, { replace: true });
  };

  const chooseAddress = (saved: SavedAddress) => setAddress({ id: saved.id, alias: saved.alias, direccion: fullAddress(saved) });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader back eyebrow="Tu pedido" title={store.nombre} subtitle={<Link to={`/app/tienda/${store.slug}`} className="font-bold text-primary">Agregar más productos</Link>} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Productos</h2><button type="button" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-destructive" onClick={clearCart}><Trash2 className="h-4 w-4" />Vaciar</button></div>
            <ul className="mt-3 divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <img src={img(item.imagen_url, 200)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.nombre}</p>
                    {item.notas && <p className="truncate text-xs text-muted-foreground">“{item.notas}”</p>}
                    <p className="font-display text-sm font-extrabold">{money(item.precio * item.cantidad)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border p-0.5">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Quitar uno" onClick={() => updateQuantity(item.id, item.cantidad - 1)}>{item.cantidad === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</Button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{item.cantidad}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Agregar uno" onClick={() => updateQuantity(item.id, item.cantidad + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <label htmlFor="order-notes" className="mt-2 block text-sm font-bold">Comentarios para el comercio</label>
            <Textarea id="order-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: sin cubiertos, tocar el timbre 2B…" className="mt-2 min-h-[64px] resize-none" />
          </section>

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><MapPin className="h-5 w-5 text-primary" />Dirección de entrega</h2>
            <div className="mt-3">
              {addresses.length > 0 && <AddressList addresses={addresses} selectable={chooseAddress} />}
              {addingAddress || addresses.length === 0 ? (
                <div className="mt-3"><AddressForm onSaved={(saved) => { setAddingAddress(false); reload(); chooseAddress(saved); }} /></div>
              ) : (
                <Button variant="outline" className="mt-3 rounded-full" onClick={() => setAddingAddress(true)}><Plus className="h-4 w-4" />Nueva dirección</Button>
              )}
            </div>
            <label htmlFor="order-phone" className="mt-5 block text-sm font-bold">Teléfono de contacto</label>
            <p className="text-xs text-muted-foreground">Solo lo ven el comercio y el repartidor de este pedido.</p>
            <Input id="order-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="11 5555-5555" className="mt-2 max-w-xs" />
          </section>

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-extrabold">Medio de pago</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {payments.map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setPayment(id)} className={cn("relative rounded-2xl border p-3 text-left transition-colors", payment === id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                  <Icon className={cn("h-6 w-6", payment === id ? "text-primary" : "text-muted-foreground")} />
                  <span className="mt-2 block font-bold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                  {payment === id && <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-extrabold">Propina para quien te lo lleva</h2>
            <p className="text-sm text-muted-foreground">El 100% es para el repartidor.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tips.map((value) => (
                <button key={value} type="button" onClick={() => setTip(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", tip === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value === 0 ? "Sin propina" : money(value)}</button>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><Tag className="h-5 w-5 text-primary" />Cupón</h2>
            {coupon?.valido ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-success/10 p-3 text-sm">
                <span><span className="font-bold text-success">{coupon.codigo}</span><span className="block text-muted-foreground">{coupon.mensaje}</span></span>
                <Button size="icon" variant="ghost" aria-label="Quitar cupón" onClick={() => { setCoupon(null); setCouponInput(""); }}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Input value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} placeholder="Ej.: BIENVENIDA" maxLength={30} className="uppercase placeholder:normal-case" onKeyDown={(event) => event.key === "Enter" && applyCoupon()} />
                <Button variant="outline" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>{checkingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}</Button>
              </div>
            )}
            {coupon && !coupon.valido && <p className="mt-2 text-sm font-semibold text-destructive">{coupon.mensaje}</p>}
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-extrabold">Resumen</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Productos</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd className={cn(summary.shipping === 0 && "font-bold text-success")}>{summary.shipping === 0 ? "Gratis" : money(summary.shipping)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tarifa de servicio</dt><dd>{money(summary.service)}</dd></div>
              {tip > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Propina</dt><dd>{money(tip)}</dd></div>}
              {summary.discount > 0 && <div className="flex justify-between font-bold text-success"><dt>Descuento</dt><dd>-{money(summary.discount)}</dd></div>}
              <div className="flex justify-between border-t pt-3 font-display text-xl font-extrabold"><dt>Total</dt><dd>{money(summary.total)}</dd></div>
            </dl>
            {summary.missing > 0 && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm font-semibold">Te faltan {money(summary.missing)} para llegar al pedido mínimo.</p>}
            {store.envio_gratis_desde && Number(store.envio_gratis_desde) > 1 && subtotal < Number(store.envio_gratis_desde) && (
              <p className="mt-3 text-sm text-muted-foreground">Sumá {money(Number(store.envio_gratis_desde) - subtotal)} más y el envío es gratis.</p>
            )}
            <p className="mt-3 truncate text-sm text-muted-foreground">Entrega en <span className="font-bold text-foreground">{address?.direccion || "—"}</span></p>
            <Button className="mt-4 h-12 w-full rounded-full text-base font-bold" onClick={checkout} disabled={submitting || summary.missing > 0 || !address?.direccion}>
              {submitting ? <><Loader2 className="h-5 w-5 animate-spin" />Confirmando…</> : `Hacer pedido · ${money(summary.total)}`}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">El total final lo calcula el sistema al confirmar.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
