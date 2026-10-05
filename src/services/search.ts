import { db } from "@/lib/delivery";

export type OrdenBusqueda = "relevancia" | "precio_asc" | "precio_desc" | "nuevos" | "cercania";
export const ORDENES: { id: OrdenBusqueda; label: string }[] = [
  { id: "relevancia", label: "Más relevantes" }, { id: "precio_asc", label: "Menor precio" }, { id: "precio_desc", label: "Mayor precio" },
  { id: "nuevos", label: "Más nuevos" }, { id: "cercania", label: "Más cerca" },
];

export type FiltrosBusqueda = { q: string; categoria: string | null; marca: string | null; min: number | null; max: number | null; conStock: boolean; ofertas: boolean; orden: OrdenBusqueda };
export const FILTROS_VACIOS: FiltrosBusqueda = { q: "", categoria: null, marca: null, min: null, max: null, conStock: true, ofertas: false, orden: "relevancia" };

export type ComercioHit = { id: string; nombre: string; slug: string; logo_url: string | null; esta_abierto: boolean; rating: number | null; resenas: number | null };
export type ResultadoBusqueda = { total: number; items: { id: string; distancia_km: number | null; comercio: ComercioHit }[] };
export type Facetas = { categorias: { id: string; parent_id: string | null; nombre: string; slug: string; n: number }[]; marcas: { marca: string; n: number }[]; precio: { min: number | null; max: number | null } };
export type PuntoBusqueda = { lat: number; lng: number } | null;

/** Buscador del marketplace. Hoy lo resuelve Postgres; la interfaz permite cambiar de motor sin tocar las pantallas. */
export interface SearchService {
  buscar(filtros: FiltrosBusqueda, punto: PuntoBusqueda, desde: number, limite: number): Promise<ResultadoBusqueda>;
  facetas(filtros: FiltrosBusqueda): Promise<Facetas>;
}

const num = (value: string | null): number | null => { if (value == null || value.trim() === "") return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; };
const ORDEN_VALIDO = new Set<string>(ORDENES.map((o) => o.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La URL es la fuente de verdad de los filtros (se pueden compartir y volver atrás). Valores inválidos se ignoran. */
export function filtrosDesdeUrl(params: URLSearchParams): FiltrosBusqueda {
  const cat = params.get("cat");
  const orden = params.get("orden") ?? "";
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    categoria: cat && UUID.test(cat) ? cat : null,
    marca: (params.get("marca") ?? "").slice(0, 60) || null,
    min: num(params.get("min")), max: num(params.get("max")),
    conStock: params.get("stock") !== "0",
    ofertas: params.get("ofertas") === "1",
    orden: ORDEN_VALIDO.has(orden) ? (orden as OrdenBusqueda) : "relevancia",
  };
}
export function filtrosAUrl(f: FiltrosBusqueda): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.q.trim()) out.q = f.q.trim();
  if (f.categoria) out.cat = f.categoria;
  if (f.marca) out.marca = f.marca;
  if (f.min != null) out.min = String(f.min);
  if (f.max != null) out.max = String(f.max);
  if (!f.conStock) out.stock = "0";
  if (f.ofertas) out.ofertas = "1";
  if (f.orden !== "relevancia") out.orden = f.orden;
  return out;
}
/** ¿Hay algo para buscar o filtrar? (sin eso se muestra la portada de exploración) */
export const hayBusqueda = (f: FiltrosBusqueda) => f.q.trim().length >= 2 || Boolean(f.categoria || f.marca || f.min != null || f.max != null || f.ofertas);
export const filtrosActivos = (f: FiltrosBusqueda) => [f.categoria, f.marca, f.min != null || f.max != null ? "precio" : null, f.ofertas ? "ofertas" : null, f.conStock ? null : "stock"].filter(Boolean).length;

const args = (f: FiltrosBusqueda) => ({ p_q: f.q.trim() || null, p_categoria: f.categoria, p_marca: f.marca, p_min: f.min, p_max: f.max, p_con_stock: f.conStock, p_ofertas: f.ofertas });

export const postgresSearch: SearchService = {
  async buscar(f, punto, desde, limite) {
    const orden = f.orden === "cercania" && !punto ? "relevancia" : f.orden;
    const { data, error } = await db.rpc("market_buscar", { ...args(f), p_lat: punto?.lat ?? null, p_lng: punto?.lng ?? null, p_orden: orden, p_limite: limite, p_desde: desde });
    if (error) throw error;
    return (data ?? { total: 0, items: [] }) as ResultadoBusqueda;
  },
  async facetas(f) {
    const { data, error } = await db.rpc("market_facetas", args(f));
    if (error) throw error;
    return (data ?? { categorias: [], marcas: [], precio: { min: null, max: null } }) as Facetas;
  },
};
