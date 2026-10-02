import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { db, DeliveryProduct, errorMessage } from "@/lib/delivery";

type Row = { seccion: string; nombre: string; descripcion: string | null; precio: number; stock: number | null };
type Parsed = { rows: Row[]; errors: string[] };

const MAX_ROWS = 500;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const aliases: Record<keyof Row, string[]> = {
  seccion: ["seccion", "categoria", "rubro"], nombre: ["nombre", "producto", "articulo"], descripcion: ["descripcion", "detalle"], precio: ["precio", "precio venta", "importe"], stock: ["stock", "cantidad"],
};
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
  const index = { seccion: col("seccion"), nombre: col("nombre"), descripcion: col("descripcion"), precio: col("precio"), stock: col("stock") };
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
    const key = `${normalize(seccion)}|${normalize(nombre)}`;
    if (seen.has(key)) { errors.push(`Fila ${line} (${nombre}): repetido en el archivo`); return; }
    seen.add(key);
    const descripcion = index.descripcion >= 0 ? (cells[index.descripcion] ?? "").trim().slice(0, 300) || null : null;
    rows.push({ seccion, nombre, descripcion, precio: Math.round(precio), stock });
  });
  return { rows, errors };
}

/** Importa productos desde una planilla CSV: los que ya existen (misma sección y nombre) se actualizan, el resto se crea. */
export function MenuImportDialog({ open, onOpenChange, storeId, products, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; storeId: string; products: DeliveryProduct[]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = new Map(products.map((product) => [`${normalize(product.categoria)}|${normalize(product.nombre)}`, product]));
  const toUpdate = parsed ? parsed.rows.filter((row) => existing.has(`${normalize(row.seccion)}|${normalize(row.nombre)}`)) : [];
  const toCreate = parsed ? parsed.rows.length - toUpdate.length : 0;

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
    const inserts = parsed.rows.filter((row) => !existing.has(`${normalize(row.seccion)}|${normalize(row.nombre)}`)).map((row) => {
      const orden = (nextOrder.get(row.seccion) ?? 0) + 1;
      nextOrder.set(row.seccion, orden);
      return { comercio_id: storeId, nombre: row.nombre, descripcion: row.descripcion, categoria: row.seccion, precio: row.precio, stock: row.stock, orden, disponible: true };
    });
    let failure: unknown = null;
    for (let start = 0; start < inserts.length && !failure; start += 100) {
      const { error } = await db.from("delivery_productos").insert(inserts.slice(start, start + 100));
      failure = error;
    }
    for (const row of toUpdate) {
      if (failure) break;
      const product = existing.get(`${normalize(row.seccion)}|${normalize(row.nombre)}`)!;
      const { error } = await db.from("delivery_productos").update({ precio: row.precio, stock: row.stock, ...(row.descripcion ? { descripcion: row.descripcion } : {}) }).eq("id", product.id);
      failure = error;
    }
    setSaving(false);
    onDone();
    if (failure) return toast.error(`${errorMessage(failure)}. Lo que se alcanzó a cargar quedó guardado: revisá tu menú.`);
    toast.success(`Listo: ${inserts.length} productos nuevos y ${toUpdate.length} actualizados`);
    setParsed(null);
    onOpenChange(false);
  };

  const template = () => downloadCsv("plantilla-menu-woref.csv", toCsv(["Sección", "Nombre", "Descripción", "Precio", "Stock"], [["Pizzas", "Muzzarella", "Salsa de tomate y muzzarella", 9500, ""], ["Bebidas", "Coca-Cola 1,5 L", "", 3200, 24]]));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setParsed(null); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-black"><FileSpreadsheet className="h-5 w-5 text-primary" />Importar productos</DialogTitle>
        <DialogDescription>Subí una planilla CSV (podés exportarla desde Excel o Google Sheets) con las columnas Sección, Nombre, Descripción, Precio y Stock. Los productos que ya existen se actualizan.</DialogDescription>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Elegir archivo</Button>
          <Button type="button" variant="ghost" className="rounded-full" onClick={template}>Descargar plantilla</Button>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(event) => pick(event.target.files?.[0])} />
        {parsed && (
          <div className="space-y-3">
            {parsed.rows.length > 0 && <p className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">{toCreate} productos nuevos · {toUpdate.length} para actualizar</p>}
            {parsed.errors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-bold">{parsed.errors.length} {parsed.errors.length === 1 ? "fila con problemas (se omite)" : "filas con problemas (se omiten)"}</p>
                <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5">{parsed.errors.slice(0, 30).map((message) => <li key={message}>{message}</li>)}</ul>
              </div>
            )}
            <Button className="w-full rounded-full" disabled={saving || parsed.rows.length === 0} onClick={confirm}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Importar {parsed.rows.length} productos</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
