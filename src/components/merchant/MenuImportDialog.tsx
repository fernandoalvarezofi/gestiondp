import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { db, DeliveryProduct, errorMessage, EstadoProducto, TipoProducto } from "@/lib/delivery";

type Row = {
  seccion: string; nombre: string; descripcion: string | null; precio: number; stock: number | null; variante: string | null; sku: string | null;
  costo: number | null; barras: string | null; minimo: number | null; estado: EstadoProducto | null; tipo: TipoProducto | null; marca: string | null; anterior: number | null;
};
type Parsed = { rows: Row[]; errors: string[] };

const MAX_ROWS = 1000;
const productKey = (row: Pick<Row, "seccion" | "nombre">) => `${normalize(row.seccion)}|${normalize(row.nombre)}`;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const aliases: Record<keyof Row, string[]> = {
  seccion: ["seccion", "categoria", "rubro"], nombre: ["nombre", "producto", "articulo"], descripcion: ["descripcion", "detalle"], precio: ["precio", "precio venta", "importe"], stock: ["stock", "cantidad"],
  variante: ["variante", "talle", "opcion"], sku: ["sku", "codigo"], costo: ["costo", "costo unitario"], barras: ["codigo de barras", "ean", "barras", "gtin"], minimo: ["stock minimo", "minimo"],
  estado: ["estado"], tipo: ["tipo"], marca: ["marca"], anterior: ["precio anterior", "precio de comparacion", "precio tachado"],
};
const ESTADOS: Record<string, EstadoProducto> = { publicado: "publicado", borrador: "borrador", archivado: "archivado", programado: "borrador" };
const TIPOS: Record<string, TipoProducto> = { fisico: "fisico", digital: "digital", servicio: "servicio" };
const toNumber = (text: string) => {
  const clean = text.replace(/[$\s]/g, "");
  // 1.234,56 -> 1234.56 ; 1.100 -> 1100 (punto de miles) ; 1234.56 queda igual
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  return Number(/^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "") : clean);
};

function parse(text: string): Parsed {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["El archivo está vacío o no tiene filas de productos"] };
  const header = table[0].map(normalize);
  const col = (key: keyof Row) => header.findIndex((cell) => aliases[key].includes(cell));
  const index = {
    seccion: col("seccion"), nombre: col("nombre"), descripcion: col("descripcion"), precio: col("precio"), stock: col("stock"), variante: col("variante"), sku: col("sku"),
    costo: col("costo"), barras: col("barras"), minimo: col("minimo"), estado: col("estado"), tipo: col("tipo"), marca: col("marca"), anterior: col("anterior"),
  };
  const celda = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  if (index.nombre < 0 || index.precio < 0) return { rows: [], errors: ["Faltan las columnas “Nombre” y “Precio” en la primera fila"] };
  if (table.length - 1 > MAX_ROWS) return { rows: [], errors: [`El archivo tiene más de ${MAX_ROWS} productos: dividilo en partes`] };
  const rows: Row[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, position) => {
    const line = position + 2;
    const nombre = (cells[index.nombre] ?? "").trim().slice(0, 80);
    const precio = toNumber(cells[index.precio] ?? "");
    const seccion = (index.seccion >= 0 ? (cells[index.seccion] ?? "").trim() : "").slice(0, 40) || "Destacados";
    if (!nombre) { errors.push(`Fila ${line}: falta el nombre`); return; }
    if (!Number.isFinite(precio) || precio <= 0 || precio > 10_000_000) { errors.push(`Fila ${line} (${nombre}): precio inválido`); return; }
    const rawStock = index.stock >= 0 ? (cells[index.stock] ?? "").trim() : "";
    const stock = rawStock === "" ? null : Math.floor(Number(rawStock));
    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) { errors.push(`Fila ${line} (${nombre}): stock inválido`); return; }
    const variante = index.variante >= 0 ? (cells[index.variante] ?? "").trim().slice(0, 80) || null : null;
    const sku = index.sku >= 0 ? (cells[index.sku] ?? "").trim().slice(0, 40) || null : null;
    const key = `${normalize(seccion)}|${normalize(nombre)}|${normalize(variante ?? "")}`;
    if (seen.has(key)) { errors.push(`Fila ${line} (${nombre}): repetido en el archivo`); return; }
    seen.add(key);
    const descripcion = index.descripcion >= 0 ? (cells[index.descripcion] ?? "").trim().slice(0, 300) || null : null;
    const rawCosto = celda(cells, index.costo);
    const costo = rawCosto === "" ? null : toNumber(rawCosto);
    if (costo !== null && (!Number.isFinite(costo) || costo < 0)) { errors.push(`Fila ${line} (${nombre}): costo inválido`); return; }
    const barras = celda(cells, index.barras) || null;
    if (barras && !/^[0-9A-Za-z-]{4,32}$/.test(barras)) { errors.push(`Fila ${line} (${nombre}): código de barras inválido`); return; }
    const rawMin = celda(cells, index.minimo);
    const minimo = rawMin === "" ? null : Math.floor(Number(rawMin));
    if (minimo !== null && (!Number.isFinite(minimo) || minimo < 0)) { errors.push(`Fila ${line} (${nombre}): stock mínimo inválido`); return; }
    const rawEstado = normalize(celda(cells, index.estado));
    if (rawEstado && !ESTADOS[rawEstado]) { errors.push(`Fila ${line} (${nombre}): estado “${rawEstado}” inválido (publicado, borrador o archivado)`); return; }
    const rawTipo = normalize(celda(cells, index.tipo));
    if (rawTipo && !TIPOS[rawTipo]) { errors.push(`Fila ${line} (${nombre}): tipo “${rawTipo}” inválido (físico, digital o servicio)`); return; }
    const rawAnt = celda(cells, index.anterior);
    const anterior = rawAnt === "" ? null : toNumber(rawAnt);
    if (anterior !== null && (!Number.isFinite(anterior) || anterior <= precio)) { errors.push(`Fila ${line} (${nombre}): el precio anterior tiene que ser mayor al precio`); return; }
    if (sku && rows.some((r) => r.sku && r.sku.toLowerCase() === sku.toLowerCase())) { errors.push(`Fila ${line} (${nombre}): SKU ${sku} repetido en el archivo`); return; }
    rows.push({ seccion, nombre, descripcion, precio: Math.round(precio), stock, variante, sku, costo, barras, minimo, estado: rawEstado ? ESTADOS[rawEstado] : null, tipo: rawTipo ? TIPOS[rawTipo] : null, marca: celda(cells, index.marca).slice(0, 60) || null, anterior: anterior === null ? null : Math.round(anterior) });
  });
  return { rows, errors };
}

