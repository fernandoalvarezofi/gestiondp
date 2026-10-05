import { KeyboardEvent, MouseEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { img } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Galería del producto: miniaturas, foto grande con zoom al pasar el mouse, flechas y vista ampliada. */
export function ProductGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [big, setBig] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const total = photos.length;
  useEffect(() => { setIndex(0); }, [photos.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (delta: number) => setIndex((current) => (current + delta + total) % total);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
  };
  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setZoom({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 });
  };

  if (!total) {
    return <div className="flex aspect-square w-full items-center justify-center bg-muted text-sm text-muted-foreground" style={{ borderRadius: "var(--sf-radius, 1rem)" }}>Sin foto</div>;
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row" onKeyDown={onKey}>
      {total > 1 && (
        <ul className="flex shrink-0 gap-2 overflow-x-auto sm:max-h-[560px] sm:flex-col sm:overflow-y-auto" aria-label="Fotos del producto">
          {photos.map((photo, n) => (
            <li key={photo}>
              <button type="button" aria-label={`Ver foto ${n + 1} de ${total}`} aria-current={n === index} onMouseEnter={() => setIndex(n)} onFocus={() => setIndex(n)} onClick={() => setIndex(n)}
                className={cn("h-16 w-16 shrink-0 overflow-hidden border-2 bg-muted transition-colors sm:h-[72px] sm:w-[72px]", n === index ? "border-[color:var(--sf-accent,hsl(var(--primary)))]" : "border-transparent hover:border-muted-foreground/40")} style={{ borderRadius: "calc(var(--sf-radius, 1rem) * 0.5)" }}>
                <img src={img(photo, 160)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          className="relative aspect-square cursor-zoom-in overflow-hidden bg-muted"
          style={{ borderRadius: "var(--sf-radius, 1rem)" }}
          onMouseMove={onMove} onMouseLeave={() => setZoom(null)} onClick={() => setBig(true)}
          role="button" tabIndex={0} aria-label="Ampliar foto" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setBig(true); } }}
        >
          {/* Mientras carga la foto grande se ve la miniatura (ya descargada) desenfocada, y después aparece nítida. */}
          <img src={img(photos[index], 160)} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />
          <img key={photos[index]} src={img(photos[index], 1000)} alt={alt} fetchPriority="high" onLoad={() => setLoaded((current) => ({ ...current, [photos[index]]: true }))} className={cn("relative h-full w-full object-cover transition-[opacity,transform] duration-300", loaded[photos[index]] ? "opacity-100" : "opacity-0")} style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
        </div>
        {total > 1 && (
          <>
            <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-card/95 text-card-foreground shadow-soft hover:bg-card"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Foto siguiente" onClick={() => go(1)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-card/95 text-card-foreground shadow-soft hover:bg-card"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white" aria-live="polite">{index + 1} / {total}</span>
          </>
        )}
      </div>

      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 text-white sm:p-4">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">Foto ampliada. Usá las flechas del teclado para ver las demás.</DialogDescription>
          <button type="button" aria-label="Cerrar" onClick={() => setBig(false)} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X className="h-5 w-5" /></button>
          <div className="relative" onKeyDown={onKey}>
            <img src={img(photos[index], 1600)} alt={alt} className="max-h-[80vh] w-full object-contain" />
            {total > 1 && (
              <>
                <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" aria-label="Foto siguiente" onClick={() => go(1)} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
