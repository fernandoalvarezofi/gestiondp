import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { DIAS, fetchMetricas, hoyLocal, MetricasAgenda, ocupacion, sumarDias } from "@/services/bookings";

const RANGOS = [{ id: "7", texto: "Últimos 7 días", dias: 7 }, { id: "30", texto: "Últimos 30 días", dias: 30 }, { id: "90", texto: "Últimos 90 días", dias: 90 }, { id: "prox", texto: "Próximos 30 días", dias: -30 }];

/** Métricas reales de la agenda: ocupación, cancelaciones, ausencias, por servicio, por profesional, días y horas pico. */
export function MetricsTab({ storeId }: { storeId: string }) {
  const [rango, setRango] = useState("30");
  const [m, setM] = useState<MetricasAgenda | null>(null);
  useEffect(() => {
    const r = RANGOS.find((x) => x.id === rango) ?? RANGOS[1];
    const hoy = hoyLocal();
    const [desde, hasta] = r.dias > 0 ? [sumarDias(hoy, -(r.dias - 1)), hoy] : [hoy, sumarDias(hoy, -r.dias)];
    setM(null);
    fetchMetricas(storeId, desde, hasta).then(setM).catch((e) => { toast.error(errorMessage(e)); });
  }, [storeId, rango]);

  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
  const total = m?.total ?? 0;
  const maxDia = Math.max(1, ...(m?.por_dia_semana ?? []).map((d) => d.turnos));
  const maxHora = Math.max(1, ...(m?.por_hora ?? []).map((d) => d.turnos));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {RANGOS.map((r) => <button key={r.id} type="button" aria-pressed={rango === r.id} onClick={() => setRango(r.id)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", rango === r.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{r.texto}</button>)}
      </div>
      {!m ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : total === 0 ? (
        <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay turnos en este período. Las métricas se calculan con los turnos reales.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Ocupación", `${ocupacion(m.minutos_ocupados, m.minutos_disponibles)}%`, `${Math.round(m.minutos_ocupados / 60)} de ${Math.round(m.minutos_disponibles / 60)} h disponibles`],
              ["Turnos", String(total), `${m.online} online · ${m.panel} desde el panel`],
              ["Ingresos realizados", money(m.ingresos), `${money(m.ingresos_previstos)} por cobrar en turnos próximos`],
              ["Clientes", String(m.clientes_unicos), "personas distintas"],
              ["Cancelaciones", pct(m.por_estado.cancelado ?? 0, total), `${m.por_estado.cancelado ?? 0} turnos`],
              ["Ausencias", pct(m.por_estado.ausente ?? 0, total), `${money(m.perdido_ausencias)} sin cobrar`],
              ["Por confirmar", String(m.por_estado.pendiente ?? 0), "esperan tu respuesta"],
              ["Realizados", String(m.por_estado.completado ?? 0), pct(m.por_estado.completado ?? 0, total) + " del total"],
            ].map(([k, v, s]) => <div key={k} className="rounded-3xl border bg-card p-4"><dt className="text-xs font-bold text-muted-foreground">{k}</dt><dd className="mt-1 text-2xl font-black tabular-nums">{v}</dd><p className="mt-0.5 text-xs text-muted-foreground">{s}</p></div>)}
          </dl>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border bg-card p-5">
              <h3 className="font-extrabold">Por servicio</h3>
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-bold">Servicio</th><th className="pb-2 text-right font-bold">Turnos</th><th className="pb-2 text-right font-bold">Cancel.</th><th className="pb-2 text-right font-bold">Ingresos</th></tr></thead>
                <tbody className="divide-y">{m.por_servicio.map((s) => <tr key={s.servicio}><td className="py-2 font-semibold">{s.servicio}</td><td className="py-2 text-right tabular-nums">{s.turnos}</td><td className="py-2 text-right tabular-nums">{s.cancelados}</td><td className="py-2 text-right tabular-nums">{money(s.ingresos)}</td></tr>)}</tbody>
              </table>
            </section>
            <section className="rounded-3xl border bg-card p-5">
              <h3 className="font-extrabold">Carga de trabajo por profesional</h3>
              <ul className="mt-3 space-y-3">
                {m.por_profesional.map((p) => { const o = ocupacion(p.minutos_ocupados, p.minutos_disponibles); return (
                  <li key={p.profesional}>
                    <div className="flex justify-between text-sm"><span className="font-semibold">{p.profesional}</span><span className="tabular-nums text-muted-foreground">{p.turnos} turnos · {o}%</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${o}%` }} /></div>
                  </li>
                ); })}
              </ul>
            </section>
            <section className="rounded-3xl border bg-card p-5">
              <h3 className="font-extrabold">Días con más turnos</h3>
              <div className="mt-4 flex h-32 items-end gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => { const n = m.por_dia_semana.find((x) => x.dia === d)?.turnos ?? 0; return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1"><span className="text-[11px] tabular-nums text-muted-foreground">{n}</span><div className="w-full rounded-t-lg bg-primary/80" style={{ height: `${(n / maxDia) * 96}px` }} /><span className="text-[11px] font-bold">{DIAS[d].slice(0, 3)}</span></div>
                ); })}
              </div>
            </section>
            <section className="rounded-3xl border bg-card p-5">
              <h3 className="font-extrabold">Horarios más pedidos</h3>
              <div className="mt-4 flex h-32 items-end gap-1">
                {m.por_hora.map((h) => <div key={h.hora} className="flex flex-1 flex-col items-center gap-1" title={`${h.hora}:00 · ${h.turnos} turnos`}><div className="w-full rounded-t bg-brand-yellow" style={{ height: `${(h.turnos / maxHora) * 96}px` }} /><span className="text-[10px] tabular-nums">{h.hora}</span></div>)}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
