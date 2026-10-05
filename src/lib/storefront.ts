/**
 * Tienda online de cada comercio.
 *
 * El tema tiene dos capas: el DISEÑO global (colores, letras, esquinas, botones, espaciado) y los BLOQUES (las partes de la
 * página, en el orden que el comercio quiera). Las plantillas son solo puntos de partida que generan bloques y diseño.
 * Todo lo que viene de la base se vuelve a validar acá antes de usarse en estilos, enlaces o imágenes.
 */

export type Plantilla = "boutique" | "galeria" | "impacto" | "gourmet" | "atelier" | "urbano" | "mercado";
export type Seccion = "categorias" | "destacados" | "catalogo" | "acerca" | "opiniones" | "contacto";

// ---------------------------------------------------------------- diseño global
export type Radio = "cuadrado" | "suave" | "redondo" | "pildora";
export type Fuente = "sans" | "serif" | "redondeada" | "display" | "mono" | "geometrica" | "editorial";
export type Diseno = {
  /** Fondo y texto de la página (opcionales: si faltan se usan los de la app, claro u oscuro). */
  fondo?: string;
  texto?: string;
  radio: Radio;
  boton: "relleno" | "contorno";
  fuente_titulos: Fuente;
  fuente_texto: "sans" | "serif";
  ancho: "normal" | "amplio";
  espaciado: "compacto" | "normal" | "amplio";
  aspecto: "1 / 1" | "4 / 5" | "3 / 4" | "16 / 10";
  descripcion: boolean;
  cabecera: "izquierda" | "centro";
};

export const RADIOS: Record<Radio, { nombre: string; css: string }> = {
  cuadrado: { nombre: "Cuadradas", css: "0px" },
  suave: { nombre: "Suaves", css: "0.5rem" },
  redondo: { nombre: "Redondeadas", css: "1rem" },
  pildora: { nombre: "Muy redondas", css: "1.75rem" },
};

export const FUENTES: Record<Fuente, { nombre: string; css: string | undefined; ejemplo: string }> = {
  sans: { nombre: "Moderna", css: undefined, ejemplo: "Aa" },
  serif: { nombre: "Elegante", css: "'Playfair Display Variable', Georgia, 'Times New Roman', serif", ejemplo: "Aa" },
  editorial: { nombre: "Editorial", css: "'Fraunces Variable', Georgia, serif", ejemplo: "Aa" },
  geometrica: { nombre: "Geométrica", css: "'Space Grotesk Variable', 'Helvetica Neue', Arial, sans-serif", ejemplo: "Aa" },
  redondeada: { nombre: "Amistosa", css: "'Nunito Variable', ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif", ejemplo: "Aa" },
  display: { nombre: "Impacto", css: "'Bebas Neue', Impact, 'Arial Narrow Bold', Haettenschweiler, sans-serif", ejemplo: "Aa" },
  mono: { nombre: "Técnica", css: "'Space Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace", ejemplo: "Aa" },
};

/** Letra del texto corrido cuando se elige "serif" (los títulos usan la familia elegida aparte). */
export const TEXTO_SERIF = "'Lora Variable', Georgia, 'Times New Roman', serif";

export const ASPECTOS: { id: Diseno["aspecto"]; nombre: string }[] = [
  { id: "1 / 1", nombre: "Cuadrada" },
  { id: "4 / 5", nombre: "Vertical" },
  { id: "3 / 4", nombre: "Alta" },
  { id: "16 / 10", nombre: "Horizontal" },
];

// ---------------------------------------------------------------- bloques
export type EstiloPortada = "boutique" | "galeria" | "impacto" | "gourmet" | "atelier" | "urbano" | "mercado" | "simple";
export type EnlaceTipo = "catalogo" | "whatsapp" | "url";
type Base = { id: string; visible: boolean };

