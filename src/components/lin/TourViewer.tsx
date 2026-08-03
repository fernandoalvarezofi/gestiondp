import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Box, ExternalLink, Loader2, AlertTriangle, Play } from "lucide-react";

type Props = {
  tourUrl?: string | null;
  estado?: string | null;
  titulo?: string;
};

const VIEWER = "https://antimatter15.com/splat/?url=";

export function TourViewer({ tourUrl, estado, titulo }: Props) {
  const [activo, setActivo] = useState(false);

  if (estado === "procesando") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border bg-secondary/30 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm font-semibold">Generando el tour 3D</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          La reconstrucción del recorrido puede tardar varios minutos. Te avisamos cuando esté listo.
        </p>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border bg-secondary/30 text-center">
        <AlertTriangle className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-semibold">No se pudo generar el tour</p>
        <p className="max-w-xs text-xs text-muted-foreground">Probá de nuevo con un video más estable y con buena luz.</p>
      </div>
    );
  }

  if (!tourUrl) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border bg-secondary/30 text-center">
        <Box className="h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm font-semibold">Esta propiedad todavía no tiene tour 3D</p>
      </div>
    );
  }

  const src = `${VIEWER}${encodeURIComponent(tourUrl)}`;

  return (
    <div className="overflow-hidden rounded-2xl border bg-black/90">
      {activo ? (
        <iframe
          src={src}
          title={`Tour 3D de ${titulo ?? "la propiedad"}`}
          className="aspect-video w-full"
          allow="fullscreen; xr-spatial-tracking"
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 text-center">
          <Box className="h-10 w-10 text-primary" />
          <p className="text-sm font-semibold text-white">Recorrido 3D disponible</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setActivo(true)} className="gap-1.5">
              <Play className="h-4 w-4" /> Iniciar recorrido
            </Button>
            <Button asChild variant="secondary" className="gap-1.5">
              <a href={src} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Pantalla completa
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
