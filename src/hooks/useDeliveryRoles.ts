import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";

export type DeliveryRoles = {
  loading: boolean;
  isAdmin: boolean;
  isCourier: boolean;
  storeId: string | null;
  nombre: string;
  refresh: () => Promise<void>;
};

/** Qué paneles puede usar el usuario actual: comercio, repartidor y/o administración. */
export function useDeliveryRoles(): DeliveryRoles {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, isAdmin: false, isCourier: false, storeId: null as string | null, nombre: "" });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ loading: false, isAdmin: false, isCourier: false, storeId: null, nombre: "" });
      return;
    }
    const [roles, store, courier, perfil] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", user.id),
      db.rpc("delivery_mi_acceso"),
      db.from("delivery_repartidores").select("perfil_id, activo").eq("perfil_id", user.id).maybeSingle(),
      db.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    ]);
    setState({
      loading: false,
      isAdmin: (roles.data || []).some((row: { role: string }) => row.role === "admin"),
      isCourier: Boolean(courier.data?.activo),
      storeId: store.data?.comercio_id ?? null,
      nombre: perfil.data?.nombre || (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "",
    });
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh };
}