export type BloquePortada = Base & { tipo: "portada"; estilo: EstiloPortada; imagen_url?: string; titulo?: string; subtitulo?: string; boton?: string; alineacion: "izquierda" | "centro"; alto: "chico" | "medio" | "grande"; oscurecer: number };
export type BloqueTexto = Base & { tipo: "texto"; titulo?: string; texto?: string; alineacion: "izquierda" | "centro"; fondo: "ninguno" | "suave" | "color" };
export type BloqueImagenTexto = Base & { tipo: "imagen_texto"; imagen_url?: string; lado: "izquierda" | "derecha"; titulo?: string; texto?: string; boton?: string; enlace_tipo: EnlaceTipo; enlace_url?: string };
export type BloqueBanner = Base & { tipo: "banner"; imagen_url?: string; titulo?: string; texto?: string; boton?: string; enlace_tipo: EnlaceTipo; enlace_url?: string; alto: "chico" | "medio" | "grande" };
export type BloqueColecciones = Base & { tipo: "colecciones"; titulo?: string; estilo: "tarjetas" | "circulos" | "lista" };
export type BloqueProductos = Base & { tipo: "productos"; titulo?: string; fuente: "destacados" | "categoria" | "todos"; categoria?: string; cantidad: number; columnas: number };
export type BloqueCatalogo = Base & { tipo: "catalogo"; titulo?: string; columnas: number; filtros: boolean };
export type GaleriaItem = { url: string; texto?: string };
export type BloqueGaleria = Base & { tipo: "galeria"; titulo?: string; imagenes: GaleriaItem[]; columnas: number };
export type Icono = "envio" | "pago" | "calidad" | "tiempo" | "soporte" | "local";
export type ConfianzaItem = { icono: Icono; titulo: string; texto?: string };
export type BloqueConfianza = Base & { tipo: "confianza"; items: ConfianzaItem[] };
export type FaqItem = { p: string; r: string };
export type BloqueFaq = Base & { tipo: "faq"; titulo?: string; items: FaqItem[] };
export type BloqueOpiniones = Base & { tipo: "opiniones"; titulo?: string };
export type BloqueContacto = Base & { tipo: "contacto"; titulo?: string };
export type BloqueSeparador = Base & { tipo: "separador"; alto: "chico" | "medio" | "grande"; linea: boolean };
export type BloqueCinta = Base & { tipo: "cinta"; items: string[]; estilo: "acento" | "oscuro" | "claro" };
export type BloqueNewsletter = Base & { tipo: "newsletter"; titulo?: string; texto?: string; boton?: string };
export type PoliticaItem = { t: string; x: string };
export type BloquePoliticas = Base & { tipo: "politicas"; titulo?: string; items: PoliticaItem[] };
export type BloqueOferta = Base & { tipo: "oferta"; titulo?: string; texto?: string; boton?: string; hasta?: string; enlace_tipo: EnlaceTipo; enlace_url?: string };
export type BloqueVideo = Base & { tipo: "video"; titulo?: string; texto?: string; url?: string };

export type Bloque = BloquePortada | BloqueTexto | BloqueImagenTexto | BloqueBanner | BloqueColecciones | BloqueProductos | BloqueCatalogo | BloqueGaleria | BloqueConfianza | BloqueFaq | BloqueOpiniones | BloqueCinta | BloqueNewsletter | BloquePoliticas | BloqueOferta | BloqueVideo | BloqueContacto | BloqueSeparador;
export type BloqueTipo = Bloque["tipo"];

export const MAX_BLOQUES = 24;

export const TIPOS_BLOQUE: { tipo: BloqueTipo; nombre: string; detalle: string; unico?: boolean }[] = [
  { tipo: "portada", nombre: "Portada", detalle: "Lo primero que se ve: foto grande, título y botón", unico: true },
  { tipo: "banner", nombre: "Banner de oferta", detalle: "Una imagen ancha con mensaje y botón" },
  { tipo: "colecciones", nombre: "Colecciones", detalle: "Tus categorías como tarjetas con foto" },
  { tipo: "productos", nombre: "Selección de productos", detalle: "Destacados, una categoría o los últimos" },
  { tipo: "catalogo", nombre: "Catálogo completo", detalle: "Todos tus productos con filtros", unico: true },
  { tipo: "imagen_texto", nombre: "Imagen con texto", detalle: "Foto a un lado y tu mensaje al otro" },
  { tipo: "texto", nombre: "Texto", detalle: "Un título y un párrafo" },
  { tipo: "galeria", nombre: "Galería de fotos", detalle: "Hasta 8 fotos de tu local o tus productos" },
  { tipo: "confianza", nombre: "Ventajas", detalle: "Envío rápido, pago seguro, atención…" },
  { tipo: "faq", nombre: "Preguntas frecuentes", detalle: "Respondé lo que siempre te preguntan" },
  { tipo: "opiniones", nombre: "Opiniones de clientes", detalle: "Lo que dicen de vos", unico: true },
  { tipo: "contacto", nombre: "Contacto y horarios", detalle: "Dirección, horarios y redes", unico: true },
  { tipo: "cinta", nombre: "Cinta de anuncios", detalle: "Una franja con frases que se mueven (envío gratis, novedades…)" },
  { tipo: "oferta", nombre: "Oferta con cuenta regresiva", detalle: "Un mensaje con reloj hasta que termina la promo" },
  { tipo: "newsletter", nombre: "Suscripción por email", detalle: "Juntá los emails de tus clientes y avisales de novedades" },
  { tipo: "politicas", nombre: "Envíos, cambios y garantía", detalle: "Tus políticas en desplegables, también en cada producto" },
  { tipo: "video", nombre: "Video", detalle: "Un video de YouTube o Vimeo" },
  { tipo: "separador", nombre: "Espacio", detalle: "Un respiro entre bloques, con línea opcional" },
];

export const ICONOS: { id: Icono; nombre: string }[] = [
  { id: "envio", nombre: "Envío" }, { id: "pago", nombre: "Pago" }, { id: "calidad", nombre: "Calidad" },
  { id: "tiempo", nombre: "Rapidez" }, { id: "soporte", nombre: "Atención" }, { id: "local", nombre: "Local" },
];

// ---------------------------------------------------------------- tema completo
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
  secciones?: Seccion[];
  diseno?: Partial<Diseno>;
  bloques?: Bloque[];
};

