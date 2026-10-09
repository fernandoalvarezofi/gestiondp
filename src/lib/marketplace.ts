/** Funciones de marketplace de la tienda online: reputación del vendedor, insignias de producto, filtros y orden del catálogo. */
import type { DeliveryProduct } from "@/lib/delivery";

export type VendedorResumen = {
  desde: string;
  entregados: number;
  rating: number;
  resenas: number;
  positivas: number | null;
  mas_vendidos: { producto_id: string; unidades: number }[];
  preguntas_respondidas: number;
};

export type Pregunta = { id: string; producto_id: string; pregunta: string; respuesta: string | null; respondida_at: string | null; created_at: string };

// ------------------------------------------------------------------ reputación
export type NivelReputacion = { nivel: 1 | 2 | 3 | 4 | 5; nombre: string; detalle: string; color: string };

/** Nivel de reputación a partir de datos reales (calificación, volumen y opiniones positivas); nunca se muestra uno que los datos no sostienen. */
export function nivelReputacion(resumen: Pick<VendedorResumen, "entregados" | "rating" | "resenas" | "positivas">): NivelReputacion {
  const volumen = Math.max(resumen.entregados, resumen.resenas);
  const rating = Number(resumen.rating) || 0;
  const positivas = resumen.positivas ?? 0;
  if (volumen < 5 || rating === 0) return { nivel: 1, nombre: "Vendedor nuevo", detalle: "Todavía tiene pocas ventas para medir su reputación.", color: "#9CA3AF" };
  if (rating >= 4.5 && volumen >= 30 && positivas >= 90) return { nivel: 5, nombre: "Vendedor destacado", detalle: "Excelente atención y muchas ventas.", color: "#16A34A" };
  if (rating >= 4.2) return { nivel: 4, nombre: "Muy buena atención", detalle: "Sus clientes están muy conformes.", color: "#65A30D" };
  if (rating >= 3.5) return { nivel: 3, nombre: "Buena atención", detalle: "Sus clientes están conformes.", color: "#EAB308" };
  return { nivel: 2, nombre: "En mejora", detalle: "Tiene algunas opiniones por mejorar.", color: "#F97316" };
}

/** "Vende en Woref desde octubre de 2026". */
export function antiguedad(desde: string, ahora = new Date()): string {
  const fecha = new Date(desde);
  if (Number.isNaN(fecha.getTime())) return "";
  const meses = (ahora.getFullYear() - fecha.getFullYear()) * 12 + ahora.getMonth() - fecha.getMonth();
  if (meses < 1) return "Vende en Woref desde este mes";
  const texto = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return `Vende en Woref desde ${texto}`;
}

// ------------------------------------------------------------------ insignias de producto
export type Insignia = { id: "oferta" | "nuevo" | "ultimas" | "masvendido"; texto: string };

export const descuentoPct = (product: Pick<DeliveryProduct, "precio" | "precio_anterior">): number | null => {
  const anterior = Number(product.precio_anterior);
  const precio = Number(product.precio);
  if (!anterior || anterior <= precio) return null;
  return Math.round((1 - precio / anterior) * 100);
};

export function insignias(product: Pick<DeliveryProduct, "id" | "precio" | "precio_anterior" | "stock" | "created_at">, masVendidos: string[] = [], ahora = new Date()): Insignia[] {
  const out: Insignia[] = [];
  const off = descuentoPct(product);
  if (off) out.push({ id: "oferta", texto: `${off}% OFF` });
  if (masVendidos.includes(product.id)) out.push({ id: "masvendido", texto: "Más vendido" });
  const edad = product.created_at ? (ahora.getTime() - new Date(product.created_at).getTime()) / 86_400_000 : Infinity;
  if (edad >= 0 && edad <= 14) out.push({ id: "nuevo", texto: "Nuevo" });
  if (product.stock != null && product.stock > 0 && product.stock <= 3) out.push({ id: "ultimas", texto: product.stock === 1 ? "¡Última unidad!" : `¡Últimas ${product.stock}!` });
  return out;
}

