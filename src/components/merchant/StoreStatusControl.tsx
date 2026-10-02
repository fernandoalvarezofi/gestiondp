import { useEffect, useState } from "react";
import { ChevronDown, PauseCircle, PlayCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db, DeliveryStore, errorMessage, formatTime, isOpenNow, isPaused, nextOpening } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const PAUSES = [{ minutes: 15, label: "15 minutos" }, { minutes: 30, label: "30 minutos" }, { minutes: 60, label: "1 hora" }, { minutes: 120, label: "2 horas" }, { minutes: 1440, label: "Hasta mañana" }];

/** Estado del local: abierto, en pausa temporal (con cuenta regresiva) o cerrado. */
export function StoreStatusControl({ store, onChange }: { store: DeliveryStore; onChange: () => void }) {
  const [, tick] = useState(0);
  // Para que la pausa se levante sola en pantalla cuando vence.
  useEffect(() => {
    if (!isPaused(store)) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, [store]);

  const paused = isPaused(store);
  const open = isOpenNow(store);
  const outsideHours = store.esta_abierto && !paused && !open;

  const pause = async (minutes: number | null) => {
    const { error } = await db.rpc("delivery_pausar_comercio", { p_comercio: store.id, p_minutos: minutes });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(minutes ? "Pausaste los pedidos nuevos" : "Volviste a recibir pedidos");
    onChange();
  };
  const setOpenFlag = async (value: boolean) => {
    const { error } = await db.from("delivery_comercios").update({ esta_abierto: value }).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(value ? "Tu comercio está abierto" : "Cerraste el comercio");
    onChange();
  };

  const label = !store.esta_abierto ? "Cerrado" : paused ? `En pausa hasta las ${formatTime(store.pausado_hasta)}` : open ? "Abierto · recibiendo pedidos" : nextOpening(store.horarios) || "Fuera de horario";
  const tone = open ? "border-success/40 bg-success/10 text-success" : paused ? "border-warning/50 bg-warning/15" : "bg-muted text-muted-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("flex items-center gap-2 rounded-full border px-4 py-2 font-bold", tone)} aria-label="Cambiar estado del local">
          <span className={cn("h-2.5 w-2.5 rounded-full", open ? "bg-success" : paused ? "bg-warning" : "bg-muted-foreground")} />
          {label}<ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {paused && <DropdownMenuItem onClick={() => pause(null)}><PlayCircle className="h-4 w-4" />Reanudar ahora</DropdownMenuItem>}
        {store.esta_abierto && (
          <>
            <DropdownMenuLabel>{paused ? "Extender la pausa" : "Pausar pedidos nuevos"}</DropdownMenuLabel>
            {PAUSES.map((item) => <DropdownMenuItem key={item.minutes} onClick={() => pause(item.minutes)}><PauseCircle className="h-4 w-4" />{item.label}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => setOpenFlag(!store.esta_abierto)}><Power className="h-4 w-4" />{store.esta_abierto ? "Cerrar el comercio" : "Abrir el comercio"}</DropdownMenuItem>
        {outsideHours && <p className="px-2 py-1.5 text-xs text-muted-foreground">Estás fuera de tu horario de atención. Podés cambiarlo en Configuración.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