export const PLANTILLAS: { id: Plantilla; nombre: string; ideal: string; detalle: string; color: string }[] = [
  { id: "boutique", nombre: "Boutique", ideal: "Moda, regalos, decoración", detalle: "Portada a pantalla completa, colecciones con foto y catálogo en grilla amplia.", color: "#1F2A44" },
  { id: "atelier", nombre: "Atelier", ideal: "Moda de autor, objetos, hogar", detalle: "Papel cálido, tipografía editorial y líneas finas. Mucho aire, fotos grandes y un tono de revista.", color: "#3B2F2F" },
  { id: "galeria", nombre: "Galería", ideal: "Cosmética, productos de autor", detalle: "Estilo aireado y minimalista: las fotos son las protagonistas y todo lo demás se corre.", color: "#27272A" },
  { id: "urbano", nombre: "Urbano", ideal: "Streetwear, tecnología, bebidas", detalle: "Fondo negro, titulares gigantes condensados y un color de acento que se ve desde lejos.", color: "#C8F031" },
  { id: "impacto", nombre: "Impacto", ideal: "Súper, kioscos, ofertas", detalle: "Portada de color con título gigante, cuenta regresiva y compra rápida.", color: "#E2552C" },
  { id: "mercado", nombre: "Mercado", ideal: "Súper, ferretería, catálogos grandes", detalle: "Denso y directo: banner principal, ofertas, categorías y muchos productos a la vista.", color: "#2563EB" },
  { id: "gourmet", nombre: "Gourmet", ideal: "Restaurantes, panaderías, cafés", detalle: "Carta con fotos, secciones con título decorado y lectura cómoda de precios.", color: "#7A2E2E" },
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

const DISENO_BASE: Diseno = { radio: "redondo", boton: "relleno", fuente_titulos: "sans", fuente_texto: "sans", ancho: "normal", espaciado: "normal", aspecto: "4 / 5", descripcion: false, cabecera: "izquierda" };

/** Diseño inicial de cada plantilla (lo que antes estaba fijo en el código). */
export const DISENO_PLANTILLA: Record<Plantilla, Diseno> = {
  boutique: { ...DISENO_BASE, radio: "suave", aspecto: "4 / 5" },
  galeria: { ...DISENO_BASE, radio: "cuadrado", aspecto: "3 / 4", fuente_titulos: "editorial", espaciado: "amplio", cabecera: "centro" },
  impacto: { ...DISENO_BASE, radio: "pildora", aspecto: "1 / 1", fuente_titulos: "sans" },
  gourmet: { ...DISENO_BASE, radio: "redondo", aspecto: "1 / 1", fuente_titulos: "serif", fuente_texto: "serif", descripcion: true },
  // Atelier: papel cálido, tipografía editorial, líneas finas y mucho aire. Pensada para moda, decoración y objetos de autor.
  atelier: { ...DISENO_BASE, fondo: "#FAF7F2", texto: "#1C1917", radio: "cuadrado", boton: "contorno", aspecto: "3 / 4", fuente_titulos: "editorial", ancho: "amplio", espaciado: "amplio", cabecera: "centro" },
  // Urbano: fondo negro, titulares condensados y color de acento fuerte. Pensada para streetwear, tecnología, bebidas y deportes.
  urbano: { ...DISENO_BASE, fondo: "#0A0A0B", texto: "#F4F4F5", radio: "cuadrado", aspecto: "3 / 4", fuente_titulos: "display", ancho: "amplio" },
  // Mercado: denso y directo, con ofertas y categorías a la vista como en un marketplace. Pensada para súper, kioscos, ferretería y catálogos grandes.
  mercado: { ...DISENO_BASE, radio: "suave", aspecto: "1 / 1", fuente_titulos: "sans", ancho: "amplio", espaciado: "compacto" },
};

export const TEMA_BASE = {
  plantilla: "boutique" as Plantilla,
  color: "#1F2A44",
  tipografia: "sans" as "sans" | "serif",
  mostrar_opiniones: true,
  secciones: SECCIONES_BASE,
};

const HEX = /^#[0-9A-F]{6}$/i;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const httpsUrl = (value: unknown, max = 600) => {
  const v = text(value, max);
  return /^https:\/\//i.test(v) ? v : "";
};
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.find((option) => option === value) ?? fallback);
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const idOf = (value: unknown, index: number) => (typeof value === "string" && /^[a-z0-9-]{1,16}$/.test(value) ? value : `b${index}${Math.random().toString(36).slice(2, 6)}`);

/** Fecha ISO (con o sin zona) o undefined. */
export function fechaIso(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value) && !Number.isNaN(Date.parse(value)) ? value.slice(0, 30) : undefined;
}

