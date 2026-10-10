import { useEffect, useState } from "react";
import { cookiesDecididas, EVENTO_DECIDIDO } from "@/lib/cookies";

/** true cuando el aviso de cookies ya se respondió: las ventanas que se abren solas esperan a que se cierre. */
export function useCookiesDecididas() {
  const [listo, setListo] = useState(cookiesDecididas);
  useEffect(() => {
    if (listo) return;
    const marcar = () => setListo(true);
    window.addEventListener(EVENTO_DECIDIDO, marcar);
    return () => window.removeEventListener(EVENTO_DECIDIDO, marcar);
  }, [listo]);
  return listo;
}
