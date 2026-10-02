import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        // El link de "olvidé mi contraseña" puede caer en cualquier página: llevamos al formulario de contraseña nueva.
        if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/restablecer") {
          window.location.replace("/restablecer");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Si el servidor no puede cerrar la sesión (por ejemplo, cuenta eliminada), igual la borramos de este dispositivo.
    const { error } = await supabase.auth.signOut();
    if (error) {
      try {
        Object.keys(window.localStorage).filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token")).forEach((key) => window.localStorage.removeItem(key));
      } catch { /* sin acceso al almacenamiento: no hay nada que limpiar */ }
    }
    // Dirección y carrito son de la persona que se va: en un dispositivo compartido no deben pasar a la siguiente.
    try {
      window.localStorage.removeItem("woref-delivery-address");
      window.localStorage.removeItem("woref-delivery-cart");
    } catch { /* sin acceso al almacenamiento: no hay nada que limpiar */ }
    window.location.replace("/auth");
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
