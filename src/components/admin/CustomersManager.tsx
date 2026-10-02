import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Customer = {
  id: string; nombre: string; telefono: string | null; email: string; alta: string; pedidos: number; entregados: number; cancelados: number; cancelados_7d: number;
  gastado: number; ultimo: string | null; bloqueado: boolean; motivo: string | null; nota: string | null; alerta: boolean;
};
type Scope = "todos" | "alertas" | "bloqueados";

/** Clientes con su historial, alertas de posible abuso y suspensión de cuentas. */
export function CustomersManager() {
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<Scope>("todos");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [credit, setCredit] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_admin_clientes", { p_buscar: term.trim() || null, p_solo: scope, p_limite: 100 });
    if (error) { toast.error(errorMessage(error)); setRows([]); return; }
    setRows(data || []);
  }, [term, scope]);
  useEffect(() => {
    const timer = window.setTimeout(load, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = (customer: Customer) => { setEditing(customer); setReason(customer.motivo ?? ""); setNote(customer.nota ?? ""); };
  const giveCredit = async () => {
    if (!editing) return;
    setSaving(true);
    const { data, error } = await db.rpc("delivery_admin_regalar_credito", { p_cliente: editing.id, p_monto: Number(credit), p_motivo: reason.trim(), p_dias: 30 });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Crédito regalado: el cliente lo ve en su Club (${data})`);
    setCredit("");
  };
  const save = async (blocked: boolean) => {
    if (!editing) return;
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_cliente_control", { p_cliente: editing.id, p_bloqueado: blocked, p_motivo: blocked ? reason.trim() : null, p_nota: note.trim() || null });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(blocked ? "Cuenta suspendida" : "Cuenta reactivada");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-muted px-4"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar por nombre, email o teléfono" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Buscar clientes" /></label>
        {(["todos", "alertas", "bloqueados"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setScope(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", scope === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{value === "todos" ? "Todos" : value === "alertas" ? "Con alertas" : "Suspendidos"}</button>
        ))}
      </div>
      {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="No hay clientes con este filtro" /> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Cliente</th><th className="p-3 text-right">Pedidos</th><th className="p-3 text-right">Entregados</th><th className="p-3 text-right">Cancelados</th><th className="p-3 text-right">Gastado</th><th className="p-3">Último pedido</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y">
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td className="p-3"><span className="flex items-center gap-1.5 font-bold">{customer.nombre}{customer.bloqueado && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-extrabold text-destructive">Suspendido</span>}{customer.alerta && !customer.bloqueado && <AlertTriangle className="h-4 w-4 text-warning" aria-label="Alerta de cancelaciones" />}</span><span className="block text-xs text-muted-foreground">{customer.email}{customer.telefono && ` · ${customer.telefono}`}</span></td>
                  <td className="p-3 text-right tabular-nums">{customer.pedidos}</td>
                  <td className="p-3 text-right tabular-nums">{customer.entregados}</td>
                  <td className={cn("p-3 text-right tabular-nums", customer.alerta && "font-bold text-destructive")}>{customer.cancelados}{customer.cancelados_7d > 0 && <span className="block text-[11px] font-normal text-muted-foreground">{customer.cancelados_7d} esta semana</span>}</td>
                  <td className="p-3 text-right tabular-nums">{money(customer.gastado)}</td>
                  <td className="p-3">{customer.ultimo ? formatDateTime(customer.ultimo) : "—"}</td>
                  <td className="p-3 text-right"><Button size="sm" variant={customer.bloqueado ? "outline" : "ghost"} className="rounded-full" onClick={() => open(customer)}>{customer.bloqueado ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{customer.bloqueado ? "Revisar" : "Gestionar"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && !saving && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-black">{editing?.nombre}</DialogTitle>
          <DialogDescription>{editing?.email} · cliente desde {editing && formatDateTime(editing.alta)}. Una cuenta suspendida no puede hacer pedidos ni envíos.</DialogDescription>
          <label htmlFor="cc-reason" className="text-sm font-bold">Motivo de la suspensión</label>
          <Textarea id="cc-reason" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: pedidos falsos repetidos" className="min-h-[64px] resize-none" />
          <label htmlFor="cc-note" className="text-sm font-bold">Nota interna (solo administración)</label>
          <Textarea id="cc-note" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} className="min-h-[64px] resize-none" />
          <div className="rounded-2xl border bg-muted/40 p-3">
            <p className="text-sm font-bold">Regalar crédito (compensación)</p>
            <p className="text-xs text-muted-foreground">Se le crea un cupón personal de descuento, válido 30 días. Usa el motivo de arriba.</p>
            <div className="mt-2 flex gap-2">
              <Input inputMode="numeric" value={credit} onChange={(event) => setCredit(event.target.value.replace(/\D/g, ""))} placeholder="Monto ($)" aria-label="Monto del crédito" className="h-9" />
              <Button size="sm" variant="outline" className="rounded-full" disabled={saving || !credit || reason.trim().length < 5} onClick={giveCredit}>Regalar</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {editing?.bloqueado
              ? <Button className="rounded-full" disabled={saving} onClick={() => save(false)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Reactivar cuenta</Button>
              : <Button variant="destructive" className="rounded-full" disabled={saving || reason.trim().length < 5} onClick={() => save(true)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Suspender cuenta</Button>}
            <Button variant="outline" className="rounded-full" disabled={saving} onClick={() => save(Boolean(editing?.bloqueado))}>Guardar nota</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