/** Importa productos desde una planilla CSV: los que ya existen (misma sección y nombre) se actualizan, el resto se crea. */
export function MenuImportDialog({ open, onOpenChange, storeId, products, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; storeId: string; products: DeliveryProduct[]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [saving, setSaving] = useState(false);

  // Filas del mismo producto (sección + nombre) = un producto; con columna Variante son sus variantes.
  const groups = parsed ? [...parsed.rows.reduce((map, row) => { const k = productKey(row); map.set(k, [...(map.get(k) || []), row]); return map; }, new Map<string, Row[]>()).values()] : [];
  const existing = new Map(products.map((product) => [`${normalize(product.categoria)}|${normalize(product.nombre)}`, product]));
  const toUpdate = groups.filter((rows) => existing.has(productKey(rows[0])));
  const toCreate = groups.length - toUpdate.length;

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("El archivo es muy pesado (máximo 2 MB)");
    setParsed(parse(await file.text()));
  };

  const confirm = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setSaving(true);
    const nextOrder = new Map<string, number>();
    products.forEach((product) => nextOrder.set(product.categoria, Math.max(nextOrder.get(product.categoria) ?? 0, product.orden ?? 0)));
    const conVariantes = (rows: Row[]) => rows.some((row) => row.variante);
    const precioProducto = (rows: Row[]) => (conVariantes(rows) ? Math.min(...rows.map((row) => row.precio)) : rows[0].precio);
    const variantesDe = (rows: Row[], productoId: string) => rows.filter((row) => row.variante).map((row, i) => ({ producto_id: productoId, nombre: row.variante!, sku: row.sku, precio: row.precio, stock: row.stock, orden: i, codigo_barras: row.barras, costo: row.costo, stock_minimo: row.minimo }));
    // Datos del producto que vienen en la planilla (solo se pisan los que trae).
    const extras = (rows: Row[]) => {
      const row = rows[0]; const simple = !conVariantes(rows);
      return {
        ...(row.estado ? { estado: row.estado } : {}), ...(row.tipo ? { tipo: row.tipo } : {}), ...(row.marca ? { marca: row.marca } : {}),
        ...(simple && row.sku ? { sku: row.sku } : {}), ...(simple && row.barras ? { codigo_barras: row.barras } : {}), ...(simple && row.costo != null ? { costo: row.costo } : {}),
        ...(row.minimo != null ? { stock_minimo: row.minimo } : {}), ...(row.anterior != null ? { precio_anterior: row.anterior } : {}),
      };
    };
    const nuevos = groups.filter((rows) => !existing.has(productKey(rows[0])));
    const inserts = nuevos.map((rows) => {
      const row = rows[0];
      const orden = (nextOrder.get(row.seccion) ?? 0) + 1;
      nextOrder.set(row.seccion, orden);
      return { comercio_id: storeId, nombre: row.nombre, descripcion: row.descripcion, categoria: row.seccion, precio: precioProducto(rows), stock: conVariantes(rows) ? null : row.stock, orden, disponible: true, ...extras(rows) };
    });
    let failure: unknown = null;
    const creados: { id: string; categoria: string; nombre: string }[] = [];
    for (let start = 0; start < inserts.length && !failure; start += 100) {
      const { data, error } = await db.from("delivery_productos").insert(inserts.slice(start, start + 100)).select("id, categoria, nombre");
      failure = error;
      creados.push(...((data || []) as typeof creados));
    }
    const variantes: ReturnType<typeof variantesDe> = [];
    const conVariantesIds: string[] = [];
    for (const rows of nuevos) {
      const hecho = creados.find((c) => productKey({ seccion: c.categoria, nombre: c.nombre }) === productKey(rows[0]));
      if (hecho && conVariantes(rows)) { variantes.push(...variantesDe(rows, hecho.id)); conVariantesIds.push(hecho.id); }
    }
    for (const rows of toUpdate) {
      if (failure) break;
      const product = existing.get(productKey(rows[0]))!;
      const row = rows[0];
      if (conVariantes(rows)) {
        variantes.push(...variantesDe(rows, product.id)); conVariantesIds.push(product.id);
        const { error } = await db.from("delivery_productos").update({ precio: precioProducto(rows), ...(row.descripcion ? { descripcion: row.descripcion } : {}), ...extras(rows) }).eq("id", product.id);
        failure = error;
      } else {
        const { error } = await db.from("delivery_productos").update({ precio: row.precio, stock: row.stock, ...(row.descripcion ? { descripcion: row.descripcion } : {}), ...extras(rows) }).eq("id", product.id);
        failure = error;
      }
    }
    for (let start = 0; start < variantes.length && !failure; start += 100) {
      const { error } = await db.from("delivery_producto_variantes").upsert(variantes.slice(start, start + 100), { onConflict: "producto_id,nombre" });
      failure = error;
    }
    if (!failure && conVariantesIds.length) {
      const { error } = await db.from("delivery_productos").update({ usa_variantes: true }).in("id", conVariantesIds);
      failure = error;
    }
    setSaving(false);
    onDone();
    if (failure) return toast.error(`${errorMessage(failure)}. Lo que se alcanzó a cargar quedó guardado: revisá tu menú.`);
    toast.success(`Listo: ${inserts.length} productos nuevos y ${toUpdate.length} actualizados${variantes.length ? ` (${variantes.length} variantes)` : ""}`);
    setParsed(null);
    onOpenChange(false);
  };

  const template = () => downloadCsv("plantilla-catalogo-woref.csv", toCsv(["Sección", "Nombre", "Descripción", "Precio", "Stock", "Variante", "SKU", "Costo", "Código de barras", "Stock mínimo", "Estado", "Tipo", "Marca", "Precio anterior"], [
    ["Pizzas", "Muzzarella", "Salsa de tomate y muzzarella", 9500, "", "", "", 3500, "", "", "publicado", "fisico", "", ""],
    ["Bebidas", "Coca-Cola 1,5 L", "", 3200, 24, "", "COCA-15", 2100, "7790895000997", 6, "publicado", "fisico", "Coca-Cola", 3600],
    ["Ropa", "Remera básica", "Algodón peinado", 12000, 10, "M / Negro", "REM-M-N", 5000, "", 3, "borrador", "fisico", "Woref", ""],
    ["Ropa", "Remera básica", "", 12000, 4, "L / Negro", "REM-L-N", 5000, "", 3, "borrador", "fisico", "Woref", ""],
  ]));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setParsed(null); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-black"><FileSpreadsheet className="h-5 w-5 text-primary" />Importar productos</DialogTitle>
        <DialogDescription>Subí una planilla CSV (podés exportarla desde Excel o Google Sheets) con las columnas Sección, Nombre y Precio (y, si querés, Descripción, Stock, Variante, SKU, Costo, Código de barras, Stock mínimo, Estado, Tipo, Marca y Precio anterior; para variantes repetí el producto una fila por variante). Los productos que ya existen se actualizan. Antes de importar te mostramos qué se crea, qué se actualiza y qué filas tienen errores.</DialogDescription>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Elegir archivo</Button>
          <Button type="button" variant="ghost" className="rounded-full" onClick={template}>Descargar plantilla</Button>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(event) => pick(event.target.files?.[0])} />
        {parsed && (
          <div className="space-y-3">
            {parsed.rows.length > 0 && <p className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">{toCreate} productos nuevos · {toUpdate.length} para actualizar{parsed.rows.length > groups.length ? ` · ${parsed.rows.length - groups.length} variantes extra` : ""}</p>}
            {parsed.errors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-bold">{parsed.errors.length} {parsed.errors.length === 1 ? "fila con problemas (se omite)" : "filas con problemas (se omiten)"}</p>
                <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5">{parsed.errors.slice(0, 30).map((message) => <li key={message}>{message}</li>)}</ul>
              </div>
            )}
            <Button className="w-full rounded-full" disabled={saving || parsed.rows.length === 0} onClick={confirm}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Importar {groups.length} productos</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
