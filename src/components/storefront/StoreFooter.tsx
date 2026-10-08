import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { abrirPreferenciasCookies } from "@/lib/cookies";
import { Banknote, CreditCard, Landmark, MapPin, Store as StoreIcon, Wallet } from "lucide-react";
import { StoreLogo } from "@/components/delivery/StoreCard";
import { DeliveryStore, db, scheduleSummary } from "@/lib/delivery";

type Enlace = { label: string; onClick: () => void };
type Red = { href: string; label: string; icon: ReactNode };

/** Pie de página completo de la tienda: marca, navegación, datos del local, medios de pago y redes. */
export function StoreFooter({ store, enlaces, redes, preview, widthClass }: { store: DeliveryStore; enlaces: Enlace[]; redes: Red[]; preview?: boolean; widthClass: string }) {
  const [pagoOnline, setPagoOnline] = useState(false);
  useEffect(() => {
    if (preview) return;
    db.rpc("delivery_pagos_online_activos").then(({ data }: { data: boolean | null }) => setPagoOnline(Boolean(data)), () => undefined);
  }, [preview]);

  const medios = [
    pagoOnline && { label: "Mercado Pago", icon: <Wallet className="h-4 w-4" /> },
    pagoOnline && { label: "Tarjetas", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Efectivo", icon: <Banknote className="h-4 w-4" /> },
    { label: "Transferencia", icon: <Landmark className="h-4 w-4" /> },
  ].filter(Boolean) as { label: string; icon: ReactNode }[];
  const horario = scheduleSummary(store.horarios);

  return (
    <footer className="mt-4 border-t bg-card text-card-foreground">
      <div className={`mx-auto grid gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-4 ${widthClass}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-3"><StoreLogo store={store} className="h-10 w-10" /><p className="text-lg font-extrabold">{store.nombre}</p></div>
          {store.descripcion && <p className="line-clamp-3 text-sm text-muted-foreground">{store.descripcion}</p>}
          {redes.length > 0 && (
            <div className="flex gap-2 pt-1">
              {redes.map((r) => (
                <a key={r.label} href={preview ? undefined : r.href} target="_blank" rel="noopener noreferrer" aria-label={r.label} className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{r.icon}</a>
              ))}
            </div>
          )}
        </div>

        {enlaces.length > 0 && (
          <nav aria-label="Navegación de la tienda">
            <h2 className="text-sm font-extrabold uppercase tracking-wide">Tienda</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {enlaces.map((e) => <li key={e.label}><button type="button" onClick={e.onClick} className="text-left hover:text-foreground">{e.label}</button></li>)}
            </ul>
          </nav>
        )}

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide">Dónde y cuándo</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {store.direccion && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{store.direccion}</li>}
            {horario && <li className="whitespace-pre-line">{horario}</li>}
            {store.acepta_retiro && <li>Retiro en el local disponible</li>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide">Medios de pago</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {medios.map((m) => <li key={m.label} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-muted-foreground">{m.icon}{m.label}</li>)}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className={`mx-auto flex flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6 ${widthClass}`}>
          <p>© {new Date().getFullYear()} {store.nombre}</p>
          <p className="inline-flex items-center gap-1.5"><StoreIcon className="h-3.5 w-3.5" />Tienda online creada en Woref</p>
          {!preview && <Link to={`/app/tienda/${store.slug}`} className="font-semibold hover:text-foreground">Ver en la app de Woref</Link>}
          {!preview && <button type="button" onClick={abrirPreferenciasCookies} className="font-semibold hover:text-foreground">Cookies</button>}
        </div>
      </div>
    </footer>
  );
}
