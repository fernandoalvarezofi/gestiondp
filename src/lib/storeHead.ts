import { consiente } from "@/lib/cookies";

/**
 * Etiquetas de la cabeza del documento para una página de tienda: título, descripción, canónica, ícono, robots e imagen para
 * compartir. Devuelve una función que deja todo como estaba (al salir de la tienda vuelve la cabeza de Woref).
 * Los rastreadores que no ejecutan JavaScript reciben las mismas etiquetas desde /api/tienda (ver vercel.json).
 */
export type HeadTienda = { titulo: string; descripcion: string; canonica: string; favicon?: string | null; imagen?: string | null; indexar?: boolean; jsonLd?: Record<string, unknown> | null };

function setMeta(selector: string, crear: () => HTMLElement, attr: string, valor: string | null): () => void {
  let el = document.head.querySelector<HTMLElement>(selector);
  const creado = !el;
  if (!el) { el = crear(); document.head.appendChild(el); }
  const anterior = el.getAttribute(attr);
  if (valor === null) el.removeAttribute(attr); else el.setAttribute(attr, valor);
  return () => { if (creado) el?.remove(); else if (anterior === null) el?.removeAttribute(attr); else el?.setAttribute(attr, anterior); };
}
const meta = (key: "name" | "property", nombre: string) => () => { const m = document.createElement("meta"); m.setAttribute(key, nombre); return m; };
const link = (rel: string) => () => { const l = document.createElement("link"); l.setAttribute("rel", rel); return l; };

export function aplicarHead(h: HeadTienda): () => void {
  const titulo = h.titulo.slice(0, 70);
  const descripcion = h.descripcion.replace(/\s+/g, " ").trim().slice(0, 170);
  const tituloAnterior = document.title;
  document.title = titulo;
  const deshacer = [
    setMeta('meta[name="description"]', meta("name", "description"), "content", descripcion),
    setMeta('link[rel="canonical"]', link("canonical"), "href", h.canonica),
    setMeta('meta[property="og:title"]', meta("property", "og:title"), "content", titulo),
    setMeta('meta[property="og:description"]', meta("property", "og:description"), "content", descripcion),
    setMeta('meta[property="og:url"]', meta("property", "og:url"), "content", h.canonica),
    setMeta('meta[name="robots"]', meta("name", "robots"), "content", h.indexar === false ? "noindex, nofollow" : "index, follow"),
  ];
  if (h.imagen && /^https:\/\//.test(h.imagen)) deshacer.push(setMeta('meta[property="og:image"]', meta("property", "og:image"), "content", h.imagen));
  if (h.favicon && /^https:\/\//.test(h.favicon)) deshacer.push(setMeta('link[rel="icon"]', link("icon"), "href", h.favicon));
  let script: HTMLScriptElement | null = null;
  if (h.jsonLd) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    // "<" escapado: el contenido del comercio nunca puede cerrar la etiqueta.
    script.text = JSON.stringify(h.jsonLd).replace(/</g, "\\u003c");
    document.head.appendChild(script);
  }
  return () => { document.title = tituloAnterior; deshacer.reverse().forEach((f) => f()); script?.remove(); };
}

const META_PIXEL_RE = /^[0-9]{8,20}$/;
const GA4_RE = /^G-[A-Z0-9]{4,14}$/;
let cargados = new Set<string>();

/**
 * Píxeles de analítica del propio comercio (Meta y Google Analytics 4). Solo se cargan si la persona aceptó las cookies de
 * medición, solo desde los dominios oficiales y con IDs validados (no se puede inyectar código arbitrario).
 * Devuelve false si no se cargó nada.
 */
export function cargarPixeles(ids: { pixel_meta?: string; ga4?: string }, evento: "PageView" | "ViewContent" = "PageView", datos?: Record<string, unknown>): boolean {
  if (typeof window === "undefined" || !consiente("medicion")) return false;
  const w = window as unknown as Record<string, unknown> & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
  let algo = false;
  if (ids.pixel_meta && META_PIXEL_RE.test(ids.pixel_meta)) {
    if (!w.fbq) {
      const cola: unknown[][] = [];
      const fbq = (...a: unknown[]) => { cola.push(a); };
      (fbq as unknown as Record<string, unknown>).queue = cola;
      (fbq as unknown as Record<string, unknown>).loaded = true;
      (fbq as unknown as Record<string, unknown>).version = "2.0";
      w.fbq = fbq; w._fbq = fbq;
      const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(s);
    }
    if (!cargados.has(`meta:${ids.pixel_meta}`)) { w.fbq?.("init", ids.pixel_meta); cargados.add(`meta:${ids.pixel_meta}`); }
    w.fbq?.("track", evento, datos ?? {});
    algo = true;
  }
  if (ids.ga4 && GA4_RE.test(ids.ga4)) {
    if (!cargados.has(`ga:${ids.ga4}`)) {
      const s = document.createElement("script"); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${ids.ga4}`; document.head.appendChild(s);
      w.dataLayer = w.dataLayer ?? [];
      // gtag.js solo reconoce el objeto `arguments` (no un array): no usar rest params.
      // eslint-disable-next-line prefer-rest-params
      w.gtag = function gtag() { (w.dataLayer as unknown[]).push(arguments); };
      w.gtag("js", new Date());
      w.gtag("config", ids.ga4, { anonymize_ip: true });
      cargados.add(`ga:${ids.ga4}`);
    } else {
      w.gtag?.("event", evento === "ViewContent" ? "view_item" : "page_view", datos ?? {});
    }
    algo = true;
  }
  return algo;
}
/** Solo para pruebas. */
export const _reiniciarPixeles = () => { cargados = new Set(); };
