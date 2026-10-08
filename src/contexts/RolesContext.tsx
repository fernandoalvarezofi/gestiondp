import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";

export type DeliveryRoles = {
  loading: boolean;
  isAdmin: boolean;
  /** Repartidor activo (puede tener la verificación pendiente). */
  isCourier: boolean;
  /** Conductor de remís aprobado por administración. */
  isDriver: boolean;
  storeId: string | null;
  nombre: string;
  refresh: () => Promise<void>;
};

type State = Omit<DeliveryRoles, "refresh">;
const EMPTY: State = { loading: false, isAdmin: false, isCourier: false, isDriver: false, storeId: null, nombre: "" };

const RolesContext = createContext<DeliveryRoles>({ ...EMPTY, loading: true, refresh: async () => {} });

/**
 * Roles de la cuenta, consultados UNA vez por sesión y compartidos por toda la app.
 * Sirve para armar la navegación; los permisos reales los valida el servidor (RLS y funciones).
 */
export function RolesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ ...EMPTY, loading: true });

  const refresh = useCallback(async () => {
    if (!user) { setState(EMPTY); return; }
    const [roles, store, courier, perfil] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", user.id),
      db.rpc("delivery_mi_acceso"),
      db.from("delivery_repartidores").select("perfil_id, activo, remis_estado").eq("perfil_id", user.id).maybeSingle(),
      db.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    ]);
    setState({
      loading: false,
      isAdmin: (roles.data || []).some((row: { role: string }) => row.role === "admin"),
      isCourier: Boolean(courier.data?.activo),
      isDriver: Boolean(courier.data?.activo && courier.data?.remis_estado === "aprobado"),
      storeId: store.data?.comercio_id ?? null,
      nombre: perfil.data?.nombre || (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "",
    });
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setState((prev) => ({ ...prev, loading: true }));
    refresh();
  }, [authLoading, refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export const useRoles = () => useContext(RolesContext);
