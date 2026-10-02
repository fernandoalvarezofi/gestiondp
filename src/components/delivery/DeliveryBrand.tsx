import { Logo } from "@/components/brand/Logo";

/** Marca de Woref en encabezados y pantallas sueltas. */
export function DeliveryBrand({ compact = false, inverted = false, className }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return <Logo compact={compact} inverted={inverted} className={className} />;
}
