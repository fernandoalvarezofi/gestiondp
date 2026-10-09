import { CSSProperties, FormEvent, ReactNode, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { db, errorMessage } from "@/lib/delivery";

/** Tiempo que falta hasta una fecha, partido en días, horas, minutos y segundos (nunca negativo). */
export function tiempoRestante(hasta: number, ahora: number): { dias: number; horas: number; min: number; seg: number; terminada: boolean } {
  const ms = Math.max(0, hasta - ahora);
  const total = Math.floor(ms / 1000);
  return { dias: Math.floor(total / 86400), horas: Math.floor((total % 86400) / 3600), min: Math.floor((total % 3600) / 60), seg: total % 60, terminada: ms === 0 };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Reloj de cuenta regresiva. Si la fecha ya pasó, avisa con `onTermino` para ocultar la oferta. */
export function Cuenta({ hasta, style, onTermino }: { hasta: string; style?: CSSProperties; onTermino?: () => void }) {
  const fin = Date.parse(hasta);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(fin)) return;
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [fin]);
  const t = tiempoRestante(fin, ahora);
  useEffect(() => { if (!Number.isNaN(fin) && t.terminada) onTermino?.(); }, [t.terminada, fin, onTermino]);
  if (Number.isNaN(fin) || t.terminada) return null;
  const celdas: [number, string][] = [[t.dias, "días"], [t.horas, "horas"], [t.min, "min"], [t.seg, "seg"]];
  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-label={`Faltan ${t.dias} días, ${t.horas} horas y ${t.min} minutos`}>
      {celdas.map(([valor, etiqueta]) => (
        <div key={etiqueta} className="min-w-[3.6rem] border border-white/30 bg-white/10 px-2 py-2 text-center backdrop-blur sm:min-w-[4.4rem]" style={style}>
          <div className="text-2xl font-black tabular-nums sm:text-3xl">{dos(valor)}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{etiqueta}</div>
        </div>
      ))}
    </div>
  );
}

/** Formulario de suscripción por email de la tienda. Pide consentimiento explícito; el servidor lo exige, valida, ignora repetidos y limita el volumen. */
export function NewsletterForm({ comercioId, boton, preview, buttonStyle, inputStyle }: { comercioId: string; boton: string; preview?: boolean; buttonStyle: CSSProperties; inputStyle?: CSSProperties }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"libre" | "enviando" | "listo">("libre");
  const [error, setError] = useState<string | null>(null);
  const [acepto, setAcepto] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (preview || estado === "enviando") return;
    setError(null);
    if (!acepto) { setError("Marcá la casilla para aceptar recibir novedades."); return; }
    setEstado("enviando");
    const { error: failure } = await db.rpc("delivery_tienda_suscribir", { p_comercio: comercioId, p_email: email, p_consentimiento: true });
    if (failure) { setEstado("libre"); setError(errorMessage(failure, "No pudimos registrar tu email")); return; }
    setEstado("listo");
  };

  if (estado === "listo") {
    return <p className="flex items-center justify-center gap-2 text-lg font-bold" role="status"><Check className="h-5 w-5" />¡Listo! Te avisamos de las novedades.</p>;
  }
  return (
    <form onSubmit={enviar} className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row sm:flex-wrap" noValidate>
      <label className="sr-only" htmlFor="newsletter-email">Tu email</label>
      <input id="newsletter-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} required placeholder="tu@email.com"
        className="h-12 min-w-0 flex-1 border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2" style={inputStyle} />
      <button type="submit" disabled={estado === "enviando"} className="inline-flex h-12 items-center justify-center gap-2 px-6 text-base font-bold transition-opacity hover:opacity-90 disabled:opacity-60" style={buttonStyle}>
        {estado === "enviando" && <Loader2 className="h-4 w-4 animate-spin" />}{boton}
      </button>
      <label className="flex items-start gap-2 text-left text-sm sm:basis-full">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Acepto recibir novedades y ofertas de esta tienda por email. Puedo pedirle a la tienda la baja cuando quiera.</span>
      </label>
      {error && <p className="text-sm font-semibold text-destructive sm:basis-full" role="alert">{error}</p>}
    </form>
  );
}

/** Desplegables de políticas (envíos, cambios, garantía). */
export function Politicas({ items, radius }: { items: { t: string; x: string }[]; radius?: string }): ReactNode {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details key={item.t} className="group border bg-card p-4 text-card-foreground" style={{ borderRadius: radius ?? "var(--sf-radius)" }}>
          <summary className="cursor-pointer list-none font-bold marker:hidden">{item.t}<span className="float-right transition-transform group-open:rotate-45" aria-hidden>＋</span></summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{item.x}</p>
        </details>
      ))}
    </div>
  );
}

/** Envoltorio de una oferta con reloj: cuando la fecha pasa, la oferta desaparece sola de la tienda. */
export function OfertaSeccion({ hasta, radius, children }: { hasta?: string; radius?: string; children: (reloj: ReactNode) => ReactNode }) {
  const [terminada, setTerminada] = useState(false);
  const fin = hasta ? Date.parse(hasta) : NaN;
  if (terminada || (!Number.isNaN(fin) && fin <= Date.now())) return null;
  const reloj = hasta && !Number.isNaN(fin) ? <Cuenta hasta={hasta} style={{ borderRadius: radius }} onTermino={() => setTerminada(true)} /> : null;
  return <>{children(reloj)}</>;
}
