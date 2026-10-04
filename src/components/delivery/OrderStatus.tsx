import { Bike, Check, ChefHat, ClipboardCheck, Home, PackageCheck, Receipt, ShoppingBag } from "lucide-react";
import { DeliveryOrder, EstadoPedido, estadoCorto, estadoTone, formatTime, pasosDe } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export function StatusBadge({ estado, className }: { estado: EstadoPedido; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", estadoTone[estado], className)}>{estadoCorto[estado]}</span>;
}

const stepIcons = { pendiente: Receipt, confirmado: ClipboardCheck, preparando: ChefHat, listo: ShoppingBag, en_camino: Bike, entregado: Home } as const;
const stepLabels = { pendiente: "Pedido enviado", confirmado: "Confirmado", preparando: "Preparando", listo: "Listo para retirar", en_camino: "En camino", entregado: "Entregado" } as const;

export function OrderTimeline({ order }: { order: DeliveryOrder }) {
  const steps = pasosDe(order);
  const current = steps.indexOf(order.estado);
  const retiro = order.tipo_entrega === "retiro";
  const times: Record<string, string | null | undefined> = {
    pendiente: order.created_at,
    confirmado: order.confirmado_at,
    preparando: order.preparando_at,
    listo: order.listo_at,
    en_camino: order.en_camino_at,
    entregado: order.entregado_at,
  };

  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((step, index) => {
        const Icon = step === "entregado" && retiro ? PackageCheck : stepIcons[step as keyof typeof stepIcons];
        const done = current >= index;
        const active = current === index && order.estado !== "entregado";
        const label = step === "entregado" && retiro ? "Retirado" : stepLabels[step as keyof typeof stepLabels];
        return (
          <li key={step} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-1 flex-1 rounded-full", index === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-muted")} />
              <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors", active ? "bg-brand-orange text-white shadow-[0_0_0_4px_hsl(var(--brand-orange)/0.18)]" : done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {active && <span className="absolute inset-0 animate-ping rounded-full bg-brand-orange/40" />}
                {done && !active ? <Check className="h-5 w-5" /> : <Icon className={cn("h-5 w-5", active && step === "en_camino" && "animate-ride")} />}
              </span>
              <span className={cn("h-1 flex-1 rounded-full", index === steps.length - 1 ? "bg-transparent" : current > index ? "bg-primary" : "bg-muted")} />
            </div>
            <span className={cn("mt-2 text-[11px] font-bold leading-tight sm:text-xs", active ? "text-brand-orange" : done ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(times[step])}</span>
          </li>
        );
      })}
    </ol>
  );
}
