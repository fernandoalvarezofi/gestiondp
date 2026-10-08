import { FormEvent, useEffect, useMemo, useState } from "react";
import { Banknote, Camera, Check, KeyRound, Loader2, MapPin, Navigation, Phone, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ChatButton } from "@/components/delivery/OrderChat";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { changeOrderStatus } from "@/components/merchant/MerchantOrders";
import { MapView } from "@/components/maps/LazyMaps";
import type { MapMarker } from "@/components/maps/DeliveryMap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, DeliveryOrder, errorMessage, formatTime, metodoPagoLabel, money, optionsLabel, shortId } from "@/lib/delivery";
import { formatKm, GeoPoint } from "@/lib/geo";
import { uploadDeliveryProof } from "@/lib/uploads";
import { cn } from "@/lib/utils";

const RELEASE_REASONS = ["Tuve un problema con mi vehículo", "Me surgió un imprevisto", "El comercio demora demasiado"];

type Step = "ir_comercio" | "en_comercio" | "ir_cliente" | "en_puerta";
const STEPS: { id: Step; label: string }[] = [
  { id: "ir_comercio", label: "Ir al comercio" },
  { id: "en_comercio", label: "Retirar" },
  { id: "ir_cliente", label: "Ir al cliente" },
  { id: "en_puerta", label: "Entregar" },
];

function currentStep(order: DeliveryOrder): Step {
  if (order.estado === "en_camino") return order.llegada_cliente_at ? "en_puerta" : "ir_cliente";
  return order.llegada_comercio_at ? "en_comercio" : "ir_comercio";
}

