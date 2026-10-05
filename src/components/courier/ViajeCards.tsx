import { FormEvent, useState } from "react";
import { categoriaLabel } from "@/lib/remis";
import { Banknote, Car, KeyRound, Loader2, MapPin, Navigation, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/maps/LazyMaps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { formatKm, GeoPoint } from "@/lib/geo";
import type { Viaje, ViajeOferta } from "@/lib/remis";
import { cn } from "@/lib/utils";

const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Oferta de viaje de remís: la dirección exacta se ve recién al aceptar. */
export function ViajeOfferCard({ offer, onChange }: { offer: ViajeOferta; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const { error } = await db.rpc("delivery_tomar_viaje", { p_id: offer.id });
    setBusy(false);
    if (error) toast.error(errorMessage(error)); else toast.success("¡Viaje tuyo! Andá a buscar al pasajero.");
    onChange();
  };
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-sky-400/70 bg-card shadow-pop">
      <div className="flex items-center gap-3 bg-sky-100/70 p-4 dark:bg-sky-500/10">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-200 text-sky-800"><Car className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-sky-700 dark:text-sky-300">Viaje de remís · lo toma el primero</p><p className="truncate text-lg font-extrabold">{offer.origen_zona} → {offer.destino_zona}</p></div>
        <div className="text-right"><p className="font-display text-3xl font-black leading-none text-success">{money(offer.ganancia)}</p><p className="text-[11px] font-semibold text-muted-foreground">tu ganancia</p></div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{formatKm(Number(offer.distancia_km))} de viaje</span>
          {offer.dist_recogida_km != null && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{formatKm(Number(offer.dist_recogida_km))} hasta el pasajero</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-bold"><Users className="h-3 w-3" />{offer.pasajeros}</span>
          {offer.categoria && offer.categoria !== "estandar" && <span className="rounded-full bg-sky-200 px-3 py-1 text-xs font-bold text-sky-900">{categoriaLabel(offer.categoria)}</span>}
          {offer.programado_para && <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-bold">Reservado: {formatDateTime(offer.programado_para)}</span>}
        </div>
        <p className="flex items-center gap-2 rounded-xl bg-warning/15 p-3 font-semibold"><Banknote className="h-4 w-4 shrink-0" />Cobrás el viaje en efectivo al llegar a destino</p>
      </div>
      <div className="p-4 pt-0"><Button className="h-12 w-full rounded-full text-base font-extrabold" disabled={busy} onClick={accept}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar viaje"}</Button></div>
    </article>
  );
}

/** Viaje en curso: ir al origen → llegué → subir con el código → viajar → terminar y cobrar. */
export function ActiveViaje({ viaje, position, sharing, onChange }: { viaje: Viaje; position: GeoPoint | null; sharing: string; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const aboard = viaje.estado === "a_bordo";
  const waiting = viaje.estado === "en_origen";
  const markers = [
    { lat: Number(viaje.origen_lat), lng: Number(viaje.origen_lng), kind: "home" as const, label: "Pasajero" },
    { lat: Number(viaje.destino_lat), lng: Number(viaje.destino_lng), kind: "store" as const, label: "Destino" },
    ...(position ? [{ ...position, kind: "courier" as const, label: "Vos" }] : []),
  ];

  const advance = async (estado: "en_origen" | "a_bordo" | "completado", codigo?: string) => {
    setBusy(true);
    const { error } = await db.rpc("delivery_viaje_avanzar", { p_id: viaje.id, p_estado: estado, p_codigo: codigo ?? null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(estado === "en_origen" ? "Avisamos al pasajero que llegaste." : estado === "a_bordo" ? "¡Viaje iniciado!" : `¡Viaje terminado! Ganaste ${money(viaje.ganancia_conductor)}`);
    setCode("");
    onChange();
  };
  const start = (event: FormEvent) => { event.preventDefault(); advance("a_bordo", code.trim()); };
  const target = aboard ? { lat: Number(viaje.destino_lat), lng: Number(viaje.destino_lng), label: "Destino", address: viaje.destino_direccion } : { lat: Number(viaje.origen_lat), lng: Number(viaje.origen_lng), label: "Pasajero", address: viaje.origen_direccion };

  return (
    <section className="mt-6 rounded-3xl border-2 border-sky-400 bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-sky-700 dark:text-sky-300">Remís en curso · {shortId(viaje.id)}</p><h2 className="text-2xl font-extrabold">{aboard ? "Llevá al pasajero a destino" : waiting ? "Esperando al pasajero" : "Andá a buscar al pasajero"}</h2></div>
        <div className="text-right"><p className="font-display text-2xl font-black text-success">{money(viaje.ganancia_conductor)}</p><p className="text-[11px] text-muted-foreground">tu ganancia</p></div>
      </div>

      <MapView markers={markers} className="mt-4 h-52 sm:h-64" />
      <p className={cn("mt-2 text-xs font-semibold", sharing === "sharing" ? "text-success" : "text-warning-foreground dark:text-warning")}>{sharing === "sharing" ? "● Compartiendo tu ubicación en vivo" : sharing === "denied" ? "Activá el permiso de ubicación para que el pasajero te vea" : "Activando ubicación…"}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href={directions(target.lat, target.lng)} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-2xl border border-primary bg-primary/5 p-3"><Navigation className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">{target.label}</span><span className="block text-sm text-muted-foreground">{target.address}</span><span className="text-xs font-bold text-primary">Abrir en Google Maps</span></span></a>
        <div className="rounded-2xl border p-3">
          <p className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-primary" />{viaje.pasajeros} {viaje.pasajeros === 1 ? "pasajero" : "pasajeros"}</p>
          {viaje.notas && <p className="mt-1 text-sm text-muted-foreground">“{viaje.notas}”</p>}
          <Button asChild variant="outline" size="sm" className="mt-2 rounded-full"><a href={phoneHref(viaje.telefono)}><Phone className="h-4 w-4" />Llamar al pasajero</a></Button>
        </div>
      </div>
      <div className="mt-3 flex gap-3 rounded-2xl bg-muted p-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{viaje.origen_direccion} → {viaje.destino_direccion}</span></div>
      <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warning/15 p-3 text-sm font-semibold"><Banknote className="mt-0.5 h-4 w-4 shrink-0" />Al llegar a destino cobrá {money(viaje.total)} en efectivo (viaje {money(viaje.tarifa)}{Number(viaje.propina) > 0 ? ` + propina ${money(viaje.propina)}` : ""}).</p>

      <div className="mt-4">
        {viaje.estado === "asignado" && (
          <div className="space-y-2">
            <Button className="h-12 w-full rounded-full text-base font-bold" onClick={() => advance("en_origen")} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Llegué donde está el pasajero</Button>
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setReleasing(true)}>No puedo hacer este viaje</Button>
          </div>
        )}
        {waiting && (
          <div className="space-y-2">
            <form onSubmit={start} className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-full border px-4"><KeyRound className="h-5 w-5 text-muted-foreground" /><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Código del pasajero (4 números)" aria-label="Código del pasajero" className="h-auto border-0 p-0 text-base shadow-none focus-visible:ring-0" /></label>
              <Button type="submit" className="h-12 rounded-full px-6 text-base font-bold" disabled={busy || code.length !== 4}>Iniciar viaje</Button>
            </form>
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setReleasing(true)}>El pasajero no aparece</Button>
          </div>
        )}
        {aboard && <Button className="h-12 w-full rounded-full text-base font-bold" onClick={() => advance("completado")} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Terminé el viaje y cobré</Button>}
      </div>
      <ReleaseViajeDialog open={releasing} onOpenChange={setReleasing} viajeId={viaje.id} onDone={onChange} />
    </section>
  );
}

function ReleaseViajeDialog({ open, onOpenChange, viajeId, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; viajeId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const release = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_soltar_viaje", { p_id: viajeId, p_motivo: reason.trim() });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Soltaste el viaje. Se lo ofrecemos a otro conductor.");
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xl font-black">¿Por qué soltás el viaje?</DialogTitle>
        <DialogDescription>Se le ofrece a otro conductor. Soltar viajes seguido afecta tu cuenta.</DialogDescription>
        <Textarea value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder="Contanos qué pasó" className="min-h-[80px] resize-none" aria-label="Motivo" />
        <Button variant="destructive" className="rounded-full" onClick={release} disabled={saving || reason.trim().length < 5}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Soltar viaje</Button>
      </DialogContent>
    </Dialog>
  );
}
