import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

/**
 * Aviso global de conexión: si se corta internet lo dice en el momento (en vez de dejar que cada acción falle con un error
 * poco claro) y avisa cuando vuelve. Mientras no hay conexión, Supabase reintenta solo las suscripciones en tiempo real.
 */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [recuperada, setRecuperada] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const caida = () => { window.clearTimeout(timer); setRecuperada(false); setOnline(false); };
    const vuelta = () => {
      setOnline(true); setRecuperada(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRecuperada(false), 3500);
    };
    window.addEventListener("offline", caida);
    window.addEventListener("online", vuelta);
    return () => { window.removeEventListener("offline", caida); window.removeEventListener("online", vuelta); window.clearTimeout(timer); };
  }, []);

  if (online && !recuperada) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[100] flex justify-center px-4">
      <div className={online
        ? "flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-bold text-success-foreground shadow-lg"
        : "flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-lg"}>
        {online ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
        {online ? "Conexión recuperada" : "Sin conexión. Lo que hagas ahora no se va a guardar."}
      </div>
    </div>
  );
}
