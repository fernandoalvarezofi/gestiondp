import type { Categoria } from "@/lib/delivery";
import {
  bloqueNuevo, type Bloque, type BloqueTipo, type MenuItem, type MenuTipo, type Plantilla, type TiendaTema,
} from "@/lib/storefront";

/*
 * Creador de sitios web. Un "sitio" es un comercio con `tipo_sitio = 'sitio'`: usa el mismo editor, temas, páginas,
 * versiones, publicación y CRM que una tienda, pero sin catálogo, carrito ni pedidos, y no aparece en el Market.
 * Acá viven las actividades y el punto de partida editable que se crea para cada una (secciones y páginas reales).
 */

export type TipoSitio = "tienda" | "sitio";
export const esSitio = (store?: { tipo_sitio?: string | null } | null) => store?.tipo_sitio === "sitio";

/** Lo que en un sitio no tiene sentido: bloques que muestran productos y destinos del catálogo. */
export const BLOQUES_SOLO_TIENDA: BloqueTipo[] = ["productos", "catalogo", "colecciones"];
export const MENU_SOLO_TIENDA: MenuTipo[] = ["catalogo", "ofertas", "categoria", "coleccion"];
export const bloquePermitido = (tipo: BloqueTipo, sitio: boolean) => !sitio || !BLOQUES_SOLO_TIENDA.includes(tipo);

export type Actividad = "profesional" | "consultora" | "salud" | "servicios" | "comercio" | "gastronomia" | "portfolio";

type Textos = {
  titulo: (nombre: string) => string; subtitulo: string; boton: string;
  presentacion: { antetitulo: string; titulo: string; texto: string };
  servicios: { titulo: string; items: { titulo: string; texto: string }[] };
  faq: { p: string; r: string }[];
  cierre: { titulo: string; texto: string };
};

export type ActividadInfo = { id: Actividad; nombre: string; detalle: string; plantilla: Plantilla; color: string; categoria: Categoria; rubro: string; textos: Textos };

