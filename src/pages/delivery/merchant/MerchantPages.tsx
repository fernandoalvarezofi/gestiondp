import { CampaignManager } from "@/components/merchant/CampaignManager";
import { CouponManager } from "@/components/merchant/CouponManager";
import { ProductosLista } from "@/components/merchant/productos/ProductosLista";
import { MerchantOrders } from "@/components/merchant/MerchantOrders";
import { MerchantReviews } from "@/components/merchant/MerchantReviews";
import { MerchantProductReviews } from "@/components/merchant/MerchantProductReviews";
import { useState, type ReactNode } from "react";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { PageIntro } from "@/components/panel/kit";
import { useMerchant } from "./context";

/** Encabezado común de las pantallas del panel: título, para qué sirve y, si hace falta, acciones. */
function Pagina({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="space-y-5"><PageIntro title={title} description={description} />{children}</div>;
}

export function MerchantOrdersPage() {
  const { orders, store, loadOrders } = useMerchant();
  return <Pagina title="Pedidos" description="Seguimiento completo, desde la compra hasta la entrega."><MerchantOrders orders={orders} store={store} onChange={loadOrders} /></Pagina>;
}

export function MerchantMenuPage() {
  const { store, products, loadProducts } = useMerchant();
  return <Pagina title={store.pedidos_online === false ? "Carta" : "Productos"} description="Precios, fotos, variantes y disponibilidad de lo que ofrecés."><ProductosLista storeId={store.id} products={products} onChange={loadProducts} enMarket={store.en_market !== false} /></Pagina>;
}

export function MerchantPromosPage() {
  const { store, coupons, loadCoupons } = useMerchant();
  return <Pagina title="Promociones y cupones" description="Descuentos para atraer clientes nuevos y que vuelvan los que ya te compraron."><CouponManager storeId={store.id} coupons={coupons} onChange={loadCoupons} /></Pagina>;
}

export function MerchantCampaignsPage() {
  const { store, coupons } = useMerchant();
  return <Pagina title="Campañas" description="Mensajes a tus clientes con promociones y novedades."><CampaignManager storeId={store.id} storeName={store.nombre} coupons={coupons} /></Pagina>;
}

export function MerchantReviewsPage() {
  const { reviews, loadReviews, store } = useMerchant();
  const [tab, setTab] = useState<"local" | "productos">("local");
  return (
    <Pagina title="Opiniones" description="Lo que dicen tus clientes del local y de tus productos. Responder suma confianza.">
      <div role="tablist" aria-label="Tipo de opinión" className="inline-flex rounded-lg border bg-card p-0.5">
        {([["local", "Del local"], ["productos", "De productos"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {tab === "local" ? <MerchantReviews reviews={reviews} onChange={loadReviews} /> : <MerchantProductReviews storeId={store.id} />}
    </Pagina>
  );
}

export function MerchantStatsPage() {
  const { store } = useMerchant();
  return <MerchantStats storeId={store.id} rating={Number(store.rating)} reviews={store.total_resenas} />;
}
