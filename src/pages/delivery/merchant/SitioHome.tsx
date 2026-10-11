import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CheckCircle2, CircleAlert, ExternalLink, Globe, Inbox, Loader2, MessageCircle, Palette, PencilRuler, Search, Settings, ShoppingBag, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/dialogos";
import { ListRow, Metric, MetricStrip, PageIntro, RowList, Section, SectionLink, StatusPill } from "@/components/panel/kit";
import { StorefrontStats } from "@/components/storefront/StorefrontStats";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, errorMessage } from "@/lib/delivery";
import { storefrontPath, storefrontUrl } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import { listarTareas, resumenCrm, type ResumenCrm, type Tarea } from "@/services/crm";
import { fetchPreparacion, type ItemPreparacion } from "@/services/storeBuilder";
import { Permission, useMerchant } from "./context";

/** Las consultas del formulario del sitio entran al CRM como tareas con este título (ver `tienda_consulta_enviar`). */
const TITULO_CONSULTA = "Consulta desde la tienda";
/** Las consultas vencen un día después de llegar: se muestra hasta cuándo conviene responder. */
const responderAntes = (vence: string) => new Date(vence).toLocaleString("es-AR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

type Acceso = { to: string; titulo: string; detalle: string; icon: ReactNode; permiso?: Permission };
const ACCESOS: Acceso[] = [
  { to: "/app/comercio/tienda/editor", titulo: "Editor y páginas", detalle: "Secciones, páginas, menú, encabezado y pie", icon: <PencilRuler className="h-5 w-5" />, permiso: "ajustes" },
  { to: "/app/comercio/tienda/temas", titulo: "Apariencia y temas", detalle: "Tipografías, colores y estilo", icon: <Palette className="h-5 w-5" />, permiso: "ajustes" },
  { to: "/app/comercio/tienda/seo", titulo: "SEO, dominio y publicación", detalle: "Google, redes y dominio propio", icon: <Search className="h-5 w-5" />, permiso: "ajustes" },
  { to: "/app/comercio/clientes", titulo: "Clientes (CRM)", detalle: "Contactos, fichas y etiquetas", icon: <Users className="h-5 w-5" />, permiso: "estadisticas" },
  { to: "/app/comercio/clientes/seguimientos", titulo: "Consultas y seguimientos", detalle: "Lo que te escribieron y lo que falta responder", icon: <Inbox className="h-5 w-5" />, permiso: "estadisticas" },
  { to: "/app/comercio/turnos", titulo: "Agenda y turnos", detalle: "Servicios con reserva en línea", icon: <CalendarCheck className="h-5 w-5" />, permiso: "pedidos" },
  { to: "/app/comercio/mensajes", titulo: "Mensajes", detalle: "Conversaciones con tus clientes", icon: <MessageCircle className="h-5 w-5" /> },
  { to: "/app/comercio/equipo", titulo: "Equipo", detalle: "Quién más puede editar el sitio", icon: <UsersRound className="h-5 w-5" />, permiso: "equipo" },
  { to: "/app/comercio/configuracion/general", titulo: "Configuración del negocio", detalle: "Datos, logo, horarios y verificación", icon: <Settings className="h-5 w-5" />, permiso: "ajustes" },
];

/** Inicio del panel de un sitio web: si está publicado, qué falta, qué consultas llegaron y adónde ir para administrarlo. */
export default function SitioHome() {
  const { store, access, loadStore } = useMerchant();
  const roles = useDeliveryRoles();
  const can = (permiso: Permission) => access.permisos.includes(permiso);
  const [prep, setPrep] = useState<ItemPreparacion[] | null>(null);
  const [crm, setCrm] = useState<ResumenCrm | null>(null);
  const [consultas, setConsultas] = useState<Tarea[] | null>(null);
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (can("ajustes")) fetchPreparacion(store.id).then((x) => vivo && setPrep(x)).catch(() => vivo && setPrep([]));
    if (can("estadisticas")) {
      resumenCrm(store.id).then((x) => vivo && setCrm(x)).catch(() => undefined);
      listarTareas(store.id, "pendientes").then((x) => vivo && setConsultas(x.filter((t) => t.titulo === TITULO_CONSULTA))).catch(() => vivo && setConsultas([]));
    }
    return () => { vivo = false; };
  }, [store.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const publico = store.aprobado && store.activo !== false;
  const sinPublicar = prep?.some((i) => i.clave === "borrador" && !i.ok) ?? false;
  const pendientes = (prep ?? []).filter((i) => !i.ok && i.clave !== "borrador");
  const url = storefrontUrl(store.slug);

  /** Pasar de sitio informativo a tienda online: se conserva todo el contenido y se habilitan catálogo, pedidos y el Market. */
  const activarTienda = async () => {
    const ok = await confirmar({
      titulo: "¿Activar la tienda online?",
      descripcion: store.verificado
        ? "Tu sitio, sus páginas y su diseño se conservan. Se suman catálogo, carrito, pedidos, envíos y finanzas al panel. Después cargás productos y elegís cómo entregás en Configuración."
        : "Tu sitio, sus páginas y su diseño se conservan y se suman catálogo, carrito, pedidos y envíos. Para vender, Woref verifica al titular: hasta que te aprobemos, el sitio deja de ser público. Cargá el CUIT en Configuración → Verificación.",
      confirmar: "Activar tienda online",
    });
    if (!ok) return;
    setActivando(true);
    const { error } = await db.from("delivery_comercios").update({ tipo_sitio: "tienda" }).eq("id", store.id);
    setActivando(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(store.verificado ? "Tienda online activada. Ya podés cargar tus productos." : "Tienda online activada. Cargá tus productos y el CUIT para que la aprobemos.");
    await loadStore();
  };

  const nombre = roles.nombre.split(" ")[0];
  return (
    <div className="space-y-6">
      <PageIntro
        title={nombre ? `Hola, ${nombre}` : "Tu sitio web"}
        description={<>Administrá <span className="font-semibold text-foreground">{store.nombre}</span>: contenido, apariencia, consultas y clientes.</>}
        actions={<>
          <Button asChild variant="outline" size="sm" className="rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer">Ver mi sitio<ExternalLink className="h-3.5 w-3.5" /></a></Button>
          {can("ajustes") && <Button asChild size="sm" className="rounded-full"><Link to="/app/comercio/tienda/editor"><PencilRuler className="h-4 w-4" />Editar sitio</Link></Button>}
        </>}
      />

      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="estado-sitio">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", publico ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground dark:text-warning")}><Globe className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p id="estado-sitio" className="flex flex-wrap items-center gap-2 text-lg font-black">
              {publico ? "Tu sitio está publicado" : "Tu sitio está en revisión"}
              {publico ? <StatusPill tone="success" dot>En línea</StatusPill> : <StatusPill tone="warning" dot>Todavía no es público</StatusPill>}
              {sinPublicar && <StatusPill tone="info">Cambios sin publicar</StatusPill>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{publico ? url.replace(/^https?:\/\//, "") : "Woref revisa cada negocio antes de mostrarlo. Mientras tanto podés editarlo y previsualizarlo."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!publico && can("finanzas") && <Button asChild variant="outline" className="rounded-full"><Link to="/app/comercio/configuracion/verificacion">Completar verificación</Link></Button>}
            {sinPublicar && can("ajustes") && <Button asChild className="rounded-full"><Link to="/app/comercio/tienda/resumen">Revisar y publicar</Link></Button>}
          </div>
        </div>
        {can("ajustes") && (
          <div className="border-t px-5 py-4">
            {prep === null ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Revisando tu sitio…</p>
              : pendientes.length === 0 ? <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-success" />Tu sitio tiene todo lo necesario.</p>
              : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {pendientes.map((i) => (
                    <li key={i.clave} className="flex items-start gap-2 text-sm"><CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", i.grave ? "text-destructive" : "text-warning")} /><span><span className="font-bold">{i.titulo}</span><span className="block text-xs text-muted-foreground">{i.detalle}</span></span></li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </section>

      {crm && (
        <MetricStrip cols={4}>
          <Metric icon={<Inbox />} tone="accent" label="Consultas sin responder" value={crm.consultas_sin_responder ?? 0} hint="Desde el formulario del sitio" />
          <Metric icon={<Users />} tone="brand" label="Contactos" value={crm.total} hint={`${crm.nuevos_30d} nuevos en 30 días`} />
          <Metric icon={<CalendarCheck />} tone="ink" label="Seguimientos vencidos" value={crm.tareas_vencidas} hint={`${crm.tareas_pendientes} pendientes en total`} />
          <Metric icon={<CalendarCheck />} tone="info" label="Turnos de hoy" value={crm.turnos_hoy} hint="Si usás la agenda" />
        </MetricStrip>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {can("estadisticas") && (
          <Section title="Últimas consultas" description="Lo que te escribieron desde el formulario del sitio" action={<SectionLink to="/app/comercio/clientes/seguimientos">Ver todas</SectionLink>}>
            {consultas === null ? <div className="flex justify-center rounded-2xl border bg-card py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              : consultas.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card px-5 py-8 text-center"><p className="font-bold">Sin consultas pendientes</p><p className="mt-0.5 text-sm text-muted-foreground">Cuando alguien complete el formulario de tu sitio, aparece acá y en Clientes, y te llega un aviso.</p></div>
              ) : (
                <RowList>
                  {consultas.slice(0, 6).map((t) => (
                    <ListRow key={t.id} to={`/app/comercio/clientes/${t.contacto_id}`} lead={<StatusPill tone="warning" className="h-8 w-8 justify-center rounded-full p-0"><Inbox className="h-4 w-4" /></StatusPill>}
                      title={t.contacto} meta={`${(t.detalle ?? "").split("\n")[0].slice(0, 90)} · responder antes del ${responderAntes(t.vence_at)}`} trailing={<ArrowRight className="h-4 w-4 text-muted-foreground" />} />
                  ))}
                </RowList>
              )}
          </Section>
        )}
        <Section title="Visitas" description="De quienes aceptan cookies de medición">
          <div className="rounded-2xl border bg-card p-4"><StorefrontStats storeId={store.id} /></div>
        </Section>
      </div>

      <Section title="Administrar">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACCESOS.filter((a) => !a.permiso || can(a.permiso)).map((a) => (
            <li key={a.to}>
              <Link to={a.to} className="group flex h-full items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{a.icon}</span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{a.titulo}</span><span className="block text-xs text-muted-foreground">{a.detalle}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {access.rol === "dueno" && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow/20 text-brand-yellow-foreground"><ShoppingBag className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">¿Querés vender en línea?</p>
            <p className="text-sm text-muted-foreground">Activá la tienda online sobre este mismo sitio: sumás catálogo, carrito y pedidos sin perder tus páginas ni tu diseño.</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0 rounded-full" onClick={activarTienda} disabled={activando}>{activando && <Loader2 className="h-4 w-4 animate-spin" />}Activar tienda online</Button>
        </section>
      )}
    </div>
  );
}
