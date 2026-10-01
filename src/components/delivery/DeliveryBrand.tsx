import { Bike } from "lucide-react";

export function DeliveryBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-primary" aria-label="Woref entregas">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bike className="h-5 w-5" />
      </span>
      {!compact && <span className="font-display text-xl font-extrabold text-foreground">woref</span>}
    </div>
  );
}