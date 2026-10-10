import { downloadCsv, toCsv } from "@/lib/csv";
import { DeliveryProduct, ESTADO_PRODUCTO, precioRegular, TIPO_PRODUCTO } from "@/lib/delivery";

/** Exporta el catálogo con la misma estructura que acepta la importación (se edita en una planilla y se vuelve a importar). */
export function exportarCatalogo(products: DeliveryProduct[], nombre = "catalogo-woref.csv") {
  const base = (p: DeliveryProduct) => [p.categoria, p.nombre, p.descripcion ?? ""];
  const extra = (p: DeliveryProduct, costo: number | null | undefined, barras: string | null | undefined, minimo: number | null | undefined) =>
    [costo ?? "", barras ?? "", minimo ?? "", ESTADO_PRODUCTO[p.estado ?? "publicado"].texto, TIPO_PRODUCTO[p.tipo ?? "fisico"], p.marca ?? "", precioRegular(p) !== Number(p.precio) ? "" : p.precio_anterior ?? ""];
  const csv = toCsv(["Sección", "Nombre", "Descripción", "Precio", "Stock", "Disponible", "Variante", "SKU", "Costo", "Código de barras", "Stock mínimo", "Estado", "Tipo", "Marca", "Precio anterior"], products.flatMap((product) => (product.usa_variantes && product.variantes?.length
    ? [...product.variantes].sort((x, y) => x.orden - y.orden).map((v) => [...base(product), v.precio ?? precioRegular(product), v.stock ?? "", product.disponible && v.disponible ? "si" : "no", v.nombre, v.sku ?? "", ...extra(product, v.costo ?? product.costo, v.codigo_barras, v.stock_minimo ?? product.stock_minimo)])
    : [[...base(product), precioRegular(product), product.stock ?? "", product.disponible ? "si" : "no", "", product.sku ?? "", ...extra(product, product.costo, product.codigo_barras, product.stock_minimo)]])));
  downloadCsv(nombre, csv);
}
