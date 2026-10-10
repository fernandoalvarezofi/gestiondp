/**
 * Contratos comunes a TODAS las secciones de la tienda: estilo de la sección, destinos de enlace y botones.
 *
 * Antes cada bloque tenía su propio fondo, márgenes y enlaces (o no los tenía). Ahora cualquier sección tiene el mismo `est`
 * (fondo, márgenes, ancho, alineación, visibilidad por dispositivo y ancla) que valida este archivo y su gemelo en el
 * servidor (`_ts_estilo`), y que el render aplica en un único marco. Las propiedades son opcionales: las tiendas guardadas
 * antes siguen viéndose igual.
 */

const HEX = /^#[0-9A-F]{6}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const texto = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const https = (value: unknown, max = 600) => { const v = texto(value, max); return /^https:\/\/[^\s<>"]+$/i.test(v) ? v : ""; };
const elegir = <T extends string>(value: unknown, options: readonly T[]): T | undefined => options.find((option) => option === value);
const entero = (value: unknown, min: number, max: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined);

// ---------------------------------------------------------------- estilo de sección
export const FONDOS_SECCION = ["suave", "superficie", "acento", "oscuro", "color", "imagen"] as const;
export type FondoSeccion = (typeof FONDOS_SECCION)[number];
export const ANCHOS_SECCION = ["estrecho", "normal", "amplio", "completo"] as const;
export type AnchoSeccion = (typeof ANCHOS_SECCION)[number];
export const DISPOSITIVOS = ["todos", "escritorio", "movil"] as const;
export type Dispositivo = (typeof DISPOSITIVOS)[number];

/** Estilo de una sección. Lo que falta toma el valor del tema (diseño global). */
export type EstiloSeccion = {
  /** Fondo de toda la franja; sin fondo, se ve el de la página. */
  fondo?: FondoSeccion;
  /** Color propio (solo con fondo "color"). */
  color?: string;
  /** Foto de fondo (solo con fondo "imagen") y cuánto se oscurece (0 a 80). */
  imagen?: string;
  capa?: number;
  /** Espacio arriba y abajo en una escala de 0 (nada) a 6 (mucho). Sin valor: el espaciado del tema. */
  arriba?: number;
  abajo?: number;
  ancho?: AnchoSeccion;
  alinear?: "izquierda" | "centro";
  /** En qué pantallas se ve. */
  ver?: Dispositivo;
  /** Identificador para enlazar a esta sección (#ancla) desde el menú o un botón. */
  ancla?: string;
  /** Nombre interno para reconocer la sección en el árbol del editor (no se publica). */
  nombre?: string;
};

/** Valida el estilo de una sección (mismas reglas que `_ts_estilo` en el servidor). Devuelve undefined si no tiene nada. */
export function normalizeEstilo(raw: unknown): EstiloSeccion | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const out: EstiloSeccion = {};
  const fondo = elegir(s.fondo, FONDOS_SECCION);
  if (fondo === "color") { const c = typeof s.color === "string" && HEX.test(s.color) ? s.color.toUpperCase() : ""; if (c) { out.fondo = fondo; out.color = c; } }
  else if (fondo === "imagen") { const i = https(s.imagen); if (i) { out.fondo = fondo; out.imagen = i; out.capa = entero(s.capa, 0, 80) ?? 40; } }
  else if (fondo) out.fondo = fondo;
  const arriba = entero(s.arriba, 0, 6); if (arriba !== undefined) out.arriba = arriba;
  const abajo = entero(s.abajo, 0, 6); if (abajo !== undefined) out.abajo = abajo;
  const ancho = elegir(s.ancho, ANCHOS_SECCION); if (ancho) out.ancho = ancho;
  const alinear = elegir(s.alinear, ["izquierda", "centro"] as const); if (alinear) out.alinear = alinear;
  const ver = elegir(s.ver, DISPOSITIVOS); if (ver && ver !== "todos") out.ver = ver;
  const ancla = texto(s.ancla, 40).toLowerCase(); if (SLUG.test(ancla)) out.ancla = ancla;
  const nombre = texto(s.nombre, 40); if (nombre) out.nombre = nombre;
  return Object.keys(out).length ? out : undefined;
}

