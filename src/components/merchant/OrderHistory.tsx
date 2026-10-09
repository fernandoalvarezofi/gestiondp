import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Metric, MetricStrip } from "@/components/panel/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { db, DeliveryOrder, DeliveryStore, errorMessage, formatDateTime, merchantOrderSelect, metodoPagoLabel, money, optionsLabel, shortId } from "@/lib/delivery";
import { printOrderTicket, readPrintSettings } from "@/lib/print";
import { cn } from "@/lib/utils";

const PAGINA = 50;
type Estado = "todos" | "entregado" | "cancelado";
type Resumen = { total: number; entregados: number; cancelados: number; ventas: number; ids: string[] };

/** Fecha local (la del comercio) como AAAA-MM-DD. */
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const haceDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dia(d); };
const inicioDeMes = () => { const d = new Date(); return dia(new Date(d.getFullYear(), d.getMonth(), 1)); };

const PERIODOS = [
  { id: "hoy", label: "Hoy", desde: () => dia(new Date()) },
  { id: "7", label: "7 días", desde: () => haceDias(6) },
  { id: "30", label: "30 días", desde: () => haceDias(29) },
  { id: "mes", label: "Este mes", desde: inicioDeMes },
  { id: "90", label: "90 días", desde: () => haceDias(89) },
] as const;

async function buscar(storeId: string, desde: string, hasta: string, estado: Estado, q: string, offset: number, limite = PAGINA): Promise<Resumen> {
  const { data, error } = await db.rpc("delivery_comercio_pedidos_buscar", {
    p_comercio: storeId, p_desde: desde, p_hasta: hasta, p_estado: estado === "todos" ? null : estado, p_q: q.trim() || null, p_limite: limite, p_offset: offset,
  });
  if (error) throw new Error(errorMessage(error));
  return data as Resumen;
}

/** Trae los pedidos de esos ids con el formato del panel (bajo RLS) y los deja en el mismo orden. */
async function traerPedidos(ids: string[]): Promise<DeliveryOrder[]> {
  if (!ids.length) return [];
  const { data, error } = await db.from("delivery_pedidos").select(merchantOrderSelect).in("id", ids);
  if (error) throw new Error(errorMessage(error));
  const porId = new Map((data as DeliveryOrder[]).map((o) => [o.id, o]));
  return ids.map((id) => porId.get(id)).filter(Boolean) as DeliveryOrder[];
}

