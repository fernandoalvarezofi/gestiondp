import { db } from "@/lib/delivery";

export type DirectorioItem = {
  id: string; nombre: string; rubro: string; direccion: string | null; telefono: string | null; web: string | null; horario: string | null; lat: number; lng: number;
  interesados: number; quiero_pedir: boolean; es_mio: boolean;
};
export type DirectorioEstado = "nuevo" | "contactado" | "interesado" | "adherido" | "descartado";
export type DirectorioAdminItem = { id: string; nombre: string; rubro: string; direccion: string | null; telefono: string | null; estado: DirectorioEstado; nota: string | null; fuente: string; quieren_pedir: number; reclamos: number };

export const estadoLabel: Record<DirectorioEstado, string> = { nuevo: "Nuevo", contactado: "Contactado", interesado: "Interesado", adherido: "Se sumó", descartado: "Descartado" };

export async function loadDirectorio(): Promise<DirectorioItem[]> {
  const { data } = await db.rpc("delivery_directorio_lista");
  return ((data || []) as DirectorioItem[]).map((item) => ({ ...item, lat: Number(item.lat), lng: Number(item.lng), interesados: Number(item.interesados) }));
}

const DAYS: Record<string, string> = { Mo: "Lun", Tu: "Mar", We: "Mié", Th: "Jue", Fr: "Vie", Sa: "Sáb", Su: "Dom" };

/** Pasa el horario de OpenStreetMap ("Mo-Sa 08:00-20:00") a un texto en español ("Lun-Sáb 08:00-20:00"). */
export function formatOsmHours(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (day) => DAYS[day]).replace(/\s*;\s*/g, " · ").replace(/\boff\b/gi, "cerrado");
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export const mapsLink = (item: Pick<DirectorioItem, "lat" | "lng">) => `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
export const phoneLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Normaliza para buscar sin importar mayúsculas ni tildes. */
export const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
