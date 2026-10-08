import { useRoles, type DeliveryRoles } from "@/contexts/RolesContext";

export type { DeliveryRoles };

/** Qué contextos puede usar el usuario actual (comercio, repartidor, conductor, administración). Se carga una vez en `RolesProvider`. */
export function useDeliveryRoles(): DeliveryRoles {
  return useRoles();
}
