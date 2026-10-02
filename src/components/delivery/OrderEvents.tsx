import { useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import { OrderEta, OrderEvent, useOrderHistory } from "@/hooks/useOrderEta";
import { formatDateTime, formatTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const roleLabel: Record<OrderEvent["actor_rol"], string> = { cliente: "Cliente", comercio: "Comercio", repartidor: "Repartidor", admin: "Woref", sistema: "Sistema" };
const stateText: Record<string, string> = { pendiente: "Pedido enviado", confirmado: "El comercio aceptó el pedido", preparando: "Empezaron a prepararlo", listo: "Pedido listo", en_camino: "Salió hacia tu dirección", entregado: "Entregado", cancelado: "Pedido cancelado" };

export function eventText(event: OrderEvent, retiro = false, staff = false): string {
  const detail = event.detalle || {};
  switch (event.evento) {
    case "creado": return `Pedido creado por ${money(Number(detail.total || 0))}`;
    case "estado":
      if (event.estado_nuevo === "en_camino" && retiro) return "Listo para retirar";
      if (event.estado_nuevo === "en_camino" && staff) return "Salió hacia el cliente";
      if (event.estado_nuevo === "entregado" && retiro) return "Retirado";
      if (event.estado_nuevo === "cancelado") return `Pedido cancelado${detail.motivo ? `: ${String(detail.motivo)}` : ""}`;
      if (event.estado_nuevo === "confirmado" && detail.preparacion_min) return `${stateText.confirmado} (${String(detail.preparacion_min)} min de preparación)`;
      return stateText[event.estado_nuevo || ""] || String(event.estado_nuevo);
    case "asignado": return `${detail.repartidor ? String(detail.repartidor) : "Un repartidor"} tomó ${staff ? "el" : "tu"} pedido`;
    case "liberado": return "El repartidor no pudo continuar; buscamos otro";
    case "llegada_comercio": return "El repartidor llegó al comercio";
    case "llegada_cliente": return staff ? "El repartidor llegó a la dirección del cliente" : "El repartidor llegó a tu dirección";
    case "demora": return `El comercio avisó una demora de ${Number(detail.minutos || 0)} min`;
    case "pago": return `Pago: ${String(detail.a ?? "").replace(/_/g, " ")}`;
    default: return event.evento;
  }
}

/** Tiempo estimado de llegada con el desglose por etapas. */
export function EtaBreakdown({ eta, retiro, className }: { eta: OrderEta; retiro?: boolean; className?: string }) {
  if (!eta || eta.terminal || eta.programado || !eta.fases) return null;
  const phases = [
    { label: "Aceptación", value: eta.fases.aceptacion },
    { label: "Preparación", value: eta.fases.preparacion },
    ...(retiro ? [] : [{ label: "Retiro", value: eta.fases.retiro ?? 0 }, { label: "En camino", value: eta.fases.transito ?? 0 }]),
  ].filter((phase) => phase.value > 0);
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {phases.map((phase) => <span key={phase.label} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">{phase.label} ~{phase.value} min</span>)}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {eta.fuente === "gps" ? "Calculado con la ubicación real de tu repartidor." : eta.fuente === "historial" ? "Calculado con los tiempos reales de este comercio." : "Estimación según la distancia y el comercio."}
        {eta.trafico && eta.trafico > 1 ? " Incluye hora pico o clima." : ""}
      </p>
    </div>
  );
}

/** Historial de eventos del pedido (quién hizo qué y cuándo). */
export function OrderHistory({ orderId, version, retiro, staff = false, className }: { orderId: string; version?: string | null; retiro?: boolean; staff?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const events = useOrderHistory(open ? orderId : undefined, version);
  return (
    <section className={cn("rounded-3xl border bg-card", className)}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-4 text-left sm:px-6">
        <span className="flex items-center gap-2 font-extrabold"><Clock3 className="h-4 w-4 text-primary" />Historial del pedido</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="space-y-3 border-t px-4 pb-4 pt-3 sm:px-6">
          {!events ? <li className="text-sm text-muted-foreground">Cargando…</li> : events.length === 0 ? <li className="text-sm text-muted-foreground">Todavía no hay eventos registrados.</li> : events.map((event, index) => (
            <li key={`${event.created_at}-${index}`} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div>
                <p className="font-semibold">{eventText(event, retiro, staff)}</p>
                <p className="text-xs text-muted-foreground">{formatTime(event.created_at)} · {formatDateTime(event.created_at)} · {roleLabel[event.actor_rol]}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