/** Fin del domingo próximo, hora local, como fecha sugerida de una oferta. */
export function finDeSemana(desde = new Date()): string {
  const d = new Date(desde);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(23, 59, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T23:59`;
}

const VIDEO_RE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)[A-Za-z0-9_-]{5,20}([&?][A-Za-z0-9_=&-]*)?$/i;
/** Solo YouTube o Vimeo por https. */
export function videoUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 200 && VIDEO_RE.test(value) ? value : undefined;
}

/** Dirección para incrustar (iframe) a partir de un enlace de YouTube o Vimeo. */
export function videoEmbed(url: string | undefined): string | null {
  const ok = videoUrl(url);
  if (!ok) return null;
  const yt = ok.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{5,20})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vi = ok.match(/vimeo\.com\/([A-Za-z0-9_-]{5,20})/i);
  return vi ? `https://player.vimeo.com/video/${vi[1]}` : null;
}

export const nuevoId = () => `b${Math.random().toString(36).slice(2, 9)}`;

const ALTOS = ["chico", "medio", "grande"] as const;
const ALINEACIONES = ["izquierda", "centro"] as const;
const ENLACES = ["catalogo", "whatsapp", "url"] as const;
const ESTILOS_PORTADA = ["boutique", "galeria", "impacto", "gourmet", "atelier", "urbano", "mercado", "simple"] as const;
const FONDOS_TEXTO = ["ninguno", "suave", "color"] as const;
const ICONOS_IDS = ICONOS.map((item) => item.id);

/** Valores iniciales de cada tipo de bloque (lo que se agrega al tocar "Agregar bloque"). */
export function bloqueNuevo(tipo: BloqueTipo, plantilla: Plantilla = "boutique"): Bloque {
  const base = { id: nuevoId(), visible: true };
  switch (tipo) {
    case "portada": return { ...base, tipo, estilo: plantilla, alineacion: "izquierda", alto: "grande", oscurecer: 55 };
    case "texto": return { ...base, tipo, titulo: "Un título para tu mensaje", texto: "Escribí acá lo que quieras contarle a tus clientes.", alineacion: "centro", fondo: "ninguno" };
    case "imagen_texto": return { ...base, tipo, lado: "izquierda", titulo: "Hecho con dedicación", texto: "Contá qué te hace distinto y por qué tus clientes te eligen.", boton: "Ver productos", enlace_tipo: "catalogo" };
    case "banner": return { ...base, tipo, titulo: "Ofertas de la semana", texto: "Aprovechá precios especiales por tiempo limitado.", boton: "Ver ofertas", enlace_tipo: "catalogo", alto: "medio" };
    case "colecciones": return { ...base, tipo, titulo: "Colecciones", estilo: plantilla === "gourmet" ? "circulos" : "tarjetas" };
    case "productos": return { ...base, tipo, titulo: "Destacados", fuente: "destacados", cantidad: 4, columnas: 4 };
    case "catalogo": return { ...base, tipo, titulo: "Todos los productos", columnas: 4, filtros: true };
    case "galeria": return { ...base, tipo, titulo: "Galería", imagenes: [], columnas: 3 };
    case "confianza": return { ...base, tipo, items: [{ icono: "envio", titulo: "Envío a domicilio", texto: "Te lo llevamos a tu puerta" }, { icono: "pago", titulo: "Pagá como quieras", texto: "Efectivo o tarjeta" }, { icono: "calidad", titulo: "Calidad asegurada", texto: "Productos frescos todos los días" }] };
    case "faq": return { ...base, tipo, titulo: "Preguntas frecuentes", items: [{ p: "¿Hacen envíos?", r: "Sí, llegamos a toda la zona cercana al local." }] };
    case "opiniones": return { ...base, tipo, titulo: "Lo que dicen nuestros clientes" };
    case "contacto": return { ...base, tipo, titulo: "Contacto y horarios" };
    case "separador": return { ...base, tipo, alto: "medio", linea: true };
    case "cinta": return { ...base, tipo, items: ["Envío a domicilio", "Pagá como quieras", "Novedades cada semana"], estilo: "acento" };
    case "newsletter": return { ...base, tipo, titulo: "Enterate primero de las novedades", texto: "Dejanos tu email y te avisamos de nuevos productos y ofertas.", boton: "Quiero enterarme" };
    case "politicas": return { ...base, tipo, titulo: "Envíos, cambios y garantía", items: [{ t: "Envíos", x: "Entregamos en la zona cercana al local. El costo y el tiempo se calculan con tu dirección." }, { t: "Cambios y devoluciones", x: "Podés cambiar tu compra dentro de los 10 días con el comprobante." }, { t: "Medios de pago", x: "Efectivo, transferencia o tarjeta." }] };
    case "oferta": return { ...base, tipo, titulo: "Oferta por tiempo limitado", texto: "Aprovechá antes de que termine.", boton: "Ver productos", hasta: finDeSemana(), enlace_tipo: "catalogo" };
    case "video": return { ...base, tipo, titulo: "Conocenos" };
  }
}

/** Valida un bloque venido de la base o del editor; devuelve null si no se reconoce. */
export function normalizeBloque(raw: unknown, index: number): Bloque | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const base = { id: idOf(s.id, index), visible: s.visible !== false };
  const opt = (value: unknown, max: number) => text(value, max) || undefined;
  const enlace = { enlace_tipo: pick(s.enlace_tipo, ENLACES, "catalogo"), enlace_url: httpsUrl(s.enlace_url, 300) || undefined };
  switch (s.tipo) {
    case "portada": return { ...base, tipo: "portada", estilo: pick(s.estilo, ESTILOS_PORTADA, "simple"), imagen_url: httpsUrl(s.imagen_url) || undefined, titulo: opt(s.titulo, 80), subtitulo: opt(s.subtitulo, 200), boton: opt(s.boton, 24), alineacion: pick(s.alineacion, ALINEACIONES, "izquierda"), alto: pick(s.alto, ALTOS, "grande"), oscurecer: clampInt(s.oscurecer, 0, 80, 55) };
    case "texto": return { ...base, tipo: "texto", titulo: opt(s.titulo, 80), texto: opt(s.texto, 800), alineacion: pick(s.alineacion, ALINEACIONES, "centro"), fondo: pick(s.fondo, FONDOS_TEXTO, "ninguno") };
    case "imagen_texto": return { ...base, tipo: "imagen_texto", imagen_url: httpsUrl(s.imagen_url) || undefined, lado: pick(s.lado, ["izquierda", "derecha"] as const, "izquierda"), titulo: opt(s.titulo, 80), texto: opt(s.texto, 600), boton: opt(s.boton, 24), ...enlace };
    case "banner": return { ...base, tipo: "banner", imagen_url: httpsUrl(s.imagen_url) || undefined, titulo: opt(s.titulo, 80), texto: opt(s.texto, 200), boton: opt(s.boton, 24), alto: pick(s.alto, ALTOS, "medio"), ...enlace };
    case "colecciones": return { ...base, tipo: "colecciones", titulo: opt(s.titulo, 80), estilo: pick(s.estilo, ["tarjetas", "circulos", "lista"] as const, "tarjetas") };
    case "productos": return { ...base, tipo: "productos", titulo: opt(s.titulo, 80), fuente: pick(s.fuente, ["destacados", "categoria", "todos"] as const, "destacados"), categoria: opt(s.categoria, 60), cantidad: clampInt(s.cantidad, 2, 12, 4), columnas: clampInt(s.columnas, 2, 5, 4) };
    case "catalogo": return { ...base, tipo: "catalogo", titulo: opt(s.titulo, 80), columnas: clampInt(s.columnas, 2, 5, 4), filtros: s.filtros !== false };
    case "galeria": {
      const imagenes = (Array.isArray(s.imagenes) ? s.imagenes : []).slice(0, 8).map((item): GaleriaItem | null => {
        const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const url = httpsUrl(entry.url);
        return url ? { url, texto: opt(entry.texto, 80) } : null;
      }).filter((item): item is GaleriaItem => item !== null);
      return { ...base, tipo: "galeria", titulo: opt(s.titulo, 80), imagenes, columnas: clampInt(s.columnas, 2, 4, 3) };
    }
    case "confianza": {
      const items = (Array.isArray(s.items) ? s.items : []).slice(0, 4).map((item): ConfianzaItem | null => {
        const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const titulo = text(entry.titulo, 40);
        return titulo ? { icono: pick(entry.icono, ICONOS_IDS, "calidad"), titulo, texto: opt(entry.texto, 90) } : null;
      }).filter((item): item is ConfianzaItem => item !== null);
      return { ...base, tipo: "confianza", items };
    }
    case "faq": {
      const items = (Array.isArray(s.items) ? s.items : []).slice(0, 8).map((item): FaqItem | null => {
        const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const p = text(entry.p, 120), r = text(entry.r, 400);
        return p && r ? { p, r } : null;
      }).filter((item): item is FaqItem => item !== null);
      return { ...base, tipo: "faq", titulo: opt(s.titulo, 80), items };
    }
    case "opiniones": return { ...base, tipo: "opiniones", titulo: opt(s.titulo, 80) };
    case "contacto": return { ...base, tipo: "contacto", titulo: opt(s.titulo, 80) };
    case "separador": return { ...base, tipo: "separador", alto: pick(s.alto, ALTOS, "medio"), linea: s.linea !== false };
    case "cinta": {
      const items = (Array.isArray(s.items) ? s.items : []).map((item) => text(item, 60)).filter(Boolean).slice(0, 6);
      return { ...base, tipo: "cinta", items, estilo: pick(s.estilo, ["acento", "oscuro", "claro"] as const, "acento") };
    }
    case "newsletter": return { ...base, tipo: "newsletter", titulo: opt(s.titulo, 80), texto: opt(s.texto, 200), boton: opt(s.boton, 24) };
    case "politicas": {
      const items = (Array.isArray(s.items) ? s.items : []).slice(0, 4).map((item): PoliticaItem | null => {
        const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const t = text(entry.t, 40), x = text(entry.x, 600);
        return t && x ? { t, x } : null;
      }).filter((item): item is PoliticaItem => item !== null);
      return { ...base, tipo: "politicas", titulo: opt(s.titulo, 80), items };
    }
    case "oferta": return { ...base, tipo: "oferta", titulo: opt(s.titulo, 80), texto: opt(s.texto, 200), boton: opt(s.boton, 24), hasta: fechaIso(s.hasta), ...enlace };
    case "video": return { ...base, tipo: "video", titulo: opt(s.titulo, 80), texto: opt(s.texto, 200), url: videoUrl(s.url) };
    default: return null;
  }
}

