import { useEffect, useMemo, useState } from "react";
import { adminDb } from "@/lib/adminClient";

type Fila = { dia: string; clave: string; valor: number };

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const entero = (n: number) => Math.round(n).toLocaleString("es-AR");
const diaCorto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

/** Suma de una métrica en una lista de días. */
export function sumar(filas: Fila[], clave: string, dias: Set<string>): number {
  return filas.filter((f) => f.clave === clave && dias.has(f.dia)).reduce((total, f) => total + Number(f.valor), 0);
}

/** Último valor conocido de un indicador "de estado" (comercios activos, pendientes…). */
export function ultimo(filas: Fila[], clave: string): number | null {
  const lista = filas.filter((f) => f.clave === clave).sort((a, b) => a.dia.localeCompare(b.dia));
  return lista.length ? Number(lista[lista.length - 1].valor) : null;
}

/** Tablero de negocio del dueño: números agregados (sin datos personales) que envía la base de la plataforma. */
export function BusinessMetrics() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rango, setRango] = useState<7 | 30>(7);

  useEffect(() => {
    adminDb.rpc("metricas", { p_dias: 30 }).then(({ data, error: e }) => {
      if (e) { setError(e.message); return; }
      setFilas(((data as Fila[]) || []).map((f) => ({ ...f, valor: Number(f.valor) })));
    });
  }, []);

  const dias = useMemo(() => {
    const lista: string[] = [];
    for (let i = rango - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      lista.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    }
    return lista;
  }, [rango]);

  if (error) return <p className="rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive">No se pudieron cargar las métricas: {error}</p>;
  if (!filas) return <div className="h-40 animate-pulse rounded-3xl bg-card" />;

  const set = new Set(dias);
  const pedidos = sumar(filas, "pedidos", set);
  const entregados = sumar(filas, "pedidos_entregados", set);
  const cancelados = sumar(filas, "pedidos_cancelados", set);
  const ventas = sumar(filas, "ventas", set);
  const comision = sumar(filas, "comision", set);
  const servicio = sumar(filas, "ingresos_servicio", set);
  const tasaCancel = pedidos > 0 ? Math.round((cancelados / pedidos) * 100) : 0;
  const ticket = entregados > 0 ? ventas / entregados : 0;

  const tarjetas = [
    { titulo: "Pedidos", valor: entero(pedidos), nota: `${entero(entregados)} entregados · ${tasaCancel}% cancelados` },
    { titulo: "Ventas de los comercios", valor: ars(ventas), nota: entregados > 0 ? `Ticket promedio ${ars(ticket)}` : "Sin pedidos entregados" },
    { titulo: "Tu comisión", valor: ars(comision), nota: `+ ${ars(servicio)} de tarifa de servicio` },
    { titulo: "Usuarios nuevos", valor: entero(sumar(filas, "usuarios_nuevos", set)), nota: `${entero(sumar(filas, "comercios_nuevos", set))} comercios nuevos` },
  ];
  const estado = [
    { titulo: "Comercios activos", valor: ultimo(filas, "comercios_activos") },
    { titulo: "Esperando aprobación", valor: ultimo(filas, "comercios_pendientes"), alerta: true },
    { titulo: "Repartidores activos", valor: ultimo(filas, "repartidores_activos") },
  ];
  const porDia = dias.map((dia) => ({ dia, pedidos: sumar(filas, "pedidos", new Set([dia])), ventas: sumar(filas, "ventas", new Set([dia])) }));
  const maxVentas = Math.max(1, ...porDia.map((d) => d.ventas));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Números agregados, sin datos personales. Se actualizan cada hora.</p>
        <div className="flex rounded-full border p-0.5 text-sm font-bold" role="group" aria-label="Período">
          {([7, 30] as const).map((n) => (
            <button key={n} type="button" aria-pressed={rango === n} onClick={() => setRango(n)} className={`rounded-full px-3 py-1 ${rango === n ? "bg-foreground text-background" : "text-muted-foreground"}`}>{n} días</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-3xl border border-l-4 border-l-brand-orange bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground">{t.titulo}</p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums">{t.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.nota}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {estado.map((t) => (
          <div key={t.titulo} className="rounded-3xl border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground">{t.titulo}</p>
            <p className={`mt-1 font-display text-3xl font-black tabular-nums ${t.alerta && (t.valor ?? 0) > 0 ? "text-destructive" : ""}`}>{t.valor == null ? "—" : entero(t.valor)}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Ventas por día</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label="Ventas por día">
          {porDia.map((d) => (
            <div key={d.dia} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${diaCorto(d.dia)}: ${ars(d.ventas)} · ${d.pedidos} pedidos`}>
              <div className="w-full rounded-t-md bg-brand-orange/80" style={{ height: `${Math.max(2, (d.ventas / maxVentas) * 100)}%` }} />
              {rango === 7 && <span className="text-[10px] font-semibold text-muted-foreground">{diaCorto(d.dia)}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
