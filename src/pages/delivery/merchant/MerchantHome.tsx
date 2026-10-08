import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, HelpCircle, MessageSquareReply, PackageX, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Delta, ListRow, Metric, MetricStrip, PageIntro, ProgressRing, RowList, Section, SectionLink, StatusPill, type Tone } from "@/components/panel/kit";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { estadoCorto, img, money, shortId } from "@/lib/delivery";
import { Permission, useMerchant } from "./context";

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (value: string | number | Date) => new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });
const hourNow = () => Number(new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
const greeting = () => { const h = hourNow(); return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches"; };
const minutesAgo = (value: string) => Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
const ago = (value: string) => { const m = minutesAgo(value); return m < 1 ? "recién" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`; };
const ESTADO_TONE: Record<string, Tone> = { pendiente: "warning", confirmado: "info", preparando: "info", listo: "success", en_camino: "brand" };

/** Inicio del comercio: cómo va el día, qué pedidos están en juego y qué necesita atención, en ese orden. */
export default function MerchantHome() {
  const { store, orders, products, reviews, pendingCount, preguntasPendientes, access } = useMerchant();
  const roles = useDeliveryRoles();
  const can = (permission: Permission) => access.permisos.includes(permission);

  const sales = useMemo(() => {
    const valid = orders.filter((order) => order.estado !== "cancelado");
    const byDay = new Map<string, { total: number; count: number }>();
    for (const order of valid) { const key = dayKey(order.created_at); const cur = byDay.get(key) ?? { total: 0, count: 0 }; cur.total += Number(order.subtotal); cur.count += 1; byDay.set(key, cur); }
    const last7 = Array.from({ length: 7 }, (_, i) => byDay.get(dayKey(Date.now() - (6 - i) * 86400000))?.total ?? 0);
    const today = byDay.get(dayKey(Date.now())) ?? { total: 0, count: 0 };
    // Ayer hasta esta misma hora: comparar el día entero contra uno a medias engaña.
    const sameTime = valid.filter((order) => dayKey(order.created_at) === dayKey(Date.now() - 86400000) && new Date(order.created_at).getTime() <= Date.now() - 86400000);
    const yesterday = { total: sameTime.reduce((t, order) => t + Number(order.subtotal), 0), count: sameTime.length };
    return { today, yesterday, last7 };
  }, [orders]);

  const live = useMemo(() => orders.filter((order) => ["pendiente", "confirmado", "preparando", "listo", "en_camino"].includes(order.estado)).sort((a, b) => (a.estado === "pendiente" ? -1 : 0) - (b.estado === "pendiente" ? -1 : 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [orders]);
  const oldestPending = live.find((order) => order.estado === "pendiente");

  const steps = useMemo(() => [
    { label: "Subí el logo de tu local", done: Boolean(store.logo_url), to: "/app/comercio/configuracion/general" },
    { label: "Subí una foto de portada", done: Boolean(store.imagen_url), to: "/app/comercio/configuracion/general" },
    { label: "Contá qué vendés en la descripción", done: Boolean(store.descripcion?.trim()), to: "/app/comercio/configuracion/general" },
    { label: "Cargá el teléfono del local", done: Boolean(store.telefono?.trim()), to: "/app/comercio/configuracion/general" },
    { label: "Marcá tu local en el mapa", done: store.latitud != null && store.longitud != null, to: "/app/comercio/configuracion/entrega" },
    { label: "Cargá al menos 5 productos", done: products.length >= 5, to: "/app/comercio/menu" },
    { label: "Poné foto a todos tus productos", done: products.length > 0 && products.every((product) => Boolean(product.imagen_url)), to: "/app/comercio/menu" },
    { label: "Personalizá tu tienda online y compartí el enlace", done: Boolean(store.tienda_tema && typeof store.tienda_tema === "object" && Object.keys(store.tienda_tema as object).length > 0), to: "/app/comercio/tienda" },
  ], [store, products]);
  const doneCount = steps.filter((step) => step.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const nextSteps = steps.filter((step) => !step.done);

  // Con variantes, el producto se agota cuando se agotan todas sus variantes activas.
  const sinVariantes = (product: typeof products[number]) => Boolean(product.usa_variantes) && (product.variantes || []).every((v) => !v.disponible || v.stock === 0);
  const soldOut = products.filter((product) => !product.disponible || product.stock === 0 || sinVariantes(product));
  const lowStock = [
    ...products.filter((product) => product.disponible && !product.usa_variantes && product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= 3).map((product) => ({ id: product.id, label: product.nombre })),
    ...products.filter((product) => product.disponible && product.usa_variantes).flatMap((product) => (product.variantes || []).filter((v) => v.disponible && v.stock !== null && v.stock > 0 && v.stock <= 3).map((v) => ({ id: v.id, label: `${product.nombre} · ${v.nombre}` }))),
  ];
  const sinResponder = reviews.filter((review) => !review.respuesta).length;

  const attention = [
    can("catalogo") && soldOut.length > 0 && { key: "agotados", icon: <PackageX className="h-4 w-4" />, tone: "danger" as Tone, title: `${soldOut.length} ${soldOut.length === 1 ? "producto agotado o pausado" : "productos agotados o pausados"}`, meta: soldOut.slice(0, 2).map((p) => p.nombre).join(", ") + (soldOut.length > 2 ? "…" : ""), to: "/app/comercio/menu" },
    can("catalogo") && lowStock.length > 0 && { key: "stock", icon: <AlertTriangle className="h-4 w-4" />, tone: "warning" as Tone, title: `${lowStock.length} con poco stock`, meta: lowStock.slice(0, 2).map((p) => p.label).join(", ") + (lowStock.length > 2 ? "…" : ""), to: "/app/comercio/menu" },
    can("opiniones") && sinResponder > 0 && { key: "opiniones", icon: <MessageSquareReply className="h-4 w-4" />, tone: "info" as Tone, title: `${sinResponder} ${sinResponder === 1 ? "opinión" : "opiniones"} sin responder`, meta: "Responder mejora tu reputación", to: "/app/comercio/opiniones" },
    can("opiniones") && preguntasPendientes > 0 && { key: "preguntas", icon: <HelpCircle className="h-4 w-4" />, tone: "info" as Tone, title: `${preguntasPendientes} ${preguntasPendientes === 1 ? "pregunta" : "preguntas"} de clientes`, meta: "Respondé antes de que compren en otro lado", to: "/app/comercio/preguntas" },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; tone: Tone; title: string; meta: string; to: string }[];

  const first = roles.nombre.split(" ")[0];
  const dateText = new Date().toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <PageIntro
        title={`${greeting()}${first ? `, ${first}` : ""}`}
        description={<span className="first-letter:capitalize">{dateText} · {store.esta_abierto ? "recibiendo pedidos" : "pausado: no estás recibiendo pedidos"}</span>}
        actions={<>
          <Button asChild variant="outline" size="sm" className="rounded-full"><Link to={`/app/tienda/${store.slug}`}>Ver como cliente<ExternalLink className="h-3.5 w-3.5" /></Link></Button>
          {can("catalogo") && <Button asChild size="sm" className="rounded-full"><Link to="/app/comercio/menu"><Plus className="h-4 w-4" />Nuevo producto</Link></Button>}
        </>}
      />

      {pendingCount > 0 && (
        <Link to="/app/comercio/pedidos" className="group flex items-center gap-3 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.06] px-4 py-3 transition-colors hover:bg-brand-yellow/10">
          <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-yellow opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-yellow" /></span>
          <p className="min-w-0 flex-1 text-sm"><span className="font-extrabold">{pendingCount === 1 ? "1 pedido nuevo esperando" : `${pendingCount} pedidos nuevos esperando`}</span>{oldestPending && <span className="text-muted-foreground"> · el más antiguo es de {ago(oldestPending.created_at)}</span>}</p>
          <span className="flex items-center gap-1 text-sm font-bold">Responder<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
      )}

      <MetricStrip cols={5}>
        {can("estadisticas") && <Metric featured label="Ventas de hoy" value={money(sales.today.total)} delta={<Delta current={sales.today.total} previous={sales.yesterday.total} suffix="vs. ayer a esta hora" />} hint={`${sales.today.count} ${sales.today.count === 1 ? "pedido" : "pedidos"}`} spark={sales.last7} />}
        <Metric label="En curso" value={live.length} hint={pendingCount ? `${pendingCount} por responder` : "Nada por responder"} />
        {can("estadisticas") && <Metric label="Ticket promedio" value={sales.today.count ? money(sales.today.total / sales.today.count) : "—"} hint="Hoy, sin envío" />}
        <Metric label="Calificación" value={store.total_resenas ? Number(store.rating).toFixed(1) : "—"} hint={`${store.total_resenas} ${store.total_resenas === 1 ? "opinión" : "opiniones"}`} />
      </MetricStrip>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Pedidos en curso" description="Lo que está pasando ahora mismo" action={<SectionLink to="/app/comercio/pedidos">Ir a pedidos</SectionLink>}>
          {live.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-9 text-center"><p className="font-bold">No hay pedidos en curso</p><p className="mt-0.5 text-sm text-muted-foreground">Cuando entre uno, te avisamos con sonido y acá lo vas a ver primero.</p></div>
          ) : (
            <RowList>
              {live.slice(0, 6).map((order) => {
                const items = order.items ?? [];
                const units = items.reduce((total, item) => total + item.cantidad, 0);
                return (
                  <ListRow key={order.id} to="/app/comercio/pedidos"
                    lead={<StatusPill tone={ESTADO_TONE[order.estado] ?? "neutral"} dot className="w-[104px] justify-center">{estadoCorto[order.estado]}</StatusPill>}
                    title={<>{shortId(order.id)} <span className="font-medium text-muted-foreground">· {order.cliente?.nombre?.split(" ")[0] || "Cliente"}</span></>}
                    meta={`${units || "—"} ${units === 1 ? "producto" : "productos"} · ${order.tipo_entrega === "retiro" ? "retiro" : "envío"} · ${ago(order.created_at)}`}
                    trailing={<span className="font-extrabold tabular-nums">{money(order.total)}</span>} />
                );
              })}
            </RowList>
          )}
        </Section>

        <Section title="Para revisar" description="Lo que conviene resolver hoy">
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-sm font-bold">Todo en orden</p><p className="text-[12.5px] text-muted-foreground">Sin agotados, sin poco stock y sin consultas pendientes.</p></div></div>
          ) : (
            <RowList>
              {attention.map((item) => (
                <ListRow key={item.key} to={item.to} lead={<StatusPill tone={item.tone} className="h-8 w-8 justify-center rounded-full p-0">{item.icon}</StatusPill>} title={item.title} meta={item.meta} trailing={<ArrowRight className="h-4 w-4 text-muted-foreground" />} />
              ))}
            </RowList>
          )}
        </Section>
      </div>

      {(progress < 100 && can("ajustes") && can("catalogo")) || (reviews.length > 0 && can("opiniones")) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {progress < 100 && can("ajustes") && can("catalogo") && (
            <Section title="Completá tu local" description={`${doneCount} de ${steps.length} pasos hechos · los locales completos reciben más pedidos`}>
              <div className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex items-center gap-3 border-b px-4 py-3"><ProgressRing value={progress} /><p className="text-sm text-muted-foreground">Te faltan <span className="font-bold text-foreground">{nextSteps.length}</span> {nextSteps.length === 1 ? "paso" : "pasos"} para tener todo listo.</p></div>
                <ul className="divide-y">
                  {nextSteps.slice(0, 4).map((step) => (
                    <li key={step.label}><Link to={step.to} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"><span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" /><span className="flex-1">{step.label}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link></li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {reviews.length > 0 && can("opiniones") && (
            <Section title="Últimas opiniones" action={<SectionLink to="/app/comercio/opiniones">Ver todas</SectionLink>}>
              <RowList>
                {reviews.slice(0, 3).map((review) => (
                  <ListRow key={review.id} to="/app/comercio/opiniones"
                    lead={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/15 text-sm font-extrabold tabular-nums text-warning-foreground dark:text-warning">{review.puntaje}<Star className="ml-0.5 h-3 w-3 fill-current" /></span>}
                    title={review.cliente?.nombre?.split(" ")[0] || "Cliente"} meta={review.comentario || "Sin comentario"}
                    trailing={!review.respuesta ? <span className="text-xs font-bold text-primary">Responder</span> : <span className="text-xs text-muted-foreground">Respondida</span>} />
                ))}
              </RowList>
            </Section>
          )}
        </div>
      ) : null}
    </div>
  );
}
