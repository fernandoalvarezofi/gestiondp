import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { PageIntro } from "@/components/panel/kit";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Devolucion, ESTADO_DEVOLUCION, fetchDevolucionesComercio, motivoLabel, reintegrarDevolucion, responderDevolucion } from "@/services/returns";
import { useMerchant } from "./context";

type Tab = "pendientes" | "aprobadas" | "historial";

/** Devoluciones que pidieron los clientes: se aprueban o rechazan y, al recibir los productos, se confirma el reintegro (con o sin reponer el stock). */
export default function MerchantReturns() {
  const { store } = useMerchant();
  const [rows, setRows] = useState<Devolucion[] | null>(null);
  const [tab, setTab] = useState<Tab>("pendientes");
  const [busy, setBusy] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<Record<string, string>>({});
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [reponer, setReponer] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try { setRows(await fetchDevolucionesComercio(store.id)); } catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, [store.id]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const groups = useMemo(() => ({
    pendientes: (rows ?? []).filter((r) => r.estado === "solicitada"),
    aprobadas: (rows ?? []).filter((r) => r.estado === "aprobada"),
    historial: (rows ?? []).filter((r) => ["reintegrada", "rechazada", "cancelada"].includes(r.estado)),
  }), [rows]);

  const run = async (id: string, action: () => Promise<void>, ok: string) => {
    setBusy(id);
    try { await action(); toast.success(ok); setRechazando(null); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  };

  const list = groups[tab];
  return (
    <div className="space-y-5">
      <PageIntro description="Los clientes tienen 7 días desde la entrega para pedirlas. Al confirmar el reintegro se descuenta de tus ventas y se te devuelve la comisión correspondiente." />
      <div role="tablist" aria-label="Estado" className="flex gap-2">
        {([["pendientes", "Para responder"], ["aprobadas", "Aprobadas"], ["historial", "Historial"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>
            {label}{groups[id].length > 0 && ` (${groups[id].length})`}
          </button>
        ))}
      </div>

      {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : list.length === 0 ? <EmptyState icon={<PackageOpen className="h-7 w-7" />} title="Nada por acá" text={tab === "pendientes" ? "No tenés devoluciones esperando respuesta." : "No hay devoluciones en esta lista."} />
        : (
          <ul className="space-y-3">
            {list.map((d) => (
              <li key={d.id} className="rounded-3xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">{money(d.monto)} <span className="font-semibold text-muted-foreground">· pedido {shortId(d.pedido_id)}</span></p>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_DEVOLUCION[d.estado].clase)}>{ESTADO_DEVOLUCION[d.estado].texto}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(d.created_at)} · {motivoLabel(d.motivo)}</p>
                <ul className="mt-2 text-sm">{d.items.map((i) => <li key={i.item_id}><span className="font-bold">{i.cantidad}×</span> {i.nombre}</li>)}</ul>
                {d.detalle && <p className="mt-2 rounded-xl bg-muted p-2.5 text-sm">“{d.detalle}”</p>}
                {d.destino === "medio_original" && <p className="mt-2 text-xs font-semibold text-muted-foreground">El cliente pidió que la plata vuelva a su medio de pago original (pedido pagado online, completo): la devolución la hace administración desde Mercado Pago.</p>}
                {d.respuesta && <p className="mt-2 text-sm"><span className="font-bold">Tu respuesta: </span>{d.respuesta}</p>}

                {d.estado === "solicitada" && (
                  <div className="mt-3 space-y-2">
                    {rechazando === d.id ? (
                      <>
                        <Textarea aria-label="Motivo del rechazo" value={motivoRechazo[d.id] ?? ""} maxLength={500} onChange={(event) => setMotivoRechazo((c) => ({ ...c, [d.id]: event.target.value }))} placeholder="Contale al cliente por qué no se puede devolver" className="min-h-[64px] resize-none" />
                        <div className="flex gap-2">
                          <Button variant="destructive" className="rounded-full" disabled={busy === d.id || (motivoRechazo[d.id] ?? "").trim().length < 5} onClick={() => run(d.id, () => responderDevolucion(d.id, false, motivoRechazo[d.id]), "Rechazaste la devolución")}>Rechazar</Button>
                          <Button variant="ghost" className="rounded-full" onClick={() => setRechazando(null)}>Volver</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button className="rounded-full" disabled={busy === d.id} onClick={() => run(d.id, () => responderDevolucion(d.id, true), "Aprobaste la devolución")}>{busy === d.id && <Loader2 className="h-4 w-4 animate-spin" />}Aprobar</Button>
                        <Button variant="outline" className="rounded-full" onClick={() => setRechazando(d.id)}>Rechazar</Button>
                      </div>
                    )}
                  </div>
                )}

                {d.estado === "aprobada" && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" checked={reponer[d.id] ?? false} onChange={(event) => setReponer((c) => ({ ...c, [d.id]: event.target.checked }))} />Volver a sumar los productos a mi stock</label>
                    <Button className="rounded-full" disabled={busy === d.id} onClick={() => run(d.id, () => reintegrarDevolucion(d.id, reponer[d.id] ?? false), "Reintegro confirmado")}>{busy === d.id && <Loader2 className="h-4 w-4 animate-spin" />}Ya recibí los productos: confirmar reintegro de {money(d.monto)}</Button>
                    <p className="text-xs text-muted-foreground">Esto no se puede deshacer: se devuelve la plata al cliente y se ajustan tus ventas.</p>
                  </div>
                )}
                {d.estado === "reintegrada" && d.repuso_stock && <p className="mt-2 text-xs font-semibold text-muted-foreground">Se repuso el stock.</p>}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
