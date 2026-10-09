import { db } from "@/lib/delivery";

/** Acciones masivas que valida el servidor (solo sobre productos del propio local). */
export type AccionCatalogo = "publicar" | "borrador" | "archivar" | "disponible" | "destacar" | "seccion" | "tipo" | "canales" | "coleccion" | "stock_minimo";
export type ResumenCatalogo = { total: number; publicados: number; borradores: number; programados: number; archivados: number; sin_foto: number; agotados: number; stock_bajo: number; en_oferta: number; valor_inventario: number };
export type CambioProducto = { id: number; producto_id: string | null; variante_id: string | null; producto_nombre: string; campo: string; antes: string | null; despues: string | null; usuario_id: string | null; fecha: string };
export type Coleccion = { id: string; comercio_id: string; nombre: string; slug: string; descripcion: string | null; imagen_url: string | null; orden: number; activa: boolean };

export const CAMPO_CAMBIO: Record<string, string> = {
  nombre: "Nombre", precio: "Precio", precio_anterior: "Precio anterior", costo: "Costo", estado: "Estado", disponible: "Disponible", sku: "SKU", categoria: "Sección",
  tipo: "Tipo", precio_promo: "Precio de oferta", promo_desde: "Oferta desde", promo_hasta: "Oferta hasta",
};

/** Slug a partir de un texto: minúsculas, sin acentos, solo letras, números y guiones. */
export function slugify(texto: string, max = 70): string {
  const s = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
  return s || "item";
}
export const slugValido = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 90;

export async function catalogoMasivo(comercio: string, ids: string[], accion: AccionCatalogo, valor: Record<string, unknown> = {}): Promise<number> {
  const { data, error } = await db.rpc("catalogo_masivo", { p_comercio: comercio, p_ids: ids, p_accion: accion, p_valor: valor });
  if (error) throw error;
  return Number(data ?? 0);
}
export async function duplicarProducto(id: string): Promise<string> {
  const { data, error } = await db.rpc("producto_duplicar", { p_producto: id });
  if (error) throw error;
  return data as string;
}
/** Programa (o quita, con precio null) una oferta con vigencia. Si ya empezó, se aplica al instante. */
export async function programarOferta(id: string, precio: number | null, desde?: string | null, hasta?: string | null) {
  const { error } = await db.rpc("catalogo_oferta", { p_producto: id, p_precio: precio, p_desde: desde || null, p_hasta: hasta || null });
  if (error) throw error;
}
export async function fetchResumenCatalogo(comercio: string): Promise<ResumenCatalogo | null> {
  const { data } = await db.rpc("catalogo_resumen", { p_comercio: comercio });
  return (data as ResumenCatalogo) ?? null;
}
export async function fetchCambios(comercio: string, producto?: string | null, limite = 100): Promise<CambioProducto[]> {
  let q = db.from("delivery_producto_cambios").select("*").eq("comercio_id", comercio).order("fecha", { ascending: false }).limit(limite);
  if (producto) q = q.eq("producto_id", producto);
  const { data } = await q;
  return (data ?? []) as CambioProducto[];
}
export async function fetchColecciones(comercio: string): Promise<(Coleccion & { productos: string[] })[]> {
  const [{ data: cols }, { data: rel }] = await Promise.all([
    db.from("delivery_colecciones").select("*").eq("comercio_id", comercio).order("orden").order("nombre"),
    db.from("delivery_coleccion_productos").select("coleccion_id, producto_id, orden, delivery_colecciones!inner(comercio_id)").eq("delivery_colecciones.comercio_id", comercio).order("orden"),
  ]);
  const r = (rel ?? []) as { coleccion_id: string; producto_id: string }[];
  return ((cols ?? []) as Coleccion[]).map((c) => ({ ...c, productos: r.filter((x) => x.coleccion_id === c.id).map((x) => x.producto_id) }));
}
/** Reemplaza los productos de una colección por la lista dada (en ese orden). */
export async function guardarProductosColeccion(coleccion: string, productos: string[]) {
  const { error: e1 } = await db.from("delivery_coleccion_productos").delete().eq("coleccion_id", coleccion);
  if (e1) throw e1;
  if (productos.length) {
    const { error } = await db.from("delivery_coleccion_productos").insert(productos.map((producto_id, orden) => ({ coleccion_id: coleccion, producto_id, orden })));
    if (error) throw error;
  }
}
/** Colecciones públicas de una tienda, con sus productos (para la tienda online). */
export async function fetchColeccionesPublicas(comercio: string) {
  return fetchColecciones(comercio).then((cs) => cs.filter((c) => c.activa));
}

export type MotivoAjuste = "recepcion" | "merma" | "devolucion" | "inventario" | "ajuste";
export const MOTIVOS_AJUSTE: Record<MotivoAjuste, string> = { recepcion: "Ingreso de mercadería", merma: "Merma o rotura", devolucion: "Devolución de un cliente", inventario: "Conteo de inventario", ajuste: "Otro ajuste" };
/** Ajuste manual de stock con motivo: "sumar" (cantidad positiva o negativa) o "fijar" (lo que se contó). Devuelve el stock nuevo. */
export async function ajustarStock(producto: string, variante: string | null, modo: "sumar" | "fijar", cantidad: number, motivo: MotivoAjuste, nota?: string): Promise<number> {
  const { data, error } = await db.rpc("inventario_ajustar", { p_producto: producto, p_variante: variante, p_modo: modo, p_cantidad: cantidad, p_motivo: motivo, p_nota: nota?.trim() || null });
  if (error) throw error;
  return Number(data);
}
export type Movimiento = { id: number; fecha: string; producto_id: string; producto: string; variante_id: string | null; variante: string | null; delta: number | null; stock_antes: number | null; stock_despues: number | null; motivo: string; nota: string | null };
export async function fetchMovimientos(comercio: string, limite = 100): Promise<Movimiento[]> {
  const { data, error } = await db.rpc("delivery_inventario_movimientos", { p_comercio: comercio, p_producto: null, p_limite: limite });
  if (error) throw error;
  return (data ?? []) as Movimiento[];
}

/** "2026-10-06T10:30" (datetime-local, hora de Argentina) -> ISO; vacío -> null. */
export const localDateTimeAIso = (v: string) => (v ? `${v}:00-03:00` : null);
export function isoADateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return p.replace(" ", "T");
}
