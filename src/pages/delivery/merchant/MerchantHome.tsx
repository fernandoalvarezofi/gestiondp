import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Circle, ClipboardList, Receipt, Star, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/delivery/Common";
import { img, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Permission, useMerchant } from "./context";

/** Pantalla de inicio del comercio: qué pasa hoy, qué falta completar y qué necesita atención. */
export default function MerchantHome() {
  const { store, orders, products, reviews, pendingCount, access } = useMerchant();
  const can = (permission: Permission) => access.permisos.includes(permission);

  const today = useMemo(() => {
    const day = new Date().toDateString();
    const list = orders.filter((order) => order.estado !== "cancelado" && new Date(order.created_at).toDateString() === day);
    const sales = list.reduce((total, order) => total + Number(order.subtotal), 0);
    return { count: list.length, sales, ticket: list.length ? sales / list.length : 0 };
  }, [orders]);

  const oldestPending = useMemo(() => orders.filter((order) => order.estado === "pendiente").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0], [orders]);
  const inProgress = orders.filter((order) => ["confirmado", "preparando", "listo", "en_camino"].includes(order.estado)).length;

  // Lista de pasos para tener el local listo para vender (como el onboarding de los portales de socios).
  const steps = useMemo(() => [
    { label: "Subí el logo de tu local", done: Boolean(store.logo_url), to: "/app/comercio/configuracion/general" },
    { label: "Subí una foto de portada", done: Boolean(store.imagen_url), to: "/app/comercio/configuracion/general" },
    { label: "Contá qué vendés (descripción)", done: Boolean(store.descripcion?.trim()), to: "/app/comercio/configuracion/general" },
    { label: "Cargá el teléfono del local", done: Boolean(store.telefono?.trim()), to: "/app/comercio/configuracion/general" },
    { label: "Marcá tu local en el mapa", done: store.latitud != null && store.longitud != null, to: "/app/comercio/configuracion/entrega" },
    { label: "Cargá al menos 5 productos", done: products.length >= 5, to: "/app/comercio/menu" },
    { label: "Poné foto a todos tus productos", done: products.length > 0 && products.every((product) => Boolean(product.imagen_url)), to: "/app/comercio/menu" },
  ], [store, products]);
  const doneCount = steps.filter((step) => step.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  const soldOut = products.filter((product) => !product.disponible || product.stock === 0);
  const lowStock = products.filter((product) => product.disponible && product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= 3);

  return (
    <div className="space-y-6">
      {pendingCount > 0 ? (
        <Link to="/app/comercio/pedidos" className="flex items-center gap-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-pop">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{pendingCount === 1 ? "Tenés 1 pedido nuevo esperando" : `Tenés ${pendingCount} pedidos nuevos esperando`}</p>
            {oldestPending && <p className="text-sm text-primary-foreground/85">El más antiguo es {shortId(oldestPending.id)}. Respondelo cuanto antes.</p>}
          </div>
          <span className="flex items-center gap-1 text-sm font-bold">Ver pedidos<ArrowRight className="h-4 w-4" /></span>
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-3xl border bg-card p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success"><BellRing className="h-5 w-5" /></span>
          <div><p className="font-extrabold">Todo al día</p><p className="text-sm text-muted-foreground">No tenés pedidos esperando respuesta. {inProgress > 0 ? `Hay ${inProgress} en preparación o camino.` : "Cuando entre uno, te avisamos acá."}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can("estadisticas") && <StatCard label="Ventas de hoy" value={money(today.sales)} icon={<Wallet className="h-4 w-4" />} hint={`${today.count} ${today.count === 1 ? "pedido" : "pedidos"}`} />}
        {can("estadisticas") && <StatCard label="Ticket promedio" value={money(today.ticket)} icon={<Receipt className="h-4 w-4" />} hint="Hoy, sin envío ni propinas" />}
        <StatCard label="En curso" value={pendingCount + inProgress} icon={<ClipboardList className="h-4 w-4" />} hint={`${pendingCount} por responder`} />
        <StatCard label="Calificación" value={store.total_resenas ? Number(store.rating).toFixed(1) : "—"} icon={<Star className="h-4 w-4" />} hint={`${store.total_resenas} opiniones`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {progress < 100 && can("ajustes") && can("catalogo") && (
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-extrabold">Dejá tu local listo para vender</h2><p className="text-sm text-muted-foreground">Los locales completos reciben más pedidos.</p></div>
              <span className="font-display text-2xl font-black text-primary">{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            <ul className="mt-4 space-y-1">
              {steps.map((step) => (
                <li key={step.label}>
                  <Link to={step.to} className={cn("flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-muted", step.done && "text-muted-foreground")}>
                    {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />}
                    <span className={cn("flex-1", step.done && "line-through")}>{step.label}</span>
                    {!step.done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {can("catalogo") && <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><AlertTriangle className="h-5 w-5 text-warning" />Necesita atención</h2>
          {soldOut.length === 0 && lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Tu menú está en orden: no hay productos agotados ni con poco stock.</p>
          ) : (
            <>
              {soldOut.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-bold">{soldOut.length} {soldOut.length === 1 ? "producto agotado o pausado" : "productos agotados o pausados"}</p>
                  <ul className="mt-2 space-y-2">
                    {soldOut.slice(0, 4).map((product) => (
                      <li key={product.id} className="flex items-center gap-3 text-sm"><img src={img(product.imagen_url, 80)} alt="" className="h-9 w-9 rounded-lg object-cover grayscale" /><span className="min-w-0 flex-1 truncate">{product.nombre}</span><span className="text-xs text-muted-foreground">{product.stock === 0 ? "Sin stock" : "Pausado"}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {lowStock.length > 0 && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm"><span className="font-bold">Poco stock:</span> {lowStock.slice(0, 4).map((product) => `${product.nombre} (${product.stock})`).join(", ")}</p>}
              <Link to="/app/comercio/menu" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Ir al menú y stock<ArrowRight className="h-4 w-4" /></Link>
            </>
          )}
        </section>}

        {reviews.length > 0 && can("opiniones") && (
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-extrabold"><TrendingUp className="h-5 w-5 text-primary" />Últimas opiniones</h2><Link to="/app/comercio/opiniones" className="text-sm font-bold text-primary">Ver todas</Link></div>
            <ul className="mt-3 divide-y">
              {reviews.slice(0, 3).map((review) => (
                <li key={review.id} className="py-2.5 text-sm">
                  <p className="flex items-center justify-between gap-2"><span className="font-bold">{review.cliente?.nombre?.split(" ")[0] || "Cliente"}</span><span className="flex items-center gap-0.5 text-warning"><Star className="h-3.5 w-3.5 fill-warning" />{review.puntaje}</span></p>
                  {review.comentario && <p className="line-clamp-2 text-muted-foreground">{review.comentario}</p>}
                  {!review.respuesta && <Link to="/app/comercio/opiniones" className="text-xs font-bold text-primary">Responder</Link>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
