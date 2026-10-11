import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Printer, Search, ShoppingBag, PackageCheck, XCircle, Banknote } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Metric, MetricStrip } from "@/components/panel/kit";
import { Button } from "@/components/ui/button";
import { ClienteLink } from "@/components/merchant/ClienteLink";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { db, DeliveryOrder, DeliveryStore, EstadoPedido, errorMessage, formatDateTime, merchantOrderSelect, metodoPagoLabel, money, optionsLabel, shortId } from "@/lib/delivery";
import { printOrderTicket, readPrintSettings } from "@/lib/print";
import { cn } from "@/lib/utils";

const PAGINA = 50;
type Estado = "todos" | EstadoPedido;
type Resumen = { total: number; entregados: number; cancelados: number; ventas: number; por_estado?: Partial<Record<EstadoPedido, number>>; ids: string[] };

/** Filtros por estado, en el orden en que avanza un pedido. */
const ESTADOS: { id: Estado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendiente", label: "Nuevos" },
  { id: "confirmado", label: "Aceptados" },
  { id: "preparando", label: "En preparación" },
  { id: "listo", label: "Listos" },
  { id: "en_camino", label: "En camino" },
  { id: "entregado", label: "Entregados" },
  { id: "cancelado", label: "Cancelados" },
];
const entregaLabel = (o: DeliveryOrder) => (o.tipo_entrega === "retiro" ? "Retiro" : o.tipo_entrega === "envio" ? "Envío de la tienda" : "Delivery");
const iniciales = (nombre?: string | null) => (nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

/** Fecha local (la del comercio) como AAAA-MM-DD. */
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const haceDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dia(d); };
const inicioDeMes = () => { const d = new Date(); return dia(new Date(d.getFullYear(), d.getMonth(), 1)); };

