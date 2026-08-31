import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Un usuario "necesita onboarding" si su perfil está incompleto:
 * falta nombre, bio o avatar.
 */
export function useOnboardingStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user) return { needsOnboarding: false };

      const { data, error } = await (supabase as any)
        .from("perfiles")
        .select("nombre,bio,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      const vacio = (v: string | null | undefined) => !v || !v.trim();
      const needsOnboarding = !data || vacio(data.nombre) || vacio(data.bio) || vacio(data.avatar_url);

      return { needsOnboarding };
    },
    enabled: !!user,
  });
}