/**
 * Página COMPLETA de cada plantilla: portada, beneficios, colecciones, selecciones de productos, banners, catálogo, opiniones,
 * suscripción, políticas y contacto, ya ordenados y con textos de ejemplo para que el comercio solo los ajuste. Los identificadores son
 * fijos para que la misma tienda genere siempre los mismos bloques. Solo se usa al ELEGIR una plantilla; las tiendas ya armadas no cambian.
 */
export function paginaDePlantilla(plantilla: Plantilla, tema: Pick<TiendaTema, "titulo" | "subtitulo" | "boton" | "banner_url" | "acerca"> = {}): Bloque[] {
  const b = <T extends Bloque>(tipo: T["tipo"], id: string, cambios: Partial<T> = {}): T => ({ ...(bloqueNuevo(tipo, plantilla) as Bloque), id, ...cambios }) as T;
  const portada = b<BloquePortada>("portada", "portada", { estilo: plantilla, titulo: tema.titulo, subtitulo: tema.subtitulo, boton: tema.boton, imagen_url: tema.banner_url });
  const beneficios = (items: ConfianzaItem[]) => b<BloqueConfianza>("confianza", "beneficios", { items });
  const envio: ConfianzaItem = { icono: "envio", titulo: "Envío a domicilio", texto: "Te lo llevamos a tu puerta" };
  const pago: ConfianzaItem = { icono: "pago", titulo: "Pagá como quieras", texto: "Efectivo, transferencia o tarjeta" };
  const calidad: ConfianzaItem = { icono: "calidad", titulo: "Calidad asegurada", texto: "Productos elegidos con cuidado" };
  const soporte: ConfianzaItem = { icono: "soporte", titulo: "Atención personalizada", texto: "Escribinos y te ayudamos" };
  const catalogo = (titulo: string, columnas = 4) => b<BloqueCatalogo>("catalogo", "catalogo", { titulo, columnas, filtros: true });
  const acerca = tema.acerca ? b<BloqueTexto>("texto", "acerca", { titulo: "Sobre nosotros", texto: tema.acerca, alineacion: plantilla === "gourmet" ? "izquierda" : "centro", fondo: "ninguno" }) : null;
  const cierre: Bloque[] = [b<BloqueOpiniones>("opiniones", "opiniones"), b<BloqueNewsletter>("newsletter", "newsletter"), b<BloqueContacto>("contacto", "contacto")];
  const quitar = (lista: (Bloque | null)[]) => lista.filter((x): x is Bloque => x !== null);

  switch (plantilla) {
    case "atelier":
      return quitar([
        portada,
        b<BloqueCinta>("cinta", "cinta", { estilo: "claro", items: ["Nuevos ingresos", "Envíos a domicilio", "Pagá como quieras"] }),
        acerca ?? b<BloqueTexto>("texto", "manifiesto", { titulo: "Pocas cosas, bien elegidas", texto: "Contá en dos líneas qué hacés y por qué lo hacés así. Una tienda con una voz propia se recuerda más que una con mil productos.", alineacion: "centro", fondo: "ninguno" }),
        b<BloqueProductos>("productos", "seleccion", { titulo: "La selección de la casa", fuente: "destacados", cantidad: 3, columnas: 3 }),
        b<BloqueImagenTexto>("imagen_texto", "historia", { lado: "derecha", titulo: "Hecho con tiempo", texto: "Explicá cómo nace cada pieza, quién la hace y qué la hace distinta. Cambiá esta foto por una tuya.", boton: "Ver la colección", enlace_tipo: "catalogo" }),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "Explorá por colección", estilo: "lista" }),
        catalogo("Todo el catálogo", 3),
        ...cierre,
        b<BloquePoliticas>("politicas", "politicas"),
      ]);
    case "urbano":
      return quitar([
        b<BloqueCinta>("cinta", "cinta", { estilo: "acento", items: ["Nuevo drop", "Stock limitado", "Envíos a todo el país", "Pagá como quieras"] }),
        portada,
        b<BloqueProductos>("productos", "drop", { titulo: "Último drop", fuente: "destacados", cantidad: 4, columnas: 4 }),
        b<BloqueBanner>("banner", "banner", { titulo: "Edición limitada", texto: "Cuando se agota, no vuelve. Elegí el tuyo.", boton: "Ver todo", enlace_tipo: "catalogo", alto: "grande" }),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "Categorías", estilo: "tarjetas" }),
        catalogo("Todo el catálogo", 4),
        b<BloqueOferta>("oferta", "oferta", { titulo: "Descuento por tiempo limitado", texto: "Aprovechalo antes de que termine.", boton: "Ir a comprar" }),
        ...cierre,
      ]);
    case "mercado":
      return quitar([
        portada,
        beneficios([envio, pago, soporte]),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "Categorías", estilo: "circulos" }),
        b<BloqueProductos>("productos", "ofertas", { titulo: "Los más elegidos", fuente: "destacados", cantidad: 5, columnas: 5 }),
        b<BloqueBanner>("banner", "banner", { titulo: "Ofertas de la semana", texto: "Precios especiales en productos seleccionados.", boton: "Ver ofertas", enlace_tipo: "catalogo", alto: "chico" }),
        catalogo("Todos los productos", 5),
        b<BloqueFaq>("faq", "faq"),
        b<BloquePoliticas>("politicas", "politicas"),
        b<BloqueNewsletter>("newsletter", "newsletter"),
        b<BloqueContacto>("contacto", "contacto"),
      ]);
    case "impacto":
      return quitar([
        b<BloqueCinta>("cinta", "cinta", { estilo: "oscuro", items: ["Pedí ahora", "Ofertas todos los días", "Envío rápido"] }),
        portada,
        b<BloqueOferta>("oferta", "oferta", { titulo: "Oferta por tiempo limitado", texto: "Aprovechá antes de que termine.", boton: "Ver ofertas" }),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "¿Qué estás buscando?", estilo: "circulos" }),
        b<BloqueProductos>("productos", "destacados", { titulo: "Los más pedidos", fuente: "destacados", cantidad: 4, columnas: 4 }),
        beneficios([envio, pago, calidad]),
        catalogo("Todos los productos", 4),
        b<BloqueFaq>("faq", "faq"),
        ...cierre.slice(1),
      ]);
    case "gourmet":
      return quitar([
        portada,
        acerca ?? b<BloqueImagenTexto>("imagen_texto", "cocina", { lado: "izquierda", titulo: "Cocina de la casa", texto: "Contá de dónde vienen tus recetas y tus ingredientes. Cambiá esta foto por una de tu cocina.", boton: "Ver la carta", enlace_tipo: "catalogo" }),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "La carta", estilo: "circulos" }),
        b<BloqueProductos>("productos", "destacados", { titulo: "Para empezar", fuente: "destacados", cantidad: 4, columnas: 4 }),
        catalogo("Nuestra carta", 4),
        beneficios([envio, calidad, pago]),
        b<BloqueOpiniones>("opiniones", "opiniones"),
        b<BloqueFaq>("faq", "faq"),
        b<BloqueContacto>("contacto", "contacto"),
      ]);
    case "galeria":
      return quitar([
        portada,
        acerca ?? b<BloqueTexto>("texto", "manifiesto", { titulo: "Hecho con intención", texto: "Una frase sobre tu forma de trabajar. Dejá que las fotos hagan el resto.", alineacion: "centro", fondo: "ninguno" }),
        b<BloqueProductos>("productos", "seleccion", { titulo: "Selección", fuente: "destacados", cantidad: 3, columnas: 3 }),
        b<BloqueImagenTexto>("imagen_texto", "historia", { lado: "izquierda", titulo: "Nuestra historia", texto: "Contá cómo empezó todo. Cambiá esta foto por una tuya.", boton: "Ver productos", enlace_tipo: "catalogo" }),
        catalogo("Catálogo", 3),
        ...cierre,
      ]);
    default: // boutique
      return quitar([
        portada,
        beneficios([envio, pago, calidad, soporte]),
        b<BloqueColecciones>("colecciones", "colecciones", { titulo: "Comprá por categoría", estilo: "tarjetas" }),
        b<BloqueProductos>("productos", "destacados", { titulo: "Lo más elegido", fuente: "destacados", cantidad: 4, columnas: 4 }),
        b<BloqueImagenTexto>("imagen_texto", "historia", { lado: "izquierda", titulo: tema.acerca ? "Sobre nosotros" : "Hecho con dedicación", texto: tema.acerca ?? "Contá qué te hace distinto y por qué tus clientes te eligen. Cambiá esta foto por una tuya.", boton: "Ver productos", enlace_tipo: "catalogo" }),
        b<BloqueBanner>("banner", "banner", { titulo: "Novedades de la temporada", texto: "Mirá lo último que llegó.", boton: "Ver novedades", enlace_tipo: "catalogo", alto: "medio" }),
        catalogo("Todos los productos", 4),
        ...cierre,
        b<BloquePoliticas>("politicas", "politicas"),
      ]);
  }
}