export const ACTIVIDADES: ActividadInfo[] = [
  {
    id: "profesional", nombre: "Profesional independiente", detalle: "Abogacía, contabilidad, arquitectura, diseño, coaching", plantilla: "galeria", color: "#1F2A44", categoria: "tiendas", rubro: "Servicios profesionales",
    textos: {
      titulo: (n) => n, subtitulo: "Asesoramiento profesional, claro y cercano.", boton: "Hacé tu consulta",
      presentacion: { antetitulo: "Quién soy", titulo: "Experiencia al servicio de tu proyecto", texto: "Contá en pocas líneas tu formación, cómo trabajás y en qué podés ayudar. Un texto honesto genera más confianza que una lista larga." },
      servicios: { titulo: "Cómo puedo ayudarte", items: [{ titulo: "Primera consulta", texto: "Escuchamos tu caso y te explicamos las opciones." }, { titulo: "Acompañamiento", texto: "Seguimiento del proceso de principio a fin." }, { titulo: "A distancia o presencial", texto: "Elegí la modalidad que te quede cómoda." }] },
      faq: [{ p: "¿Cómo pido una primera consulta?", r: "Completá el formulario de contacto o escribí por WhatsApp y te respondemos para coordinar." }, { p: "¿Atendés a distancia?", r: "Contá acá si atendés por videollamada y en qué horarios." }],
      cierre: { titulo: "¿Hablamos de tu caso?", texto: "Escribinos y te respondemos a la brevedad." },
    },
  },
  {
    id: "consultora", nombre: "Estudio o consultora", detalle: "Estudios contables y jurídicos, agencias, consultoras", plantilla: "atelier", color: "#3B2F2F", categoria: "tiendas", rubro: "Consultoría",
    textos: {
      titulo: (n) => n, subtitulo: "Un equipo que conoce tu negocio y te acompaña.", boton: "Solicitá una reunión",
      presentacion: { antetitulo: "El estudio", titulo: "Soluciones a medida para empresas y personas", texto: "Presentá al estudio: cuándo nació, qué lo distingue y a quiénes asesora. Podés sumar fotos del equipo y de la oficina." },
      servicios: { titulo: "Áreas de trabajo", items: [{ titulo: "Asesoramiento", texto: "Describí la primera área de trabajo." }, { titulo: "Gestión", texto: "Describí la segunda área." }, { titulo: "Capacitación", texto: "Describí la tercera área." }] },
      faq: [{ p: "¿Trabajan con empresas de otras ciudades?", r: "Contá cómo trabajan a distancia y qué zonas cubren." }, { p: "¿Cómo es la primera reunión?", r: "Explicá qué pasa en la primera reunión y si tiene costo." }],
      cierre: { titulo: "Contanos qué necesitás", texto: "Te respondemos con una propuesta en pocos días." },
    },
  },
  {
    id: "salud", nombre: "Salud y bienestar", detalle: "Consultorios, kinesiología, nutrición, estética, terapias", plantilla: "estudio", color: "#0F766E", categoria: "farmacia", rubro: "Salud y bienestar",
    textos: {
      titulo: (n) => n, subtitulo: "Atención personalizada, con turnos y seguimiento.", boton: "Pedí tu turno",
      presentacion: { antetitulo: "Sobre nosotros", titulo: "Un espacio pensado para tu bienestar", texto: "Presentá a quienes atienden, su formación y el enfoque del consultorio. Si trabajás con obras sociales, contalo acá." },
      servicios: { titulo: "Especialidades", items: [{ titulo: "Consultas", texto: "Primera consulta y controles." }, { titulo: "Tratamientos", texto: "Describí los tratamientos que ofrecés." }, { titulo: "Seguimiento", texto: "Acompañamiento después de cada sesión." }] },
      faq: [{ p: "¿Cómo saco un turno?", r: "Desde el botón de turnos (si los cargaste en Agenda) o completando el formulario." }, { p: "¿Atienden obras sociales?", r: "Indicá con cuáles trabajás y qué cubre cada una." }],
      cierre: { titulo: "¿Querés un turno?", texto: "Escribinos y te ayudamos a encontrar el mejor horario." },
    },
  },
  {
    id: "servicios", nombre: "Empresa de servicios", detalle: "Mantenimiento, limpieza, instalaciones, mudanzas, eventos", plantilla: "boutique", color: "#2563EB", categoria: "tiendas", rubro: "Servicios",
    textos: {
      titulo: (n) => n, subtitulo: "Trabajos garantizados, presupuesto sin cargo.", boton: "Pedí un presupuesto",
      presentacion: { antetitulo: "Quiénes somos", titulo: "Hacemos el trabajo bien, a tiempo", texto: "Contá cuántos años llevan trabajando, qué zona cubren y qué los diferencia. Una foto del equipo trabajando suma mucha confianza." },
      servicios: { titulo: "Nuestros servicios", items: [{ titulo: "Servicio principal", texto: "Describí qué incluye y para quién es." }, { titulo: "Urgencias", texto: "Si atendés urgencias, contá en qué horarios." }, { titulo: "Mantenimiento", texto: "Planes periódicos para empresas y hogares." }] },
      faq: [{ p: "¿El presupuesto tiene costo?", r: "Contá si el presupuesto es sin cargo y cuánto tarda." }, { p: "¿Qué zonas cubren?", r: "Indicá las localidades o barrios donde trabajan." }],
      cierre: { titulo: "Pedí tu presupuesto", texto: "Contanos qué necesitás y te respondemos hoy mismo." },
    },
  },
  {
    id: "comercio", nombre: "Comercio local", detalle: "Tiendas, ferreterías, ópticas, viveros, librerías", plantilla: "taller", color: "#5C6B3B", categoria: "tiendas", rubro: "Comercio",
    textos: {
      titulo: (n) => n, subtitulo: "Tu comercio de confianza, cerca tuyo.", boton: "Escribinos",
      presentacion: { antetitulo: "Nuestra historia", titulo: "Atención de barrio, de toda la vida", texto: "Contá desde cuándo están, qué venden y por qué los eligen. Si después querés vender en línea, podés activar la tienda online sin perder nada." },
      servicios: { titulo: "Qué vas a encontrar", items: [{ titulo: "Primera línea", texto: "Describí lo principal de tu comercio." }, { titulo: "Encargos", texto: "Si tomás pedidos especiales, contalo acá." }, { titulo: "Atención personalizada", texto: "Te asesoramos para que elijas bien." }] },
      faq: [{ p: "¿Hacen envíos?", r: "Contá si hacés envíos y a qué zonas." }, { p: "¿Qué medios de pago aceptan?", r: "Indicá efectivo, transferencia, tarjetas." }],
      cierre: { titulo: "¿Buscás algo en particular?", texto: "Consultanos y te decimos si lo tenemos." },
    },
  },
  {
    id: "gastronomia", nombre: "Restaurante o gastronomía", detalle: "Restaurantes, cafés, bares, catering, pastelería", plantilla: "gourmet", color: "#7A2E2E", categoria: "comida", rubro: "Gastronomía",
    textos: {
      titulo: (n) => n, subtitulo: "Cocina casera, ingredientes frescos y buena atención.", boton: "Reservá tu mesa",
      presentacion: { antetitulo: "La casa", titulo: "Un lugar para disfrutar sin apuro", texto: "Contá la historia del lugar, el estilo de cocina y qué no se pueden perder. Subí fotos del salón y de los platos en la galería." },
      servicios: { titulo: "Lo que ofrecemos", items: [{ titulo: "Almuerzos y cenas", texto: "Contá tus días y horarios." }, { titulo: "Eventos", texto: "Cumpleaños, reuniones y empresas." }, { titulo: "Para llevar", texto: "Si preparás pedidos para retirar, contalo." }] },
      faq: [{ p: "¿Se puede reservar?", r: "Sí, escribinos por el formulario o por WhatsApp." }, { p: "¿Tienen opciones sin TACC o vegetarianas?", r: "Contá qué opciones tenés." }],
      cierre: { titulo: "¿Venís a comer?", texto: "Reservá tu mesa o consultanos por un evento." },
    },
  },
  {
    id: "portfolio", nombre: "Portfolio o marca personal", detalle: "Fotografía, arte, música, diseño, creadores", plantilla: "urbano", color: "#C8F031", categoria: "tiendas", rubro: "Portfolio",
    textos: {
      titulo: (n) => n, subtitulo: "Proyectos, colaboraciones y contacto.", boton: "Trabajemos juntos",
      presentacion: { antetitulo: "Sobre mí", titulo: "Lo que hago y cómo lo hago", texto: "Presentate en primera persona: tu recorrido, tu estilo y los proyectos de los que estás orgulloso. Subí tus mejores trabajos en la galería." },
      servicios: { titulo: "Servicios", items: [{ titulo: "Proyectos a medida", texto: "Contá qué tipo de proyectos tomás." }, { titulo: "Colaboraciones", texto: "Marcas, artistas o empresas." }, { titulo: "Talleres", texto: "Si das clases o talleres, contalo." }] },
      faq: [{ p: "¿Cómo es el proceso de trabajo?", r: "Explicá los pasos, desde la primera charla hasta la entrega." }, { p: "¿Trabajás a distancia?", r: "Contá si trabajás con clientes de otras ciudades." }],
      cierre: { titulo: "¿Tenés un proyecto en mente?", texto: "Escribime y lo charlamos." },
    },
  },
];

