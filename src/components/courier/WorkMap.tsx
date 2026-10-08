import { useEffect, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { MapView } from "@/components/maps/LazyMaps";
import type { MapMarker } from "@/components/maps/DeliveryMap";
import { db } from "@/lib/delivery";
import type { GeoPoint } from "@/lib/geo";

export type WorkMarker = MapMarker;

/** Demanda en este momento: pedidos esperando repartidor y repartidores libres (dato que ya usa la tarifa dinámica). */
export function DemandStrip() {
  const [demanda, setDemanda] = useState<{ pendientes: number; repartidores_libres: number; recargo: number } | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => db.rpc("delivery_demanda_actual").then(({ data }: { data: typeof demanda }) => { if (active && data) setDemanda(data); });
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!demanda) return null;
  const alta = demanda.pendientes > demanda.repartidores_libres;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-2xl border bg-card p-3"><p className="text-xl font-black tabular-nums">{demanda.pendientes}</p><p className="text-[11px] font-bold text-muted-foreground">pedidos esperando</p></div>
      <div className="rounded-2xl border bg-card p-3"><p className="text-xl font-black tabular-nums">{demanda.repartidores_libres}</p><p className="text-[11px] font-bold text-muted-foreground">repartidores libres</p></div>
      <div className={alta ? "rounded-2xl border border-brand-yellow bg-brand-yellow/20 p-3" : "rounded-2xl border bg-card p-3"}>
        <p className="text-xl font-black tabular-nums">{demanda.recargo > 0 ? `+${Math.round(demanda.recargo * 100)}%` : "—"}</p>
        <p className="text-[11px] font-bold text-muted-foreground">{alta ? "demanda alta" : "recargo"}</p>
      </div>
    </div>
  );
}

/**
 * Mapa de trabajo del repartidor o conductor: su ubicación, el trabajo en curso y las ofertas con punto de retiro.
 * Usa la ubicación que ya se comparte al estar conectado (no pide permisos nuevos).
 */
export function WorkMap({ position, connected, markers, legend }: { position: GeoPoint | null; connected: boolean; markers: WorkMarker[]; legend: { color: string; label: string }[] }) {
  const all: WorkMarker[] = [...(position ? [{ ...position, kind: "courier" as const, label: "Vos" }] : []), ...markers];
  if (!all.length) {
    return (
      <EmptyState icon={<LocateFixed className="h-7 w-7" />} title={connected ? "Buscando tu ubicación…" : "Conectate para ver tu mapa"}
        text={connected ? "Si no aparece, habilitá la ubicación desde el candado de la barra de direcciones." : "Al conectarte vas a ver dónde estás, tu trabajo en curso y las ofertas cerca tuyo."} />
    );
  }
  return (
    <div className="space-y-2">
      <MapView markers={all} className="h-[58vh] min-h-[320px] border" />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground" aria-label="Referencias del mapa">
        {legend.map((item) => <li key={item.label} className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" style={{ color: item.color }} aria-hidden />{item.label}</li>)}
      </ul>
    </div>
  );
}