const PERIODOS = [
  { id: "hoy", label: "Hoy", desde: () => dia(new Date()) },
  { id: "7", label: "Últimos 7 días", desde: () => haceDias(6) },
  { id: "30", label: "Últimos 30 días", desde: () => haceDias(29) },
  { id: "mes", label: "Este mes", desde: inicioDeMes },
  { id: "90", label: "Últimos 90 días", desde: () => haceDias(89) },
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
  const conteo = (id: Estado) => {
    const por = resumen?.por_estado;
    if (!por) return undefined;
    return id === "todos" ? Object.values(por).reduce((a, n) => a + Number(n || 0), 0) : Number(por[id] || 0);
  };
  const elegirEstado = (id: Estado) => { setEstado(id); setOffset(0); };
  const filtrando = Boolean(q) || estado !== "todos";

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[208px_minmax(0,1fr)]">
      {/* Filtros por estado: lista vertical en escritorio, fila deslizable en el celular. */}
      <nav aria-label="Filtrar por estado" className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-xl lg:border lg:bg-card lg:p-1.5 lg:px-1.5">
        {ESTADOS.map((item) => {
          const n = conteo(item.id);
          const activo = estado === item.id;
          return (
            <button key={item.id} type="button" aria-pressed={activo} onClick={() => elegirEstado(item.id)}
              className={cn("flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors lg:border-0 lg:py-2",
                activo ? "border-primary/30 bg-primary/[0.07] text-primary" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground lg:bg-transparent")}>
              <span className="whitespace-nowrap">{item.label}</span>
              {n !== undefined && <span className={cn("min-w-6 rounded-md px-1.5 text-center text-[11.5px] tabular-nums leading-5", activo ? "bg-primary text-primary-foreground" : item.id === "pendiente" && n > 0 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-muted")}>{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-[3px] focus-within:ring-ring/25">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Número, cliente o teléfono" aria-label="Buscar pedido" maxLength={60} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <label className="sr-only" htmlFor="historial-periodo">Período</label>
          <select id="historial-periodo" value={periodo} onChange={(e) => elegirPeriodo(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold">
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            {periodo === "personalizado" && <option value="personalizado">Fechas elegidas</option>}
          </select>
          <div className="flex items-center gap-1.5 text-[13px]">
            <label className="sr-only" htmlFor="historial-desde">Desde</label>
            <input id="historial-desde" type="date" value={desde} max={dia(new Date())} onChange={(e) => cambiarFecha("desde", e.target.value)} className="h-10 rounded-lg border border-input bg-card px-2.5 font-semibold" />
            <span aria-hidden className="text-muted-foreground">a</span>
            <label className="sr-only" htmlFor="historial-hasta">Hasta</label>
            <input id="historial-hasta" type="date" value={hasta} max={dia(new Date())} onChange={(e) => cambiarFecha("hasta", e.target.value)} className="h-10 rounded-lg border border-input bg-card px-2.5 font-semibold" />
          </div>
          <Button type="button" variant="outline" className="h-10" onClick={exportar} disabled={exportando || !total}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exportar CSV
          </Button>
        </div>

        {resumen && !error && (
          <MetricStrip cols={4}>
            <Metric icon={<ShoppingBag />} tone="ink" label="Pedidos" value={resumen.total} />
            <Metric icon={<PackageCheck />} tone="brand" label="Entregados" value={resumen.entregados} />
            <Metric icon={<XCircle />} tone="danger" label="Cancelados" value={resumen.cancelados} hint={resumen.total ? `${Math.round((resumen.cancelados / resumen.total) * 100)}% del total` : undefined} />
            <Metric icon={<Banknote />} tone="accent" label="Ventas entregadas" value={money(resumen.ventas)} hint="Productos, sin envío" />
          </MetricStrip>
        )}

        {error ? <ErrorState title="No pudimos cargar los pedidos" error={error} onRetry={cargar} />
          : cargando && !pedidos.length ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando pedidos">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
          ) : pedidos.length === 0 ? (
            <EmptyState title={filtrando ? "No hay pedidos con esos filtros" : "No hay pedidos en este período"} text={filtrando ? "Probá con otro texto, otro estado o un período más largo." : "Elegí un período más largo para ver pedidos anteriores."} />
          ) : (
            <div className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", cargando && "opacity-60")} aria-busy={cargando}>
              {/* Celular: filas compactas. */}
              <ul className="divide-y md:hidden">
                {pedidos.map((order) => (
                  <li key={order.id}>
                    <button type="button" onClick={() => setAbierto(order)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50">
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-bold">{iniciales(order.cliente?.nombre)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{order.cliente?.nombre || "Cliente"}</span><span className="text-sm font-bold tabular-nums">{money(order.total)}</span></span>
                        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate tabular-nums">{shortId(order.id)} · {formatDateTime(order.created_at)}</span><StatusBadge estado={order.estado} className="px-2 py-0.5 text-[11px]" /></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {/* Escritorio: tabla. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-[12px] text-muted-foreground">
                    <tr><th className="px-4 py-2.5 font-semibold">Pedido</th><th className="px-4 py-2.5 font-semibold">Cliente</th><th className="px-4 py-2.5 font-semibold">Entrega y pago</th><th className="px-4 py-2.5 font-semibold">Estado</th><th className="px-4 py-2.5 text-right font-semibold">Total</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {pedidos.map((order) => (
                      <tr key={order.id} className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none" onClick={() => setAbierto(order)} tabIndex={0} aria-label={`Ver pedido ${shortId(order.id)}`} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setAbierto(order))}>
                        <td className="whitespace-nowrap px-4 py-3"><span className="block font-bold tabular-nums">{shortId(order.id)}</span><span className="block text-xs tabular-nums text-muted-foreground">{formatDateTime(order.created_at)}</span></td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11.5px] font-bold">{iniciales(order.cliente?.nombre)}</span>
                            <span className="min-w-0"><span className="block truncate font-semibold">{order.cliente?.nombre || "—"}</span><span className="block max-w-[220px] truncate text-xs text-muted-foreground">{(order.items || []).map((item) => `${item.cantidad}× ${item.nombre}`).join(", ")}</span></span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="block">{entregaLabel(order)}</span><span className="block text-xs text-muted-foreground">{metodoPagoLabel[order.metodo_pago] ?? order.metodo_pago}</span></td>
                        <td className="px-4 py-3"><StatusBadge estado={order.estado} /></td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{money(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px]">
                <span className="text-muted-foreground tabular-nums">Mostrando {offset + 1}–{hastaFila} de {total}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" disabled={cargando || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGINA))} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /><span className="max-sm:sr-only">Anteriores</span></Button>
                  <Button type="button" size="sm" variant="outline" disabled={cargando || hastaFila >= total} onClick={() => setOffset(offset + PAGINA)} aria-label="Página siguiente"><span className="max-sm:sr-only">Siguientes</span><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
      </div>

      <Dialog open={Boolean(abierto)} onOpenChange={(next) => !next && setAbierto(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          {abierto && (
            <>
              <DialogTitle className="text-xl font-black">Pedido {shortId(abierto.id)}</DialogTitle>
              <DialogDescription><ClienteLink clienteId={abierto.cliente_id}>{abierto.cliente?.nombre || "Cliente"}</ClienteLink> · {formatDateTime(abierto.created_at)}</DialogDescription>
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
              <Button variant="outline" onClick={() => printOrderTicket(abierto, store, readPrintSettings(), 1)}><Printer className="h-4 w-4" />Imprimir comanda</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
