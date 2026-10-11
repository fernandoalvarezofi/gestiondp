import type { Categoria } from "@/lib/delivery";
import { type Actividad, actividadInfo, sitioInicial } from "@/lib/sitioWeb";
import {
  bloqueNuevo, paginaDePlantilla, type Bloque, type ConfianzaItem, type MenuItem, type Plantilla, type TiendaTema,
} from "@/lib/storefront";

/*
 * Creador de Woref: un solo alta para cuatro tipos de negocio, todos sobre "Mi tienda" (mismo editor, temas, páginas,
 * panel y CRM). Cada tipo arma un punto de partida real y editable; el servidor lo crea en una transacción (`negocio_crear`).
 */

export type TipoNegocio = "tienda" | "carta" | "servicios" | "sitio";

export const TIPOS_NEGOCIO: { id: TipoNegocio; nombre: string; bajada: string; incluye: string[] }[] = [
  { id: "tienda", nombre: "Tienda online", bajada: "Vendé productos con tu propia web, carrito y pedidos.", incluye: ["Catálogo con variantes y stock", "Carrito, pagos y pedidos", "Envío propio o retiro", "Cupones, clientes y estadísticas"] },
  { id: "carta", nombre: "Carta digital con QR", bajada: "Tu menú con fotos para restaurantes, bares y cafés, con QR para las mesas.", incluye: ["Platos con foto, descripción y precio", "QR imprimible para las mesas", "Pedidos para retirar (opcional)", "Horarios, ubicación y reservas"] },
  { id: "servicios", nombre: "Servicios con turnos", bajada: "Mostrá tus servicios y recibí reservas en línea las 24 horas.", incluye: ["Servicios con duración y precio", "Agenda y reservas en línea", "Recordatorios y lista de espera", "Fichas de clientes (CRM)"] },
  { id: "sitio", nombre: "Página web", bajada: "Presentá tu negocio, tus servicios y recibí consultas.", incluye: ["Inicio y páginas propias", "Formulario de consultas al CRM", "SEO y dominio propio", "Podés sumar tienda después"] },
];
export const tipoInfo = (id: TipoNegocio) => TIPOS_NEGOCIO.find((t) => t.id === id) ?? TIPOS_NEGOCIO[0];

