import { CampaignManager } from "@/components/merchant/CampaignManager";
import { CouponManager } from "@/components/merchant/CouponManager";
import { MerchantMenu } from "@/components/merchant/MerchantMenu";
import { MerchantOrders } from "@/components/merchant/MerchantOrders";
import { MerchantReviews } from "@/components/merchant/MerchantReviews";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { useMerchant } from "./context";

export function MerchantOrdersPage() {
  const { orders, store, loadOrders } = useMerchant();
  return <MerchantOrders orders={orders} store={store} onChange={loadOrders} />;
}

export function MerchantMenuPage() {
  const { store, products, loadProducts } = useMerchant();
  return <MerchantMenu storeId={store.id} products={products} onChange={loadProducts} />;
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
  const { reviews, loadReviews } = useMerchant();
  return <MerchantReviews reviews={reviews} onChange={loadReviews} />;
}

export function MerchantStatsPage() {
  const { store } = useMerchant();
  return <MerchantStats storeId={store.id} rating={Number(store.rating)} reviews={store.total_resenas} />;
}
