import { CampaignManager } from "@/components/merchant/CampaignManager";
import { CouponManager } from "@/components/merchant/CouponManager";
import { ProductosLista } from "@/components/merchant/productos/ProductosLista";
import { MerchantOrders } from "@/components/merchant/MerchantOrders";
import { MerchantReviews } from "@/components/merchant/MerchantReviews";
import { MerchantProductReviews } from "@/components/merchant/MerchantProductReviews";
import { useState } from "react";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { useMerchant } from "./context";

export function MerchantOrdersPage() {
  const { orders, store, loadOrders } = useMerchant();
  return <MerchantOrders orders={orders} store={store} onChange={loadOrders} />;
}

export function MerchantMenuPage() {
  const { store, products, loadProducts } = useMerchant();
  return <ProductosLista storeId={store.id} products={products} onChange={loadProducts} />;
}

export function MerchantPromosPage() {
  const { store, coupons, loadCoupons } = useMerchant();
  return <CouponManager storeId={store.id} coupons={coupons} onChange={loadCoupons} />;
}

export function MerchantCampaignsPage() {
  const { store, coupons } = useMerchant();
  return <CampaignManager storeId={store.id} storeName={store.nombre} coupons={coupons} />;
}

export function MerchantReviewsPage() {
  const { reviews, loadReviews, store } = useMerchant();
  const [tab, setTab] = useState<"local" | "productos">("local");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Tipo de opinión" className="flex gap-2">
        {([["local", "Del local"], ["productos", "De productos"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 rounded-full border px-4 text-sm font-bold ${tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"}`}>{label}</button>
        ))}
      </div>
      {tab === "local" ? <MerchantReviews reviews={reviews} onChange={loadReviews} /> : <MerchantProductReviews storeId={store.id} />}
    </div>
  );
}

export function MerchantStatsPage() {
  const { store } = useMerchant();
  return <MerchantStats storeId={store.id} rating={Number(store.rating)} reviews={store.total_resenas} />;
}
