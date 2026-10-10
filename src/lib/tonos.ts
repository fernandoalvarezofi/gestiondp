/** Paleta de íconos por sección (clases `.tono-*` en index.css). Verde y amarillo de marca + tonos de apoyo armónicos. */
export const TONOS = ["verde", "coral", "violeta", "azul", "amarillo", "rosa", "celeste", "naranja", "tinta", "menta"] as const;
export type Tono = (typeof TONOS)[number];

/** Clases del cuadro de ícono para un tono. */
export const tono = (t: Tono) => `tono tono-${t}`;
/** Cuadro claro teñido (ícono del color sobre fondo suave). */
export const tonoSuave = (t: Tono) => `tono-suave tono-${t}`;

/** Tono estable para un texto (categorías, rubros): el mismo nombre siempre da el mismo color. */
export function tonoDe(texto: string | null | undefined): Tono {
  let h = 0;
  for (const ch of (texto ?? "").toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

/** Tonos fijos de las categorías y secciones principales (lo que el usuario más ve, siempre del mismo color). */
export const TONO_CATEGORIA: Record<string, Tono> = {
  restaurantes: "coral", comida: "coral", supermercado: "verde", super: "verde", farmacia: "celeste", tiendas: "violeta",
  cafe: "naranja", heladeria: "rosa", helados: "rosa", pizza: "naranja", sushi: "rosa", hamburguesas: "coral", parrilla: "tinta",
  pollo: "amarillo", sandwiches: "menta", saludable: "menta", pastas: "amarillo", envios: "amarillo", remis: "tinta", productos: "azul",
};
export const tonoCategoria = (clave: string | null | undefined): Tono => {
  const k = (clave ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return TONO_CATEGORIA[k] ?? tonoDe(k);
};

/** Tono de cada sección de los paneles, por palabra clave de la ruta (lo no listado toma un tono estable por nombre). */
const TONO_SECCION: [RegExp, Tono][] = [
  [/pedidos|viajes|trabajos/, "naranja"], [/turnos|agenda|incentivos/, "rosa"], [/mensajes|soporte/, "azul"],
  [/envios|enviar|logistica|mensajeria|paquetes/, "amarillo"], [/clientes|crm|personas|identidades/, "violeta"], [/productos|menu|categorias/, "coral"],
  [/inventario|zonas|demanda/, "celeste"], [/colecciones|directorio/, "menta"], [/tienda|comercios|red/, "verde"], [/preguntas|opiniones|arrepentimientos/, "amarillo"],
  [/promociones|cupones|anuncios|campanas/, "naranja"], [/estadisticas|analytics|operaciones/, "azul"], [/finanzas|pagos|liquidaciones|contabilidad|ganancias/, "tinta"],
  [/devoluciones/, "coral"], [/equipo|repartidores|conductores/, "violeta"], [/sucursales/, "celeste"], [/configuracion|seguridad|auditoria|errores|perfil/, "tinta"],
  [/remis|conductor/, "tinta"], [/mapa/, "menta"], [/historial/, "celeste"], [/club/, "amarillo"], [/favoritos/, "rosa"], [/notificaciones/, "azul"], [/privacidad/, "tinta"], [/ayuda/, "celeste"],
];
export function tonoSeccion(ruta: string): Tono {
  const partes = ruta.split("?")[0].split("/").filter(Boolean).slice(1);
  if (partes.length === 1 && partes[0] === "perfil") return "violeta";
  if (partes[0] === "explorar") return "celeste";
  if (["comercio", "repartidor", "conductor", "admin", "perfil"].includes(partes[0])) partes.shift();
  const ultima = partes.join("/");
  if (!ultima) return "verde";
  return TONO_SECCION.find(([re]) => re.test(ultima))?.[1] ?? tonoDe(ultima);
}

/** Perfiles de trabajo (selector de contexto). */
export const TONO_CONTEXTO: Record<string, Tono> = { cliente: "verde", comercio: "violeta", repartidor: "naranja", conductor: "tinta", admin: "azul" };
/** Tipos de notificación. */
export const TONO_NOTIFICACION: Record<string, Tono> = { pedidos: "naranja", pagos: "tinta", turnos: "rosa", devoluciones: "coral", opiniones: "amarillo", mensajes: "azul", sistema: "verde" };
