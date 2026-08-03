/**
 * Cliente del servicio de reconstrucción 3D (Gaussian Splatting).
 * La URL del servicio se configura desde la app (Mis propiedades → Tours 3D)
 * o con la variable de entorno VITE_SPLAT_API_URL.
 */

const STORAGE_KEY = "woref_splat_api_url";

export function getSplatServiceUrl(): string {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const envUrl = (import.meta as any).env?.VITE_SPLAT_API_URL as string | undefined;
  return (stored || envUrl || "").replace(/\/+$/, "");
}

export function setSplatServiceUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(STORAGE_KEY, clean);
  else localStorage.removeItem(STORAGE_KEY);
}

export function isSplatServiceConfigured() {
  return !!getSplatServiceUrl();
}

export type TourJob = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed" | string;
  stage?: string | null;
  progress?: number | null;
  splat_url?: string | null;
  error?: string | null;
};

function requireUrl() {
  const base = getSplatServiceUrl();
  if (!base) throw new Error("Configurá la URL del servicio 3D antes de generar un tour.");
  return base;
}

/** Sube el video y encola el trabajo de reconstrucción. Devuelve el job. */
export async function crearTourJob(video: File, propiedadId: string): Promise<TourJob> {
  const base = requireUrl();
  const form = new FormData();
  form.append("file", video);
  form.append("property_id", propiedadId);
  const res = await fetch(`${base}/jobs`, { method: "POST", body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`El servicio 3D rechazó el video (${res.status}). ${txt.slice(0, 200)}`);
  }
  return normalize(await res.json());
}

/** Consulta el estado de un trabajo. */
export async function obtenerTourJob(jobId: string): Promise<TourJob> {
  const base = requireUrl();
  const res = await fetch(`${base}/jobs/${jobId}`);
  if (!res.ok) throw new Error(`No se pudo consultar el trabajo (${res.status}).`);
  return normalize(await res.json());
}

function normalize(raw: any): TourJob {
  return {
    job_id: raw.job_id ?? raw.id ?? "",
    status: raw.status ?? raw.state ?? "queued",
    stage: raw.stage ?? raw.current_stage ?? null,
    progress: typeof raw.progress === "number" ? raw.progress : null,
    splat_url: raw.splat_url ?? raw.result?.splat_url ?? raw.output_url ?? null,
    error: raw.error ?? raw.error_message ?? null,
  };
}
