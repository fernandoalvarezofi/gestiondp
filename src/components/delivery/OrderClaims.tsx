import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, LifeBuoy, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db, DeliveryOrder, errorMessage, formatDateTime, money, Reclamo, ReclamoTipo, reclamosDisponibles, reclamoTipoLabel } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const estadoReclamo = {
  abierto: { label: "En revisión", icon: Clock3, tone: "bg-warning/15 text-warning-foreground dark:text-warning" },
  resuelto: { label: "Resuelto", icon: CheckCircle2, tone: "bg-success/10 text-success" },
  rechazado: { label: "Respondido", icon: XCircle, tone: "bg-muted text-muted-foreground" },
} as const;

/** Ayuda del pedido: reclamos ya hechos con su respuesta y botón para iniciar uno nuevo. */
export function OrderClaims({ order }: { order: DeliveryOrder }) {
  const [claims, setClaims] = useState<Reclamo[]>([]);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<ReclamoTipo | null>(null);
  const [detalle, setDetalle] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_reclamos").select("*").eq("pedido_id", order.id).order("created_at", { ascending: false });
    setClaims(data || []);
  }, [order.id]);

  useEffect(() => {
    load();
    const channel = db.channel(`reclamos-${order.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_reclamos", filter: `pedido_id=eq.${order.id}` }, load)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [order.id, load]);

  const available = reclamosDisponibles(order).filter((item) => !claims.some((claim) => claim.tipo === item && claim.estado === "abierto"));
  if (!available.length && !claims.length) return null;

  const submit = async () => {
    if (!tipo) return toast.error("Elegí qué pasó");
    if (detalle.trim().length < 10) return toast.error("Contanos un poco más (al menos 10 caracteres)");
    setSending(true);
    const { error } = await db.rpc("delivery_crear_reclamo", { p_pedido: order.id, p_tipo: tipo, p_detalle: detalle.trim() });
    setSending(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Recibimos tu reclamo. Te respondemos por acá.");
    setOpen(false); setTipo(null); setDetalle("");
    load();
  };

  return (
    <section className="mt-4 rounded-3xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><LifeBuoy className="h-5 w-5 text-primary" />Ayuda con este pedido</h2>
        {available.length > 0 && <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>Tuve un problema</Button>}
      </div>
      {claims.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Si algo no salió bien, contanos y lo resolvemos.</p>}
      <ul className="mt-3 space-y-3">
        {claims.map((claim) => {
          const status = estadoReclamo[claim.estado];
          const Icon = status.icon;
          return (
            <li key={claim.id} className="rounded-2xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{reclamoTipoLabel[claim.tipo]}</p>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold", status.tone)}><Icon className="h-3 w-3" />{status.label}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{claim.detalle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(claim.created_at)}</p>
              {claim.resolucion && (
                <div className="mt-2 rounded-xl bg-muted p-2.5">
                  <p className="text-xs font-bold">Respuesta de Woref</p>
                  <p>{claim.resolucion}</p>
                  {Number(claim.reembolso_monto) > 0 && <p className="mt-1 font-bold text-success">Reintegro: {money(claim.reembolso_monto)}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogTitle className="text-xl font-black">¿Qué pasó?</DialogTitle>
          <DialogDescription>Elegí la opción que mejor lo describe.</DialogDescription>
          <div role="radiogroup" className="space-y-2">
            {available.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={tipo === item} onClick={() => setTipo(item)} className={cn("flex w-full items-center rounded-2xl border p-3 text-left text-sm font-bold transition-colors", tipo === item ? "border-primary bg-primary/5" : "hover:bg-muted")}>{reclamoTipoLabel[item]}</button>
            ))}
          </div>
          <Textarea value={detalle} maxLength={1000} onChange={(event) => setDetalle(event.target.value)} placeholder="Contanos qué ocurrió con el mayor detalle posible" className="min-h-[96px] resize-none" aria-label="Detalle del problema" />
          <Button className="rounded-full" onClick={submit} disabled={sending}>{sending && <Loader2 className="h-4 w-4 animate-spin" />}Enviar reclamo</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
