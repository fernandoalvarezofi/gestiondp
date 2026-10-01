import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";

type FavoritesValue = {
  ids: Set<string>;
  isFavorite: (storeId: string) => boolean;
  toggle: (storeId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    db.from("delivery_favoritos").select("comercio_id").eq("perfil_id", user.id).then(({ data }: { data: { comercio_id: string }[] | null }) => {
      setIds(new Set((data || []).map((row) => row.comercio_id)));
    });
  }, [user]);

  const toggle = useCallback(async (storeId: string) => {
    if (!user) return;
    const wasFavorite = ids.has(storeId);
    setIds((current) => {
      const next = new Set(current);
      if (wasFavorite) next.delete(storeId); else next.add(storeId);
      return next;
    });
    const { error } = wasFavorite
      ? await db.from("delivery_favoritos").delete().eq("perfil_id", user.id).eq("comercio_id", storeId)
      : await db.from("delivery_favoritos").insert({ perfil_id: user.id, comercio_id: storeId });
    if (error) {
      toast.error(errorMessage(error));
      setIds((current) => {
        const next = new Set(current);
        if (wasFavorite) next.add(storeId); else next.delete(storeId);
        return next;
      });
    }
  }, [ids, user]);

  const value = useMemo(() => ({ ids, isFavorite: (storeId: string) => ids.has(storeId), toggle }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  return context;
}