export const actividadInfo = (id: Actividad) => ACTIVIDADES.find((a) => a.id === id) ?? ACTIVIDADES[0];

export type DatosSitio = { nombre: string; descripcion?: string; telefono?: string; whatsapp?: string; direccion?: string };
export type PaginaInicial = { titulo: string; slug: string; clase: "nosotros" | "contacto" | "otra"; tipo: "landing"; bloques: Bloque[]; seo_descripcion?: string };

const b = <T extends Bloque>(tipo: T["tipo"], id: string, plantilla: Plantilla, cambios: Partial<T> = {}): T => ({ ...(bloqueNuevo(tipo, plantilla) as Bloque), id, ...cambios }) as T;

/**
 * Punto de partida de un sitio para una actividad: inicio con secciones reales del editor (presentación, servicios,
 * preguntas, formulario de consultas al CRM y contacto) y tres páginas (Servicios, Nosotros, Contacto) con menú.
 * Todo es editable: son las mismas secciones que se agregan a mano en el editor. No incluye opiniones ni testimonios
 * inventados ni fotos de stock: las fotos y textos propios los pone el negocio.
 */
export function sitioInicial(actividad: Actividad, datos: DatosSitio): { tema: TiendaTema; paginas: PaginaInicial[] } {
  const info = actividadInfo(actividad);
  const { plantilla, textos: t } = info;
  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion?.trim() || "";
  const subtitulo = (descripcion || t.subtitulo).slice(0, 160);

  const presentacion = b("contenido", "presentacion", plantilla, {
    antetitulo: t.presentacion.antetitulo, titulo: t.presentacion.titulo, nivel: "h2", texto: t.presentacion.texto, imagen_pos: "ninguna",
    botones: [{ texto: "Conocenos", destino: { tipo: "pagina", valor: "nosotros" }, estilo: "secundario" }],
  });
  const servicios = b("columnas", "servicios", plantilla, { titulo: t.servicios.titulo, items: t.servicios.items });
  const faq = b("faq", "faq", plantilla, { titulo: "Preguntas frecuentes", items: t.faq });
  const formulario = b("formulario", "consulta", plantilla, { titulo: "Escribinos", texto: "Dejanos tu consulta y te respondemos a la brevedad.", boton: "Enviar consulta", pedir_telefono: true });
  const contacto = b("contacto", "contacto", plantilla, { titulo: "Contacto" });
  const galeria = b("galeria", "galeria", plantilla, { titulo: actividad === "gastronomia" ? "El lugar y los platos" : "Trabajos", imagenes: [] });

  const inicio: Bloque[] = [
    b("portada", "portada", plantilla, { estilo: plantilla, titulo: t.titulo(nombre).slice(0, 80), subtitulo, boton: t.boton }),
    presentacion,
    servicios,
    ...(actividad === "portfolio" || actividad === "gastronomia" ? [galeria] : []),
    faq,
    formulario,
    contacto,
  ];

  const paginas: PaginaInicial[] = [
    {
      titulo: "Servicios", slug: "servicios", clase: "otra", tipo: "landing",
      bloques: [
        b("contenido", "intro", plantilla, { antetitulo: nombre.slice(0, 60), titulo: t.servicios.titulo, nivel: "h1", texto: "Detallá cada servicio: en qué consiste, para quién es y cómo se contrata.", imagen_pos: "ninguna", botones: [] }),
        b("columnas", "lista", plantilla, { titulo: "", items: t.servicios.items }),
        b("cta", "cierre", plantilla, { titulo: t.cierre.titulo, texto: t.cierre.texto, boton: "Consultar", enlace_tipo: datos.whatsapp ? "whatsapp" : "catalogo", fondo: "color" }),
      ],
      seo_descripcion: `${t.servicios.titulo} de ${nombre}.`.slice(0, 170),
    },
    {
      titulo: "Nosotros", slug: "nosotros", clase: "nosotros", tipo: "landing",
      bloques: [
        b("contenido", "historia", plantilla, { antetitulo: t.presentacion.antetitulo, titulo: nombre.slice(0, 120), nivel: "h1", texto: descripcion || t.presentacion.texto, imagen_pos: "derecha", imagen_forma: "horizontal", botones: [{ texto: "Escribinos", destino: { tipo: "pagina", valor: "contacto" }, estilo: "primario" }] }),
      ],
    },
    {
      titulo: "Contacto", slug: "contacto", clase: "contacto", tipo: "landing",
      bloques: [
        b("formulario", "formulario", plantilla, { titulo: t.cierre.titulo, texto: t.cierre.texto, boton: "Enviar consulta", pedir_telefono: true }),
        b("contacto", "datos", plantilla, { titulo: "Otras formas de contactarnos" }),
      ],
    },
  ];

  const menu: MenuItem[] = [
    { texto: "Inicio", tipo: "inicio" },
    { texto: "Servicios", tipo: "pagina", destino: "servicios" },
    { texto: "Nosotros", tipo: "pagina", destino: "nosotros" },
    { texto: "Contacto", tipo: "pagina", destino: "contacto" },
  ];

  const tema: TiendaTema = {
    plantilla, color: info.color, titulo: nombre.slice(0, 80), subtitulo, boton: t.boton, acerca: descripcion || undefined,
    whatsapp: datos.whatsapp && /^[0-9]{8,15}$/.test(datos.whatsapp) ? datos.whatsapp : undefined,
    bloques: inicio, menu, mostrar_busqueda: false, mostrar_opiniones: false, pie_auto: true,
    seo_titulo: nombre.slice(0, 70), seo_descripcion: (descripcion || `${info.rubro} · ${nombre}`).slice(0, 170),
  };
  return { tema, paginas };
}

