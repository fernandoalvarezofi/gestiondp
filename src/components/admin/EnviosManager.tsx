import { useCallback, useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { Envio, envioActivo, EnvioEstado, envioEstadoLabel, tamanoLabel } from "@/lib/envios";
import { cn } from "@/lib/utils";

type Row = Envio & { cliente?: { nombre: string } | null; repartidor?: { nombre: string } | null };

/** Envíos de paquetes de todos los clientes: seguimiento y cancelación por soporte. */
export function EnviosManager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"activos" | "todos" | EnvioEstado>("activos");

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_envios").select("*, cliente:perfiles!delivery_envios_cliente_perfil_fkey(nombre)").order("created_at", { ascending: false }).limit(200);
    setRows(data || []);
  }, []);
  useEffect(() => {
    load();
    const channel = db.channel("admin-envios").on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios" }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [load]);

  const cancel = async (envio: Row) => {
    const motivo = window.prompt("Motivo de la cancelación (lo verá el cliente)", "Cancelado por soporte");
    if (motivo === null) return;
    const { error } = await db.rpc("delivery_cancelar_envio", { p_id: envio.id, p_motivo: motivo });
    if (error) return toast.error(errorMessage(error));
    toast.success("Envío cancelado");
    load();
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const today = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.created_at).toDateString() === today && row.estado !== "cancelado");
  const visible = rows.filter((row) => filter === "todos" || (filter === "activos" ? envioActivo(row.estado) : row.estado === filter));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Envíos hoy" value={todayRows.length} icon={<Package className="h-4 w-4" />} />
        <StatCard label="En curso" value={rows.filter((row) => envioActivo(row.estado)).length} />
        <StatCard label="Sin repartidor" value={rows.filter((row) => row.estado === "buscando").length} hint="Buscando" />
        <StatCard label="Facturado hoy" value={money(todayRows.reduce((total, row) => total + Number(row.total), 0))} />
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {(["activos", "todos", "buscando", "asignado", "retirado", "entregado", "cancelado"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{value === "activos" ? "En curso" : value === "todos" ? "Todos" : envioEstadoLabel[value]}</button>
        ))}
      </div>
      {visible.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No hay envíos con este filtro" /> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Envío</th><th className="p-3">Cliente</th><th className="p-3">Recorrido</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y">
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="p-3"><span className="font-bold">{shortId(row.id)}</span><span className="block text-xs text-muted-foreground">{formatDateTime(row.created_at)} · {tamanoLabel[row.tamano]}</span></td>
                  <td className="p-3">{row.cliente?.nombre || "—"}</td>
                  <td className="p-3"><span className="block max-w-[260px] truncate">{row.origen_direccion}</span><span className="block max-w-[260px] truncate text-muted-foreground">→ {row.destino_direccion}</span><span className="text-xs text-muted-foreground">{Number(row.distancia_km).toFixed(1)} km · {row.descripcion}</span></td>
                  <td className="p-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", row.estado === "entregado" ? "bg-success/10 text-success" : row.estado === "cancelado" ? "bg-destructive/10 text-destructive" : "bg-warning/20")}>{envioEstadoLabel[row.estado]}</span>{row.repartidor_id && <span className="block text-[11px] text-muted-foreground">con repartidor</span>}</td>
                  <td className="p-3 text-right font-bold">{money(row.total)}</td>
                  <td className="p-3 text-right">{envioActivo(row.estado) && <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => cancel(row)}>Cancelar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