/** Bloques de una plantilla: el punto de partida que el comercio puede cambiar por completo. */
export function bloquesDePlantilla(plantilla: Plantilla, tema: Pick<TiendaTema, "titulo" | "subtitulo" | "boton" | "banner_url" | "acerca" | "secciones" | "mostrar_opiniones"> = {}): Bloque[] {
  const secciones = tema.secciones ?? SECCIONES_BASE;
  // Identificadores fijos: así la misma tienda genera siempre los mismos bloques y el editor no ve cambios donde no los hay.
  const con = <T extends Bloque>(bloque: T, id: string): T => ({ ...bloque, id });
  const out: Bloque[] = [{ ...(con(bloqueNuevo("portada", plantilla), "portada") as BloquePortada), estilo: plantilla, titulo: tema.titulo, subtitulo: tema.subtitulo, boton: tema.boton, imagen_url: tema.banner_url }];
  for (const id of secciones) {
    if (id === "categorias") out.push(con(bloqueNuevo("colecciones", plantilla), "colecciones"));
    else if (id === "destacados") out.push(con(bloqueNuevo("productos", plantilla), "destacados"));
    else if (id === "catalogo") out.push({ ...(con(bloqueNuevo("catalogo", plantilla), "catalogo") as BloqueCatalogo), titulo: plantilla === "gourmet" ? "Nuestra carta" : "Todos los productos", columnas: plantilla === "galeria" ? 3 : 4 });
    else if (id === "acerca") out.push({ ...(con(bloqueNuevo("texto", plantilla), "acerca") as BloqueTexto), titulo: "Sobre nosotros", texto: tema.acerca ?? "" });
    else if (id === "opiniones") out.push(con(bloqueNuevo("opiniones", plantilla), "opiniones"));
    else if (id === "contacto") out.push(con(bloqueNuevo("contacto", plantilla), "contacto"));
  }
  return out;
}

