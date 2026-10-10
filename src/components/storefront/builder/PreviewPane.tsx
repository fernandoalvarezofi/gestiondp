import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { PreviewData } from "@/pages/StorefrontPreviewFrame";
import { cn } from "@/lib/utils";

export type Dispositivo = "escritorio" | "tableta" | "celular";
export const ANCHO_DISPOSITIVO: Record<Dispositivo, number> = { escritorio: 1280, tableta: 820, celular: 390 };

export function SelectorDispositivo({ value, onChange, className }: { value: Dispositivo; onChange: (d: Dispositivo) => void; className?: string }) {
  return (
    <div className={cn("flex rounded-full border bg-card p-0.5", className)} role="group" aria-label="Tamaño de pantalla">
      {([["escritorio", Monitor, "Computadora"], ["tableta", Tablet, "Tableta"], ["celular", Smartphone, "Celular"]] as const).map(([id, Icon, label]) => (
        <button key={id} type="button" aria-pressed={value === id} aria-label={label} title={label} onClick={() => onChange(id)}
          className={cn("flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors", value === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/**
 * Marco con la tienda real adentro (misma pantalla que el sitio público), al ancho del dispositivo y escalado para entrar.
 * `llenar`: ocupa todo el alto disponible (lienzo del editor). Si no se controla el dispositivo desde afuera, muestra su propio selector.
 */
export function PreviewPane({ data, selected, onSelect, className, device: deviceProp, onDevice, llenar }: {
  data: PreviewData; selected: string | null; onSelect: (id: string) => void; className?: string; device?: Dispositivo; onDevice?: (d: Dispositivo) => void; llenar?: boolean;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const [deviceLocal, setDeviceLocal] = useState<Dispositivo>("escritorio");
  const device = deviceProp ?? deviceLocal;
  const [caja, setCaja] = useState({ w: 800, h: 600 });
  const width = ANCHO_DISPOSITIVO[device];
  const scale = Math.min(1, caja.w / width);
  const height = llenar ? Math.max(400, Math.round(caja.h / scale)) : device === "celular" ? 780 : device === "tableta" ? 1000 : 820;

  const send = useCallback((message: unknown) => {
    if (ready.current) iframe.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      const message = event.data as { tipo?: string; id?: string } | null;
      if (message?.tipo === "woref-vista-previa-lista") { ready.current = true; send({ tipo: "woref-vista-previa", datos: data }); send({ tipo: "woref-seleccion", id: selected }); }
      if (message?.tipo === "woref-bloque" && message.id) onSelect(message.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [data, onSelect, send, selected]);

  // Cada cambio se manda al marco (con una pequeña espera mientras se escribe).
  useEffect(() => {
    const timer = window.setTimeout(() => send({ tipo: "woref-vista-previa", datos: data }), 120);
    return () => window.clearTimeout(timer);
  }, [data, send]);
  useEffect(() => { send({ tipo: "woref-seleccion", id: selected }); }, [selected, send]);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setCaja({ w: element.clientWidth, h: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn(llenar && "flex h-full min-h-0 flex-col", className)}>
      {!deviceProp && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-muted-foreground">Vista previa en vivo <span className="font-normal">· tocá un bloque para editarlo</span></p>
          <SelectorDispositivo value={device} onChange={(d) => (onDevice ? onDevice(d) : setDeviceLocal(d))} />
        </div>
      )}
      <div ref={holder} className={cn("overflow-hidden", llenar ? "min-h-0 flex-1" : "rounded-3xl border bg-muted/40 shadow-soft")} style={llenar ? undefined : { height: Math.round(height * scale) }}>
        <div className={cn("mx-auto overflow-hidden bg-background", llenar && device !== "escritorio" && "border-x shadow-soft")} style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}>
          <iframe ref={iframe} title="Vista previa de tu tienda" src="/vista-previa-tienda" style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
    </div>
  );
}