export type Rubro = { id: string; nombre: string; plantilla: Plantilla; color: string; categoria: Categoria; actividad?: Actividad };
export const RUBROS: Record<TipoNegocio, Rubro[]> = {
  tienda: [
    { id: "moda", nombre: "Ropa y accesorios", plantilla: "boutique", color: "#1F2A44", categoria: "tiendas" },
    { id: "autor", nombre: "Diseño de autor y deco", plantilla: "atelier", color: "#3B2F2F", categoria: "tiendas" },
    { id: "artesanias", nombre: "Artesanías y regalos", plantilla: "taller", color: "#5C6B3B", categoria: "tiendas" },
    { id: "belleza", nombre: "Cosmética y cuidado personal", plantilla: "galeria", color: "#27272A", categoria: "farmacia" },
    { id: "tecno", nombre: "Tecnología, deportes y bebidas", plantilla: "urbano", color: "#C8F031", categoria: "tiendas" },
    { id: "almacen", nombre: "Almacén, dietética y súper", plantilla: "mercado", color: "#2563EB", categoria: "supermercado" },
    { id: "ofertas", nombre: "Ofertas y productos varios", plantilla: "impacto", color: "#E2552C", categoria: "tiendas" },
  ],
  carta: [
    { id: "restaurante", nombre: "Restaurante o parrilla", plantilla: "gourmet", color: "#7A2E2E", categoria: "comida" },
    { id: "cafe", nombre: "Café o panadería", plantilla: "gourmet", color: "#6B4F3A", categoria: "comida" },
    { id: "bar", nombre: "Bar o cervecería", plantilla: "urbano", color: "#F0B900", categoria: "comida" },
    { id: "rapida", nombre: "Pizzería, hamburguesería o rotisería", plantilla: "impacto", color: "#E2552C", categoria: "comida" },
    { id: "heladeria", nombre: "Heladería o pastelería", plantilla: "estudio", color: "#BE185D", categoria: "comida" },
  ],
  servicios: [
    { id: "belleza", nombre: "Peluquería, barbería y estética", plantilla: "estudio", color: "#9D6B53", categoria: "farmacia", actividad: "salud" },
    { id: "salud", nombre: "Salud, kinesiología y nutrición", plantilla: "estudio", color: "#0F766E", categoria: "farmacia", actividad: "salud" },
    { id: "bienestar", nombre: "Yoga, gimnasio y clases", plantilla: "estudio", color: "#7C3AED", categoria: "tiendas", actividad: "salud" },
    { id: "profesional", nombre: "Consultas profesionales", plantilla: "galeria", color: "#1F2A44", categoria: "tiendas", actividad: "profesional" },
    { id: "oficios", nombre: "Oficios y servicios técnicos", plantilla: "boutique", color: "#2563EB", categoria: "tiendas", actividad: "servicios" },
  ],
  sitio: [
    { id: "profesional", nombre: "Profesional independiente", plantilla: "galeria", color: "#1F2A44", categoria: "tiendas", actividad: "profesional" },
    { id: "consultora", nombre: "Estudio o consultora", plantilla: "atelier", color: "#3B2F2F", categoria: "tiendas", actividad: "consultora" },
    { id: "salud", nombre: "Salud y bienestar", plantilla: "estudio", color: "#0F766E", categoria: "farmacia", actividad: "salud" },
    { id: "servicios", nombre: "Empresa de servicios", plantilla: "boutique", color: "#2563EB", categoria: "tiendas", actividad: "servicios" },
    { id: "comercio", nombre: "Comercio local", plantilla: "taller", color: "#5C6B3B", categoria: "tiendas", actividad: "comercio" },
    { id: "gastronomia", nombre: "Gastronomía", plantilla: "gourmet", color: "#7A2E2E", categoria: "comida", actividad: "gastronomia" },
    { id: "portfolio", nombre: "Portfolio o marca personal", plantilla: "urbano", color: "#C8F031", categoria: "tiendas", actividad: "portfolio" },
  ],
};
export const rubroDe = (tipo: TipoNegocio, id: string | null | undefined) => RUBROS[tipo].find((r) => r.id === id) ?? RUBROS[tipo][0];

export type DatosNegocio = { nombre: string; descripcion?: string; telefono?: string; whatsapp?: string; direccion?: string };
export type Entrega = { envioPropio: boolean; retiro: boolean; envioDetalle?: string; pedidos: boolean };
export type ProductoInicial = { nombre: string; precio: number; categoria: string; descripcion?: string; imagen_url?: string };
export type ServicioInicial = { nombre: string; duracion_min: number; precio: number };
export type AgendaInicial = { profesional: string; dias: number[]; desde: string; hasta: string };
export type PaginaNegocio = { titulo: string; slug: string; clase: "nosotros" | "contacto" | "envios" | "cambios" | "otra"; tipo: "landing"; bloques: Bloque[]; seo_descripcion?: string };

const b = <T extends Bloque>(tipo: T["tipo"], id: string, plantilla: Plantilla, cambios: Partial<T> = {}): T => ({ ...(bloqueNuevo(tipo, plantilla) as Bloque), id, ...cambios }) as T;
const waOk = (wa?: string) => (wa && /^[0-9]{8,15}$/.test(wa) ? wa : undefined);

