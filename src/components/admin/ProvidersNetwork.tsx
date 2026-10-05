import { useCallback, useEffect, useState } from "react";
import { Bike, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { fetchRed, RedProveedores } from "@/services/dispatch";

const PERIODOS = [7, 30, 90] as const;

/** La red de repartidores y conductores: quién está conectado, quién trabaja y cómo le va (de los últimos días). */
export function ProvidersNetwork() {
  const [dias, setDias] = useState<number>(30);
  const [data, setData] = useState<RedProveedores | null>(null);
  const load = useCallback(async () => { try { setData(await fetchRed(dias)); } catch (error) { toast.error(errorMessage(error)); } }, [dias]);
  useEffect(() => { setData(null); load(); }, [load]);

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const kpi = (titulo: string, valor: number) => <div className="rounded-2xl border bg-card p-3"><span className="block text-xs font-bold text-muted-foreground">{titulo}</span><span className="font-display text-2xl font-black tabular-nums">{valor}</span></div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">{kpi("Activos", data.resumen.total)}{kpi("Conectados ahora", data.resumen.conectados)}{kpi("En revisión", data.resumen.en_revision)}</div>
      <div role="group" aria-label="Período" className="flex gap-2">
        {PERIODOS.map((d) => <button key={d} type="button" aria-pressed={dias === d} onClick={() => setDias(d)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", dias === d ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>Últimos {d} días</button>)}
      </div>
      {data.items.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no hay repartidores ni conductores activos.</p> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">Proveedor</th><th className="p-3">Estado</th><th className="p-3 text-right">Completados</th><th className="p-3 text-right">Cancelados</th><th className="p-3 text-right">Tiempo prom.</th><th className="p-3 text-right">Aceptación</th><th className="p-3 text-right">Ganancia</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.proveedor_id} className="border-b last:border-0">
                  <td className="p-3"><span className="flex items-center gap-2 font-bold">{p.conductor_remis ? <Car className="h-4 w-4 text-muted-foreground" /> : <Bike className="h-4 w-4 text-muted-foreground" />}{p.nombre}</span><span className="block text-xs text-muted-foreground">{p.vehiculo ?? "—"}{p.conductor_remis && " · también remís"}</span></td>
                  <td className="p-3">
                    {!p.verificado ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">En revisión</span>
                      : p.ocupado ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">En reparto</span>
                      : p.conectado ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Conectado</span>
                      : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Desconectado</span>}
                    {p.ubicacion_hace_min != null && p.conectado && <span className="ml-2 text-xs text-muted-foreground">ubicación hace {p.ubicacion_hace_min} min</span>}
                  </td>
                  <td className="p-3 text-right font-bold tabular-nums">{p.completados}</td>
                  <td className="p-3 text-right tabular-nums">{p.cancelados}</td>
                  <td className="p-3 text-right tabular-nums">{p.minutos_promedio != null ? `${p.minutos_promedio} min` : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{p.aceptacion_pct != null ? `${p.aceptacion_pct}%` : "—"}</td>
                  <td className="p-3 text-right font-bold tabular-nums">{money(p.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
