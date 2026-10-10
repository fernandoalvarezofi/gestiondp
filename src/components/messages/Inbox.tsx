import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bike, CarTaxiFront, Headset, Loader2, MessageCircle, Package, Search, Store, UserRound } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { db } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { fetchBandeja, type HiloBandeja } from "@/services/messaging";
import { ChatThread, estadoContexto } from "./ChatThread";
import { tonoSuave } from "@/lib/tonos";

const FILTROS = [["todas", "Todas"], ["sin_leer", "Sin leer"], ["archivadas", "Archivadas"]] as const;
type Filtro = (typeof FILTROS)[number][0];

const cuando = (v: string) => {
  const d = new Date(v);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

function Avatar({ hilo }: { hilo: HiloBandeja }) {
  if (hilo.logo_url) return <img src={hilo.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  // El ícono es el de la otra parte de la conversación.
  const otro = hilo.rol === "cliente" || hilo.rol === "pasajero"
    ? (hilo.contexto === "viaje" ? "auto" : hilo.canal === "cliente_comercio" || hilo.canal === "consulta" ? "local" : hilo.contexto === "envio" ? "paquete" : "repartidor")
    : hilo.rol === "comercio" ? (hilo.canal === "comercio_repartidor" ? "repartidor" : "persona")
    : hilo.rol === "repartidor" ? (hilo.canal === "comercio_repartidor" ? "local" : "persona")
    : "persona";
  const Icon = { auto: CarTaxiFront, local: Store, paquete: Package, repartidor: Bike, persona: UserRound }[otro];
  const color = ({ auto: "tinta", local: "violeta", paquete: "amarillo", repartidor: "naranja", persona: "azul" } as const)[otro];
  return <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tonoSuave(color))}><Icon className="h-5 w-5" /></span>;
}

/**
 * Bandeja de mensajes de un contexto. Todas las conversaciones surgen de una relación válida
 * (pedido, viaje, envío o consulta a un local): no se le puede escribir a cualquiera.
 * En el celular se ve una cosa a la vez (lista o conversación).
 */
export function Inbox({ comercio, rol, vacio, extra, accion }: { comercio?: string; rol?: "cliente" | "repartidor" | "conductor"; vacio: { titulo: string; texto: string; accion?: ReactNode }; extra?: ReactNode; /** Botón para empezar una conversación nueva (por ejemplo, "Nueva consulta"). */ accion?: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const activa = params.get("h");
  const [filas, setFilas] = useState<HiloBandeja[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => { setFilas(await fetchBandeja({ comercio, rol }).catch(() => [])); }, [comercio, rol]);
  useEffect(() => {
    cargar();
    // Cualquier mensaje nuevo visible para mí refresca la lista (las políticas de lectura filtran lo ajeno).
    const ch = db.channel(`bandeja-${crypto.randomUUID()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "msg_mensajes" }, cargar).subscribe();
    const timer = window.setInterval(cargar, 45000);
    return () => { db.removeChannel(ch); window.clearInterval(timer); };
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (filas ?? []).filter((f) => (filtro === "archivadas" ? f.archivado : !f.archivado) && (filtro !== "sin_leer" || f.sin_leer > 0)
      && (!q || `${f.titulo} ${f.subtitulo} ${f.ultimo_texto ?? ""}`.toLowerCase().includes(q)));
  }, [filas, filtro, busqueda]);
  const actual = filas?.find((f) => f.id === activa) ?? null;

  if (!filas) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (filas.length === 0 && !activa) return <div className="space-y-4">{extra}<EmptyState icon={<MessageCircle className="h-7 w-7" />} title={vacio.titulo} text={vacio.texto} action={accion ?? vacio.accion} /></div>;

  return (
    <div className="space-y-4">
      <div className={cn(activa && "max-md:hidden")}>{extra}</div>
      <div className="grid overflow-hidden rounded-3xl border bg-card md:h-[min(680px,calc(100vh-13rem))] md:grid-cols-[340px_1fr]">
        <div className={cn("flex min-h-0 flex-col md:border-r", activa && "max-md:hidden")}>
          <div className="space-y-2 border-b p-3">
            {accion && <div className="flex">{accion}</div>}
            <label className="flex h-10 items-center gap-2 rounded-full border bg-background px-3 text-sm focus-within:border-primary">
              <Search className="h-4 w-4 text-muted-foreground" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar" aria-label="Buscar conversaciones" className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            <div className="flex gap-1" role="group" aria-label="Filtrar conversaciones">
              {FILTROS.map(([id, label]) => {
                const n = id === "sin_leer" ? filas.filter((f) => !f.archivado && f.sin_leer > 0).length : 0;
                return <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={cn("rounded-full px-3 py-1 text-xs font-bold", filtro === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{label}{n > 0 && ` · ${n}`}</button>;
              })}
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {visibles.map((f) => {
              const estado = estadoContexto(f.contexto, f.estado);
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => setParams({ h: f.id })} aria-current={f.id === activa ? "true" : undefined} className={cn("flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60", f.id === activa && "bg-primary/5")}>
                    <Avatar hilo={f} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><span className={cn("truncate", f.sin_leer ? "font-extrabold" : "font-bold")}>{f.titulo}</span><span className="shrink-0 text-[11px] text-muted-foreground">{cuando(f.ultimo_mensaje_at)}</span></span>
                      <span className="flex items-center gap-1.5 truncate text-[11.5px] font-semibold text-primary">{f.subtitulo}{estado && <span className="text-muted-foreground">· {estado}</span>}</span>
                      <span className="flex items-center justify-between gap-2"><span className={cn("truncate text-sm", f.sin_leer ? "font-semibold text-foreground" : "text-muted-foreground")}>{f.ultimo_mio && "Vos: "}{f.ultimo_texto}</span>
                        {f.sin_leer > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-yellow px-1.5 text-[10px] font-black text-brand-yellow-foreground">{f.sin_leer}</span>}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {visibles.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{filtro === "archivadas" ? "No tenés conversaciones archivadas." : "No hay conversaciones con este filtro."}</li>}
          </ul>
        </div>
        <div className={cn("flex min-h-[70vh] min-w-0 flex-col md:min-h-0", !activa && "max-md:hidden")}>
          {activa ? (
            <>
              <button type="button" onClick={() => setParams({})} className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-bold md:hidden"><ArrowLeft className="h-4 w-4" />{actual?.titulo ?? "Mensajes"}</button>
              <div className="min-h-0 flex-1"><ChatThread hiloId={activa} onActivity={cargar} /></div>
            </>
          ) : <div className="hidden flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground md:flex">Elegí una conversación para verla.</div>}
        </div>
      </div>
    </div>
  );
}

/** Acceso al soporte de Woref (sistema aparte, con tickets): aparece arriba de la bandeja del cliente. */
export function SupportEntry() {
  return (
    <Link to="/app/ayuda" className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/60">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"><Headset className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-extrabold">Soporte Woref</span><span className="block truncate text-sm text-muted-foreground">Problemas con un pedido, pagos o tu cuenta</span></span>
    </Link>
  );
}