const directions = (lat: number | null | undefined, lng: number | null | undefined, address: string) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Entrega en curso paso a paso: llegué al comercio → retiré → llegué al cliente → entregué (con código). */
export function ActiveDelivery({ order, position, sharing, onChange }: { order: DeliveryOrder; position: GeoPoint | null; sharing: string; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const step = currentStep(order);
  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const earning = Number(order.ganancia_repartidor ?? Number(order.costo_envio) + Number(order.propina));
  const markers: MapMarker[] = [
    ...(order.comercio?.latitud != null && order.comercio?.longitud != null ? [{ lat: Number(order.comercio.latitud), lng: Number(order.comercio.longitud), kind: "store" as const, label: order.comercio.nombre }] : []),
    ...(order.latitud != null && order.longitud != null ? [{ lat: Number(order.latitud), lng: Number(order.longitud), kind: "home" as const, label: "Entrega" }] : []),
    ...(position ? [{ ...position, kind: "courier" as const, label: "Vos" }] : []),
  ];

  const arrived = async (where: "comercio" | "cliente") => {
    setBusy(true);
    const { error } = await db.rpc("delivery_marcar_llegada", { p_pedido: order.id, p_donde: where });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(where === "comercio" ? "Avisamos al comercio que llegaste" : "Avisamos al cliente que llegaste");
    onChange();
  };
  const pickUp = async () => {
    setBusy(true);
    const ok = await changeOrderStatus(order.id, "en_camino");
    setBusy(false);
    if (ok) { toast.success("¡En camino! El cliente ya fue avisado."); onChange(); }
  };
  const deliver = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    let proof: string | null = null;
    if (photo) {
      try { proof = await uploadDeliveryProof(photo, order.id); } catch (cause) { toast.error(errorMessage(cause)); setBusy(false); return; }
    }
    const ok = await changeOrderStatus(order.id, "entregado", undefined, code.trim());
    if (ok && proof) await db.rpc("delivery_registrar_foto_entrega", { p_pedido: order.id, p_path: proof });
    setBusy(false);
    if (ok) { toast.success(`¡Entregado! Ganaste ${money(earning)}`); setCode(""); setPhoto(null); onChange(); }
  };

  const change = order.efectivo_paga_con != null ? Number(order.efectivo_paga_con) - Number(order.total) : null;

  return (
    <section className="mt-6 rounded-3xl border-2 border-brand-yellow bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Entrega en curso · {shortId(order.id)}</p>
          <h2 className="text-2xl font-extrabold">
            {step === "ir_comercio" ? `Andá a ${order.comercio?.nombre}` : step === "en_comercio" ? "Retirá el pedido" : step === "ir_cliente" ? "Llevalo al cliente" : "Entregalo en la puerta"}
          </h2>
        </div>
        <div className="text-right"><p className="font-display text-2xl font-black text-success">{money(earning)}</p><p className="text-[11px] text-muted-foreground">tu ganancia</p></div>
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Pasos de la entrega">
        {STEPS.map((item, index) => (
          <li key={item.id} className="flex flex-col items-center text-center">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-black", index < stepIndex ? "bg-primary text-primary-foreground" : index === stepIndex ? "bg-brand-yellow text-brand-yellow-foreground ring-4 ring-brand-yellow/20" : "bg-muted text-muted-foreground")}>{index < stepIndex ? <Check className="h-4 w-4" /> : index + 1}</span>
            <span className={cn("mt-1 text-[11px] font-bold leading-tight", index <= stepIndex ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
          </li>
        ))}
      </ol>

      {markers.length > 1 && <MapView markers={markers} className="mt-4 h-52 sm:h-64" />}
      <p className={cn("mt-2 text-xs font-semibold", sharing === "sharing" ? "text-success" : "text-warning-foreground dark:text-warning")}>
        {sharing === "sharing" ? "● Compartiendo tu ubicación en vivo" : sharing === "denied" ? "Activá el permiso de ubicación: el cliente no puede seguirte y no vas a poder marcar tus llegadas" : "Buscando tu ubicación…"}
        {order.distancia_km != null && ` · Recorrido al cliente ${formatKm(Number(order.distancia_km))}`}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href={directions(order.comercio?.latitud, order.comercio?.longitud, order.comercio?.direccion || "")} target="_blank" rel="noopener noreferrer" className={cn("flex gap-3 rounded-2xl border p-3 hover:bg-muted", (step === "ir_comercio" || step === "en_comercio") && "border-brand-yellow bg-brand-yellow/5")}>
          <Store className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">Retiro · {order.comercio?.nombre}</span><span className="block text-sm text-muted-foreground">{order.comercio?.direccion}</span></span><Navigation className="ml-auto h-4 w-4 shrink-0" />
        </a>
        <a href={directions(order.latitud, order.longitud, order.direccion_entrega)} target="_blank" rel="noopener noreferrer" className={cn("flex gap-3 rounded-2xl border p-3 hover:bg-muted", (step === "ir_cliente" || step === "en_puerta") && "border-brand-yellow bg-brand-yellow/5")}>
          <MapPin className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">Entrega · {order.cliente?.nombre?.split(" ")[0] || "cliente"}</span><span className="block text-sm text-muted-foreground">{order.direccion_entrega}</span></span><Navigation className="ml-auto h-4 w-4 shrink-0" />
        </a>
      </div>

      <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
        <p className="font-bold">Contenido ({(order.items || []).reduce((total, item) => total + item.cantidad, 0)} productos)</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {(order.items || []).map((item, index) => <li key={item.id || index}><span className="font-bold text-foreground">{item.cantidad}×</span> {item.nombre}{item.opciones?.length ? ` (${optionsLabel(item.opciones)})` : ""}</li>)}
        </ul>
        {order.notas && <p className="mt-2"><span className="font-bold">Nota del cliente: </span>{order.notas}</p>}
      </div>

      <p className={cn("mt-3 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold", order.metodo_pago === "efectivo" ? "bg-warning/15" : "bg-success/10 text-success")}>
        {order.metodo_pago === "efectivo" ? <Banknote className="mt-0.5 h-4 w-4 shrink-0" /> : <Wallet className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{order.metodo_pago === "efectivo"
          ? `Cobrá ${money(order.total)} en efectivo${change != null ? ` · el cliente paga con ${money(order.efectivo_paga_con)}: llevá ${money(change)} de vuelto` : ""}`
          : order.metodo_pago === "mercadopago" ? "Ya está pagado online: no cobres nada" : `${metodoPagoLabel[order.metodo_pago]}: cobrá ${money(order.total)}`}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ChatButton pedidoId={order.id} canal="repartidor" label="Chat con el cliente" title={order.cliente?.nombre || "Cliente"} subtitle={`Pedido ${shortId(order.id)}`} />
        {order.telefono_contacto && <Button asChild variant="outline" size="sm" className="rounded-full"><a href={`tel:${order.telefono_contacto.replace(/\s/g, "")}`}><Phone className="h-4 w-4" />Llamar al cliente</a></Button>}
        {order.comercio?.telefono && <Button asChild variant="outline" size="sm" className="rounded-full"><a href={`tel:${order.comercio.telefono.replace(/\s/g, "")}`}><Store className="h-4 w-4" />Llamar al comercio</a></Button>}
      </div>

      <div className="mt-4">
        {step === "ir_comercio" && <Button className="h-12 w-full rounded-full text-base font-bold" onClick={() => arrived("comercio")} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Llegué al comercio</Button>}
        {step === "en_comercio" && (
          <div className="space-y-2">
            <p className="rounded-xl bg-muted p-3 text-center text-sm font-semibold">{order.estado === "preparando" ? (order.listo_at ? "¡Está listo! Pasá a retirarlo." : "Ya lo están preparando. Retiralo cuando te lo entreguen.") : "El comercio todavía no empezó a prepararlo. Esperá o consultale."}</p>
            <Button className="h-12 w-full rounded-full text-base font-bold" onClick={pickUp} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Retiré el pedido</Button>
          </div>
        )}
        {step === "ir_cliente" && <Button className="h-12 w-full rounded-full text-base font-bold" onClick={() => arrived("cliente")} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Llegué al cliente</Button>}
        {step === "en_puerta" && (
          <form onSubmit={deliver} className="space-y-2">
            <div className="flex items-center gap-3 rounded-2xl border p-3">
              {photoUrl ? <img src={photoUrl} alt="Foto de la entrega" className="h-14 w-14 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted"><Camera className="h-6 w-6 text-muted-foreground" /></span>}
              <div className="min-w-0 flex-1 text-sm"><p className="font-bold">Foto de la entrega <span className="font-normal text-muted-foreground">(opcional)</span></p><p className="text-muted-foreground">Te cuida si el cliente dice que no le llegó.</p></div>
              <label className="cursor-pointer rounded-full border px-3 py-2 text-sm font-bold hover:bg-muted">{photo ? "Cambiar" : "Sacar foto"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 sm:flex-1"><KeyRound className="h-5 w-5 text-muted-foreground" /><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código del cliente" aria-label="Código de entrega" className="h-full border-0 p-0 font-mono text-lg tracking-widest shadow-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal focus-visible:ring-0" /></label>
            <Button type="submit" className="h-12 rounded-full px-6 text-base font-bold" disabled={busy || code.length !== 4}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar entrega</Button>
            </div>
          </form>
        )}
        {(step === "ir_comercio" || step === "en_comercio") && order.estado !== "en_camino" && <Button variant="ghost" className="mt-2 w-full text-destructive" onClick={() => setReleasing(true)}>No puedo hacer este pedido</Button>}
      </div>

      <ReleaseDialog open={releasing} onOpenChange={setReleasing} orderId={order.id} onDone={onChange} />
      {order.entrega_estimada && <p className="mt-3 text-center text-xs text-muted-foreground">El cliente espera su pedido para las {formatTime(order.entrega_estimada)}</p>}
    </section>
  );
}

function ReleaseDialog({ open, onOpenChange, orderId, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; orderId: string; onDone: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const text = reason === "Otro motivo" ? other.trim() : reason;

  const release = async () => {
    if (!text || text.length < 5) { toast.error("Contanos el motivo"); return; }
    setSaving(true);
    const { error } = await db.rpc("delivery_soltar_pedido", { p_pedido: orderId, p_motivo: text });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Soltaste el pedido. Se lo ofrecemos a otro repartidor.");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xl font-black">¿Por qué soltás el pedido?</DialogTitle>
        <DialogDescription>Se le ofrece a otro repartidor. Soltar pedidos seguido afecta tu cuenta.</DialogDescription>
        <div className="space-y-2" role="radiogroup" aria-label="Motivo">
          {[...RELEASE_REASONS, "Otro motivo"].map((item) => (
            <button key={item} type="button" role="radio" aria-checked={reason === item} onClick={() => setReason(item)} className={cn("flex w-full items-center rounded-2xl border p-3 text-left text-sm font-bold transition-colors", reason === item ? "border-primary bg-primary/5" : "hover:bg-muted")}>{item}</button>
          ))}
        </div>
        {reason === "Otro motivo" && <Textarea value={other} maxLength={200} onChange={(event) => setOther(event.target.value)} placeholder="Contanos qué pasó" className="min-h-[72px] resize-none" aria-label="Otro motivo" />}
        <Button variant="destructive" className="rounded-full" onClick={release} disabled={saving || !text}>Soltar pedido</Button>
      </DialogContent>
    </Dialog>
  );
}
