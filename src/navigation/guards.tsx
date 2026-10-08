import { ReactNode, Suspense } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { MfaChallenge } from "@/components/account/MfaChallenge";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { contextById, type AppContextId } from "./contexts";

export const FullPageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
);

/** Pantallas del cliente que se pueden ver sin cuenta (como en las apps de delivery: se explora y se pide ingresar al confirmar). */
const PUBLIC_CLIENT = /^\/app(\/(buscar|explorar|servicios|promociones|directorio|carrito|categoria\/[^/]+|tienda\/[^/]+))?\/?$/;
export const isPublicClientPath = (pathname: string) => PUBLIC_CLIENT.test(pathname);

/**
 * Puerta de toda la app (/app/*): espera la sesión, pide el segundo factor si corresponde y
 * manda a ingresar cuando la pantalla no es pública. Los paneles nunca son públicos.
 */
export function SessionGate() {
  const { session, loading, mfaNeeded } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (session && mfaNeeded) return <MfaChallenge />;
  if (!session && !isPublicClientPath(location.pathname)) {
    return <Navigate to={{ pathname: "/auth", search: `?next=${encodeURIComponent(location.pathname + location.search)}` }} replace state={{ from: location.pathname + location.search }} />;
  }
  return <Suspense fallback={<FullPageLoader />}><Outlet /></Suspense>;
}

/** Pantalla "sin permiso" común a todos los contextos (403). */
export function Forbidden({ context, text }: { context: AppContextId; text?: string }) {
  const ctx = contextById(context);
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <EmptyState icon={<ShieldAlert className="h-7 w-7" />} title={`No tenés acceso a ${ctx.label}`} text={text ?? "Tu cuenta no tiene este perfil. Si creés que es un error, escribinos desde Ayuda."}
        action={<Button asChild className="rounded-full"><Link to="/app">Volver al inicio</Link></Button>} />
    </div>
  );
}

/**
 * Guarda de rol para un contexto completo. Solo decide qué se dibuja: la autorización real
 * la hace el servidor (RLS, `has_role`, `delivery_permiso`), así que forzar la URL no da acceso a datos.
 */
export function RequireRole({ context, children }: { context: AppContextId; children: ReactNode }) {
  const roles = useDeliveryRoles();
  if (roles.loading) return <FullPageLoader />;
  if (!contextById(context).has(roles)) return <Forbidden context={context} />;
  return <>{children}</>;
}
