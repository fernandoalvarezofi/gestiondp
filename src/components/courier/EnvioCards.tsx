import { FormEvent, useState } from "react";
import { Banknote, Check, KeyRound, Loader2, MapPin, Navigation, Package, PackageCheck, Phone } from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/maps/LazyMaps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, money, shortId } from "@/lib/delivery";
import { Envio, EnvioOferta, tamanoLabel } from "@/lib/envios";
import { formatKm, GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Oferta de envío de paquete: la dirección exacta se ve recién al aceptar. */
export function EnvioOfferCard({ offer, onChange }: { offer: EnvioOferta; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const { error } = await db.rpc("delivery_tomar_envio", { p_id: offer.id });
    setBusy(false);
    if (error) toast.error(errorMessage(error)); else toast.success("¡Envío tuyo! Andá a retirar el paquete.");
    onChange();
  };
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-amber-400/70 bg-card shadow-pop">
      <div className="flex items-center gap-3 bg-amber-100/70 p-4 dark:bg-amber-500/10">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-800"><Package className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300">Envío de paquete · lo toma el primero</p><p className="truncate text-lg font-extrabold">{offer.descripcion}</p></div>
        <div className="text-right"><p className="font-display text-3xl font-black leading-none text-success">{money(offer.ganancia)}</p><p className="text-[11px] font-semibold text-muted-foreground">tu ganancia</p></div>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Retiro</p><p className="text-muted-foreground">{offer.origen_zona} · la dirección exacta la ves al aceptar</p></div>{offer.dist_retiro_km != null && <p className="ml-auto shrink-0 font-bold">{formatKm(Number(offer.dist_retiro_km))}<span className="block text-right text-[11px] font-normal text-muted-foreground">de vos</span></p>}</div>
        <div className="flex gap-3"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Entrega</p><p className="text-muted-foreground">{offer.destino_zona}</p></div><p className="ml-auto shrink-0 font-bold">{formatKm(Number(offer.distancia_km))}<span className="block text-right text-[11px] font-normal text-muted-foreground">del retiro</span></p></div>
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">Tamaño {tamanoLabel[offer.tamano].toLowerCase()}</span></div>
        <p className="flex items-center gap-2 rounded-xl bg-warning/15 p-3 font-semibold"><Banknote className="h-4 w-4 shrink-0" />Cobrás {money(offer.cobrar)} en efectivo {offer.quien_paga === "origen" ? "al retirar el paquete" : "al entregarlo"}</p>
      </div>
      <div className="p-4 pt-0"><Button className="h-12 w-full rounded-full text-base font-extrabold" disabled={busy} onClick={accept}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar envío"}</Button></div>
    </article>
  );
}

