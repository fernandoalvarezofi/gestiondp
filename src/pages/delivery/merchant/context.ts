import { useOutletContext } from "react-router-dom";
import type { StoreReview } from "@/components/merchant/MerchantReviews";
import type { StoreFormValues } from "@/components/merchant/StoreSettingsForm";
import type { Coupon, DeliveryOrder, DeliveryProduct, DeliveryStore } from "@/lib/delivery";

/** Datos del comercio compartidos por todas las secciones del panel. */
export type MerchantContext = {
  store: DeliveryStore;
  orders: DeliveryOrder[];
  products: DeliveryProduct[];
  coupons: Coupon[];
  reviews: StoreReview[];
  pendingCount: number;
  loadStore: () => Promise<DeliveryStore | null>;
  loadOrders: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadCoupons: () => Promise<void>;
  loadReviews: () => Promise<void>;
  saveSettings: (values: StoreFormValues) => Promise<void>;
};

export const useMerchant = () => useOutletContext<MerchantContext>();
