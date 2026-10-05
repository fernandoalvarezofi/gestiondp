// Páginas de una tienda online: inicio, colección (categoría), ofertas y búsqueda. Lógica pura, sin React.
import type { DeliveryProduct } from "@/lib/delivery";

export type Vista =
  | { tipo: "inicio" }
  | { tipo: "coleccion"; categoria: string }
  | { tipo: "ofertas" }
  | { tipo: "buscar"; q: string };

export const VISTA_INICIO: Vista = { tipo: "inicio" };

export const storePath = (slug: string) => `/t/${slug}`;
export const collectionPath = (slug: string, categoria: string) => `/t/${slug}/c/${encodeURIComponent(categoria)}`;
export const offersPath = (slug: string) => `/t/${slug}/ofertas`;
export const searchPath = (slug: string, q: string) => `/t/${slug}/buscar${q.trim() ? `?q=${encodeURIComponent(q.trim().slice(0, 80))}` : ""}`;

/** Interpreta la dirección actual como una página de la tienda. */
export function parseVista(pathname: string, search: string, categoriaParam?: string): Vista {
  const limpio = pathname.replace(/\/+$/, "");
  if (categoriaParam !== undefined && /\/c\/[^/]+$/.test(limpio)) {
    let categoria = categoriaParam;
    try { categoria = decodeURIComponent(categoriaParam); } catch { /* se usa tal cual */ }
    return { tipo: "coleccion", categoria: categoria.slice(0, 60) };
  }
  if (/\/ofertas$/.test(limpio)) return { tipo: "ofertas" };
  if (/\/buscar$/.test(limpio)) return { tipo: "buscar", q: (new URLSearchParams(search).get("q") ?? "").slice(0, 80) };
  return VISTA_INICIO;
}

/** Clave estable de una vista (para saber si cambió de página). */
export const vistaKey = (v: Vista) => (v.tipo === "coleccion" ? `c:${v.categoria}` : v.tipo === "buscar" ? `b:${v.q}` : v.tipo);

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const tieneDescuento = (p: Pick<DeliveryProduct, "precio" | "precio_anterior">) => p.precio_anterior != null && Number(p.precio_anterior) > Number(p.precio);

export type Sugerencias = { productos: DeliveryProduct[]; categorias: string[] };

/** Sugerencias al escribir en el buscador: primero lo que empieza con lo escrito y después lo que lo contiene (sin tildes ni mayúsculas). */
export function sugerencias(productos: DeliveryProduct[], categorias: string[], termino: string, maxProductos = 5, maxCategorias = 3): Sugerencias {
  const q = normalizar(termino);
  if (q.length < 2) return { productos: [], categorias: [] };
  const puntaje = (texto: string) => {
    const t = normalizar(texto);
    if (t.startsWith(q)) return 0;
    if (t.split(/\s+/).some((palabra) => palabra.startsWith(q))) return 1;
    return t.includes(q) ? 2 : 3;
  };
  const ordenar = <T,>(lista: T[], texto: (item: T) => string, max: number) =>
    lista.map((item) => ({ item, p: puntaje(texto(item)) })).filter((x) => x.p < 3).sort((a, b) => a.p - b.p).slice(0, max).map((x) => x.item);
  return {
    productos: ordenar(productos.filter((p) => p.disponible !== false), (p) => p.nombre, maxProductos),
    categorias: ordenar(categorias, (c) => c, maxCategorias),
  };
}
