import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { db, estadoCorto, formatDateTime, money, type EstadoPedido } from "@/lib/delivery";

type Contexto = {
  pedido: null | { id: string; estado: EstadoPedido; tipo_entrega: string; direccion: string; metodo_pago: string; pago_estado: string; subtotal: number; costo_envio: number; propina: number; total: number; creado: string; entregado: string | null; cancelado: string | null; motivo_cancelacion: string | null; notas: string | null };
  repartidor?: { nombre: string | null; telefono: string | null; vehiculo: string } | null;
  items?: { nombre: string; cantidad: number; precio: number; notas: string | null }[];
  historial?: { evento: string; de: string | null; a: string | null; rol: string | null; at: string }[];
  chats?: Record<string, number>;
};
const canalLabel: Record<string, string> = { cliente_comercio: "cliente ↔ comercio", cliente_repartidor: "cliente ↔ repartidor", comercio_repartidor: "comercio ↔ repartidor" };

/** Todo el contexto del pedido de un ticket, para que el agente no tenga que buscarlo: productos, dirección, repartidor, pago e historial. */
export function SupportContext({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<Contexto | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setData(null); db.rpc("delivery_soporte_contexto", { p_reclamo: ticketId }).then(({ data: d }: { data: Contexto | null }) => setData(d)); }, [ticketId]);
  if (!data?.pedido) return null;
  const p = data.pedido;
  return (
    <div className="mt-3 rounded-2xl border">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-bold">
        Contexto completo del pedido<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-4 border-t p-3 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">Entrega y pago</p>
            <p>{p.tipo_entrega === "retiro" ? "Retiro en el local" : p.direccion}</p>
            <p className="text-muted-foreground">{p.metodo_pago} · pago {p.pago_estado} · {money(p.subtotal)} + envío {money(p.costo_envio)}{Number(p.propina) > 0 ? ` + propina ${money(p.propina)}` : ""} = <span className="font-bold text-foreground">{money(p.total)}</span></p>
            {p.notas && <p className="text-muted-foreground">Notas: “{p.notas}”</p>}
            {p.motivo_cancelacion && <p className="text-destructive">Cancelado: {p.motivo_cancelacion}</p>}
            {data.repartidor && <p><span className="font-bold">Repartidor:</span> {data.repartidor.nombre || "—"} · {data.repartidor.vehiculo}{data.repartidor.telefono ? ` · ${data.repartidor.telefono}` : ""}</p>}
            {data.chats && Object.keys(data.chats).length > 0 && <p className="text-muted-foreground">Mensajes: {Object.entries(data.chats).map(([c, n]) => `${canalLabel[c] ?? c} (${n})`).join(" · ")}</p>}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">Productos</p>
            <ul className="space-y-0.5">{(data.items ?? []).map((i, idx) => <li key={idx}>{i.cantidad}× {i.nombre} <span className="text-muted-foreground">· {money(i.precio)}</span>{i.notas && <span className="text-muted-foreground"> · “{i.notas}”</span>}</li>)}</ul>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-bold uppercase text-muted-foreground">Historial</p>
            <ol className="space-y-0.5">
              <li className="text-muted-foreground">{formatDateTime(p.creado)} · pedido creado</li>
              {(data.historial ?? []).map((h, idx) => (
                <li key={idx} className="text-muted-foreground">{formatDateTime(h.at)} · {h.a ? `${estadoCorto[h.de as EstadoPedido] ?? h.de ?? "—"} → ${estadoCorto[h.a as EstadoPedido] ?? h.a}` : h.evento}{h.rol ? ` (${h.rol})` : ""}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