// ------------------------------------------------------------------ filtros y orden del catálogo
export type Orden = "relevancia" | "menor" | "mayor" | "nuevos" | "descuento" | "nombre";
export const ORDENES: { id: Orden; nombre: string }[] = [
  { id: "relevancia", nombre: "Más relevantes" },
  { id: "menor", nombre: "Menor precio" },
  { id: "mayor", nombre: "Mayor precio" },
  { id: "descuento", nombre: "Mayor descuento" },
  { id: "nuevos", nombre: "Más nuevos" },
  { id: "nombre", nombre: "Nombre (A-Z)" },
];

export type FiltrosCatalogo = { min: number | null; max: number | null; soloOferta: boolean; orden: Orden };
export const SIN_FILTROS: FiltrosCatalogo = { min: null, max: null, soloOferta: false, orden: "relevancia" };

export function filtrarYOrdenar<T extends Pick<DeliveryProduct, "precio" | "precio_anterior" | "created_at" | "destacado" | "orden">>(items: T[], filtros: FiltrosCatalogo, masVendidos: string[] = []): T[] {
  const out = items.filter((item) => {
    const precio = Number(item.precio);
    if (filtros.min != null && precio < filtros.min) return false;
    if (filtros.max != null && precio > filtros.max) return false;
    if (filtros.soloOferta && descuentoPct(item) === null) return false;
    return true;
  });
  const fecha = (item: T) => (item.created_at ? new Date(item.created_at).getTime() : 0);
  const ids = (item: T) => (item as unknown as { id?: string }).id ?? "";
  switch (filtros.orden) {
    case "menor": return [...out].sort((a, b) => Number(a.precio) - Number(b.precio));
    case "mayor": return [...out].sort((a, b) => Number(b.precio) - Number(a.precio));
    case "descuento": return [...out].sort((a, b) => (descuentoPct(b) ?? 0) - (descuentoPct(a) ?? 0));
    case "nuevos": return [...out].sort((a, b) => fecha(b) - fecha(a));
    case "nombre": return [...out].sort((a, b) => String((a as unknown as { nombre?: string }).nombre ?? "").localeCompare(String((b as unknown as { nombre?: string }).nombre ?? ""), "es"));
    default: return [...out].sort((a, b) => {
      // Relevancia: más vendidos, luego destacados, luego el orden elegido por el comercio.
      const va = masVendidos.includes(ids(a)) ? 1 : 0, vb = masVendidos.includes(ids(b)) ? 1 : 0;
      if (va !== vb) return vb - va;
      if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
      return (a.orden ?? 0) - (b.orden ?? 0);
    });
  }
}

/** Rangos de precio sugeridos (cuatro tramos parejos entre el mínimo y el máximo del catálogo). */
export function tramosDePrecio(precios: number[]): { min: number; max: number | null; texto: (formato: (n: number) => string) => string }[] {
  const lista = precios.filter((p) => p > 0).sort((a, b) => a - b);
  if (lista.length < 4) return [];
  const redondear = (n: number) => { const base = n < 1000 ? 100 : n < 10000 ? 500 : 1000; return Math.max(base, Math.round(n / base) * base); };
  const cortes = [0.33, 0.66].map((q) => redondear(lista[Math.floor(q * (lista.length - 1))]));
  const [a, b] = [...new Set(cortes)].sort((x, y) => x - y);
  if (b === undefined) return [{ min: 0, max: a, texto: (f) => `Hasta ${f(a)}` }, { min: a, max: null, texto: (f) => `Más de ${f(a)}` }];
  return [
    { min: 0, max: a, texto: (f) => `Hasta ${f(a)}` },
    { min: a, max: b, texto: (f) => `${f(a)} a ${f(b)}` },
    { min: b, max: null, texto: (f) => `Más de ${f(b)}` },
  ];
}

/** Fotos de un producto: la principal más las extra, sin repetir y solo https. */
export function fotosDe(product: Pick<DeliveryProduct, "imagen_url"> & { imagenes?: string[] | null }): string[] {
  const todas = [product.imagen_url, ...(product.imagenes ?? [])].filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u) || (typeof u === "string" && u.startsWith("/")));
  return [...new Set(todas)];
}
