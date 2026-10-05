import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, MapPin, Route } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { estaAtrasado, ESTADO_TRABAJO, ESTADOS_ORDEN, EstadoTrabajo, fetchSeguimiento, fetchTablero, Seguimiento, TableroTrabajos, TIPO_TRABAJO, TipoTrabajo, TrabajoFila } from "@/services/jobs";

/** Todas las operaciones físicas (entregas, mensajería y viajes) en un solo tablero, con su estado común y su línea de tiempo. */
export function JobsBoard() {
  const [estado, setEstado] = useState<EstadoTrabajo | null>("pendiente");
  const [tipo, setTipo] = useState<TipoTrabajo | null>(null);
  const [data, setData] = useState<TableroTrabajos | null>(null);
  const [detalle, setDetalle] = useState<TrabajoFila | null>(null);

  const load = useCallback(async () => {
    try { setData(await fetchTablero(estado, tipo)); } catch (error) { toast.error(errorMessage(error)); setData({ por_estado: {}, por_tipo: {}, items: [] }); }
  }, [estado, tipo]);
  useEffect(() => { setData(null); load(); const t = window.setInterval(load, 30000); return () => window.clearInterval(t); }, [load]);

  const atrasados = (data?.items ?? []).filter(estaAtrasado).length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ESTADOS_ORDEN.map((e) => (
          <button key={e} type="button" aria-pressed={estado === e} onClick={() => setEstado(estado === e ? null : e)} className={cn("rounded-2xl border p-3 text-left transition-colors", estado === e ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>
            <span className={cn("block text-xs font-bold", estado === e ? "text-background/70" : "text-muted-foreground")}>{ESTADO_TRABAJO[e].texto}</span>
            <span className="font-display text-2xl font-black tabular-nums">{data?.por_estado[e] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de trabajo">
        <button type="button" aria-pressed={tipo === null} onClick={() => setTipo(null)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", tipo === null ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>Todos</button>
        {(["delivery", "envio", "viaje"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? null : t)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", tipo === t ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{TIPO_TRABAJO[t]}{data?.por_tipo[t] != null && ` (${data.por_tipo[t]})`}</button>
        ))}
        {atrasados > 0 && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive"><AlertTriangle className="h-4 w-4" />{atrasados} sin asignar hace más de 10 min</span>}
      </div>

      {!data ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : data.items.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No hay trabajos con estos filtros.</p>
        : (
          <ul className="divide-y rounded-3xl border bg-card">
            {data.items.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setDetalle(t)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left text-sm hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-bold">{TIPO_TRABAJO[t.tipo]} <span className="font-semibold text-muted-foreground">{shortId(t.origen_id)}</span>{estaAtrasado(t) && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive"><AlertTriangle className="h-3 w-3" />{t.minutos_sin_asignar} min</span>}</span>
                    <span className="mt-0.5 block truncate text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />{t.recogida ?? "—"} → {t.entrega ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(t.creado)}{t.proveedor && ` · lo lleva ${t.proveedor}`}{t.distancia_km != null && ` · ${Number(t.distancia_km).toFixed(1)} km`}</span>
                  </span>
                  {t.monto != null && <span className="font-extrabold tabular-nums">{money(t.monto)}</span>}
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TRABAJO[t.estado].clase)}>{ESTADO_TRABAJO[t.estado].texto}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      {detalle && <DetalleTrabajo trabajo={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function DetalleTrabajo({ trabajo, onClose }: { trabajo: TrabajoFila; onClose: () => void }) {
  const [seg, setSeg] = useState<Seguimiento | null>(null);
  useEffect(() => { fetchSeguimiento(trabajo.origen_tipo, trabajo.origen_id).then(setSeg, (error) => { toast.error(errorMessage(error)); onClose(); }); }, [trabajo.origen_tipo, trabajo.origen_id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-extrabold"><Route className="h-5 w-5 text-primary" />{TIPO_TRABAJO[trabajo.tipo]} {shortId(trabajo.origen_id)}</DialogTitle>
        <DialogDescription>Estado actual en el sistema de origen: {trabajo.estado_origen}.</DialogDescription>
        {!seg ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl bg-muted p-3"><p><span className="font-bold">Retiro: </span>{seg.recogida.direccion ?? "—"}</p><p><span className="font-bold">Entrega: </span>{seg.entrega.direccion ?? "—"}</p>
              {seg.proveedor && <p><span className="font-bold">Lo lleva: </span>{seg.proveedor.nombre ?? "—"}{seg.proveedor.vehiculo && ` (${seg.proveedor.vehiculo})`}</p>}
              {seg.eta_min != null && <p><span className="font-bold">Llega en: </span>{seg.eta_min} min</p>}
              {seg.ubicacion && <p className="text-xs text-muted-foreground">Última ubicación hace {seg.ubicacion.hace_seg} s</p>}</div>
            <ol className="space-y-2" aria-label="Línea de tiempo">
              {seg.eventos.map((e, i) => (
                <li key={i} className="flex items-start gap-3"><span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", i === seg.eventos.length - 1 ? "bg-primary" : "bg-muted-foreground/40")} /><span><span className="font-bold">{ESTADO_TRABAJO[e.estado].texto}</span><span className="block text-xs text-muted-foreground">{formatDateTime(e.cuando)}</span></span></li>
              ))}
              {seg.eventos.length === 0 && <li className="text-muted-foreground">Todavía no hay movimientos registrados (es un trabajo anterior a este tablero).</li>}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
