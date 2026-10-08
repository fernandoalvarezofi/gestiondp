import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { PreviewData } from "@/pages/StorefrontPreviewFrame";
import { cn } from "@/lib/utils";

/** Marco con la tienda real adentro, en ancho de computadora o de celular, y escalada para entrar en el panel. */
export function PreviewPane({ data, selected, onSelect, className }: { data: PreviewData; selected: string | null; onSelect: (id: string) => void; className?: string }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const [device, setDevice] = useState<"escritorio" | "celular">("escritorio");
  const [scale, setScale] = useState(0.5);
  const width = device === "celular" ? 390 : 1280;
  const height = device === "celular" ? 780 : 820;

  const send = useCallback((message: unknown) => {
    if (ready.current) iframe.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      const message = event.data as { tipo?: string; id?: string } | null;
      if (message?.tipo === "woref-vista-previa-lista") { ready.current = true; send({ tipo: "woref-vista-previa", datos: data }); }
      if (message?.tipo === "woref-bloque" && message.id) onSelect(message.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [data, onSelect, send]);

  // Cada cambio se manda al marco (con una pequeña espera mientras se escribe).
  useEffect(() => {
    const timer = window.setTimeout(() => send({ tipo: "woref-vista-previa", datos: data }), 120);
    return () => window.clearTimeout(timer);
  }, [data, send]);
  useEffect(() => { send({ tipo: "woref-seleccion", id: selected }); }, [selected, send]);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, element.clientWidth / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted-foreground">Vista previa en vivo <span className="font-normal">· tocá un bloque para editarlo</span></p>
        <div className="flex rounded-full border bg-card p-0.5" role="group" aria-label="Tamaño de pantalla">
          {([["escritorio", Monitor, "Computadora"], ["celular", Smartphone, "Celular"]] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" aria-pressed={device === id} aria-label={label} onClick={() => setDevice(id)} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors", device === id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
      </div>
      <div ref={holder} className="overflow-hidden rounded-3xl border bg-muted/40 shadow-soft" style={{ height: Math.round(height * scale) }}>
        <div className="mx-auto overflow-hidden" style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}>
          <iframe ref={iframe} title="Vista previa de tu tienda" src="/vista-previa-tienda" style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
    </div>
  );
}
