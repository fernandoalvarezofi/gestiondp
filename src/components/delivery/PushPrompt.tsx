import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "woref-push-dismissed";

/** Invitación a activar avisos (pedido en curso, panel de comercio o repartidor). Se oculta si ya están activos o si la cerraron. */
export function PushPrompt({ title, text, className }: { title: string; text: string; className?: string }) {
  const { state, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed || state === "on" || state === "loading" || state === "unsupported") return null;

  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* sin almacenamiento: se vuelve a mostrar la próxima vez */ }
  };

  const activate = async () => {
    const result = await enable();
    if (result.ok) toast.success(result.message); else toast.error(result.message);
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-info/30 bg-info/5 p-4", className)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/10 text-info"><BellRing className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">
          {state === "denied" ? "Bloqueaste las notificaciones de este sitio. Habilitalas desde el candado de la barra de direcciones." :
            state === "ios-install" ? "En iPhone primero agregá Woref a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí." : text}
        </p>
        {state === "off" && <Button size="sm" className="mt-2 rounded-full" onClick={activate}>Activar avisos</Button>}
      </div>
      <button type="button" aria-label="Cerrar" onClick={dismiss} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
