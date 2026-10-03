import { useCallback, useEffect, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Row = { id: string; codigo: string; tipo: "arrepentimiento" | "baja"; nombre: string; email: string; telefono: string | null; pedido_ref: string | null; motivo: string | null; estado: "recibido" | "resuelto" | "rechazado"; resolucion: string | null; creado_en: string };

const HOURS_LIMIT = 24;
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;

/** Bandeja de arrepentimientos y bajas: la norma exige responder dentro de las 24 horas. */
export function WithdrawalsManager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"recibido" | "cerrados">("recibido");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from("delivery_arrepentimientos").select("*").order("creado_en", { ascending: false }).limit(200);
    if (error) { toast.error(errorMessage(error)); setRows([]); return; }
    setRows((data || []) as Row[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (row: Row, estado: "resuelto" | "rechazado") => {
    setBusy(row.id);
    const { error } = await db.rpc("delivery_arrepentimiento_resolver", { p_id: row.id, p_estado: estado, p_resolucion: notes[row.id] || "" });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success("Solicitud cerrada. Avisale a la persona por email.");
    load();
  };

  const visible = (rows || []).filter((row) => (filter === "recibido" ? row.estado === "recibido" : row.estado !== "recibido"));

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Estado">
        {([["recibido", "Pendientes"], ["cerrados", "Cerradas"]] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}{value === "recibido" && rows ? ` (${rows.filter((row) => row.estado === "recibido").length})` : ""}</button>
        ))}
      </div>
      {rows === null ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : visible.length === 0 ? (
        <EmptyState icon={<Undo2 className="h-7 w-7" />} title="Sin solicitudes" text={filter === "recibido" ? "No hay arrepentimientos ni bajas pendientes." : "Todavía no cerraste ninguna."} />
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const hours = hoursSince(row.creado_en);
            const late = row.estado === "recibido" && hours > HOURS_LIMIT;
            return (
              <li key={row.id} className={cn("rounded-3xl border bg-card p-4", late && "border-destructive")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display font-black">{row.codigo} · {row.tipo === "baja" ? "Baja" : "Arrepentimiento"}</p>
                  <p className={cn("text-xs font-bold", late ? "text-destructive" : "text-muted-foreground")}>{row.estado === "recibido" ? (late ? `Vencida hace ${Math.floor(hours - HOURS_LIMIT)} h` : `Quedan ${Math.max(Math.ceil(HOURS_LIMIT - hours), 0)} h`) : row.estado === "resuelto" ? "Resuelta" : "Rechazada"}</p>
                </div>
                <p className="mt-1 text-sm">{row.nombre} · <a className="underline" href={`mailto:${row.email}`}>{row.email}</a>{row.telefono ? ` · ${row.telefono}` : ""}</p>
                {row.pedido_ref && <p className="text-sm text-muted-foreground">Pedido: {row.pedido_ref}</p>}
                {row.motivo && <p className="mt-2 rounded-xl bg-muted p-3 text-sm">{row.motivo}</p>}
                {row.estado === "recibido" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input aria-label={`Qué se resolvió en ${row.codigo}`} placeholder="Qué se resolvió (queda registrado)" maxLength={1000} value={notes[row.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} className="min-w-52 flex-1 rounded-full" />
                    <Button size="sm" className="rounded-full" disabled={busy === row.id} onClick={() => resolve(row, "resuelto")}>Resuelta</Button>
                    <Button size="sm" variant="outline" className="rounded-full" disabled={busy === row.id} onClick={() => resolve(row, "rechazado")}>Rechazar</Button>
                  </div>
                ) : row.resolucion && <p className="mt-2 text-sm text-muted-foreground">Resolución: {row.resolucion}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