/** Envío en curso: ir al retiro → retirar → ir a la entrega → entregar con el código del destinatario. */
export function ActiveEnvio({ envio, position, sharing, onChange }: { envio: Envio; position: GeoPoint | null; sharing: string; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const pickedUp = envio.estado === "retirado";
  const markers = [
    { lat: Number(envio.origen_lat), lng: Number(envio.origen_lng), kind: "store" as const, label: "Retiro" },
    { lat: Number(envio.destino_lat), lng: Number(envio.destino_lng), kind: "home" as const, label: "Entrega" },
    ...(position ? [{ ...position, kind: "courier" as const, label: "Vos" }] : []),
  ];

  const advance = async (estado: "retirado" | "entregado", codigo?: string) => {
    setBusy(true);
    const { error } = await db.rpc("delivery_envio_avanzar", { p_id: envio.id, p_estado: estado, p_codigo: codigo ?? null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(estado === "retirado" ? "¡Paquete retirado! Llevalo a destino." : `¡Entregado! Ganaste ${money(envio.ganancia_repartidor)}`);
    setCode("");
    onChange();
  };
  const deliver = (event: FormEvent) => { event.preventDefault(); advance("entregado", code.trim()); };

  return (
    <section className="mt-6 rounded-3xl border-2 border-amber-400 bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300">Envío en curso · {shortId(envio.id)}</p><h2 className="text-2xl font-extrabold">{pickedUp ? "Llevalo a la entrega" : "Andá a retirar el paquete"}</h2></div>
        <div className="text-right"><p className="font-display text-2xl font-black text-success">{money(envio.ganancia_repartidor)}</p><p className="text-[11px] text-muted-foreground">tu ganancia</p></div>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-1" aria-label="Pasos del envío">
        {["Retirar", "Entregar"].map((label, index) => (
          <li key={label} className="flex flex-col items-center text-center">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-black", index < Number(pickedUp) ? "bg-primary text-primary-foreground" : index === Number(pickedUp) ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground")}>{index < Number(pickedUp) ? <Check className="h-4 w-4" /> : index + 1}</span>
            <span className="mt-1 text-[11px] font-bold">{label}</span>
          </li>
        ))}
      </ol>

      <MapView markers={markers} className="mt-4 h-52 sm:h-64" />
      <p className={cn("mt-2 text-xs font-semibold", sharing === "sharing" ? "text-success" : "text-warning-foreground dark:text-warning")}>{sharing === "sharing" ? "● Compartiendo tu ubicación en vivo" : sharing === "denied" ? "Activá el permiso de ubicación: el cliente no puede seguirte" : "Buscando tu ubicación…"} · Recorrido {formatKm(Number(envio.distancia_km))}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={cn("rounded-2xl border p-3", !pickedUp && "border-primary bg-primary/5")}>
          <a href={directions(Number(envio.origen_lat), Number(envio.origen_lng))} target="_blank" rel="noopener noreferrer" className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">Retiro · {envio.origen_contacto}</span><span className="block text-sm text-muted-foreground">{envio.origen_direccion}</span>{envio.origen_notas && <span className="block text-sm text-muted-foreground">“{envio.origen_notas}”</span>}</span><Navigation className="ml-auto h-4 w-4 shrink-0" /></a>
          <Button asChild variant="outline" size="sm" className="mt-2 rounded-full"><a href={phoneHref(envio.origen_telefono)}><Phone className="h-4 w-4" />Llamar a {envio.origen_contacto.split(" ")[0]}</a></Button>
        </div>
        <div className={cn("rounded-2xl border p-3", pickedUp && "border-primary bg-primary/5")}>
          <a href={directions(Number(envio.destino_lat), Number(envio.destino_lng))} target="_blank" rel="noopener noreferrer" className="flex gap-3"><PackageCheck className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-bold">Entrega · {envio.destino_contacto}</span><span className="block text-sm text-muted-foreground">{envio.destino_direccion}</span>{envio.destino_notas && <span className="block text-sm text-muted-foreground">“{envio.destino_notas}”</span>}</span><Navigation className="ml-auto h-4 w-4 shrink-0" /></a>
          <Button asChild variant="outline" size="sm" className="mt-2 rounded-full"><a href={phoneHref(envio.destino_telefono)}><Phone className="h-4 w-4" />Llamar a {envio.destino_contacto.split(" ")[0]}</a></Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-muted p-3 text-sm"><p className="font-bold">{envio.descripcion}</p><p className="text-muted-foreground">Tamaño {tamanoLabel[envio.tamano].toLowerCase()}. No lleves dinero, joyas, armas ni medicamentos con receta; si algo no corresponde, no lo retires y avisá a soporte.</p></div>
      <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warning/15 p-3 text-sm font-semibold"><Banknote className="mt-0.5 h-4 w-4 shrink-0" />Cobrá {money(envio.total)} en efectivo {envio.quien_paga === "origen" ? "al retirar el paquete" : `al entregarlo (paga ${envio.destino_contacto})`}.</p>

      <div className="mt-4">
        {!pickedUp ? (
          <div className="space-y-2">
            <Button className="h-12 w-full rounded-full text-base font-bold" onClick={() => advance("retirado")} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Retiré el paquete{envio.quien_paga === "origen" ? " y cobré" : ""}</Button>
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setReleasing(true)}>No puedo hacer este envío</Button>
          </div>
        ) : (
          <form onSubmit={deliver} className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-12 flex-1 items-center gap-2 rounded-full border px-4"><KeyRound className="h-5 w-5 text-muted-foreground" /><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código que te da quien recibe" aria-label="Código de entrega" className="h-full border-0 p-0 font-mono text-lg tracking-widest shadow-none focus-visible:ring-0" /></label>
            <Button type="submit" className="h-12 rounded-full px-6 text-base font-bold" disabled={busy || code.length !== 4}>Confirmar entrega</Button>
          </form>
        )}
      </div>
      <ReleaseEnvioDialog open={releasing} onOpenChange={setReleasing} envioId={envio.id} onDone={onChange} />
    </section>
  );
}

function ReleaseEnvioDialog({ open, onOpenChange, envioId, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; envioId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const release = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_soltar_envio", { p_id: envioId, p_motivo: reason.trim() });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Soltaste el envío. Se lo ofrecemos a otro repartidor.");
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xl font-black">¿Por qué soltás el envío?</DialogTitle>
        <DialogDescription>Se le ofrece a otro repartidor. Soltar envíos seguido afecta tu cuenta.</DialogDescription>
        <Textarea value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder="Contanos qué pasó" className="min-h-[80px] resize-none" aria-label="Motivo" />
        <Button variant="destructive" className="rounded-full" onClick={release} disabled={saving || reason.trim().length < 5}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Soltar envío</Button>
      </DialogContent>
    </Dialog>
  );
}
