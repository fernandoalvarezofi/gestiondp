import { useCallback, useEffect, useState } from "react";
import { Bell, Camera, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PermissionKey = "geolocation" | "notifications" | "camera";
type Status = "granted" | "denied" | "prompt" | "unknown";

const ITEMS: { key: PermissionKey; label: string; why: string; icon: typeof MapPin }[] = [
  { key: "geolocation", label: "Ubicación", why: "Para mostrarte comercios cercanos y que el repartidor te encuentre.", icon: MapPin },
  { key: "notifications", label: "Notificaciones", why: "Para avisarte cómo va tu pedido.", icon: Bell },
  { key: "camera", label: "Cámara", why: "Solo para verificar tu identidad (DNI y selfie).", icon: Camera },
];
const statusText: Record<Status, string> = { granted: "Permitido", denied: "Bloqueado", prompt: "Sin decidir", unknown: "No disponible" };

async function readStatus(key: PermissionKey): Promise<Status> {
  try {
    if (key === "notifications" && "Notification" in window && !navigator.permissions) return Notification.permission === "default" ? "prompt" : Notification.permission;
    const result = await navigator.permissions.query({ name: key as PermissionName });
    return result.state;
  } catch {
    return key === "notifications" && "Notification" in window ? (Notification.permission === "default" ? "prompt" : Notification.permission) : "unknown";
  }
}

/** Qué permisos del dispositivo le diste a Woref y cómo cambiarlos (el navegador no deja que una web los revoque sola). */
export function DevicePermissions() {
  const [states, setStates] = useState<Record<PermissionKey, Status>>({ geolocation: "unknown", notifications: "unknown", camera: "unknown" });

  const refresh = useCallback(async () => {
    const entries = await Promise.all(ITEMS.map(async (item) => [item.key, await readStatus(item.key)] as const));
    setStates(Object.fromEntries(entries) as Record<PermissionKey, Status>);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const request = (key: PermissionKey) => {
    if (key === "geolocation") navigator.geolocation?.getCurrentPosition(() => refresh(), () => { toast.error("No pudimos acceder a tu ubicación"); refresh(); });
    else if (key === "notifications" && "Notification" in window) Notification.requestPermission().then(refresh);
    else toast.info("Te lo pedimos cuando lo necesitemos.");
  };

  return (
    <ul className="divide-y rounded-2xl border">
      {ITEMS.map(({ key, label, why, icon: Icon }) => (
        <li key={key} className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">{label}</span><span className="block text-xs text-muted-foreground">{states[key] === "denied" ? "Lo bloqueaste: habilitalo desde el candado de la barra del navegador o los ajustes del teléfono." : why}</span></span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", states[key] === "granted" ? "bg-success/10 text-success" : states[key] === "denied" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{statusText[states[key]]}</span>
          {states[key] === "prompt" && key !== "camera" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => request(key)}>Activar</Button>}
        </li>
      ))}
    </ul>
  );
}
