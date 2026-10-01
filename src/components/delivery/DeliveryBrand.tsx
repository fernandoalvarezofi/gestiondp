import { Bike } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeliveryBrand({ compact = false, inverted = false, className }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="Woref">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", inverted ? "bg-white text-primary" : "bg-primary text-primary-foreground")}>
        <Bike className="h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact && <span className={cn("font-display text-2xl font-extrabold tracking-tight", inverted ? "text-white" : "text-primary")}>woref</span>}
    </div>
  );
}
