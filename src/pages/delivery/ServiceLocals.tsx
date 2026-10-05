import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Clock3, MapPin } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { db, money } from "@/lib/delivery";
import { duracionTexto } from "@/services/bookings";

type Local = { id: string; slug: string; nombre: string; logo_url: string | null; direccion: string | null; total: number; desde_precio: number | null; servicios: { id: string; nombre: string; duracion_min: number; precio: number }[] };

/** Locales de la ciudad que ofrecen turnos en línea: peluquerías, consultorios, talleres, etc. */
export default function ServiceLocals() {
  const [locales, setLocales] = useState<Local[] | null>(null);
  useEffect(() => { db.rpc("locales_con_servicios", { p_limite: 60 }).then(({ data }: { data: Local[] | null }) => setLocales(data ?? [])); }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Reservas" title="Reservá un turno" subtitle="Locales con turnos en línea: elegís servicio, día y hora." actions={<Button asChild variant="outline" className="rounded-full"><Link to="/app/turnos">Mis turnos</Link></Button>} />
      {!locales ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />)}</div>
        : locales.length === 0 ? <EmptyState className="mt-6" icon={<CalendarCheck className="h-7 w-7" />} title="Todavía no hay locales con turnos" text="Pronto vas a poder reservar acá." />
        : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {locales.map((l) => (
              <li key={l.id} className="rounded-3xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  {l.logo_url ? <img src={l.logo_url} alt="" className="h-12 w-12 rounded-2xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted font-black">{l.nombre.slice(0, 2).toUpperCase()}</span>}
                  <div className="min-w-0"><p className="truncate text-lg font-extrabold">{l.nombre}</p>{l.direccion && <p className="truncate text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />{l.direccion}</p>}</div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {l.servicios.map((s) => <li key={s.id} className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{s.nombre}</span><span className="shrink-0 text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{duracionTexto(s.duracion_min)}{s.precio > 0 && ` · ${money(s.precio)}`}</span></li>)}
                  {l.total > l.servicios.length && <li className="text-xs text-muted-foreground">y {l.total - l.servicios.length} más</li>}
                </ul>
                <Button asChild className="mt-4 w-full rounded-full"><Link to={`/t/${l.slug}/reservar`}>Reservar turno</Link></Button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
