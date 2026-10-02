import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";

export type PersonalCoupon = { codigo: string; descripcion: string; tipo: "monto" | "porcentaje" | "envio_gratis"; valor: number; tope: number | null; minimo: number; vence_at: string | null };

/** Cupones personales disponibles (premios del club, amigos, créditos de soporte) que todavía no se usaron. */
export function useMyCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<PersonalCoupon[]>([]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    db.rpc("delivery_club_resumen").then(({ data }: { data: { cupones?: PersonalCoupon[] } | null }) => { if (active) setCoupons(data?.cupones ?? []); });
    return () => { active = false; };
  }, [user]);
  return coupons;
}

export const couponLabel = (coupon: PersonalCoupon) =>
  coupon.tipo === "envio_gratis" ? "Envío gratis" : coupon.tipo === "porcentaje" ? `${coupon.valor}% OFF` : `$${Number(coupon.valor).toLocaleString("es-AR")} OFF`;
