import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cookie, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EVENTO_ABRIR, guardarConsentimiento, leerConsentimiento } from "@/lib/cookies";
import { isNativeApp } from "@/lib/native";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  { id: "necesarias", titulo: "Necesarias", texto: "Tu sesión y la seguridad de la cuenta, el carrito, la dirección de entrega y el pedido en curso. Sin esto la app no funciona.", fija: true },
  { id: "preferencias", titulo: "Preferencias", texto: "Recordar tu apariencia y accesibilidad, tus productos favoritos y el último panel que usaste." },
  { id: "medicion", titulo: "Medición", texto: "Contar de forma anónima las visitas a las tiendas y desde qué canal llegan los pedidos, para que cada comercio vea sus resultados." },
] as const;

/**
 * Aviso de cookies: aparece la primera vez y se puede volver a abrir desde el pie ("Preferencias de cookies").
 * Woref no usa publicidad ni rastreadores de terceros; lo opcional queda apagado hasta que la persona acepta.
 */
export function CookieBanner() {
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [configurar, setConfigurar] = useState(false);
  const [eleccion, setEleccion] = useState({ preferencias: true, medicion: true });
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNativeApp()) return;
    const actual = leerConsentimiento();
    if (!actual) setAbierto(true);
    else setEleccion({ preferencias: actual.preferencias, medicion: actual.medicion });
    const reabrir = () => { setConfigurar(true); setAbierto(true); };
    window.addEventListener(EVENTO_ABRIR, reabrir);
    return () => window.removeEventListener(EVENTO_ABRIR, reabrir);
  }, []);

  const visible = abierto && !pathname.startsWith("/vista-previa-tienda");
  // Mientras está abierto reserva su alto al final de la página: así nunca tapa un botón (p. ej. "Iniciar sesión" en el celular),
  // porque siempre se puede desplazar el contenido por encima del aviso.
  useEffect(() => {
    const el = caja.current;
    if (!visible || !el) return;
    const ajustar = () => { document.body.style.paddingBottom = `${el.offsetHeight + 8}px`; };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(el);
    return () => { obs.disconnect(); document.body.style.paddingBottom = ""; };
  }, [visible, configurar]);

  // No se muestra dentro de la vista previa del editor de tiendas.
  if (!visible) return null;

  const decidir = (valor: { preferencias: boolean; medicion: boolean }) => { guardarConsentimiento(valor); setEleccion(valor); setAbierto(false); setConfigurar(false); };

  return (
    <div ref={caja} role="dialog" aria-modal="false" aria-labelledby="cookies-titulo" aria-describedby="cookies-texto"
      className="pb-safe fixed inset-x-0 bottom-0 z-[60] p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[420px] sm:p-0">
      <div className="max-h-[80vh] overflow-y-auto rounded-3xl border bg-card p-4 text-card-foreground shadow-pop sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-yellow/25 text-brand-yellow-foreground"><Cookie className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="cookies-titulo" className="text-base font-extrabold">Cookies en Woref</h2>
            <p id="cookies-texto" className="mt-1 text-sm text-muted-foreground">
              Usamos el almacenamiento de tu navegador para que la app funcione y, si nos dejás, para recordar tus preferencias y medir visitas de forma anónima. No usamos publicidad ni rastreadores de terceros.{" "}
              <Link to="/privacidad#cookies" className="font-bold text-primary underline-offset-2 hover:underline">Más información</Link>
            </p>
          </div>
        </div>

        {configurar && (
          <ul className="mt-4 space-y-2">
            {CATEGORIAS.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border p-3">
                <span className="min-w-0"><span className="block text-sm font-extrabold">{c.titulo}</span><span className="block text-xs text-muted-foreground">{c.texto}</span></span>
                {"fija" in c ? <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted-foreground"><Lock className="h-3.5 w-3.5" />Siempre</span>
                  : <Switch checked={eleccion[c.id]} onCheckedChange={(v) => setEleccion((e) => ({ ...e, [c.id]: v }))} aria-label={`Permitir cookies de ${c.titulo.toLowerCase()}`} />}
              </li>
            ))}
          </ul>
        )}

        <div className={cn("mt-4 grid gap-2", configurar ? "grid-cols-2" : "grid-cols-3")}>
          {configurar ? (
            <>
              <Button variant="outline" className="rounded-full font-bold" onClick={() => decidir({ preferencias: false, medicion: false })}>Solo necesarias</Button>
              <Button className="rounded-full font-bold" onClick={() => decidir(eleccion)}>Guardar elección</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="rounded-full px-2 font-bold" onClick={() => setConfigurar(true)}>Configurar</Button>
              <Button variant="outline" className="rounded-full px-2 font-bold" onClick={() => decidir({ preferencias: false, medicion: false })}>Rechazar</Button>
              <Button className="rounded-full px-2 font-bold" onClick={() => decidir({ preferencias: true, medicion: true })}>Aceptar</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
