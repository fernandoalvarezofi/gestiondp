export const OPERACIONES = [
  { id: "venta", label: "Venta", corto: "Venta" },
  { id: "alquiler", label: "Alquiler", corto: "Alquiler" },
  { id: "alquiler_temporal", label: "Alquiler temporal", corto: "Temporal" },
] as const;

export type OperacionId = typeof OPERACIONES[number]["id"];

export const TIPOS_INMUEBLE = [
  { id: "departamento", label: "Departamento" },
  { id: "casa", label: "Casa" },
  { id: "ph", label: "PH" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local comercial" },
  { id: "oficina", label: "Oficina" },
  { id: "galpon", label: "Galpón" },
  { id: "cochera", label: "Cochera" },
  { id: "campo", label: "Campo" },
  { id: "otro", label: "Otro" },
] as const;

export type TipoInmuebleId = typeof TIPOS_INMUEBLE[number]["id"];

export const ESTADOS_PROPIEDAD = [
  { id: "activa", label: "Publicada" },
  { id: "borrador", label: "Borrador" },
  { id: "reservada", label: "Reservada" },
  { id: "vendida", label: "Vendida" },
  { id: "alquilada", label: "Alquilada" },
  { id: "pausada", label: "Pausada" },
] as const;

export const AMENITIES = [
  "Pileta", "Cochera", "Parrilla", "Balcón", "Terraza", "Jardín", "SUM",
  "Gimnasio", "Seguridad 24h", "Ascensor", "Amoblado", "Apto crédito",
  "Apto mascotas", "Aire acondicionado", "Calefacción", "Lavadero",
] as const;

export const MONEDAS = ["USD", "ARS", "EUR"] as const;

export function labelOperacion(id: string) {
  return OPERACIONES.find((o) => o.id === id)?.label ?? id;
}

export function labelTipo(id: string) {
  return TIPOS_INMUEBLE.find((t) => t.id === id)?.label ?? id;
}

export function labelEstado(id: string) {
  return ESTADOS_PROPIEDAD.find((e) => e.id === id)?.label ?? id;
}

export function formatPrecio(amount: number, moneda = "USD", operacion?: string) {
  if (!amount || amount <= 0) return "Consultar";
  let base: string;
  try {
    base = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    base = `${moneda} ${Math.round(amount).toLocaleString("es-AR")}`;
  }
  if (operacion === "alquiler") return `${base}/mes`;
  if (operacion === "alquiler_temporal") return `${base}/noche`;
  return base;
}

export function formatM2(v?: number | null) {
  if (!v) return null;
  return `${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })} m²`;
}

export function ubicacionCorta(p: { barrio?: string | null; ciudad?: string | null; provincia?: string | null }) {
  return [p.barrio, p.ciudad, p.provincia].filter(Boolean).join(", ");
}

export function slugifyPropiedad(titulo: string) {
  const base = titulo
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "propiedad"}-${suffix}`;
}
