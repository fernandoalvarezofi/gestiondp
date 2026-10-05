import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AgendaTab } from "@/components/merchant/bookings/AgendaTab";
import { ServicesTab } from "@/components/merchant/bookings/ServicesTab";
import { TeamTab } from "@/components/merchant/bookings/TeamTab";
import { db } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Profesional, Servicio } from "@/services/bookings";
import { useMerchant } from "./context";

type Tab = "agenda" | "servicios" | "equipo";

/** Turnos y servicios del local: agenda del día, catálogo de servicios y equipo con sus horarios. */
export default function MerchantBookings() {
  const { store, access } = useMerchant();
  const puedeConfigurar = access.permisos.includes("ajustes");
  const [tab, setTab] = useState<Tab>("agenda");
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [profesionales, setProfesionales] = useState<(Profesional & { servicios: string[] })[]>([]);

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }, { data: ps }] = await Promise.all([
      db.from("servicios").select("*").eq("comercio_id", store.id).order("orden").order("nombre"),
      db.from("profesionales").select("*").eq("comercio_id", store.id).order("nombre"),
      db.from("profesional_servicios").select("profesional_id, servicio_id"),
    ]);
    const rel = (ps ?? []) as { profesional_id: string; servicio_id: string }[];
    setServicios((s ?? []) as Servicio[]);
    setProfesionales(((p ?? []) as Profesional[]).map((x) => ({ ...x, servicios: rel.filter((r) => r.profesional_id === x.id).map((r) => r.servicio_id) })));
  }, [store.id]);
  useEffect(() => { setServicios(null); load(); }, [load]);

  const tabs: [Tab, string][] = [["agenda", "Agenda"], ...(puedeConfigurar ? ([["servicios", "Servicios"], ["equipo", "Equipo"]] as [Tab, string][]) : [])];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><CalendarCheck className="h-6 w-6 text-primary" />Turnos y servicios</h1>
          <p className="text-sm text-muted-foreground">Tus clientes reservan en línea y vos ves todo en la agenda.</p>
        </div>
        <Link to={`/t/${store.slug}/reservar`} target="_blank" className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold hover:bg-muted">Ver página de reservas<ExternalLink className="h-4 w-4" /></Link>
      </div>
      <div role="tablist" aria-label="Sección" className="flex gap-2">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-9 rounded-full border px-4 text-sm font-bold", tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}</button>)}
      </div>
      {!servicios ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : tab === "agenda" ? <AgendaTab storeId={store.id} profesionales={profesionales} />
        : tab === "servicios" ? <ServicesTab storeId={store.id} servicios={servicios} onChange={load} />
        : <TeamTab storeId={store.id} servicios={servicios} profesionales={profesionales} onChange={load} />}
    </div>
  );
}