/** Ventajas que el negocio de verdad ofrece (las plantillas traen ejemplos genéricos: acá se reemplazan por lo configurado). */
function ventajas(entrega: Entrega): ConfianzaItem[] {
  const out: ConfianzaItem[] = [];
  if (entrega.envioPropio) out.push({ icono: "envio", titulo: "Envíos a domicilio", texto: (entrega.envioDetalle || "Te lo mandamos a tu casa").slice(0, 120) });
  if (entrega.retiro) out.push({ icono: "local", titulo: "Retiro en el local", texto: "Sin costo de envío" });
  out.push({ icono: "pago", titulo: "Pagá como quieras", texto: "Efectivo o transferencia" });
  out.push({ icono: "soporte", titulo: "Atención personalizada", texto: "Escribinos y te ayudamos" });
  return out.slice(0, 4);
}

const paginaContacto = (plantilla: Plantilla, titulo: string, texto: string): PaginaNegocio => ({
  titulo: "Contacto", slug: "contacto", clase: "contacto", tipo: "landing",
  bloques: [
    b("formulario", "formulario", plantilla, { titulo, texto, boton: "Enviar consulta", pedir_telefono: true }),
    b("contacto", "datos", plantilla, { titulo: "Otras formas de contactarnos" }),
  ],
});

/**
 * Punto de partida de cada tipo: inicio y páginas reales del editor, menú armado y textos editables.
 * No inventa opiniones, testimonios ni fotos.
 */
