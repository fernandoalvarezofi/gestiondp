import { Link } from "react-router-dom";
import { ArrowLeft, LifeBuoy } from "lucide-react";

/**
 * Barra mínima de los procesos de alta (repartidor, conductor): siempre deja volver a la app o pedir ayuda.
 * Antes la verificación ocupaba toda la pantalla sin ninguna salida.
 */
export function OnboardingBar() {
  return (
    <div className="sticky top-0 z-30 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-2 sm:px-4">
        <Link to="/app" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold hover:bg-muted"><ArrowLeft className="h-4 w-4" />Volver a Woref</Link>
        <Link to="/app/ayuda" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"><LifeBuoy className="h-4 w-4" />Ayuda</Link>
      </div>
    </div>
  );
}
