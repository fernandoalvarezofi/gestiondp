import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, ArrowLeft, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { PageIntro } from "@/components/panel/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { listarTareas, marcarTarea, relativo, Tarea, whatsappUrl } from "@/services/crm";
import { useMerchant } from "../context";

type Filtro = "vencidas" | "hoy" | "proximas" | "completadas";
const FILTROS: { id: Filtro; texto: string }[] = [{ id: "vencidas", texto: "Vencidos" }, { id: "hoy", texto: "Para hoy" }, { id: "proximas", texto: "Próximos" }, { id: "completadas", texto: "Hechos" }];

/** Seguimientos del local: las tareas de contacto con clientes, de todo el equipo, ordenadas por urgencia. */
export default function CrmSeguimientos() {
  const { store } = useMerchant();
  const [filtro, setFiltro] = useState<Filtro>("vencidas");
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setTareas(await listarTareas(store.id, filtro)); } catch (e) { setError(new Error(errorMessage(e))); }
  }, [store.id, filtro]);
  useEffect(() => { setTareas(null); cargar(); }, [cargar]);

  const marcar = async (t: Tarea) => {
    try { await marcarTarea(t.id, !t.completada_at); toast.success(t.completada_at ? "Seguimiento reabierto" : "¡Hecho!"); cargar(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-5">
      <Link to="/app/comercio/clientes" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Clientes</Link>
      <PageIntro title="Seguimientos" description="A quién tenés que contactar y cuándo. Se crean desde la ficha de cada cliente." />
      <div className="inline-flex rounded-full border bg-card p-0.5" role="tablist" aria-label="Seguimientos">
        {FILTROS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-bold", filtro === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{f.texto}</button>)}
      </div>
      {error ? <ErrorState title="No pudimos cargar los seguimientos" error={error} onRetry={cargar} />
        : !tareas ? <div className="space-y-2">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-16 rounded-2xl" />)}</div>
        : tareas.length === 0 ? (
          <EmptyState icon={<AlarmClock className="h-7 w-7" />} title={filtro === "vencidas" ? "No hay seguimientos vencidos" : filtro === "hoy" ? "Nada para hoy" : filtro === "proximas" ? "No hay seguimientos agendados" : "Todavía no completaste seguimientos"}
            text="Abrí la ficha de un cliente y usá «Seguimiento» para agendar un llamado, un mensaje o una visita." />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {tareas.map((t) => {
              const wa = whatsappUrl(t.telefono);
              const vencida = !t.completada_at && new Date(t.vence_at).getTime() < Date.now();
              return (
                <li key={t.id} className="flex items-start gap-3 p-3">
                  <button type="button" onClick={() => marcar(t)} aria-label={t.completada_at ? "Reabrir" : "Marcar como hecho"}
                    className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", t.completada_at ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-primary")}>
                    {t.completada_at && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-bold", t.completada_at && "line-through opacity-70")}>{t.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link to={`/app/comercio/clientes/${t.contacto_id}`} className="font-semibold text-foreground hover:underline">{t.contacto}</Link>
                      {" · "}<span className={cn(vencida && "font-bold text-destructive")}>{t.completada_at ? `Hecho ${relativo(t.completada_at)}` : `${formatDateTime(t.vence_at)} (${relativo(t.vence_at)})`}</span>
                      {" · "}{t.autor}
                    </p>
                    {t.detalle && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.detalle}</p>}
                  </div>
                  {wa && !t.completada_at && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold hover:bg-muted"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
