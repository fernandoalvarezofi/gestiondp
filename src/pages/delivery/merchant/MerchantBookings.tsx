import { ReactNode, useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router-dom";
import { BarChart3, CalendarDays, CalendarOff, Copy, ExternalLink, Globe, LayoutDashboard, Loader2, Scissors, UsersRound, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/delivery/Common";
import { PageIntro } from "@/components/panel/kit";
import { Button } from "@/components/ui/button";
import { AgendaSettingsTab } from "@/components/merchant/bookings/AgendaSettingsTab";
import { AgendaTab } from "@/components/merchant/bookings/AgendaTab";
import { EsperaPanel } from "@/components/merchant/bookings/EsperaPanel";
import { HoyPanel } from "@/components/merchant/bookings/HoyPanel";
import { MetricsTab } from "@/components/merchant/bookings/MetricsTab";
import { ServicesTab } from "@/components/merchant/bookings/ServicesTab";
import { TeamTab } from "@/components/merchant/bookings/TeamTab";
import { db, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Cierre, duracionTexto, hoyLocal, MODALIDAD, Profesional, Recurso, Servicio, sumarDias, Tramo } from "@/services/bookings";
import { useMerchant } from "./context";

type Seccion = "hoy" | "calendario" | "espera" | "metricas" | "servicios" | "equipo" | "ajustes" | "publica";
type Item = { id: Seccion; texto: string; icono: ReactNode; ayuda: string; config?: boolean };
const BASE = "/app/comercio/turnos";
const SECCIONES: Item[] = [
  { id: "hoy", texto: "Hoy", icono: <LayoutDashboard className="h-4 w-4" />, ayuda: "Lo que pasa ahora, lo que hay que confirmar y lo que falta cerrar." },
  { id: "calendario", texto: "Calendario", icono: <CalendarDays className="h-4 w-4" />, ayuda: "Día por profesional, semana, mes o lista. Tocá un hueco para agendar." },
  { id: "espera", texto: "Lista de espera", icono: <UsersRound className="h-4 w-4" />, ayuda: "Quién quiere un lugar en días llenos." },
  { id: "metricas", texto: "Métricas", icono: <BarChart3 className="h-4 w-4" />, ayuda: "Ocupación, ausencias, cancelaciones y horas pico." },
  { id: "servicios", texto: "Servicios", icono: <Scissors className="h-4 w-4" />, ayuda: "Qué se reserva: duración, precio, seña, cancelación y cómo ocupa la agenda.", config: true },
  { id: "equipo", texto: "Equipo y horarios", icono: <UserRoundCog className="h-4 w-4" />, ayuda: "Quién atiende, qué hace, sus horarios, descansos y vacaciones.", config: true },
  { id: "ajustes", texto: "Salas, feriados y avisos", icono: <CalendarOff className="h-4 w-4" />, ayuda: "Recursos compartidos, días cerrados y reglas de recordatorios y reprogramación.", config: true },
  { id: "publica", texto: "Página de reservas", icono: <Globe className="h-4 w-4" />, ayuda: "Cómo ven tus clientes la reserva online.", config: true },
];

/** Agenda del local organizada como un centro de operaciones: secciones de trabajo diario y de configuración, cada una con su dirección. */
export default function MerchantBookings() {
  const { store, access } = useMerchant();
  const { seccion = "hoy" } = useParams<{ seccion?: Seccion }>();
  const puedeConfigurar = access.permisos.includes("ajustes");
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [profesionales, setProfesionales] = useState<(Profesional & { servicios: string[] })[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [horarios, setHorarios] = useState<Record<string, Tramo[]>>({});
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [fallo, setFallo] = useState(false);

  const load = useCallback(async () => {
    const [s, p, ps, r, c] = await Promise.all([
      db.from("servicios").select("*").eq("comercio_id", store.id).is("eliminado_at", null).order("orden").order("nombre"),
      db.from("profesionales").select("*").eq("comercio_id", store.id).is("eliminado_at", null).order("nombre"),
      db.from("profesional_servicios").select("profesional_id, servicio_id"),
      db.from("recursos").select("*").eq("comercio_id", store.id).order("orden").order("nombre"),
      db.from("agenda_cierres").select("*").eq("comercio_id", store.id).gte("hasta", sumarDias(hoyLocal(), -120)).order("desde"),
    ]);
    if (s.error || p.error) { setFallo(true); return; }
    const profs = (p.data ?? []) as Profesional[];
    const rel = (ps.data ?? []) as { profesional_id: string; servicio_id: string }[];
    const { data: disp } = profs.length ? await db.from("disponibilidad").select("profesional_id, dia_semana, desde, hasta").in("profesional_id", profs.map((x) => x.id)) : { data: [] };
    const porProf: Record<string, Tramo[]> = {};
    ((disp ?? []) as (Tramo & { profesional_id: string })[]).forEach((t) => { (porProf[t.profesional_id] ??= []).push(t); });
    setServicios((s.data ?? []) as Servicio[]);
    setRecursos((r.data ?? []) as Recurso[]);
    setCierres((c.data ?? []) as Cierre[]);
    setHorarios(porProf);
    setProfesionales(profs.map((x) => ({ ...x, servicios: rel.filter((v) => v.profesional_id === x.id).map((v) => v.servicio_id) })));
    setFallo(false);
  }, [store.id]);
  useEffect(() => { setServicios(null); load(); }, [load]);

  const visibles = SECCIONES.filter((x) => !x.config || puedeConfigurar);
  const actual = visibles.find((x) => x.id === seccion);
  if (!actual) return <Navigate to={BASE} replace />;

  const enlace = (x: Item) => (
    <NavLink key={x.id} to={x.id === "hoy" ? BASE : `${BASE}/${x.id}`} end
      className={({ isActive }) => cn("flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold lg:h-10 lg:w-full lg:rounded-xl lg:border-0 lg:px-3",
        isActive ? "border-foreground bg-foreground text-background lg:bg-primary/10 lg:text-primary" : "bg-card hover:bg-muted lg:bg-transparent")}>
      {x.icono}{x.texto}
    </NavLink>
  );

  let contenido: ReactNode;
  if (fallo) contenido = <ErrorState title="No pudimos cargar la agenda" onRetry={load} />;
  else if (!servicios) contenido = <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  else if (seccion === "hoy") contenido = <HoyPanel storeId={store.id} />;
  else if (seccion === "calendario") contenido = <AgendaTab storeId={store.id} servicios={servicios} profesionales={profesionales} horarios={horarios} cierres={cierres} />;
  else if (seccion === "espera") contenido = <EsperaPanel storeId={store.id} />;
  else if (seccion === "metricas") contenido = <MetricsTab storeId={store.id} />;
  else if (seccion === "servicios") contenido = <ServicesTab storeId={store.id} servicios={servicios} recursos={recursos} onChange={load} />;
  else if (seccion === "equipo") contenido = <TeamTab storeId={store.id} servicios={servicios} profesionales={profesionales} onChange={load} />;
  else if (seccion === "ajustes") contenido = <AgendaSettingsTab storeId={store.id} recursos={recursos} onChange={load} />;
  else contenido = <PaginaPublica slug={store.slug} servicios={servicios} profesionales={profesionales.length} />;

  return (
    <div className="space-y-5">
      <PageIntro description={actual.ayuda}
        actions={<Link to={`/t/${store.slug}/reservar`} target="_blank" className="inline-flex items-center gap-1 rounded-full border bg-card px-4 py-2 text-sm font-bold hover:bg-muted">Ver página de reservas<ExternalLink className="h-4 w-4" /></Link>} />
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
        <nav aria-label="Secciones de la agenda" className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 lg:sticky lg:top-20 lg:mx-0 lg:mb-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:px-0">
          <p className="hidden px-3 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground lg:block">Día a día</p>
          {visibles.filter((x) => !x.config).map(enlace)}
          {puedeConfigurar && <p className="hidden px-3 pb-1 pt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground lg:block">Configuración</p>}
          {visibles.filter((x) => x.config).map(enlace)}
        </nav>
        <div className="min-w-0">{contenido}</div>
      </div>
    </div>
  );
}

/** Configuración pública: enlace para compartir y cómo se ve cada servicio en la reserva online. */
function PaginaPublica({ slug, servicios, profesionales }: { slug: string; servicios: Servicio[]; profesionales: number }) {
  const url = `${window.location.origin}/t/${slug}/reservar`;
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); } catch { toast.error("No pudimos copiar. Seleccioná el enlace y copialo a mano."); } };
  const publicos = servicios.filter((s) => s.activo);
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5">
        <h2 className="font-extrabold">Enlace de reservas</h2>
        <p className="text-sm text-muted-foreground">Ponelo en tu Instagram, Google y WhatsApp. Tus clientes eligen servicio, profesional y horario libre, y reciben recordatorios.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 text-sm">{url}</code>
          <Button variant="outline" className="rounded-full" onClick={copiar}><Copy className="h-4 w-4" />Copiar</Button>
          <Button asChild variant="outline" className="rounded-full"><a href={`https://wa.me/?text=${encodeURIComponent(`Reservá tu turno acá: ${url}`)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a></Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-card">
        <header className="border-b px-5 py-3">
          <h2 className="font-extrabold">Qué ven tus clientes</h2>
          <p className="text-xs text-muted-foreground">{publicos.length} de {servicios.length} servicios se pueden reservar online · {profesionales} {profesionales === 1 ? "persona atiende" : "personas atienden"}. Las reglas se cambian en Servicios.</p>
        </header>
        {publicos.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Todavía no hay servicios activos. <Link to={`${BASE}/servicios`} className="font-bold text-primary hover:underline">Crear un servicio</Link></p> : (
          <ul className="divide-y">
            {publicos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="min-w-[160px] flex-1 font-bold">{s.nombre}</span>
                <span className="text-muted-foreground">{duracionTexto(s.duracion_min)} · {Number(s.precio) > 0 ? money(s.precio) : "Sin precio"} · {MODALIDAD[s.modalidad]}</span>
                <span className="text-muted-foreground">{s.requiere_confirmacion ? "El local confirma cada pedido" : "Se confirma solo"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
