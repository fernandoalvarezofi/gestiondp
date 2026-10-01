import { Heart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";

export function FavoriteButton({ storeId, className }: { storeId: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(storeId);
  return (
    <button
      type="button"
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={active}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(storeId); }}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-card/95 shadow-soft transition-transform active:scale-90", className)}
    >
      <Heart className={cn("h-[18px] w-[18px]", active ? "animate-pop-in fill-primary text-primary" : "text-foreground")} />
    </button>
  );
}
