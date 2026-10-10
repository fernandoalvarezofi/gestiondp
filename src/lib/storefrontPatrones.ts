/**
 * Patrones: secciones ya compuestas (bloque + estilo de sección) para insertar con un clic. No son plantillas de página:
 * cada patrón es UNA sección normal, editable como cualquier otra, con textos de ejemplo que el editor marca para revisar.
 */
import { Bloque, bloqueNuevo, BloqueTipo, nuevoId, Plantilla } from "./storefront";

export type Patron = { id: string; nombre: string; detalle: string; crear: (plantilla: Plantilla) => Bloque };

const con = <T extends Bloque>(tipo: BloqueTipo, plantilla: Plantilla, cambios: Partial<T>): Bloque => ({ ...(bloqueNuevo(tipo, plantilla) as Bloque), ...cambios, id: nuevoId() } as Bloque);

export const PATRONES: Patron[] = [
  {
    id: "portada-dividida", nombre: "Portada dividida", detalle: "Título grande, texto y dos botones a la izquierda; foto a la derecha.",
    crear: (p) => con("contenido", p, { antetitulo: "Nuevo", titulo: "El título que define tu negocio", nivel: "h1", tamano: "grande", texto: "Una frase que explique qué hacés y por qué elegirte.", imagen_pos: "derecha", imagen_forma: "vertical",
      botones: [{ texto: "Ver productos", destino: { tipo: "catalogo" }, estilo: "primario" }, { texto: "Escribinos", destino: { tipo: "whatsapp" }, estilo: "secundario" }], est: { arriba: 5, abajo: 5 } }),
  },
  {
    id: "banda-marca", nombre: "Banda con el color de la marca", detalle: "Mensaje centrado con botón sobre el color principal.",
    crear: (p) => con("contenido", p, { antetitulo: undefined, titulo: "Envío gratis en compras grandes", texto: "Aprovechá esta semana.", nivel: "h2", imagen_pos: "ninguna", botones: [{ texto: "Comprar ahora", destino: { tipo: "catalogo" }, estilo: "secundario" }], est: { fondo: "acento", alinear: "centro", arriba: 4, abajo: 4 } }),
  },
  {
    id: "historia", nombre: "Historia con foto", detalle: "Foto a la izquierda y el relato a la derecha.",
    crear: (p) => con("contenido", p, { antetitulo: "Quiénes somos", titulo: "Una historia que vale contar", texto: "Contá cómo empezó todo, quién está detrás y qué te hace distinto.", imagen_pos: "izquierda", imagen_forma: "cuadrada",
      botones: [{ texto: "Conocé más", destino: { tipo: "catalogo" }, estilo: "enlace" }] }),
  },
  {
    id: "mensaje-oscuro", nombre: "Mensaje sobre fondo oscuro", detalle: "Una frase fuerte, centrada, sobre negro.",
    crear: (p) => con("contenido", p, { antetitulo: undefined, titulo: "Hecho para durar", texto: "Una idea, dos líneas como máximo.", nivel: "h2", tamano: "grande", imagen_pos: "ninguna", botones: [], est: { fondo: "oscuro", alinear: "centro", arriba: 6, abajo: 6, ancho: "estrecho" } }),
  },
  {
    id: "beneficios-suave", nombre: "Beneficios sobre fondo suave", detalle: "Tres o cuatro ventajas en una franja de color suave.",
    crear: (p) => con("confianza", p, { est: { fondo: "suave", arriba: 3, abajo: 3 } }),
  },
  {
    id: "destacados-carrusel", nombre: "Destacados en carrusel", detalle: "Tus productos destacados deslizándose de costado.",
    crear: (p) => con("productos", p, { titulo: "Lo más elegido", fuente: "destacados", cantidad: 8, columnas: 4, estilo: "carrusel" }),
  },
  {
    id: "novedades-amplio", nombre: "Novedades a todo el ancho", detalle: "Los últimos productos en una grilla amplia.",
    crear: (p) => con("productos", p, { titulo: "Recién llegados", fuente: "nuevos", cantidad: 10, columnas: 5, est: { ancho: "amplio" } }),
  },
  {
    id: "testimonios-oscuro", nombre: "Testimonios destacados", detalle: "Una cita grande sobre fondo oscuro.",
    crear: (p) => con("testimonios", p, { estilo: "destacado", est: { fondo: "oscuro", arriba: 5, abajo: 5 } }),
  },
  {
    id: "preguntas-estrecho", nombre: "Preguntas en columna", detalle: "Preguntas frecuentes en una columna cómoda de leer.",
    crear: (p) => con("faq", p, { est: { ancho: "estrecho" } }),
  },
  {
    id: "suscripcion-superficie", nombre: "Suscripción en caja", detalle: "Formulario de suscripción sobre la superficie del tema.",
    crear: (p) => con("newsletter", p, { est: { fondo: "superficie", arriba: 4, abajo: 4 } }),
  },
  {
    id: "llamado-final", nombre: "Llamado final", detalle: "Cierre de página con un mensaje y un botón.",
    crear: (p) => con("cta", p, { fondo: "oscuro" }),
  },
  {
    id: "visitanos", nombre: "Visitanos", detalle: "Horarios, dirección y mapa con formulario de consulta debajo.",
    crear: (p) => con("ubicacion", p, { est: { ancla: "visitanos" } }),
  },
];