export type TemaNormalizado = TiendaTema & typeof TEMA_BASE & { diseno: Diseno; bloques: Bloque[] };

export function normalizeDiseno(raw: unknown, plantilla: Plantilla, tipografia: "sans" | "serif" = "sans"): Diseno {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = { ...DISENO_PLANTILLA[plantilla] };
  if (tipografia === "serif" && plantilla !== "gourmet") { base.fuente_titulos = "serif"; base.fuente_texto = "serif"; }
  const color = (value: unknown) => (typeof value === "string" && HEX.test(value) ? value.toUpperCase() : undefined);
  return {
    // El fondo y el texto de la plantilla (papel cálido, negro…) valen salvo que el comercio elija otros.
    fondo: color(source.fondo) ?? base.fondo,
    texto: color(source.texto) ?? base.texto,
    radio: pick(source.radio, Object.keys(RADIOS) as Radio[], base.radio),
    boton: pick(source.boton, ["relleno", "contorno"] as const, base.boton),
    fuente_titulos: pick(source.fuente_titulos, Object.keys(FUENTES) as Fuente[], base.fuente_titulos),
    fuente_texto: pick(source.fuente_texto, ["sans", "serif"] as const, base.fuente_texto),
    ancho: pick(source.ancho, ["normal", "amplio"] as const, base.ancho),
    espaciado: pick(source.espaciado, ["compacto", "normal", "amplio"] as const, base.espaciado),
    aspecto: pick(source.aspecto, ASPECTOS.map((item) => item.id), base.aspecto),
    descripcion: typeof source.descripcion === "boolean" ? source.descripcion : base.descripcion,
    cabecera: pick(source.cabecera, ["izquierda", "centro"] as const, base.cabecera),
  };
}