export function inicioNegocio(tipo: TipoNegocio, rubroId: string, datos: DatosNegocio, entrega: Entrega, plantillaElegida?: Plantilla): { tema: TiendaTema; paginas: PaginaNegocio[] } {
  const rubro = rubroDe(tipo, rubroId);
  const plantilla = plantillaElegida ?? rubro.plantilla;
  const nombre = datos.nombre.trim() || "Tu negocio";
  const descripcion = datos.descripcion?.trim() || "";
  const base: TiendaTema = {
    plantilla, color: rubro.color, titulo: nombre.slice(0, 80), acerca: descripcion || undefined, whatsapp: waOk(datos.whatsapp),
    seo_titulo: nombre.slice(0, 70), seo_descripcion: (descripcion || `${rubro.nombre} · ${nombre}`).slice(0, 170), pie_auto: true,
  };

  if (tipo === "sitio") {
    const s = sitioInicial(rubro.actividad ?? "profesional", datos);
    if (!plantillaElegida) return s;
    return { ...s, tema: { ...s.tema, plantilla, bloques: (s.tema.bloques ?? []).map((x) => (x.tipo === "portada" ? { ...x, estilo: plantilla } : x)) } };
  }

  if (tipo === "tienda") {
    const subtitulo = (descripcion || "Comprá en línea, fácil y seguro.").slice(0, 160);
    const bloques = paginaDePlantilla(plantilla, { titulo: nombre, subtitulo, boton: "Ver productos", acerca: descripcion || undefined })
      .filter((x) => x.tipo !== "newsletter")
      .map((x) => (x.tipo === "confianza" ? { ...x, items: ventajas(entrega) } : x));
    const paginas: PaginaNegocio[] = [
      ...(entrega.envioPropio || entrega.retiro ? [{
        titulo: "Envíos y entregas", slug: "envios", clase: "envios" as const, tipo: "landing" as const,
        bloques: [b("contenido", "envios", plantilla, { titulo: "Envíos y entregas", nivel: "h1", imagen_pos: "ninguna", botones: [],
          texto: [entrega.envioPropio ? `**Envío a domicilio:** ${entrega.envioDetalle || "despachamos tu pedido y te avisamos con el seguimiento."}` : "", entrega.retiro ? "**Retiro en el local:** sin costo, cuando te avisemos que está listo." : "", "Completá esta página con plazos, zonas y costos."].filter(Boolean).join("\n\n") })],
      }] : []),
      { titulo: "Cambios y devoluciones", slug: "cambios", clase: "cambios", tipo: "landing",
        bloques: [b("contenido", "cambios", plantilla, { titulo: "Cambios y devoluciones", nivel: "h1", imagen_pos: "ninguna", botones: [], texto: "Explicá en cuántos días se puede cambiar o devolver un producto, en qué estado tiene que estar y cómo se hace. Tus clientes tienen derecho a arrepentirse de una compra en línea dentro de los 10 días." })] },
      paginaContacto(plantilla, "¿Tenés una consulta?", "Escribinos y te respondemos a la brevedad."),
    ];
    const menu: MenuItem[] = [{ texto: "Inicio", tipo: "inicio" }, { texto: "Productos", tipo: "catalogo" }, ...paginas.filter((p) => p.slug !== "cambios").map((p) => ({ texto: p.titulo === "Envíos y entregas" ? "Envíos" : p.titulo, tipo: "pagina" as const, destino: p.slug }))];
    return { tema: { ...base, subtitulo, boton: "Ver productos", bloques, menu, mostrar_busqueda: true }, paginas };
  }

  if (tipo === "carta") {
    const subtitulo = (descripcion || "Mirá nuestra carta y vení a disfrutar.").slice(0, 160);
    const bloques: Bloque[] = [
      b("portada", "portada", plantilla, { estilo: plantilla, titulo: nombre.slice(0, 80), subtitulo, boton: "Ver la carta" }),
      b("colecciones", "colecciones", plantilla, { titulo: "La carta", estilo: "circulos" }),
      b("catalogo", "catalogo", plantilla, { titulo: "Nuestra carta", columnas: 3, filtros: false }),
      b("contenido", "casa", plantilla, { antetitulo: "La casa", titulo: "Un lugar para disfrutar sin apuro", nivel: "h2", imagen_pos: "derecha", imagen_forma: "horizontal", botones: [], texto: descripcion || "Contá la historia del lugar, el estilo de cocina y qué no se pueden perder. Subí una foto del salón." }),
      b("ubicacion", "ubicacion", plantilla, { titulo: "Dónde estamos y horarios", mapa: true }),
      b("formulario", "consulta", plantilla, { titulo: "Reservas y consultas", texto: "Escribinos para reservar una mesa o consultar por eventos.", boton: "Enviar", pedir_telefono: true }),
      b("contacto", "contacto", plantilla, { titulo: "Contacto" }),
    ];
    const paginas: PaginaNegocio[] = [paginaContacto(plantilla, "Reservas y consultas", "Escribinos para reservar o consultar por eventos.")];
    const menu: MenuItem[] = [{ texto: "Inicio", tipo: "inicio" }, { texto: "La carta", tipo: "catalogo" }, { texto: "Reservas", tipo: "pagina", destino: "contacto" }];
    return { tema: { ...base, subtitulo, boton: "Ver la carta", bloques, menu, mostrar_busqueda: false, catalogo_orden: "relevancia" }, paginas };
  }

  // Servicios con turnos
  const act = actividadInfo(rubro.actividad ?? "salud");
  const subtitulo = (descripcion || "Reservá tu turno en línea, las 24 horas.").slice(0, 160);
  const bloques: Bloque[] = [
    b("portada", "portada", plantilla, { estilo: plantilla, titulo: nombre.slice(0, 80), subtitulo, boton: "Reservar turno" }),
    b("servicios", "servicios", plantilla, { titulo: "Servicios", texto: "Elegí el servicio, el día y la hora. Te confirmamos al instante.", estilo: "tarjetas", cantidad: 9 }),
    b("contenido", "presentacion", plantilla, { antetitulo: act.textos.presentacion.antetitulo, titulo: act.textos.presentacion.titulo, nivel: "h2", texto: descripcion || act.textos.presentacion.texto, imagen_pos: "derecha", imagen_forma: "vertical", botones: [{ texto: "Reservar turno", destino: { tipo: "reservar" }, estilo: "primario" }] }),
    b("faq", "faq", plantilla, { titulo: "Antes de tu turno", items: [{ p: "¿Puedo cambiar el horario?", r: "Sí, desde Mis turnos, con la anticipación que indica cada servicio." }, { p: "¿Cómo pago?", r: "Contá acá los medios de pago que aceptás." }] }),
    b("cta", "reservar", plantilla, { titulo: "¿Te reservamos un lugar?", texto: "Elegí día y horario en un minuto.", boton: "Reservar turno", enlace_tipo: "reservar", fondo: "color" }),
    b("formulario", "consulta", plantilla, { titulo: "¿Tenés una consulta?", texto: "Escribinos y te respondemos a la brevedad.", boton: "Enviar consulta", pedir_telefono: true }),
    b("contacto", "contacto", plantilla, { titulo: "Contacto y horarios" }),
  ];
  const paginas: PaginaNegocio[] = [
    { titulo: "Nosotros", slug: "nosotros", clase: "nosotros", tipo: "landing", bloques: [b("contenido", "historia", plantilla, { antetitulo: act.textos.presentacion.antetitulo, titulo: nombre.slice(0, 120), nivel: "h1", texto: descripcion || act.textos.presentacion.texto, imagen_pos: "derecha", imagen_forma: "horizontal", botones: [{ texto: "Reservar turno", destino: { tipo: "reservar" }, estilo: "primario" }] })] },
    paginaContacto(plantilla, "¿Tenés una consulta?", "Escribinos y te respondemos a la brevedad."),
  ];
  const menu: MenuItem[] = [{ texto: "Inicio", tipo: "inicio" }, { texto: "Reservar", tipo: "reservar" }, { texto: "Nosotros", tipo: "pagina", destino: "nosotros" }, { texto: "Contacto", tipo: "pagina", destino: "contacto" }];
  return { tema: { ...base, subtitulo, boton: "Reservar turno", bloques, menu, mostrar_busqueda: false, mostrar_opiniones: false }, paginas };
}

