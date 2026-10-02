import { useEffect, useState } from "react";
import { Banknote, CalendarClock, Loader2, MapPin, Package, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, errorMessage, formatSlot, money } from "@/lib/delivery";
import { formatKm } from "@/lib/geo";
import { ajusteValor, useAjustes } from "@/hooks/useAjustes";
import { cn } from "@/lib/utils";
import type { Offer } from "./useOffers";

/** Reloj para las cuentas regresivas de las ofertas. */
function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Anillo con los segundos que quedan para aceptar. */
function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, seconds / total));
  const urgent = seconds <= 10;
  return (
    <div className="relative h-14 w-14 shrink-0" role="timer" aria-label={`${seconds} segundos para aceptar`}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
        <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} className={cn("transition-[stroke-dashoffset] duration-500", urgent ? "stroke-destructive" : "stroke-primary")} />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums", urgent && "text-destructive")}>{seconds}</span>
    </div>
  );
}

/** Oferta de reparto: ganancia, distancias y botones para aceptar o rechazar dentro del tiempo límite. */
export function OfferCard({ offer, onChange, busyElsewhere }: { offer: Offer; onChange: () => void; busyElsewhere?: boolean }) {
  const now = useNow();
  const { ajustes } = useAjustes();
  const windowSeconds = ajusteValor(ajustes, "segundos_oferta", 45);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const remaining = offer.vence_at ? Math.max(0, Math.ceil((new Date(offer.vence_at).getTime() - now) / 1000)) : null;
  const expired = offer.exclusivo && remaining === 0;
  const total = offer.dist_retiro_km != null && offer.dist_entrega_km != null ? Number(offer.dist_retiro_km) + Number(offer.dist_entrega_km) : null;

  const accept = async () => {
    setBusy("accept");
    const { error } = await db.rpc("delivery_tomar_pedido", { p_pedido: offer.pedido_id });
    setBusy(null);
    if (error) { toast.error(errorMessage(error)); onChange(); return; }
    toast.success("¡Pedido tuyo! Andá al comercio.");
    onChange();
  };
  const reject = async () => {
    setBusy("reject");
    await db.rpc("delivery_rechazar_oferta", { p_pedido: offer.pedido_id, p_motivo: null });
    setBusy(null);
    onChange();
  };

  if (expired) return null;

  return (
    <article className={cn("overflow-hidden rounded-3xl border-2 bg-card shadow-pop", offer.exclusivo ? "border-primary" : "border-border")}>
      <div className="flex items-center gap-3 bg-primary/10 p-4">
        {remaining !== null ? <Countdown seconds={remaining} total={windowSeconds} /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted"><Package className="h-6 w-6" /></span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase text-primary">{offer.exclusivo ? "Oferta para vos" : "Disponible para todos"}</p>
          <p className="truncate text-lg font-extrabold">{offer.comercio_nombre}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black leading-none text-success">{money(offer.ganancia)}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">tu ganancia</p>
        </div>
      </div>

      <div className="space-y-3 p-4 text-sm">
        <div className="flex gap-3">
          <Store className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0"><p className="font-bold">Retiro</p><p className="text-muted-foreground">{offer.comercio_direccion}</p></div>
          {offer.dist_retiro_km != null && <p className="ml-auto shrink-0 font-bold">{formatKm(Number(offer.dist_retiro_km))}<span className="block text-right text-[11px] font-normal text-muted-foreground">de vos</span></p>}
        </div>
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0"><p className="font-bold">Entrega</p><p className="text-muted-foreground">{offer.zona_entrega} · la dirección exacta la ves al aceptar</p></div>
          {offer.dist_entrega_km != null && <p className="ml-auto shrink-0 font-bold">{formatKm(Number(offer.dist_entrega_km))}<span className="block text-right text-[11px] font-normal text-muted-foreground">del comercio</span></p>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {total != null && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">Recorrido total {formatKm(total)}</span>}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{offer.productos} {offer.productos === 1 ? "producto" : "productos"}</span>
          {offer.listo_en_min != null && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{offer.listo_en_min === 0 ? "Ya debería estar listo" : `Listo en ~${offer.listo_en_min} min`}</span>}
          {offer.programado_para && <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-3 py-1 text-xs font-bold"><CalendarClock className="h-3 w-3" />{formatSlot(offer.programado_para)}</span>}
        </div>
        <p className={cn("flex items-center gap-2 rounded-xl p-3 text-sm font-semibold", offer.metodo_pago === "efectivo" ? "bg-warning/15" : "bg-success/10 text-success")}>
          {offer.metodo_pago === "efectivo" ? <><Banknote className="h-4 w-4 shrink-0" />Tenés que cobrar {money(offer.cobrar)} en efectivo</> : <><Wallet className="h-4 w-4 shrink-0" />Pedido ya pagado: no cobrás nada</>}
        </p>
      </div>

      <div className="flex gap-2 p-4 pt-0">
        <Button variant="outline" className="h-12 rounded-full px-6" disabled={busy !== null} onClick={reject}>{busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechazar"}</Button>
        <Button className="h-12 flex-1 rounded-full text-base font-extrabold" disabled={busy !== null || busyElsewhere} onClick={accept}>{busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar pedido"}</Button>
      </div>
    </article>
  );
}
