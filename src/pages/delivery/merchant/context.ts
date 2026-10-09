import { useOutletContext } from "react-router-dom";
import type { StoreReview } from "@/components/merchant/MerchantReviews";
import type { StoreFormValues } from "@/components/merchant/StoreSettingsForm";
import type { Coupon, DeliveryOrder, DeliveryProduct, DeliveryStore } from "@/lib/delivery";

// "vendedor" viene de los roles del negocio (seller): pedidos y catálogo.
export type TeamRole = "dueno" | "encargado" | "vendedor" | "operador";
export type Permission = "pedidos" | "catalogo" | "promociones" | "opiniones" | "estadisticas" | "ajustes" | "finanzas" | "equipo";
export type StoreAccess = { rol: TeamRole; permisos: Permission[] };
export type Branch = { id: string; nombre: string; logo_url: string | null; direccion: string; rol: TeamRole; aprobado: boolean; esta_abierto: boolean; negocio_id?: string | null; negocio?: string | null; parent_store_id?: string | null };

export const roleLabel: Record<TeamRole, string> = { dueno: "Dueño", encargado: "Encargado", vendedor: "Vendedor", operador: "Operador" };
export const roleSummary: Record<TeamRole, string> = {
  dueno: "Acceso total, incluidas las finanzas y el equipo.",
  encargado: "Pedidos, menú, promociones, opiniones, estadísticas y datos del local. Sin finanzas ni equipo.",
  vendedor: "Pedidos y menú (productos, precios y stock). Sin promociones, finanzas ni equipo.",
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
  /** Preguntas de clientes sin responder (para el aviso del menú). */
  preguntasPendientes: number;
  loadPreguntas: () => Promise<void>;
  loadStore: () => Promise<DeliveryStore | null>;
  loadOrders: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadCoupons: () => Promise<void>;
  loadReviews: () => Promise<void>;
  saveSettings: (values: StoreFormValues) => Promise<boolean>;
  /** Todos los locales de la cuenta (propios y donde se es parte del equipo). */
  branches: Branch[];
  switchStore: (id: string) => void;
  reloadBranches: () => Promise<void>;
};

export const useMerchant = () => useOutletContext<MerchantContext>();
