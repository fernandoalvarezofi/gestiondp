import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ChatButton } from "@/components/delivery/OrderChat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime, money, Reclamo, reclamoTipoLabel, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type ClaimRow = Reclamo & {
  pedido?: { id: string; total: number; estado: string; repartidor_id: string | null; metodo_pago: string; pago_estado: string } | null;
  comercio?: { nombre: string } | null;
  cliente?: { nombre: string } | null;
};

const claimSelect = "*, pedido:delivery_pedidos(id,total,estado,repartidor_id,metodo_pago,pago_estado), comercio:delivery_comercios(nombre), cliente:perfiles!delivery_reclamos_cliente_id_fkey(nombre)";

/** Bandeja de reclamos del administrador: ver contexto del pedido, leer los chats y responder. */
export function ClaimsManager({ onChange }: { onChange?: (openCount: number) => void }) {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"abierto" | "todos">("abierto");
  const [active, setActive] = useState<ClaimRow | null>(null);
  const [answer, setAnswer] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_reclamos").select(claimSelect).order("created_at", { ascending: false }).limit(200);
    const list: ClaimRow[] = data || [];
    setClaims(list);
    setLoading(false);
    onChange?.(list.filter((claim) => claim.estado === "abierto").length);
  }, [onChange]);

  useEffect(() => {
    load();
    const channel = db.channel("admin-reclamos").on("postgres_changes", { event: "*", schema: "public", table: "delivery_reclamos" }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [load]);

  const resolve = async (estado: "resuelto" | "rechazado") => {
    if (!active) return;
    const monto = estado === "resuelto" ? Number(amount.replace(/\D/g, "") || 0) : 0;
    setSaving(true);
    const { error } = await db.rpc("delivery_resolver_reclamo", { p_reclamo: active.id, p_estado: estado, p_resolucion: answer.trim(), p_monto: monto });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Respuesta enviada al cliente");
    setActive(null); setAnswer(""); setAmount("");
    load();
  };

  const visible = claims.filter((claim) => filter === "todos" || claim.estado === "abierto");

  return (
    <div>
      <div className="flex gap-2">
        {(["abierto", "todos"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card")}>
            {value === "abierto" ? `Abiertos (${claims.filter((claim) => claim.estado === "abierto").length})` : "Todos"}
          </button>
        ))}
      </div>

      {loading ? <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : visible.length === 0 ? (
        <EmptyState className="mt-4" title={filter === "abierto" ? "No hay reclamos abiertos" : "Todavía no hay reclamos"} />
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((claim) => (
            <li key={claim.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{reclamoTipoLabel[claim.tipo]}</p>
                  <p className="text-xs text-muted-foreground">Pedido {shortId(claim.pedido_id)} · {claim.comercio?.nombre} · {claim.cliente?.nombre || "Cliente"} · {formatDateTime(claim.created_at)}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", claim.estado === "abierto" ? "bg-warning/15" : claim.estado === "resuelto" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{claim.estado === "abierto" ? "Abierto" : claim.estado === "resuelto" ? "Resuelto" : "Rechazado"}</span>
              </div>
              <p className="mt-2 text-sm">{claim.detalle}</p>
              {claim.pedido && <p className="mt-1 text-xs text-muted-foreground">Total del pedido {money(claim.pedido.total)} · {claim.pedido.metodo_pago === "mercadopago" ? `Mercado Pago (${claim.pedido.pago_estado})` : claim.pedido.metodo_pago}</p>}
              {claim.resolucion && <p className="mt-2 rounded-xl bg-muted p-2.5 text-sm"><span className="font-bold">Respuesta: </span>{claim.resolucion}{Number(claim.reembolso_monto) > 0 && <span className="font-bold text-success"> · Reintegro {money(claim.reembolso_monto)}</span>}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <ChatButton pedidoId={claim.pedido_id} canal="comercio" label="Chat con el comercio" title="Chat cliente ↔ comercio" readOnly />
                {claim.pedido?.repartidor_id && <ChatButton pedidoId={claim.pedido_id} canal="repartidor" label="Chat con el repartidor" title="Chat cliente ↔ repartidor" readOnly />}
                {claim.estado === "abierto" && <Button size="sm" className="rounded-full" onClick={() => { setActive(claim); setAnswer(""); setAmount(""); }}>Responder</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-black">Responder reclamo</DialogTitle>
          <DialogDescription>{active && `${reclamoTipoLabel[active.tipo]} · pedido ${shortId(active.pedido_id)} · total ${money(active.pedido?.total)}`}</DialogDescription>
          <Textarea value={answer} maxLength={1000} onChange={(event) => setAnswer(event.target.value)} placeholder="Lo que va a leer el cliente" className="min-h-[96px] resize-none" aria-label="Respuesta al cliente" />
          <div>
            <label htmlFor="refund" className="text-sm font-bold">Reintegro al cliente ($, opcional)</label>
            <Input id="refund" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Queda registrado en el reclamo. Si el pedido se pagó con Mercado Pago, hacé la devolución desde tu cuenta.</p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-full" disabled={saving || answer.trim().length < 5} onClick={() => resolve("resuelto")}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Resolver</Button>
            <Button variant="outline" className="rounded-full" disabled={saving || answer.trim().length < 5} onClick={() => resolve("rechazado")}>Rechazar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
