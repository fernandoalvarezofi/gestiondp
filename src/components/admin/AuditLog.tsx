import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Entry = { id: number; fecha: string; actor: string; accion: string; entidad: string; entidad_id: string | null; detalle: Record<string, { de?: unknown; a?: unknown } | unknown> };

const entities: [string, string][] = [["", "Todo"], ["delivery_comercios", "Comercios"], ["delivery_repartidores", "Repartidores"], ["delivery_pedidos", "Pedidos"], ["delivery_envios", "Envíos"], ["delivery_clientes_control", "Clientes"], ["delivery_liquidaciones", "Liquidaciones"], ["delivery_ajustes", "Ajustes"], ["delivery_cupones", "Cupones"]];
const entityLabel = Object.fromEntries(entities.filter(([key]) => key).map(([key, label]) => [key, label]));
const fieldLabel: Record<string, string> = {
  aprobado: "Aprobado", activo: "Activo", comision_pct: "Comisión %", destacado: "Destacado", motivo_rechazo: "Motivo de rechazo", propietario_id: "Dueño", verificado: "Verificado", bloqueado: "Suspendido", motivo: "Motivo",
  valor: "Valor", estado: "Estado", referencia: "Referencia", balance: "Balance", repartidor_id: "Repartidor", motivo_cancelacion: "Motivo de cancelación", pago_estado: "Estado de pago", codigo: "Código", cliente_id: "Cliente",
  repartidor: "Repartidor", pedido: "Pedido",
};
const show = (value: unknown) => (value === null || value === undefined ? "—" : typeof value === "boolean" ? (value ? "sí" : "no") : typeof value === "string" && value.length > 24 && /^[0-9a-f-]{36}$/.test(value) ? `${value.slice(0, 6)}…` : String(value));

/** Registro de cambios hechos por administración: quién, cuándo y qué cambió. */
export function AuditLog() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [entity, setEntity] = useState("");

  useEffect(() => {
    let active = true;
    setRows(null);
    db.rpc("delivery_admin_auditoria", { p_entidad: entity || null, p_limite: 200 }).then(({ data, error }: { data: Entry[] | null; error: unknown }) => {
      if (!active) return;
      if (error) { toast.error(errorMessage(error)); setRows([]); } else setRows(data || []);
    });
    return () => { active = false; };
  }, [entity]);

  return (
    <div className="space-y-4">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {entities.map(([key, label]) => <button key={label} type="button" onClick={() => setEntity(key)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", entity === key ? "border-foreground bg-foreground text-background" : "bg-card")}>{label}</button>)}
      </div>
      {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length === 0 ? <EmptyState icon={<ScrollText className="h-7 w-7" />} title="Todavía no hay cambios registrados" text="Acá queda el detalle de cada acción de administración." /> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Fecha</th><th className="p-3">Quién</th><th className="p-3">Qué</th><th className="p-3">Cambios</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap p-3">{formatDateTime(row.fecha)}</td>
                  <td className="p-3 font-bold">{row.actor}</td>
                  <td className="p-3"><span className="font-semibold">{entityLabel[row.entidad] ?? row.entidad}</span><span className="block text-xs text-muted-foreground">{row.accion.split(".")[1]} · {row.entidad_id ? show(row.entidad_id) : ""}</span></td>
                  <td className="p-3">
                    <ul className="space-y-0.5">
                      {Object.entries(row.detalle).map(([field, value]) => {
                        const change = value as { de?: unknown; a?: unknown };
                        const isChange = typeof value === "object" && value !== null && ("de" in change || "a" in change);
                        return <li key={field} className="text-xs"><span className="font-bold">{fieldLabel[field] ?? field}:</span> {isChange ? <>{show(change.de)} → <span className="font-bold">{show(change.a)}</span></> : show(value)}</li>;
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
