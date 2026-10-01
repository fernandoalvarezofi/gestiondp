import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Car, Footprints, KeyRound, Loader2, MapPin, Navigation, PackageCheck, Phone, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { changeOrderStatus } from "@/components/merchant/MerchantOrders";
import { db, DeliveryOrder, errorMessage, formatDateTime, formatTime, metodoPagoLabel, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Courier = { perfil_id: string; vehiculo: string; telefono?: string | null; disponible: boolean; activo: boolean };
const vehicles = [
  { id: "moto", label: "Moto", icon: Bike },
  { id: "bici", label: "Bici", icon: Bike },
  { id: "auto", label: "Auto", icon: Car },
  { id: "a_pie", label: "A pie", icon: Footprints },
];
const courierSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,direccion,telefono), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";
const earning = (order: DeliveryOrder) => Number(order.costo_envio) + Number(order.propina);
const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export default function CourierDashboard() {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<DeliveryOrder[]>([]);
  const [mine, setMine] = useState<DeliveryOrder[]>([]);

  const loadCourier = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_repartidores").select("*").eq("perfil_id", user.id).maybeSingle();
    setCourier(data || null);
    setLoading(false);
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const [{ data: open }, { data: own }] = await Promise.all([
      db.from("delivery_pedidos").select(courierSelect).is("repartidor_id", null).in("estado", ["confirmado", "preparando"]).order("created_at"),
      db.from("delivery_pedidos").select(courierSelect).eq("repartidor_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setAvailable(open || []);
    setMine(own || []);
  }, [user]);

  useEffect(() => { loadCourier(); }, [loadCourier]);

  useEffect(() => {
    if (!courier?.activo) return;
    loadOrders();
    const channel = db.channel(`repartidor-${courier.perfil_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos" }, loadOrders)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [courier?.activo, courier?.perfil_id, loadOrders]);

  const current = mine.find((order) => ["confirmado", "preparando", "en_camino"].includes(order.estado)) || null;
  const delivered = useMemo(() => mine.filter((order) => order.estado === "entregado"), [mine]);
  const todayEarnings = useMemo(() => {
    const today = new Date().toDateString();
    return delivered.filter((order) => new Date(order.entregado_at || order.created_at).toDateString() === today);
  }, [delivered]);

  const toggleAvailable = async (value: boolean) => {
    if (!courier) return;
    setCourier({ ...courier, disponible: value });
    const { error } = await db.from("delivery_repartidores").update({ disponible: value }).eq("perfil_id", courier.perfil_id);
    if (error) { toast.error(errorMessage(error)); loadCourier(); }
  };

  const take = async (order: DeliveryOrder) => {
    const { error } = await db.rpc("delivery_tomar_pedido", { p_pedido: order.id });
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Pedido asignado! Andá a retirarlo.");
    loadOrders();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier) return <CourierSignup onDone={loadCourier} />;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Bike className="h-7 w-7" />} title="Tu cuenta de repartidor está pausada" text="Comunicate con soporte para reactivarla." /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader
        eyebrow="Panel de repartidor"
        title={courier.disponible ? "Estás conectado" : "Estás desconectado"}
        subtitle={courier.disponible ? "Te mostramos los pedidos listos para retirar cerca tuyo." : "Conectate para empezar a recibir pedidos."}
        actions={
          <label className={cn("flex items-center gap-3 rounded-full border px-4 py-2 font-bold", courier.disponible ? "border-success/40 bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
            {courier.disponible ? "Conectado" : "Desconectado"}<Switch checked={courier.disponible} onCheckedChange={toggleAvailable} />
          </label>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ganancias de hoy" value={money(todayEarnings.reduce((total, order) => total + earning(order), 0))} icon={<Wallet className="h-4 w-4" />} hint="Envíos + propinas" />
        <StatCard label="Entregas de hoy" value={todayEarnings.length} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Ganancias totales" value={money(delivered.reduce((total, order) => total + earning(order), 0))} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Entregas totales" value={delivered.length} icon={<Bike className="h-4 w-4" />} />
      </div>

      {current && <CurrentDelivery order={current} onChange={loadOrders} />}

      {!current && courier.disponible && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">Pedidos disponibles ({available.length})</h2>
          {available.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {available.map((order) => (
                <article key={order.id} className="rounded-3xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-extrabold">{order.comercio?.nombre}</p><p className="text-xs text-muted-foreground">{shortId(order.id)} · {formatTime(order.created_at)} · {order.items?.length || 0} productos</p></div>
                    <div className="text-right"><p className="font-display text-xl font-extrabold text-success">{money(earning(order))}</p><p className="text-[11px] text-muted-foreground">ganancia</p></div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="flex gap-2"><Store className="h-4 w-4 shrink-0 text-primary" /><span><span className="font-bold">Retiro: </span>{order.comercio?.direccion}</span></p>
                    <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span><span className="font-bold">Entrega: </span>{order.direccion_entrega}</span></p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2"><StatusBadge estado={order.estado} /><Button className="rounded-full" onClick={() => take(order)}>Aceptar pedido</Button></div>
                </article>
              ))}
            </div>
          ) : <EmptyState className="mt-3" icon={<Bike className="h-7 w-7" />} title="No hay pedidos para retirar ahora" text="Quedate conectado: te avisamos apenas aparezca uno." />}
        </section>
      )}

      {delivered.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">Historial de entregas</h2>
          <ul className="mt-3 divide-y overflow-hidden rounded-3xl border bg-card">
            {delivered.slice(0, 30).map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-bold">{order.comercio?.nombre}</span><span className="block truncate text-muted-foreground">{formatDateTime(order.entregado_at || order.created_at)} · {order.direccion_entrega}</span></span>
                <span className="shrink-0 font-bold text-success">+{money(earning(order))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CurrentDelivery({ order, onChange }: { order: DeliveryOrder; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const pickedUp = order.estado === "en_camino";

  const pickUp = async () => {
    setBusy(true);
    const ok = await changeOrderStatus(order.id, "en_camino");
    setBusy(false);
    if (ok) { toast.success("¡En camino! El cliente ya fue avisado."); onChange(); }
  };
  const deliver = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const ok = await changeOrderStatus(order.id, "entregado", undefined, code.trim());
    setBusy(false);
    if (ok) { toast.success(`¡Entregado! Ganaste ${money(earning(order))}`); onChange(); }
  };

  return (
    <section className="mt-8 rounded-3xl border-2 border-primary bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-primary">Entrega en curso · {shortId(order.id)}</p><h2 className="text-2xl font-extrabold">{pickedUp ? "Llevalo al cliente" : `Retiralo en ${order.comercio?.nombre}`}</h2></div>
        <StatusBadge estado={order.estado} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a href={mapsUrl(order.comercio?.direccion || "")} target="_blank" rel="noreferrer" className={cn("flex gap-3 rounded-2xl border p-3 hover:bg-muted", !pickedUp && "border-primary bg-primary/5")}>
          <Store className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">1. Retiro</span><span className="block text-sm text-muted-foreground">{order.comercio?.nombre} · {order.comercio?.direccion}</span></span><Navigation className="ml-auto h-4 w-4 shrink-0" />
        </a>
        <a href={mapsUrl(order.direccion_entrega)} target="_blank" rel="noreferrer" className={cn("flex gap-3 rounded-2xl border p-3 hover:bg-muted", pickedUp && "border-primary bg-primary/5")}>
          <MapPin className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">2. Entrega a {order.cliente?.nombre?.split(" ")[0] || "cliente"}</span><span className="block text-sm text-muted-foreground">{order.direccion_entrega}</span></span><Navigation className="ml-auto h-4 w-4 shrink-0" />
        </a>
      </div>

      <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
        <p className="font-bold">Contenido</p>
        <p className="text-muted-foreground">{(order.items || []).map((item) => `${item.cantidad}× ${item.nombre}${item.opciones?.length ? ` (${item.opciones.map((option) => option.nombre).join(", ")})` : ""}`).join(" · ")}</p>
        <p className="mt-2"><span className="font-bold">Cobro: </span>{order.metodo_pago === "efectivo" ? `Cobrá ${money(order.total)} en efectivo` : metodoPagoLabel[order.metodo_pago]}</p>
        {order.notas && <p className="mt-1"><span className="font-bold">Nota: </span>{order.notas}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {order.telefono_contacto && <Button asChild variant="outline" className="rounded-full"><a href={`tel:${order.telefono_contacto.replace(/\s/g, "")}`}><Phone className="h-4 w-4" />Llamar al cliente</a></Button>}
        {order.comercio?.telefono && <Button asChild variant="outline" className="rounded-full"><a href={`tel:${order.comercio.telefono.replace(/\s/g, "")}`}><Store className="h-4 w-4" />Llamar al comercio</a></Button>}
      </div>

      {!pickedUp ? (
        <Button className="mt-4 h-12 w-full rounded-full text-base font-bold" onClick={pickUp} disabled={busy}>{order.estado === "confirmado" ? "Retiré el pedido (aún en preparación)" : "Retiré el pedido"}</Button>
      ) : (
        <form onSubmit={deliver} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full border px-4"><KeyRound className="h-5 w-5 text-muted-foreground" /><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Código de entrega del cliente" className="h-full border-0 p-0 font-mono text-lg tracking-widest shadow-none focus-visible:ring-0" /></label>
          <Button type="submit" className="h-12 rounded-full px-6 text-base font-bold" disabled={busy || code.length !== 4}>Confirmar entrega</Button>
        </form>
      )}
    </section>
  );
}

function CourierSignup({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState("moto");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await db.from("delivery_repartidores").insert({ perfil_id: user.id, vehiculo: vehicle, telefono: phone.trim() || null, disponible: true });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Bienvenido al equipo de repartidores!");
    onDone();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground">
        <Bike className="absolute -bottom-8 -right-6 h-48 w-48 text-white/10" />
        <div className="relative">
          <Bike className="h-10 w-10" />
          <h1 className="mt-3 text-3xl font-extrabold">Repartí con Woref</h1>
          <p className="mt-2 max-w-md text-primary-foreground/85">Elegí tus horarios, conectate cuando quieras y quedate con el 100% de las propinas.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-5 rounded-3xl border bg-card p-5">
        <div>
          <p className="font-bold">¿Cómo vas a repartir?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {vehicles.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setVehicle(id)} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-3 font-bold", vehicle === id ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}><Icon className="h-6 w-6" />{label}</button>
            ))}
          </div>
        </div>
        <div><label htmlFor="courier-phone" className="font-bold">Teléfono de contacto</label><Input id="courier-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} placeholder="11 5555-5555" className="mt-2" /></div>
        <Button type="submit" className="h-12 w-full rounded-full text-base font-bold" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Empezar a repartir</Button>
      </form>
    </div>
  );
}