/** Datos de alta para `negocio_crear` (mismo contrato que valida el servidor). */
export function datosAlta(tipo: TipoNegocio, rubroId: string, datos: DatosNegocio & { slug: string }, entrega: Entrega, costoEnvio: number) {
  const rubro = rubroDe(tipo, rubroId);
  const vende = tipo === "tienda" || tipo === "carta";
  return {
    nombre: datos.nombre.trim(), slug: datos.slug, categoria: rubro.categoria, rubro: rubro.nombre.slice(0, 40),
    descripcion: datos.descripcion?.trim().slice(0, 300) || null, telefono: datos.telefono?.trim().slice(0, 40) || null, direccion: datos.direccion?.trim().slice(0, 200) || "",
    ...(vende ? {
      pedidos_online: tipo === "tienda" ? true : entrega.pedidos,
      envio_propio: entrega.pedidos && entrega.envioPropio, acepta_retiro: entrega.pedidos && entrega.retiro,
      costo_envio: entrega.envioPropio ? Math.max(0, Math.round(costoEnvio)) : 0, envio_detalle: entrega.envioPropio ? entrega.envioDetalle?.trim().slice(0, 140) || null : null,
    } : {}),
  };
}

/** Productos/platos válidos para el alta (nombre y precio cargados). */
export const productosValidos = (lista: { nombre: string; precio: string; categoria: string; descripcion?: string; imagen_url?: string }[]): ProductoInicial[] =>
  lista.filter((p) => p.nombre.trim().length >= 2 && Number(p.precio) > 0).map((p) => ({
    nombre: p.nombre.trim().slice(0, 120), precio: Number(p.precio), categoria: p.categoria.trim().slice(0, 60) || "Destacados",
    descripcion: p.descripcion?.trim().slice(0, 300) || undefined, imagen_url: p.imagen_url || undefined,
  }));

/** Color de cada tipo en íconos y tarjetas (clases .tono-* de index.css). */
export const TONO_TIPO: Record<TipoNegocio, string> = { tienda: "tono-verde", carta: "tono-coral", servicios: "tono-violeta", sitio: "tono-azul" };
