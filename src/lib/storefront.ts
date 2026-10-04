/** Tienda online de cada comercio: tema editable (plantilla, color, portada, textos y redes) y utilidades para mostrarlo. */

export type Plantilla = "clasica" | "minimal" | "moderno";

export type TiendaTema = {
  plantilla?: Plantilla;
  color?: string;
  tipografia?: "sans" | "serif";
  banner_url?: string;
  titulo?: string;
  subtitulo?: string;
  anuncio?: string;
  acerca?: string;
  instagram?: string;
  facebook?: string;
  web?: string;
  whatsapp?: string;
  mostrar_opiniones?: boolean;
};

export const PLANTILLAS: { id: Plantilla; nombre: string; detalle: string }[] = [
  { id: "clasica", nombre: "Clásica", detalle: "Portada con foto y productos en grilla de tarjetas" },
  { id: "minimal", nombre: "Minimal", detalle: "Limpia y centrada en las fotos de producto" },
  { id: "moderno", nombre: "Moderna", detalle: "Portada de color con título grande y tarjetas redondeadas" },
];

export const COLORES = ["#1F2A44", "#F2402A", "#0F766E", "#7C3AED", "#BE185D", "#B45309", "#15803D", "#111827"];

export const TEMA_BASE: Required<Pick<TiendaTema, "plantilla" | "color" | "tipografia" | "mostrar_opiniones">> = {
  plantilla: "clasica",
  color: "#1F2A44",
  tipografia: "sans",
  mostrar_opiniones: true,
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
  const plantilla = (["clasica", "minimal", "moderno"] as const).find((item) => item === source.plantilla) ?? TEMA_BASE.plantilla;
  const social = (value: unknown) => (/^[A-Za-z0-9._-]{1,60}$/.test(text(value, 60)) ? text(value, 60) : undefined);
  return {
    plantilla,
    color: typeof source.color === "string" && HEX.test(source.color) ? source.color.toUpperCase() : TEMA_BASE.color,
    tipografia: source.tipografia === "serif" ? "serif" : "sans",
    mostrar_opiniones: source.mostrar_opiniones !== false,
    banner_url: httpsUrl(source.banner_url, 600) || undefined,
    titulo: text(source.titulo, 80) || undefined,
    subtitulo: text(source.subtitulo, 160) || undefined,
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
