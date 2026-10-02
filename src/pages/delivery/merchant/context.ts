import { useOutletContext } from "react-router-dom";
import type { StoreReview } from "@/components/merchant/MerchantReviews";
import type { StoreFormValues } from "@/components/merchant/StoreSettingsForm";
import type { Coupon, DeliveryOrder, DeliveryProduct, DeliveryStore } from "@/lib/delivery";

export type TeamRole = "dueno" | "encargado" | "operador";
export type Permission = "pedidos" | "catalogo" | "promociones" | "opiniones" | "estadisticas" | "ajustes" | "finanzas" | "equipo";
export type StoreAccess = { rol: TeamRole; permisos: Permission[] };

export const roleLabel: Record<TeamRole, string> = { dueno: "Dueño", encargado: "Encargado", operador: "Operador" };
export const roleSummary: Record<TeamRole, string> = {
  dueno: "Acceso total, incluidas las finanzas y el equipo.",
  encargado: "Pedidos, menú, promociones, opiniones, estadísticas y datos del local. Sin finanzas ni equipo.",
  operador: "Solo recibe y prepara pedidos.",
};

/** Datos del comercio compartidos por todas las secciones del panel. */
export type MerchantContext = {
  store: DeliveryStore;
  access: StoreAccess;
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
