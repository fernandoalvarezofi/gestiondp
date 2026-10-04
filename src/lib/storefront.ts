/** Tienda online de cada comercio: tema editable (plantilla, color, portada, textos, secciones y redes) y utilidades para mostrarlo. */

export type Plantilla = "boutique" | "galeria" | "impacto" | "gourmet";
export type Seccion = "categorias" | "destacados" | "catalogo" | "acerca" | "opiniones" | "contacto";

export type TiendaTema = {
  plantilla?: Plantilla;
  color?: string;
  tipografia?: "sans" | "serif";
  banner_url?: string;
  titulo?: string;
  subtitulo?: string;
  boton?: string;
  anuncio?: string;
  acerca?: string;
  instagram?: string;
  facebook?: string;
  web?: string;
  whatsapp?: string;
  mostrar_opiniones?: boolean;
  /** Secciones activas, en el orden en que se muestran debajo de la portada. */
  secciones?: Seccion[];
};

export const PLANTILLAS: { id: Plantilla; nombre: string; ideal: string; detalle: string }[] = [
  { id: "boutique", nombre: "Boutique", ideal: "Moda, regalos, decoración", detalle: "Portada a pantalla completa, colecciones con foto y catálogo en grilla amplia." },
  { id: "galeria", nombre: "Galería", ideal: "Productos de autor, cosmética", detalle: "Estilo editorial y aireado: mucho espacio, tipografía fina y las fotos como protagonistas." },
  { id: "impacto", nombre: "Impacto", ideal: "Súper, kioscos, bebidas, ofertas", detalle: "Portada de color con título gigante, tarjetas redondeadas y compra rápida." },
  { id: "gourmet", nombre: "Gourmet", ideal: "Restaurantes, panaderías, cafés", detalle: "Carta con fotos, secciones con título decorado y lectura cómoda de precios." },
];

export const SECCIONES: { id: Seccion; nombre: string; detalle: string; obligatoria?: boolean }[] = [
  { id: "categorias", nombre: "Colecciones", detalle: "Tarjetas con foto para cada categoría" },
  { id: "destacados", nombre: "Destacados", detalle: "Tus productos marcados con estrella" },
  { id: "catalogo", nombre: "Catálogo", detalle: "Todos tus productos", obligatoria: true },
  { id: "acerca", nombre: "Sobre nosotros", detalle: "Tu historia" },
  { id: "opiniones", nombre: "Opiniones", detalle: "Lo que dicen tus clientes" },
  { id: "contacto", nombre: "Contacto y horarios", detalle: "Dirección, horarios y redes" },
];

export const SECCIONES_BASE: Seccion[] = ["categorias", "destacados", "catalogo", "acerca", "opiniones", "contacto"];

export const COLORES = ["#1F2A44", "#F2402A", "#0F766E", "#7C3AED", "#BE185D", "#B45309", "#15803D", "#111827"];

export const TEMA_BASE: Required<Pick<TiendaTema, "plantilla" | "color" | "tipografia" | "mostrar_opiniones" | "secciones">> = {
  plantilla: "boutique",
  color: "#1F2A44",
  tipografia: "sans",
  mostrar_opiniones: true,
  secciones: SECCIONES_BASE,
};

const HEX = /^#[0-9A-F]{6}$/i;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const httpsUrl = (value: unknown, max: number) => {
  const v = text(value, max);
  return /^https:\/\//i.test(v) ? v : "";
};

export type TemaNormalizado = TiendaTema & typeof TEMA_BASE;

/** El tema viene de la base y puede haberse editado fuera de la app: se valida otra vez antes de usarlo en estilos o enlaces. */
export function normalizeTheme(raw: unknown): TemaNormalizado {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plantilla = PLANTILLAS.find((item) => item.id === source.plantilla)?.id ?? TEMA_BASE.plantilla;
  const social = (value: unknown) => (/^[A-Za-z0-9._-]{1,60}$/.test(text(value, 60)) ? text(value, 60) : undefined);
  const known = new Set<string>(SECCIONES_BASE);
  const chosen = Array.isArray(source.secciones) ? [...new Set(source.secciones.filter((item): item is Seccion => typeof item === "string" && known.has(item)))] : null;
  const secciones = chosen ? (chosen.includes("catalogo") ? chosen : [...chosen, "catalogo" as Seccion]) : TEMA_BASE.secciones;
  return {
    plantilla,
    color: typeof source.color === "string" && HEX.test(source.color) ? source.color.toUpperCase() : TEMA_BASE.color,
    tipografia: source.tipografia === "serif" ? "serif" : "sans",
    mostrar_opiniones: source.mostrar_opiniones !== false,
    secciones,
    banner_url: httpsUrl(source.banner_url, 600) || undefined,
    titulo: text(source.titulo, 80) || undefined,
    subtitulo: text(source.subtitulo, 160) || undefined,
    boton: text(source.boton, 24) || undefined,
    anuncio: text(source.anuncio, 160) || undefined,
    acerca: text(source.acerca, 800) || undefined,
    instagram: social(source.instagram),
    facebook: social(source.facebook),
    web: httpsUrl(source.web, 200) || undefined,
    whatsapp: /^[0-9]{8,15}$/.test(text(source.whatsapp, 15)) ? text(source.whatsapp, 15) : undefined,
  };
}

/** Negro o blanco según cuál se lee mejor sobre el color elegido (luminancia relativa WCAG). */
export function readableOn(hex: string): "#FFFFFF" | "#111111" {
  const value = HEX.test(hex) ? hex : TEMA_BASE.color;
  const channel = (start: number) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#111111" : "#FFFFFF";
}

export const storefrontPath = (slug: string) => `/t/${slug}`;
export const storefrontUrl = (slug: string) => `${typeof window !== "undefined" ? window.location.origin : "https://woref.vercel.app"}${storefrontPath(slug)}`;
export const whatsappLink = (number: string, store: string) => `https://wa.me/${number}?text=${encodeURIComponent(`Hola ${store}, te escribo desde tu tienda en Woref`)}`;
