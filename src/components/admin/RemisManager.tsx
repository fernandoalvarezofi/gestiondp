import { useCallback, useEffect, useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { DocumentViewer } from "@/components/verification/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { CATEGORIAS, categoriaLabel, Viaje, viajeActivo, viajeEstadoLabel } from "@/lib/remis";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/ui/dialogos";

type Driver = { remis_categorias: string[] | null; perfil_id: string; patente: string | null; telefono: string | null; remis_estado: "solicitado" | "aprobado" | "rechazado"; remis_motivo: string | null; acepta_remis: boolean; perfil: { nombre: string | null } | null };
const stateLabel = { solicitado: "Por revisar", aprobado: "Habilitado", rechazado: "Rechazado" } as const;

/** Remises: alta de conductores (con su licencia y cédula) y seguimiento de los viajes. */
/** Conductores de remís y viajes. Con `view`, muestra solo esa parte (administración tiene una sección para cada una). */
export function RemisManager({ view }: { view?: "conductores" | "viajes" } = {}) {
  const [ownTab, setTab] = useState<"conductores" | "viajes">("conductores");
  const tab = view ?? ownTab;
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [trips, setTrips] = useState<Viaje[] | null>(null);
  const [docsOf, setDocsOf] = useState<Driver | null>(null);
  const [rejecting, setRejecting] = useState<Driver | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const setCategories = async (driver: Driver, categoria: string, on: boolean) => {
    const actuales = driver.remis_categorias ?? ["estandar"];
    const next = on ? [...new Set([...actuales, categoria])] : actuales.filter((c) => c !== categoria);
    if (next.length === 0) return toast.error("Tiene que quedar al menos una categoría");
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_remis_categorias", { p_perfil: driver.perfil_id, p_categorias: next });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Categorías actualizadas");
    load();
  };

  const load = useCallback(async () => {
    const [{ data: list }, { data: viajes }] = await Promise.all([
      db.from("delivery_repartidores").select("perfil_id, remis_categorias, patente, telefono, remis_estado, remis_motivo, acepta_remis, perfil:perfiles(nombre)").not("remis_estado", "is", null),
      db.from("delivery_viajes").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setDrivers((list || []) as unknown as Driver[]);
    setTrips((viajes || []) as Viaje[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (driver: Driver, ok: boolean, motive?: string) => {
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_remis_revisar", { p_perfil: driver.perfil_id, p_ok: ok, p_motivo: motive ?? null });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return false; }
    toast.success(ok ? "Conductor habilitado" : "Habilitación rechazada");
    load();
    return true;
  };
  const cancelTrip = async (trip: Viaje) => {
    if (!(await confirmar({ titulo: "¿Cancelar este viaje por soporte?", descripcion: "Se les avisa al pasajero y al conductor. No se puede deshacer.", confirmar: "Cancelar viaje", cancelar: "Volver", peligro: true }))) return;
    const { error } = await db.rpc("delivery_cancelar_viaje", { p_id: trip.id, p_motivo: "Cancelado por soporte" });
    if (error) return toast.error(errorMessage(error));
    toast.success("Viaje cancelado");
    load();
  };

  if (!drivers || !trips) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const sorted = [...drivers].sort((a, b) => Number(b.remis_estado === "solicitado") - Number(a.remis_estado === "solicitado"));

  return (
    <div className="space-y-4">
      {!view && (
        <div className="flex gap-2" role="tablist">
          {([["conductores", `Conductores (${drivers.length})`], ["viajes", `Viajes (${trips.length})`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">Las tarifas, el recargo nocturno, la comisión y el radio se editan en Configuración → ajustes de remís.</p>

      {tab === "conductores" && (sorted.length === 0 ? <EmptyState icon={<Car className="h-7 w-7" />} title="Todavía nadie pidió ser conductor de remís" text="Las personas con auto lo piden desde el panel de Conductor, con licencia y cédula." /> : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {sorted.map((driver) => (
            <li key={driver.perfil_id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{driver.perfil?.nombre || "Conductor"}</p>
                <p className="text-xs text-muted-foreground">Patente {driver.patente || "—"} · {driver.telefono || "sin teléfono"}{driver.acepta_remis ? " · recibiendo viajes" : ""}</p>
                {driver.remis_estado === "rechazado" && <p className="text-xs text-destructive">{driver.remis_motivo}</p>}
                {driver.remis_estado === "aprobado" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Categorías habilitadas">
                    {CATEGORIAS.map((c) => {
                      const on = (driver.remis_categorias ?? ["estandar"]).includes(c.id);
                      return <button key={c.id} type="button" aria-pressed={on} disabled={saving} onClick={() => setCategories(driver, c.id, !on)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold", on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{c.label}</button>;
                    })}
                  </div>
                )}
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", driver.remis_estado === "aprobado" ? "bg-success/10 text-success" : driver.remis_estado === "solicitado" ? "bg-warning/20" : "bg-destructive/10 text-destructive")}>{stateLabel[driver.remis_estado]}</span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDocsOf(driver)}>Documentos</Button>
              {driver.remis_estado === "solicitado" && <Button size="sm" className="rounded-full" disabled={saving} onClick={() => review(driver, true)}>Habilitar</Button>}
              {driver.remis_estado !== "rechazado" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setRejecting(driver); setReason(""); }}>{driver.remis_estado === "aprobado" ? "Revocar" : "Rechazar"}</Button>}
            </li>
          ))}
        </ul>
      ))}

      {tab === "viajes" && (trips.length === 0 ? <EmptyState icon={<Car className="h-7 w-7" />} title="Todavía no hay viajes" /> : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {trips.map((trip) => (
            <li key={trip.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{trip.origen_direccion} → {trip.destino_direccion}</p>
                <p className="text-xs text-muted-foreground">{shortId(trip.id)} · {formatDateTime(trip.created_at)} · {Number(trip.distancia_km).toFixed(1)} km · {trip.pasajeros} pas.{trip.categoria && trip.categoria !== "estandar" ? ` · ${categoriaLabel(trip.categoria)}` : ""}{trip.calificacion ? ` · ★ ${trip.calificacion}` : ""}</p>
              </div>
              <span className="font-extrabold tabular-nums">{money(trip.total)}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", trip.estado === "completado" ? "bg-success/10 text-success" : trip.estado === "cancelado" ? "bg-destructive/10 text-destructive" : "bg-warning/20")}>{viajeEstadoLabel[trip.estado]}</span>
              {viajeActivo(trip.estado) && <Button size="sm" variant="outline" className="rounded-full" onClick={() => cancelTrip(trip)}>Cancelar</Button>}
            </li>
          ))}
        </ul>
      ))}

      <Dialog open={Boolean(docsOf)} onOpenChange={(open) => !open && setDocsOf(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Documentos de {docsOf?.perfil?.nombre || "conductor"}</DialogTitle>
          <DialogDescription>Verificá que la licencia sea profesional y esté vigente, y que la cédula corresponda al auto (patente {docsOf?.patente || "—"}).</DialogDescription>
          {docsOf && <DocumentViewer entidad="repartidor" entidadId={docsOf.perfil_id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && !saving && setRejecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-xl font-black">{rejecting?.remis_estado === "aprobado" ? "Revocar habilitación" : "Rechazar habilitación"}</DialogTitle>
          <DialogDescription>El conductor ve este motivo y puede corregir su documentación.</DialogDescription>
          <Textarea value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: la licencia no es profesional" className="min-h-[88px] resize-none" aria-label="Motivo" />
          <Button variant="destructive" className="rounded-full" disabled={saving || reason.trim().length < 5} onClick={async () => { if (rejecting && (await review(rejecting, false, reason.trim()))) setRejecting(null); }}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
