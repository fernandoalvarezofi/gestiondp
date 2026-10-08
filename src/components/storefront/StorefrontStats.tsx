import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { db } from "@/lib/delivery";

type Day = { dia: string; visitas: number };

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/** Visitas de los últimos 30 días a la tienda online (contador anónimo: no guarda quién entra). */
export function StorefrontStats({ storeId }: { storeId: string }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setDays(null);
    setFailed(false);
    db.rpc("delivery_tienda_estadisticas", { p_comercio: storeId }).then(({ data, error }: { data: Day[] | null; error: unknown }) => {
      if (!alive) return;
      if (error || !data) setFailed(true); else setDays(data);
    });
    return () => { alive = false; };
  }, [storeId]);

  if (failed) return <p className="text-sm text-muted-foreground">No pudimos cargar las visitas ahora. Probá de nuevo en un rato.</p>;
  if (!days) return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;

  const today = days[days.length - 1]?.visitas ?? 0;
  const week = days.slice(-7).reduce((total, day) => total + day.visitas, 0);
  const month = days.reduce((total, day) => total + day.visitas, 0);
  const max = Math.max(1, ...days.map((day) => day.visitas));

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {[["Hoy", today], ["7 días", week], ["30 días", month]].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-l-4 border-l-brand-yellow bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-extrabold tabular-nums">{(value as number).toLocaleString("es-AR")}</p>
          </div>
        ))}
      </div>
      {month === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" />Todavía no hubo visitas. Compartí el enlace o imprimí el cartel con el QR.</p>
      ) : (
        <svg viewBox={`0 0 ${days.length * 10} 60`} className="mt-4 h-24 w-full" role="img" aria-label="Visitas por día en los últimos 30 días" preserveAspectRatio="none">
          {days.map((day, index) => {
            const height = Math.max(1.5, (day.visitas / max) * 56);
            return <rect key={day.dia} x={index * 10 + 1} y={58 - height} width={8} height={height} rx={1.5} className={index === days.length - 1 ? "fill-brand-yellow" : "fill-foreground/70"}><title>{`${dayLabel(day.dia)}: ${day.visitas} ${day.visitas === 1 ? "visita" : "visitas"}`}</title></rect>;
          })}
        </svg>
      )}
    </div>
  );
}
