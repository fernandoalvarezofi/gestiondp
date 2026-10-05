import { vinoDeTienda } from "@/lib/canal";
import { fetchMyProfile } from "@/services/profile";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Bike, CalendarClock, Check, CreditCard, Landmark, Loader2, MapPin, Minus, Plus, ShoppingBag, Store as StoreIcon, Tag, Trash2, Wallet, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { AddressForm, AddressList, SavedAddress, toCartAddress, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { COMERCIO_COLS, db, DeliveryProduct, DeliveryStore, errorMessage, img, isOpenNow, MetodoPago, money, optionsLabel, productSelect, readPickupPreference, slotDay, slotTime, sortGroups, TipoEntrega } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { startOnlinePayment } from "@/lib/payments";
import { ajusteValor, useAjustes } from "@/hooks/useAjustes";
import { couponLabel, useMyCoupons } from "@/hooks/useMyCoupons";
import { useRoute } from "@/lib/route";
import { Switch } from "@/components/ui/switch";
import { loadWallet, walletApplied } from "@/lib/wallet";
import { defaultOrderPreferences, deliveryNote, initialPayment, loadOrderPreferences, OrderPreferences, TIP_OPTIONS } from "@/lib/orderPreferences";
import { cn } from "@/lib/utils";

type CouponResult = { valido: boolean; codigo?: string; descuento?: number; envio_gratis?: boolean; mensaje: string };

const onlinePayment = { id: "mercadopago" as MetodoPago, label: "Mercado Pago", hint: "Tarjeta, débito o dinero en cuenta, ahora", icon: Wallet };
const payments: { id: MetodoPago; label: string; hint: string; icon: typeof Banknote }[] = [
  { id: "efectivo", label: "Efectivo", hint: "Pagás al recibir", icon: Banknote },
  { id: "tarjeta", label: "Tarjeta", hint: "Débito o crédito al recibir (posnet)", icon: CreditCard },
  { id: "transferencia", label: "Transferencia", hint: "Te pasamos el alias al confirmar", icon: Landmark },
];
const tips = TIP_OPTIONS;
// Complementos que suelen sumarse al pedido: se ofrecen primero.
const ADDON_HINT = /bebida|gaseosa|agua|cerveza|jugo|postre|helado|acompa|papas|salsa|extra|sumá|café/i;

/** Billetes redondos que cubren el total, para sugerir "pago con…". */
function cashOptions(total: number) {
  const values = new Set<number>();
  for (const step of [1000, 2000, 5000, 10000, 20000]) {
    const value = Math.ceil(total / step) * step;
    if (value > total) values.add(value);
  }
  return [...values].sort((a, b) => a - b).slice(0, 3);
}

export default function Cart() {
  const { store, items, subtotal, updateQuantity, clearCart, address, setAddress, addItem } = useCart();
  const { addresses, reload } = useSavedAddresses();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<MetodoPago>("efectivo");
  const [tip, setTip] = useState(500);
  const [couponInput, setCouponInput] = useState("");
  const myCoupons = useMyCoupons();
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [storeInfo, setStoreInfo] = useState<DeliveryStore | null>(null);
  const point = useAddressPoint();
  const tariff = useTariff(point);
  // Ruta real por las calles: el servidor la guarda y es la que usa para cobrar el envío.
  const storePoint = storeInfo?.latitud != null && storeInfo?.longitud != null ? { lat: Number(storeInfo.latitud), lng: Number(storeInfo.longitud) } : null;
  const road = useRoute(storePoint, point, { persist: true });
  const { user } = useAuth();
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  // Preferencias guardadas en Mi cuenta (pago, propina, instrucciones): se aplican una sola vez, sin pisar lo que la persona ya tocó.
  const [prefs, setPrefs] = useState<OrderPreferences | null | undefined>(undefined);
  const touched = useRef({ payment: false, tip: false, notes: false });
  // Saldo de la billetera (créditos y reintegros): se descuenta del total si la persona lo quiere usar.
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [mode, setMode] = useState<TipoEntrega>(() => (readPickupPreference() ? "retiro" : "delivery"));
  const [slots, setSlots] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [slotDayKey, setSlotDayKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [cashWith, setCashWith] = useState<number | null>(null);
  const [customCash, setCustomCash] = useState("");
  const [catalog, setCatalog] = useState<DeliveryProduct[]>([]);
  const { ajustes } = useAjustes();
  const servicePct = ajusteValor(ajustes, "tarifa_servicio_pct", 5);

  useEffect(() => {
    db.rpc("delivery_pagos_online_activos").then(({ data }: { data: boolean | null }) => {
      setOnlineEnabled(Boolean(data));
    });
  }, []);

  useEffect(() => {
    if (!user) { setWalletBalance(0); return; }
    loadWallet().then((wallet) => setWalletBalance(wallet?.saldo ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) { setPrefs(null); return; }
    loadOrderPreferences(user.id).then(setPrefs);
  }, [user]);

  useEffect(() => {
    if (prefs === undefined) return;
    const wanted = prefs ?? defaultOrderPreferences;
    if (!touched.current.payment) setPayment(initialPayment(wanted.pago_preferido, onlineEnabled));
    if (!touched.current.tip) setTip(wanted.propina_default);
    if (!touched.current.notes) setNotes((current) => current || deliveryNote(wanted));
  }, [prefs, onlineEnabled]);

  useEffect(() => {
    if (!user) return;
    fetchMyProfile().then((data) => {
      if (data?.telefono) setPhone((current) => current || data.telefono || "");
    });
  }, [user]);

  // Datos actuales del comercio (ubicación, radio, costo por km, retiro y programados) para estimar igual que el servidor.
  useEffect(() => {
    if (!store?.id) return;
    db.from("delivery_comercios").select(COMERCIO_COLS).eq("id", store.id).maybeSingle().then(({ data }: { data: DeliveryStore | null }) => setStoreInfo(data));
    db.rpc("delivery_franjas", { p_comercio: store.id }).then(({ data }: { data: string[] | null }) => setSlots(Array.isArray(data) ? data : []));
    db.from("delivery_productos").select(productSelect).eq("comercio_id", store.id).eq("disponible", true).order("destacado", { ascending: false }).order("nombre")
      .then(({ data }: { data: DeliveryProduct[] | null }) => setCatalog(data || []));
  }, [store?.id]);

  useEffect(() => {
    if (!address && addresses.length) {
      // Preferimos direcciones con ubicación en el mapa (sin ella no se puede calcular el envío).
      const located = addresses.filter((item) => item.latitud != null);
      const preferred = located.find((item) => item.predeterminada) || located[0] || addresses.find((item) => item.predeterminada) || addresses[0];
      setAddress(toCartAddress(preferred));
    }
  }, [address, addresses, setAddress]);

  // Si cambia el carrito, el cupón aplicado puede dejar de ser válido: se vuelve a validar.
  useEffect(() => {
    if (!coupon?.valido || !store || !coupon.codigo) return;
    db.rpc("delivery_validar_cupon", { p_codigo: coupon.codigo, p_comercio: store.id, p_subtotal: subtotal }).then(({ data }: { data: CouponResult | null }) => {
      if (data) setCoupon(data);
    });
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickup = mode === "retiro";
  const canPickup = storeInfo?.acepta_retiro !== false;
  const openNow = storeInfo ? isOpenNow(storeInfo) : true;
  const canSchedule = slots.length > 0;

  // Si el local está cerrado pero acepta programados, el pedido sale programado por defecto.
  useEffect(() => {
    if (storeInfo && !openNow && canSchedule) setScheduled(true);
  }, [storeInfo, openNow, canSchedule]);

  const slotDays = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const value of slots) {
      const key = slotDay(value);
      groups.set(key, [...(groups.get(key) || []), value]);
    }
    return groups;
  }, [slots]);
  useEffect(() => {
    if (!scheduled) return;
    const first = [...slotDays.keys()][0] ?? null;
    if (!slotDayKey || !slotDays.has(slotDayKey)) { setSlotDayKey(first); setSlot(null); }
  }, [scheduled, slotDays, slotDayKey]);

  const summary = useMemo(() => {
    if (!store) return null;
    const freeByStore = store.envio_gratis_desde !== null && store.envio_gratis_desde !== undefined && subtotal >= Number(store.envio_gratis_desde);
    const reach = storeReach(storeInfo || store, point, road?.km, tariff);
    const shipping = pickup ? 0 : freeByStore || (coupon?.valido && coupon.envio_gratis) ? 0 : reach.fee;
    const service = Math.round(subtotal * servicePct / 100);
    const discount = coupon?.valido ? Number(coupon.descuento || 0) : 0;
    const tipValue = pickup ? 0 : tip;
    return {
      shipping, service, discount, tip: tipValue,
      total: Math.max(subtotal + shipping + service + tipValue - discount, 0),
      missing: Math.max(Number(store.pedido_minimo || 0) - subtotal, 0),
      reach,
      needsPin: !pickup && Boolean(storeInfo?.latitud != null && !point),
    };
  }, [store, storeInfo, point, subtotal, coupon, tip, pickup, servicePct, road?.km, tariff]);
  // El saldo de la billetera cubre parte del total (no aplica al pago online, que cobra Mercado Pago).
  const walletUsed = user && useWallet && payment !== "mercadopago" && summary ? walletApplied(walletBalance, summary.total) : 0;
  const payable = summary ? summary.total - walletUsed : 0;

  // El billete con el que se paga tiene que cubrir el total vigente.
  useEffect(() => {
    if (summary && cashWith !== null && cashWith < payable) { setCashWith(null); setCustomCash(""); }
  }, [summary, cashWith, payable]);

  const suggestions = useMemo(() => {
    const inCart = new Set(items.map((item) => item.id));
    return catalog
      .filter((product) => !inCart.has(product.id) && product.stock !== 0 && !sortGroups(product.grupos).some((group) => group.minimo > 0))
      .sort((a, b) => Number(ADDON_HINT.test(`${b.categoria} ${b.nombre}`)) - Number(ADDON_HINT.test(`${a.categoria} ${a.nombre}`)) || Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)))
      .slice(0, 8);
  }, [catalog, items]);

  if (!store || !items.length || !summary) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <EmptyState icon={<ShoppingBag className="h-7 w-7" />} title="Tu carrito está vacío" text="Explorá comercios y agregá lo que quieras pedir." action={<Button asChild className="rounded-full"><Link to="/app">Ver comercios</Link></Button>} />
      </div>
    );
  }

  const applyCoupon = async (code?: string) => {
    const value = (code ?? couponInput).trim();
    if (!value) return;
    setCheckingCoupon(true);
    const { data, error } = await db.rpc("delivery_validar_cupon", { p_codigo: value, p_comercio: store.id, p_subtotal: subtotal });
    setCheckingCoupon(false);
    if (error) return toast.error(errorMessage(error));
    if (pickup && data?.valido && data.envio_gratis) return toast.error("Ese cupón es solo para pedidos con envío");
    setCoupon(data);
    if (data?.valido) toast.success("Cupón aplicado"); else toast.error(data?.mensaje || "Cupón inválido");
  };

  const needsSlot = scheduled || (!openNow && canSchedule);
  const waitingSlot = needsSlot && !slot;
  const closedWithoutSchedule = !openNow && !canSchedule;

  const checkout = async () => {
    if (!user) {
      // El carrito se conserva: al volver de ingresar, el pedido sigue ahí.
      toast.info("Ingresá o creá tu cuenta para confirmar el pedido. Tu carrito te espera.");
      navigate("/auth", { state: { from: "/app/carrito" } });
      return;
    }
    if (!pickup && !address?.direccion) return toast.error("Elegí una dirección de entrega");
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Dejanos un teléfono de contacto para coordinar la entrega");
    if (summary.missing > 0) return toast.error(`Te faltan ${money(summary.missing)} para el pedido mínimo`);
    if (waitingSlot) return toast.error("Elegí el horario del pedido");
    setSubmitting(true);
    const online = payment === "mercadopago";
    const params = {
      p_comercio: store.id,
      p_items: items.map((item) => ({ producto_id: item.id, variante_id: item.varianteId || null, cantidad: item.cantidad, notas: item.notas || null, opciones: item.opciones.map((option) => option.id) })),
      p_direccion: pickup ? "" : address?.direccion ?? "",
      p_direccion_id: pickup ? null : address?.id || null,
      p_propina: summary.tip,
      p_cupon: coupon?.valido ? coupon.codigo : null,
      p_notas: notes.trim() || null,
      p_telefono: phone.trim(),
      p_latitud: pickup ? null : address?.lat ?? null,
      p_longitud: pickup ? null : address?.lng ?? null,
      p_tipo_entrega: mode,
      p_programado_para: needsSlot ? slot : null,
    };
    const { data: orderId, error } = online
      ? await db.rpc("delivery_crear_pedido_online", params)
      : await db.rpc("delivery_crear_pedido", { ...params, p_metodo_pago: payment, p_paga_con: payment === "efectivo" ? cashWith : null, p_usar_saldo: walletUsed > 0 });
    if (error || !orderId) { setSubmitting(false); return toast.error(errorMessage(error, "No pudimos crear el pedido")); }
    // Dato informativo: si el cliente llegó desde la tienda online del comercio, el pedido se marca como tal.
    if (vinoDeTienda(store.id)) db.rpc("delivery_marcar_canal", { p_pedido: orderId, p_canal: "tienda" }).then(() => undefined, () => undefined);
    clearCart();
    if (!online) {
      setSubmitting(false);
      toast.success(needsSlot ? "¡Pedido programado! El comercio ya lo recibió." : "¡Pedido confirmado! El comercio ya lo recibió.");
      navigate(`/app/pedidos/${orderId}`, { replace: true });
      return;
    }
    // Pago online: el pedido queda reservado y vamos a Mercado Pago. Si algo falla, se puede pagar desde el pedido.
    try {
      await startOnlinePayment(orderId);
    } catch (paymentError) {
      setSubmitting(false);
      toast.error((paymentError as Error).message);
      navigate(`/app/pedidos/${orderId}`, { replace: true });
    }
  };

  const chooseAddress = (saved: SavedAddress) => setAddress(toCartAddress(saved));
  const quickAdd = (product: DeliveryProduct) => {
    addItem(product, store);
    toast.success(`${product.nombre} agregado`);
  };
  const submitDisabled = submitting || summary.missing > 0 || waitingSlot || closedWithoutSchedule || (!pickup && (!address?.direccion || !summary.reach.inZone || summary.needsPin));
  const times = slotDays.get(slotDayKey ?? "") ?? [];
  const cashChoices = cashOptions(payable);
  const change = cashWith ? cashWith - payable : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:pb-16">
      <PageHeader eyebrow="Tu pedido" title={store.nombre} subtitle={<Link to={`/app/tienda/${store.slug}`} className="font-bold text-primary">Agregar más productos</Link>} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {canPickup && (
            <div role="radiogroup" aria-label="Cómo querés recibir tu pedido" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
              {([["delivery", "Envío a domicilio", Bike], ["retiro", "Retiro en el local", StoreIcon]] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)} className={cn("flex h-11 items-center justify-center gap-2 rounded-full text-sm font-extrabold transition-all", mode === value ? "bg-card shadow-soft" : "text-muted-foreground")}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          )}

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Productos</h2><button type="button" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-destructive" onClick={clearCart}><Trash2 className="h-4 w-4" />Vaciar</button></div>
            <ul className="mt-3 divide-y">
              {items.map((item) => (
                <li key={item.lineId} className="flex items-center gap-3 py-3">
                  <img src={img(item.imagen_url, 200)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.nombre}</p>
                    {item.opciones.length > 0 && <p className="text-xs text-muted-foreground">{optionsLabel(item.opciones)}</p>}
                    {item.notas && <p className="truncate text-xs text-muted-foreground">“{item.notas}”</p>}
                    <p className="font-display text-sm font-extrabold">{money(item.precio * item.cantidad)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border p-0.5">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Quitar uno" onClick={() => updateQuantity(item.lineId, item.cantidad - 1)}>{item.cantidad === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</Button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{item.cantidad}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Agregar uno" onClick={() => updateQuantity(item.lineId, item.cantidad + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <label htmlFor="order-notes" className="mt-2 block text-sm font-bold">Comentarios para el comercio</label>
            <Textarea id="order-notes" value={notes} maxLength={500} onChange={(event) => { touched.current.notes = true; setNotes(event.target.value); }} placeholder="Ej.: sin cubiertos, tocar el timbre 2B…" className="mt-2 min-h-[64px] resize-none" />
          </section>

          {suggestions.length > 0 && (
            <section>
              <h2 className="text-lg font-extrabold">¿Querés sumar algo más?</h2>
              <div className="scrollbar-none -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {suggestions.map((product) => (
                  <article key={product.id} className="w-[132px] shrink-0 snap-start">
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                      <img src={img(product.imagen_url, 280)} alt={product.nombre} loading="lazy" className="h-full w-full object-cover" />
                      <button type="button" aria-label={`Agregar ${product.nombre}`} onClick={() => quickAdd(product)} className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-primary shadow-pop transition-transform active:scale-90"><Plus className="h-5 w-5" strokeWidth={2.6} /></button>
                    </div>
                    <p className="mt-1.5 text-sm font-black">{money(product.precio)}</p>
                    <p className="line-clamp-2 text-[13px] font-bold leading-snug">{product.nombre}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><CalendarClock className="h-5 w-5 text-primary" />¿Cuándo {pickup ? "lo retirás" : "lo querés"}?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={!openNow} onClick={() => { setScheduled(false); setSlot(null); }} className={cn("relative rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50", !needsSlot ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <Zap className={cn("h-6 w-6", !needsSlot ? "text-primary" : "text-muted-foreground")} />
                <span className="mt-2 block font-bold">Lo antes posible</span>
                <span className="block text-xs text-muted-foreground">{!openNow ? "El local está cerrado ahora" : pickup ? `Listo en unos ${storeInfo?.tiempo_max ?? 25} min` : `${storeInfo?.tiempo_min ?? 30}–${storeInfo?.tiempo_max ?? 45} min`}</span>
                {!needsSlot && <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />}
              </button>
              <button type="button" disabled={!canSchedule} onClick={() => setScheduled(true)} className={cn("relative rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50", needsSlot ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <CalendarClock className={cn("h-6 w-6", needsSlot ? "text-primary" : "text-muted-foreground")} />
                <span className="mt-2 block font-bold">Programar</span>
                <span className="block text-xs text-muted-foreground">{canSchedule ? "Elegí día y horario" : "Este local no acepta pedidos programados"}</span>
                {needsSlot && <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />}
              </button>
            </div>
            {needsSlot && (
              <div className="mt-4">
                <div className="scrollbar-none flex gap-2 overflow-x-auto" role="tablist" aria-label="Día">
                  {[...slotDays.keys()].map((key) => (
                    <button key={key} type="button" role="tab" aria-selected={slotDayKey === key} onClick={() => { setSlotDayKey(key); setSlot(null); }} className={cn("h-9 shrink-0 rounded-full border px-4 text-sm font-bold capitalize transition-colors", slotDayKey === key ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{key}</button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Horario">
                  {times.map((value) => (
                    <button key={value} type="button" role="radio" aria-checked={slot === value} onClick={() => setSlot(value)} className={cn("h-10 rounded-xl border text-sm font-extrabold tabular-nums transition-colors", slot === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{slotTime(value)}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Podés cancelarlo sin costo hasta 1 hora antes si el local ya lo aceptó.</p>
              </div>
            )}
            {closedWithoutSchedule && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm font-semibold">{store.nombre} está cerrado y no acepta pedidos programados por ahora.</p>}
          </section>

          {pickup ? (
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><StoreIcon className="h-5 w-5 text-primary" />Retirás en</h2>
              <p className="mt-2 font-bold">{storeInfo?.nombre ?? store.nombre}</p>
              <p className="text-sm text-muted-foreground">{storeInfo?.direccion}</p>
              {storeInfo?.latitud != null && <a className="mt-2 inline-block text-sm font-bold text-primary" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${storeInfo.latitud},${storeInfo.longitud}`}>Cómo llegar</a>}
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm">Sin costo de envío ni propina. Cuando esté listo, mostrá tu código en el mostrador.</p>
              <label htmlFor="order-phone" className="mt-5 block text-sm font-bold">Teléfono de contacto</label>
              <Input id="order-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="11 5555-5555" className="mt-2 max-w-xs" />
            </section>
          ) : (
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
          )}

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-extrabold">Medio de pago</h2>
            <div className={cn("mt-3 grid gap-2", onlineEnabled ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
              {(onlineEnabled ? [onlinePayment, ...payments] : payments).map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" onClick={() => { touched.current.payment = true; setPayment(id); }} className={cn("relative rounded-2xl border p-3 text-left transition-colors", payment === id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                  <Icon className={cn("h-6 w-6", payment === id ? "text-primary" : "text-muted-foreground")} />
                  <span className="mt-2 block font-bold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{id === "efectivo" && pickup ? "Pagás al retirar" : hint}</span>
                  {payment === id && <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
            {payment === "efectivo" && (
              <div className="mt-4 rounded-2xl bg-muted/60 p-3">
                <p className="text-sm font-bold">¿Con cuánto vas a pagar?</p>
                <p className="text-xs text-muted-foreground">Así {pickup ? "el local" : "el repartidor"} lleva el vuelto justo.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setCashWith(null); setCustomCash(""); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", cashWith === null ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>Con el monto justo</button>
                  {cashChoices.map((value) => (
                    <button key={value} type="button" onClick={() => { setCashWith(value); setCustomCash(""); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold tabular-nums", cashWith === value && !customCash ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{money(value)}</button>
                  ))}
                  <Input inputMode="numeric" aria-label="Otro monto" placeholder="Otro monto" value={customCash} maxLength={9} className="h-10 w-32 rounded-full bg-card" onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    setCustomCash(digits);
                    const amount = Number(digits);
                    setCashWith(amount >= payable && amount > 0 ? amount : null);
                  }} />
                </div>
                {customCash && Number(customCash) < payable && <p className="mt-2 text-xs font-semibold text-destructive">Tiene que cubrir el total ({money(payable)}).</p>}
                {cashWith !== null && <p className="mt-2 text-sm font-semibold">Tu vuelto: <span className="font-black">{money(change)}</span></p>}
              </div>
            )}
          </section>

          {!pickup && (
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h2 className="text-lg font-extrabold">Propina para quien te lo lleva</h2>
              <p className="text-sm text-muted-foreground">El 100% es para el repartidor.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tips.map((value) => (
                  <button key={value} type="button" onClick={() => { touched.current.tip = true; setTip(value); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", tip === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value === 0 ? "Sin propina" : money(value)}</button>
                ))}
              </div>
            </section>
          )}
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
                <Button variant="outline" onClick={() => applyCoupon()} disabled={checkingCoupon || !couponInput.trim()}>{checkingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}</Button>
              </div>
            )}
            {!coupon?.valido && myCoupons.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-muted-foreground">Tus cupones del Club</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {myCoupons.map((item) => (
                    <button key={item.codigo} type="button" onClick={() => applyCoupon(item.codigo)} disabled={checkingCoupon} className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10">{couponLabel(item)} · {item.codigo}</button>
                  ))}
                </div>
              </div>
            )}
            {coupon && !coupon.valido && <p className="mt-2 text-sm font-semibold text-destructive">{coupon.mensaje}</p>}
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-extrabold">Resumen</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Productos</dt><dd>{money(subtotal)}</dd></div>
              {!pickup && <div className="flex justify-between"><dt className="text-muted-foreground">Envío{summary.reach.km != null && ` (${formatKm(summary.reach.km)})`}</dt><dd className={cn(summary.shipping === 0 && "font-bold text-success")}>{summary.shipping === 0 ? "Gratis" : money(summary.shipping)}</dd></div>}
              {!pickup && summary.reach.surge && summary.shipping > 0 && <p className="-mt-1 text-xs text-muted-foreground">Tarifa dinámica: {summary.reach.surge.join(" · ")}</p>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Tarifa de servicio</dt><dd>{money(summary.service)}</dd></div>
              {summary.tip > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Propina</dt><dd>{money(summary.tip)}</dd></div>}
              {summary.discount > 0 && <div className="flex justify-between font-bold text-success"><dt>Descuento</dt><dd>-{money(summary.discount)}</dd></div>}
              {walletUsed > 0 && <div className="flex justify-between font-bold text-success"><dt>Billetera Woref</dt><dd>-{money(walletUsed)}</dd></div>}
              <div className="flex justify-between border-t pt-3 font-display text-xl font-extrabold"><dt>Total a pagar</dt><dd>{money(payable)}</dd></div>
              {walletBalance > 0 && payment !== "mercadopago" && (
                <label className="flex items-center justify-between gap-3 rounded-xl bg-success/10 p-3 text-sm font-bold"><span>Usar mi saldo de Woref ({money(walletBalance)})</span><Switch checked={useWallet} onCheckedChange={setUseWallet} aria-label="Usar mi saldo de Woref" /></label>
              )}
            </dl>
            {summary.missing > 0 && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm font-semibold">Te faltan {money(summary.missing)} para llegar al pedido mínimo.</p>}
            {!pickup && store.envio_gratis_desde && Number(store.envio_gratis_desde) > 1 && subtotal < Number(store.envio_gratis_desde) && (
              <p className="mt-3 text-sm text-muted-foreground">Sumá {money(Number(store.envio_gratis_desde) - subtotal)} más y el envío es gratis.</p>
            )}
            <p className="mt-3 truncate text-sm text-muted-foreground">{pickup ? "Retirás en" : "Entrega en"} <span className="font-bold text-foreground">{pickup ? storeInfo?.direccion || store.nombre : address?.direccion || "—"}</span>{slot && needsSlot && <> · <span className="font-bold text-foreground">{slotDay(slot)} {slotTime(slot)}</span></>}</p>
            {summary.needsPin && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm font-semibold">Esta dirección no tiene ubicación en el mapa. Agregá una nueva dirección para calcular el envío.</p>}
            {!pickup && !summary.needsPin && summary.reach.zoneClosed && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Por ahora no entregamos en tu zona. Probá más tarde, elegí otra dirección o retirá en el local.</p>}
            {!pickup && !summary.needsPin && !summary.reach.inZone && !summary.reach.zoneClosed && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{store.nombre} no llega a esta dirección (está a {formatKm(summary.reach.km || 0)}). Elegí otra dirección, retirá en el local o pedí en un comercio más cercano.</p>}
            <Button className="mt-4 h-12 w-full rounded-full text-base font-bold max-lg:hidden" onClick={checkout} disabled={submitDisabled}>
              {submitting ? <><Loader2 className="h-5 w-5 animate-spin" />Confirmando…</> : `${!user ? "Ingresar para pedir" : payment === "mercadopago" ? "Pagar" : needsSlot ? "Programar pedido" : "Hacer pedido"} · ${money(payable)}`}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">{payment === "mercadopago" ? "Te llevamos a Mercado Pago para pagar de forma segura." : "El total final lo calcula el sistema al confirmar."}</p>
          </section>
        </aside>
      </div>

      {/* Botón de confirmar fijo abajo en el celular */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t bg-card px-4 pb-3 pt-3 shadow-pop lg:hidden">
        <Button className="h-12 w-full rounded-full text-base font-extrabold" onClick={checkout} disabled={submitDisabled}>
          {submitting ? <><Loader2 className="h-5 w-5 animate-spin" />Confirmando…</> : `${!user ? "Ingresar para pedir" : payment === "mercadopago" ? "Pagar" : needsSlot ? "Programar pedido" : "Hacer pedido"} · ${money(payable)}`}
        </Button>
      </div>
    </div>
  );
}
