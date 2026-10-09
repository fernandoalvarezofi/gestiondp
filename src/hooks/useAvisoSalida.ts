import { useEffect } from "react";

/**
 * Mientras haya cambios sin guardar, el navegador pregunta antes de cerrar o recargar la pestaña.
 * (La navegación interna se protege en cada pantalla con confirmar(), porque BrowserRouter no permite bloquearla.)
 */
export function useAvisoSalida(sinGuardar: boolean) {
  useEffect(() => {
    if (!sinGuardar) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);
}
