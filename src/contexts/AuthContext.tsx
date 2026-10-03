import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mfaPending } from "@/lib/mfa";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Tiene verificación en dos pasos activa pero todavía no confirmó el código en esta sesión. */
  mfaNeeded: boolean;
  refreshMfa: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  mfaNeeded: false,
  refreshMfa: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mfaNeeded, setMfaNeeded] = useState(false);
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

  const refreshMfa = async () => { setMfaNeeded(session ? await mfaPending() : false); };
  // Cada vez que cambia la sesión se vuelve a consultar si falta confirmar el segundo factor.
  useEffect(() => {
    let active = true;
    if (!session) { setMfaNeeded(false); return; }
    mfaPending().then((pending) => { if (active) setMfaNeeded(pending); });
    return () => { active = false; };
  }, [session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, mfaNeeded, refreshMfa, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
