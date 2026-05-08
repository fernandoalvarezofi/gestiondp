import casa from "@/assets/inmo-casa-lincoln.jpg";
import campo from "@/assets/inmo-campo-lincoln.jpg";
import plaza from "@/assets/inmo-plaza-lincoln.jpg";
import local from "@/assets/inmo-local-lincoln.jpg";

export const fallbackImages = { casa, campo, plaza, local };

export function getFallbackImage(tipo?: string | null, tipo_propiedad?: string | null): string {
  if (tipo === "evento") return plaza;
  if (tipo === "empleo" || tipo === "servicio" || tipo === "negocio") return local;
  if (tipo === "agro") return campo;
  switch (tipo_propiedad) {
    case "campo":
    case "chacra":
    case "quinta":
      return campo;
    case "local":
    case "oficina":
    case "galpon":
      return local;
    case "departamento":
    case "ph":
      return plaza;
    default:
      return casa;
  }
}

export const TIPO_PUBLICACION: Record<string, { label: string; emoji: string }> = {
  propiedad: { label: "Propiedad", emoji: "🏠" },
  empleo: { label: "Empleo", emoji: "💼" },
  servicio: { label: "Servicio", emoji: "🛠️" },
  evento: { label: "Evento", emoji: "🎉" },
  venta_objeto: { label: "Venta", emoji: "🏷️" },
  agro: { label: "Agro / Rural", emoji: "🌾" },
  novedad_local: { label: "Novedad", emoji: "📰" },
  busqueda: { label: "Búsqueda", emoji: "🔎" },
  general: { label: "General", emoji: "💬" },
};

export const TIPO_OPERACION: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporario: "Alquiler temporario",
  local_comercial: "Local comercial",
  oficina: "Oficina",
  campo_rural: "Campo / rural",
};

export const TIPO_PROPIEDAD: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  ph: "PH",
  local: "Local",
  oficina: "Oficina",
  galpon: "Galpón",
  terreno: "Terreno",
  campo: "Campo",
  chacra: "Chacra",
  quinta: "Quinta",
  otro: "Otro",
};

export const TIPO_USUARIO: Record<string, string> = {
  vecino: "Vecino",
  dueno_directo: "Dueño directo",
  inmobiliaria: "Inmobiliaria",
  agente_independiente: "Agente independiente",
  negocio: "Negocio",
  profesional: "Profesional",
  institucion: "Institución",
};

export function formatPrecio(precio: number | null | undefined, moneda = "ARS"): string {
  if (precio == null) return "Consultar";
  const symbol = moneda === "USD" ? "US$" : "$";
  return `${symbol} ${new Intl.NumberFormat("es-AR").format(precio)}`;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}
