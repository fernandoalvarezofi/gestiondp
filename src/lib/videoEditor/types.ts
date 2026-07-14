export type TrackTipo = "video" | "audio" | "texto";

export type Clip = {
  id: string;
  assetId?: string;
  assetUrl?: string;
  assetTipo?: "video" | "audio" | "imagen";
  inicio: number;        // segundo en la timeline
  duracion: number;      // duración visible
  trimIn: number;        // segundos recortados desde el inicio del asset
  volumen?: number;      // 0..1
  // texto
  texto?: string;
  color?: string;
  tamano?: number;       // px
  x?: number;            // 0..1 (relativo al ancho)
  y?: number;            // 0..1
  fondo?: string;        // color de fondo del texto o "none"
};

export type Track = {
  id: string;
  tipo: TrackTipo;
  nombre: string;
  clips: Clip[];
  mute?: boolean;
};

export type Timeline = { tracks: Track[] };

export type Proyecto = {
  id: string;
  nombre: string;
  aspect_ratio: string;
  fps: number;
  ancho: number;
  alto: number;
  duracion_s: number;
  timeline: Timeline;
  thumbnail_url?: string | null;
};

export type Asset = {
  id: string;
  nombre: string;
  tipo: "video" | "audio" | "imagen";
  url: string;
  storage_path: string;
  duracion_s: number | null;
  ancho: number | null;
  alto: number | null;
  mime: string | null;
};

export function computarDuracion(t: Timeline): number {
  let max = 0;
  for (const tr of t.tracks)
    for (const c of tr.clips)
      max = Math.max(max, c.inicio + c.duracion);
  return max;
}

export function nuevoId() {
  return crypto.randomUUID();
}