/** Historial de pedidos del local, buscado en el servidor: cualquier período (hasta 400 días), estado, texto y exportación. */
export function OrderHistory({ store }: { store: DeliveryStore }) {
  const [periodo, setPeriodo] = useState<string>("30");
  const [desde, setDesde] = useState(haceDias(29));
  const [hasta, setHasta] = useState(dia(new Date()));
  const [estado, setEstado] = useState<Estado>("todos");
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [pedidos, setPedidos] = useState<DeliveryOrder[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [exportando, setExportando] = useState(false);
  const [abierto, setAbierto] = useState<DeliveryOrder | null>(null);
  const pedido = useRef(0);

  // El texto se busca cuando la persona deja de escribir, no con cada tecla.
  useEffect(() => { const t = window.setTimeout(() => { setQ(texto); setOffset(0); }, 350); return () => window.clearTimeout(t); }, [texto]);

  const cargar = useCallback(async () => {
    const actual = ++pedido.current;
    setCargando(true); setError(null);
    try {
      const r = await buscar(store.id, desde, hasta, estado, q, offset);
      const lista = await traerPedidos(r.ids);
      if (actual !== pedido.current) return; // llegó tarde: ya hay otra búsqueda en curso
      setResumen(r); setPedidos(lista);
    } catch (e) {
      if (actual === pedido.current) setError(e);
    } finally {
      if (actual === pedido.current) setCargando(false);
    }
  }, [store.id, desde, hasta, estado, q, offset]);

  useEffect(() => { cargar(); }, [cargar]);

  const elegirPeriodo = (id: string) => {
    const p = PERIODOS.find((x) => x.id === id);
    if (!p) return;
    setPeriodo(id); setDesde(p.desde()); setHasta(dia(new Date())); setOffset(0);
  };
  const cambiarFecha = (cual: "desde" | "hasta", valor: string) => {
    if (!valor) return;
    setPeriodo("personalizado"); setOffset(0);
    if (cual === "desde") { setDesde(valor); if (valor > hasta) setHasta(valor); }
    else { setHasta(valor); if (valor < desde) setDesde(valor); }
  };

  const exportar = async () => {
    if (!resumen?.total) return;
    setExportando(true);
    try {
      const ids: string[] = [];
      const tope = 2000;
      for (let off = 0; off < Math.min(resumen.total, tope); off += 200) {
        const r = await buscar(store.id, desde, hasta, estado, q, off, 200);
        ids.push(...r.ids);
        if (r.ids.length < 200) break;
      }
      const filas: DeliveryOrder[] = [];
      for (let i = 0; i < ids.length; i += 150) filas.push(...(await traerPedidos(ids.slice(i, i + 150))));
      const csv = toCsv(
        ["Pedido", "Fecha", "Cliente", "Estado", "Entrega", "Pago", "Productos", "Subtotal", "Descuento", "Envío", "Total", "Motivo de cancelación"],
        filas.map((o) => [shortId(o.id), formatDateTime(o.created_at), o.cliente?.nombre ?? "", o.estado, o.tipo_entrega === "retiro" ? "Retiro" : "Envío", metodoPagoLabel[o.metodo_pago] ?? o.metodo_pago,
          (o.items || []).map((i) => `${i.cantidad}x ${i.nombre}`).join(" | "), Number(o.subtotal), Number(o.descuento || 0), Number(o.costo_envio || 0), Number(o.total), o.motivo_cancelacion ?? ""]),
      );
      downloadCsv(`pedidos-${store.slug || "local"}-${desde}_a_${hasta}.csv`, csv);
      toast.success(resumen.total > tope ? `Exportamos los ${tope} pedidos más recientes del período` : `Exportamos ${filas.length} pedidos`);
    } catch (e) {
      toast.error(errorMessage(e, "No pudimos exportar los pedidos"));
    } finally {
      setExportando(false);
    }
  };

  const total = resumen?.total ?? 0;
  const hastaFila = Math.min(offset + PAGINA, total);

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-3 rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => elegirPeriodo(p.id)} className={cn("h-8 rounded-full border px-3 text-[13px] font-bold transition-colors", periodo === p.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>{p.label}</button>
          ))}
          <div className="flex items-center gap-1.5 text-[13px]">
            <label className="sr-only" htmlFor="historial-desde">Desde</label>
            <input id="historial-desde" type="date" value={desde} max={dia(new Date())} onChange={(e) => cambiarFecha("desde", e.target.value)} className="h-8 rounded-full border bg-background px-3 font-semibold" />
            <span aria-hidden className="text-muted-foreground">a</span>
            <label className="sr-only" htmlFor="historial-hasta">Hasta</label>
            <input id="historial-hasta" type="date" value={hasta} max={dia(new Date())} onChange={(e) => cambiarFecha("hasta", e.target.value)} className="h-8 rounded-full border bg-background px-3 font-semibold" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border bg-background px-4">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Número, cliente o teléfono" aria-label="Buscar pedido" maxLength={60} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="inline-flex rounded-full border p-0.5" role="group" aria-label="Estado">
            {(["todos", "entregado", "cancelado"] as const).map((item) => (
              <button key={item} type="button" aria-pressed={estado === item} onClick={() => { setEstado(item); setOffset(0); }} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-bold", estado === item ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{item === "todos" ? "Todos" : item === "entregado" ? "Entregados" : "Cancelados"}</button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" onClick={exportar} disabled={exportando || !total}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exportar
          </Button>
        </div>
      </div>

      {resumen && !error && (
        <MetricStrip cols={4}>
          <Metric label="Pedidos" value={resumen.total} />
          <Metric label="Entregados" value={resumen.entregados} />
          <Metric label="Cancelados" value={resumen.cancelados} hint={resumen.total ? `${Math.round((resumen.cancelados / resumen.total) * 100)}% del total` : undefined} />
          <Metric label="Ventas entregadas" value={money(resumen.ventas)} hint="Productos, sin envío" />
        </MetricStrip>
      )}

      {error ? <ErrorState title="No pudimos cargar el historial" error={error} onRetry={cargar} />
        : cargando && !pedidos.length ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando pedidos">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : pedidos.length === 0 ? (
          <EmptyState title={q || estado !== "todos" ? "No hay pedidos con esos filtros" : "No hay pedidos en este período"} text={q || estado !== "todos" ? "Probá con otro texto, otro estado o un período más largo." : "Elegí un período más largo para ver pedidos anteriores."} />
        ) : (
          <div className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", cargando && "opacity-60")} aria-busy={cargando}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-[12.5px] text-muted-foreground"><tr><th className="p-3 font-semibold">Pedido</th><th className="p-3 font-semibold">Fecha</th><th className="p-3 font-semibold">Cliente</th><th className="p-3 font-semibold">Productos</th><th className="p-3 font-semibold">Estado</th><th className="p-3 text-right font-semibold">Total</th></tr></thead>
                <tbody className="divide-y">
                  {pedidos.map((order) => (
                    <tr key={order.id} className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none" onClick={() => setAbierto(order)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setAbierto(order))}>
                      <td className="p-3 font-bold tabular-nums">{shortId(order.id)}</td>
                      <td className="whitespace-nowrap p-3 tabular-nums">{formatDateTime(order.created_at)}</td>
                      <td className="p-3">{order.cliente?.nombre || "—"}</td>
                      <td className="max-w-[260px] truncate p-3 text-muted-foreground">{(order.items || []).map((item) => `${item.cantidad}× ${item.nombre}`).join(", ")}</td>
                      <td className="p-3"><StatusBadge estado={order.estado} /></td>
                      <td className="p-3 text-right font-bold tabular-nums">{money(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[13px]">
              <span className="text-muted-foreground tabular-nums">{offset + 1}–{hastaFila} de {total}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={cargando || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGINA))}><ChevronLeft className="h-4 w-4" />Anteriores</Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={cargando || hastaFila >= total} onClick={() => setOffset(offset + PAGINA)}>Siguientes<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

      <Dialog open={Boolean(abierto)} onOpenChange={(next) => !next && setAbierto(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          {abierto && (
            <>
              <DialogTitle className="text-xl font-black">Pedido {shortId(abierto.id)}</DialogTitle>
              <DialogDescription>{abierto.cliente?.nombre || "Cliente"} · {formatDateTime(abierto.created_at)}</DialogDescription>
              <div><StatusBadge estado={abierto.estado} /></div>
              <ul className="divide-y text-sm">
                {(abierto.items || []).map((item, index) => <li key={item.id || index} className="flex justify-between gap-3 py-2"><span><span className="font-bold">{item.cantidad}×</span> {item.nombre}{item.opciones && item.opciones.length > 0 && <span className="block text-xs text-muted-foreground">{optionsLabel(item.opciones)}</span>}{item.notas && <span className="block text-xs text-muted-foreground">“{item.notas}”</span>}</span><span className="tabular-nums">{money(item.precio_unitario * item.cantidad)}</span></li>)}
              </ul>
              <dl className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Productos</dt><dd className="tabular-nums">{money(abierto.subtotal)}</dd></div>
                {Number(abierto.descuento) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Descuento {abierto.cupon_codigo && `(${abierto.cupon_codigo})`}</dt><dd className="tabular-nums">-{money(abierto.descuento)}</dd></div>}
                {Number(abierto.costo_envio) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd className="tabular-nums">{money(abierto.costo_envio)}</dd></div>}
                <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{money(abierto.total)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Entrega</dt><dd>{abierto.tipo_entrega === "retiro" ? "Retiro en el local" : abierto.direccion_entrega}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Pago</dt><dd>{metodoPagoLabel[abierto.metodo_pago]}</dd></div>
                {abierto.aceptado_en_seg != null && <div className="flex justify-between"><dt className="text-muted-foreground">Respondiste en</dt><dd>{abierto.aceptado_en_seg < 60 ? `${abierto.aceptado_en_seg} s` : `${Math.round(abierto.aceptado_en_seg / 60)} min`}</dd></div>}
                {abierto.confirmado_at && (abierto.listo_at || abierto.en_camino_at) && <div className="flex justify-between"><dt className="text-muted-foreground">Preparación real</dt><dd>{Math.round((new Date((abierto.listo_at || abierto.en_camino_at) as string).getTime() - new Date(abierto.confirmado_at).getTime()) / 60000)} min{abierto.preparacion_min ? ` (prometidos ${abierto.preparacion_min})` : ""}</dd></div>}
                {abierto.motivo_cancelacion && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Motivo</dt><dd className="text-right">{abierto.motivo_cancelacion}</dd></div>}
              </dl>
              <Button variant="outline" className="rounded-full" onClick={() => printOrderTicket(abierto, store, readPrintSettings(), 1)}><Printer className="h-4 w-4" />Imprimir comanda</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
