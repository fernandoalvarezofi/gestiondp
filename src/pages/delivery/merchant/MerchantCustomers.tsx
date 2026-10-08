import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { ListRow, Metric, MetricStrip, PageIntro, RowList, Section, StatusPill } from "@/components/panel/kit";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

type Resumen = {
  dias: number; clientes: number; recurrentes: number; nuevos: number; gasto_promedio: number;
  lista: { nombre: string; pedidos: number; gastado: number; ultimo: string; nuevo: boolean }[];
};
const RANGOS = [30, 90, 365] as const;

/**
 * Clientes del comercio: cuántos compran, cuántos vuelven y quiénes compran más.
 * Por privacidad se ve solo el nombre de pila y la inicial (lo mismo que en cada pedido), sin teléfonos ni emails;
 * para escribirles en conjunto están las Campañas.
 */
export default function MerchantCustomers() {
  const { store } = useMerchant();
  const [dias, setDias] = useState<(typeof RANGOS)[number]>(90);
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null); setError(null);
    db.rpc("delivery_comercio_clientes", { p_comercio: store.id, p_dias: dias }).then(({ data: res, error: err }: { data: Resumen | null; error: unknown }) => {
      if (!active) return;
      if (err) setError(errorMessage(err)); else setData(res);
    });
    return () => { active = false; };
  }, [store.id, dias]);

  const recurrencia = data && data.clientes ? Math.round((data.recurrentes / data.clientes) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageIntro title="Clientes" description="Quiénes te compran, cuántos vuelven y quiénes son tus mejores clientes."
        actions={
          <div className="flex gap-1 rounded-full border bg-card p-1" role="group" aria-label="Período">
            {RANGOS.map((r) => (
              <button key={r} type="button" onClick={() => setDias(r)} aria-pressed={dias === r} className={cn("rounded-full px-3 py-1 text-xs font-bold", dias === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{r === 365 ? "1 año" : `${r} días`}</button>
            ))}
          </div>
        } />
      {error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
      {!data && !error && <div className="h-28 animate-pulse rounded-3xl bg-muted" />}
      {data && (data.clientes === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Todavía no tenés clientes en este período" text="Cuando te hagan pedidos vas a ver acá quiénes vuelven a comprar." />
      ) : (
        <>
          <MetricStrip cols={4}>
            <Metric label="Clientes" value={data.clientes} hint={`Compraron en ${data.dias === 365 ? "el último año" : `${data.dias} días`}`} />
            <Metric label="Vuelven a comprar" value={`${recurrencia}%`} hint={`${data.recurrentes} con 2 pedidos o más`} />
            <Metric label="Nuevos" value={data.nuevos} hint="Primer pedido en el período" />
            <Metric label="Gasto promedio" value={money(data.gasto_promedio)} hint="Por cliente en el período" />
          </MetricStrip>
          <Section title="Tus mejores clientes" description="Ordenados por cantidad de pedidos">
            <RowList>
              {data.lista.map((cliente, index) => (
                <ListRow key={`${cliente.nombre}-${index}`}
                  lead={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">{cliente.nombre.slice(0, 1).toUpperCase()}</span>}
                  title={<span className="flex items-center gap-2">{cliente.nombre}{cliente.nuevo && <StatusPill tone="brand">Nuevo</StatusPill>}</span>}
                  meta={`${cliente.pedidos} ${cliente.pedidos === 1 ? "pedido" : "pedidos"} · último ${formatDateTime(cliente.ultimo)}`}
                  trailing={<span className="font-extrabold tabular-nums">{money(cliente.gastado)}</span>} />
              ))}
            </RowList>
          </Section>
          <p className="text-xs text-muted-foreground">Por privacidad solo mostramos el nombre y la inicial del apellido. Para escribirles a todos juntos usá <span className="font-bold">Marketing → Campañas</span>.</p>
        </>
      ))}
    </div>
  );
}