/** ¿El fondo de la sección es oscuro? (para dar vuelta los colores del texto). */
export function fondoOscuro(est: EstiloSeccion | undefined, colorAcento: string, lum: (hex: string) => "#FFFFFF" | "#111111"): boolean | undefined {
  if (!est?.fondo) return undefined;
  if (est.fondo === "oscuro" || est.fondo === "imagen") return true;
  if (est.fondo === "acento") return lum(colorAcento) === "#FFFFFF";
  if (est.fondo === "color" && est.color) return lum(est.color) === "#FFFFFF";
  return undefined;
}

/** Escala de espacio vertical (rem) para los valores 0..6. */
export const ESCALA_ESPACIO = [0, 1, 2, 3.5, 5, 7, 9] as const;

// ---------------------------------------------------------------- destinos y botones
export const DESTINOS = ["catalogo", "ofertas", "categoria", "coleccion", "pagina", "ancla", "reservar", "whatsapp", "url", "inicio"] as const;
export type DestinoTipo = (typeof DESTINOS)[number];
/** Adónde lleva un botón o enlace. `valor` es la categoría, el slug de colección/página, el ancla o la URL https. */
export type Destino = { tipo: DestinoTipo; valor?: string };
export const NOMBRE_DESTINO: Record<DestinoTipo, string> = {
  catalogo: "Todos los productos", ofertas: "Ofertas", categoria: "Una sección del catálogo", coleccion: "Una colección", pagina: "Una página",
  ancla: "Una sección de esta página", reservar: "Reservar turno", whatsapp: "WhatsApp", url: "Otra web (https)", inicio: "Inicio",
};
export const DESTINO_NECESITA: Partial<Record<DestinoTipo, "categoria" | "coleccion" | "pagina" | "ancla" | "url">> = { categoria: "categoria", coleccion: "coleccion", pagina: "pagina", ancla: "ancla", url: "url" };

export function normalizeDestino(raw: unknown): Destino | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const tipo = elegir(s.tipo, DESTINOS);
  if (!tipo) return undefined;
  const necesita = DESTINO_NECESITA[tipo];
  if (!necesita) return { tipo };
  if (necesita === "url") { const u = https(s.valor, 300); return u ? { tipo, valor: u } : undefined; }
  if (necesita === "categoria") { const c = texto(s.valor, 60); return c ? { tipo, valor: c } : undefined; }
  const v = texto(s.valor, 70).toLowerCase();
  return SLUG.test(v) ? { tipo, valor: v } : undefined;
}

export type EstiloBoton = "primario" | "secundario" | "enlace";
export type Boton = { texto: string; destino: Destino; estilo: EstiloBoton };
export function normalizeBotones(raw: unknown, max = 2): Boton[] {
  if (!Array.isArray(raw)) return [];
  const out: Boton[] = [];
  for (const el of raw.slice(0, max)) {
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    const t = texto(e.texto, 30);
    const destino = normalizeDestino(e.destino);
    if (t && destino) out.push({ texto: t, destino, estilo: elegir(e.estilo, ["primario", "secundario", "enlace"] as const) ?? "primario" });
  }
  return out;
}

/** Dirección de un destino dentro de la tienda (o externa). `null` para WhatsApp (lo resuelve quien tiene el número). */
export function destinoHref(slug: string, d: Destino): string | null {
  const base = `/t/${slug}`;
  switch (d.tipo) {
    case "inicio": return base;
    case "catalogo": return `${base}/buscar`;
    case "ofertas": return `${base}/ofertas`;
    case "categoria": return `${base}/c/${encodeURIComponent(d.valor ?? "")}`;
    case "coleccion": return `${base}/coleccion/${d.valor}`;
    case "pagina": return `${base}/pagina/${d.valor}`;
    case "ancla": return `#${d.valor}`;
    case "reservar": return `${base}/reservar`;
    case "url": return d.valor ?? null;
    case "whatsapp": return null;
  }
}
