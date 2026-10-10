import { AtributoFila, atributosAFilas, filasAAtributos } from "@/services/categories";
import { isoADateTimeLocal, localDateTimeAIso, slugValido } from "@/services/catalogPro";
import { DeliveryProduct, EstadoProducto, precioRegular, TipoProducto } from "@/lib/delivery";

/** Formulario de un producto (todo como texto, tal como se escribe) y su conversión a la fila de la base. */
export type Borrador = {
  id?: string; nombre: string; descripcion: string; descripcion_larga: string; categoria: string; tipo: TipoProducto; estado: EstadoProducto; publicar_desde: string;
  disponible: boolean; destacado: boolean; precio: string; precio_anterior: string; costo: string; promo_precio: string; promo_desde: string; promo_hasta: string; promo_activa: boolean;
  controla_stock: boolean; stock: string; stock_minimo: string; sku: string; codigo_barras: string; imagen_url: string; imagenes: string[];
  etiquetas: string[]; colecciones: string[]; relacionados: string[]; categoria_id: string; marca: string; atributos: AtributoFila[]; en_market: boolean; en_tienda: boolean;
  slug: string; seo_titulo: string; seo_descripcion: string;
};

export const BORRADOR_VACIO: Borrador = {
  nombre: "", descripcion: "", descripcion_larga: "", categoria: "", tipo: "fisico", estado: "publicado", publicar_desde: "", disponible: true, destacado: false,
  precio: "", precio_anterior: "", costo: "", promo_precio: "", promo_desde: "", promo_hasta: "", promo_activa: false,
  controla_stock: false, stock: "", stock_minimo: "", sku: "", codigo_barras: "", imagen_url: "", imagenes: [],
  etiquetas: [], colecciones: [], relacionados: [], categoria_id: "", marca: "", atributos: [], en_market: true, en_tienda: true, slug: "", seo_titulo: "", seo_descripcion: "",
};

export function borradorDe(p: DeliveryProduct, colecciones: string[] = []): Borrador {
  return {
    ...BORRADOR_VACIO, id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? "", descripcion_larga: p.descripcion_larga ?? "", categoria: p.categoria,
    tipo: p.tipo ?? "fisico", estado: p.estado ?? "publicado", publicar_desde: isoADateTimeLocal(p.publicar_desde), disponible: p.disponible, destacado: Boolean(p.destacado),
    // Con una oferta corriendo se edita el precio regular (la oferta se maneja aparte).
    precio: String(precioRegular(p)), precio_anterior: !p.promo_activa && p.precio_anterior ? String(p.precio_anterior) : "", costo: p.costo == null ? "" : String(p.costo),
    promo_precio: p.precio_promo == null ? "" : String(p.precio_promo), promo_desde: isoADateTimeLocal(p.promo_desde), promo_hasta: isoADateTimeLocal(p.promo_hasta), promo_activa: Boolean(p.promo_activa),
    controla_stock: p.stock != null, stock: p.stock == null ? "" : String(p.stock), stock_minimo: p.stock_minimo == null ? "" : String(p.stock_minimo), sku: p.sku ?? "", codigo_barras: p.codigo_barras ?? "",
    imagen_url: p.imagen_url ?? "", imagenes: p.imagenes ?? [], etiquetas: p.etiquetas ?? [], colecciones, relacionados: p.relacionados ?? [],
    categoria_id: p.categoria_id ?? "", marca: p.marca ?? "", atributos: atributosAFilas(p.atributos), en_market: p.en_market !== false, en_tienda: p.en_tienda !== false,
    slug: p.slug ?? "", seo_titulo: p.seo_titulo ?? "", seo_descripcion: p.seo_descripcion ?? "",
  };
}

const n = (s: string) => Number(s.trim().replace(",", "."));

/** Errores por campo (vacío = se puede guardar). Son las mismas reglas que exige la base. */
export function erroresDe(b: Borrador): Partial<Record<keyof Borrador, string>> {
  const e: Partial<Record<keyof Borrador, string>> = {};
  if (b.nombre.trim().length < 2) e.nombre = "Escribí el nombre del producto";
  const precio = n(b.precio);
  if (b.precio.trim() === "" || !Number.isFinite(precio) || precio <= 0) e.precio = "Poné un precio mayor a 0";
  if (b.precio_anterior.trim() !== "") { const a = n(b.precio_anterior); if (!Number.isFinite(a) || a <= precio) e.precio_anterior = "Tiene que ser mayor que el precio (si no, no hay rebaja)"; }
  if (b.costo.trim() !== "" && !(n(b.costo) >= 0)) e.costo = "Costo inválido";
  if (b.promo_precio.trim() !== "") { const o = n(b.promo_precio); if (!(o > 0 && o < precio)) e.promo_precio = "Tiene que ser menor que el precio regular"; }
  if (b.promo_desde && b.promo_hasta && b.promo_hasta <= b.promo_desde) e.promo_hasta = "Tiene que ser después del inicio";
  if (b.controla_stock && b.stock.trim() !== "" && !(Number.isInteger(n(b.stock)) && n(b.stock) >= 0)) e.stock = "Un número entero desde 0";
  if (b.stock_minimo.trim() !== "" && !(Number.isInteger(n(b.stock_minimo)) && n(b.stock_minimo) >= 0)) e.stock_minimo = "Un número entero desde 0";
  if (b.codigo_barras && !/^[0-9A-Za-z-]{4,32}$/.test(b.codigo_barras.trim())) e.codigo_barras = "Letras, números y guiones (4 a 32)";
  if (b.slug && !slugValido(b.slug)) e.slug = "Solo minúsculas, números y guiones";
  if (b.estado === "programado" && !b.publicar_desde) e.publicar_desde = "Elegí cuándo se publica";
  if (!b.en_market && !b.en_tienda) e.en_tienda = "Tiene que estar al menos en un canal";
  return e;
}

/** Fila para insertar/actualizar en delivery_productos. */
export function filaDe(b: Borrador, comercio: string) {
  const precio = n(b.precio);
  return {
    comercio_id: comercio, nombre: b.nombre.trim(), descripcion: b.descripcion.trim() || null, descripcion_larga: b.descripcion_larga.trim() || null,
    categoria: b.categoria.trim() || "General", tipo: b.tipo, estado: b.estado, publicar_desde: b.estado === "programado" ? localDateTimeAIso(b.publicar_desde) : null,
    disponible: b.disponible, destacado: b.destacado, precio, precio_anterior: b.promo_activa ? undefined : b.precio_anterior.trim() ? n(b.precio_anterior) : null,
    costo: b.costo.trim() ? n(b.costo) : null, stock: b.controla_stock ? (b.stock.trim() === "" ? 0 : Math.max(0, Math.floor(n(b.stock)))) : null,
    stock_minimo: b.stock_minimo.trim() ? Math.max(0, Math.floor(n(b.stock_minimo))) : null, sku: b.sku.trim() || null, codigo_barras: b.codigo_barras.trim() || null,
    imagen_url: b.imagen_url.trim() || null, imagenes: b.imagenes.slice(0, 5), etiquetas: b.etiquetas, relacionados: b.relacionados,
    categoria_id: b.categoria_id || null, marca: b.marca.trim() || null, atributos: filasAAtributos(b.atributos), en_market: b.en_market, en_tienda: b.en_tienda,
    slug: b.slug.trim() || null, seo_titulo: b.seo_titulo.trim() || null, seo_descripcion: b.seo_descripcion.trim() || null,
  };
}
export const promoNumero = (b: Borrador) => (b.promo_precio.trim() === "" ? null : n(b.promo_precio));
