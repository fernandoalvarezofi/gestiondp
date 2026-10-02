import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktopNotificationsState, PrintSettings, readPrintSettings, writePrintSettings } from "@/lib/print";
import { cn } from "@/lib/utils";

/** Impresión automática de comandas y avisos del navegador (se guardan en este dispositivo). */
export function PrintAlertsPanel({ className }: { className?: string }) {
  const [settings, setSettings] = useState<PrintSettings>(() => readPrintSettings());
  const [notifications, setNotifications] = useState(desktopNotificationsState());
  const update = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writePrintSettings(next);
  };
  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifications(result);
    if (result === "granted") toast.success("Te vamos a avisar de cada pedido nuevo");
    else toast.error("El navegador bloqueó los avisos. Podés habilitarlos desde el candado de la barra de direcciones.");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="font-extrabold">Impresión de comandas</p>
        <label className="mt-2 flex items-center justify-between gap-3 text-sm"><span>Imprimir automáticamente cada pedido nuevo</span><Switch checked={settings.auto} onCheckedChange={(checked) => update({ auto: checked })} /></label>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="w-14 shrink-0 font-semibold">Papel</span>
          {(["58", "80"] as const).map((paper) => <button key={paper} type="button" onClick={() => update({ paper })} className={cn("rounded-full border px-3 py-1 text-xs font-bold", settings.paper === paper ? "border-foreground bg-foreground text-background" : "bg-card")}>{paper} mm</button>)}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="w-14 shrink-0 font-semibold">Copias</span>
          {[1, 2, 3].map((copies) => <button key={copies} type="button" onClick={() => update({ copies })} className={cn("rounded-full border px-3 py-1 text-xs font-bold", settings.copies === copies ? "border-foreground bg-foreground text-background" : "bg-card")}>{copies}</button>)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Funciona con esta pestaña abierta. Elegí tu impresora de tickets como predeterminada del navegador.</p>
      </div>
      <div className="border-t pt-3">
        <p className="font-extrabold">Avisos del navegador</p>
        {notifications === "granted" ? <p className="mt-1 text-sm text-success">Activados: te avisamos aunque estés en otra ventana.</p>
          : notifications === "unsupported" ? <p className="mt-1 text-sm text-muted-foreground">Este navegador no permite avisos.</p>
          : notifications === "denied" ? <p className="mt-1 text-sm text-muted-foreground">Están bloqueados. Habilitalos desde el candado de la barra de direcciones.</p>
          : <Button size="sm" className="mt-2 rounded-full" onClick={enableNotifications}>Activar avisos</Button>}
      </div>
    </div>
  );
}