/** El tema viene de la base y puede haberse editado fuera de la app: se valida otra vez antes de usarlo en estilos o enlaces. */
export function normalizeTheme(raw: unknown): TemaNormalizado {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plantilla = PLANTILLAS.find((item) => item.id === source.plantilla)?.id ?? TEMA_BASE.plantilla;
  const social = (value: unknown) => (/^[A-Za-z0-9._-]{1,60}$/.test(text(value, 60)) ? text(value, 60) : undefined);
  const known = new Set<string>(SECCIONES_BASE);
  const chosen = Array.isArray(source.secciones) ? [...new Set(source.secciones.filter((item): item is Seccion => typeof item === "string" && known.has(item)))] : null;
  const secciones = chosen ? (chosen.includes("catalogo") ? chosen : [...chosen, "catalogo" as Seccion]) : TEMA_BASE.secciones;
  const tipografia: "sans" | "serif" = source.tipografia === "serif" ? "serif" : "sans";
  const tema = {
    plantilla,
    color: typeof source.color === "string" && HEX.test(source.color) ? source.color.toUpperCase() : TEMA_BASE.color,
    tipografia,
    mostrar_opiniones: source.mostrar_opiniones !== false,
    secciones,
    banner_url: httpsUrl(source.banner_url) || undefined,
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
  const guardados = Array.isArray(source.bloques) ? source.bloques.slice(0, MAX_BLOQUES).map((item, index) => normalizeBloque(item, index)).filter((item): item is Bloque => item !== null) : null;
  // Sin bloques guardados (tiendas anteriores o recién creadas) la página se arma a partir de la plantilla y las secciones.
  const bloques = guardados && guardados.length ? guardados : bloquesDePlantilla(plantilla, tema).map((item, index) => normalizeBloque(item, index)!).filter(Boolean);
  const salida = { ...tema, diseno: normalizeDiseno(source.diseno, plantilla, tipografia), bloques };
  // Si hay bloques guardados, el catálogo sigue siendo obligatorio.
  if (!salida.bloques.some((item) => item.tipo === "catalogo")) salida.bloques = [...salida.bloques, normalizeBloque({ ...bloqueNuevo("catalogo", plantilla), id: "catalogo" }, salida.bloques.length)!];
  return salida;
}

/** Lo que se guarda en la base: el tema normalizado con bloques y diseño explícitos. */
export function temaParaGuardar(tema: TemaNormalizado): TiendaTema {
  return { ...tema, bloques: tema.bloques, diseno: tema.diseno };
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
