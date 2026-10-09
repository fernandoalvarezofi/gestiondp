import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MessageCircle, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/dialogos";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { cap1, EnEspera, fechaLarga, fetchListaEspera, quitarDeEspera } from "@/services/bookings";
import { whatsappUrl } from "@/services/crm";
import { ClienteLink } from "@/components/merchant/ClienteLink";

/** Lista de espera: quién quiere un lugar qué día. Desde acá se le da un turno, se le escribe o se lo saca de la lista. */
export function EsperaPanel({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<EnEspera[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => { try { setItems(await fetchListaEspera(storeId)); setError(null); } catch (e) { setError(e); } }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const quitar = async (e: EnEspera) => {
    if (!(await confirmar({ titulo: `¿Sacar a ${e.cliente} de la lista?`, descripcion: "Ya no le vamos a avisar si se libera un lugar ese día.", confirmar: "Sacar de la lista", peligro: true }))) return;
    try { await quitarDeEspera(e.id); toast.success("Quitado de la lista de espera"); load(); } catch (err) { toast.error(errorMessage(err)); }
  };

  if (error && !items) return <ErrorState title="No pudimos cargar la lista de espera" error={error} onRetry={load} />;
  if (!items) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!items.length) return <EmptyState icon={<UsersRound className="h-7 w-7" />} title="Nadie está esperando lugar" text="Cuando un día se llena, tus clientes pueden anotarse. Si alguien cancela, les avisamos automáticamente." />;

  const dias = [...new Set(items.map((i) => i.fecha))];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Si se libera un horario, avisamos solos a la primera persona de cada día. También podés darle un turno directamente.</p>
      {dias.map((d) => (
        <section key={d} aria-label={d}>
          <h3 className="mb-1.5 px-1 text-sm font-extrabold">{cap1(fechaLarga(`${d}T15:00:00Z`))}</h3>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {items.filter((i) => i.fecha === d).map((e, n) => {
              const wa = whatsappUrl(e.telefono);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">{n + 1}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <ClienteLink contactoId={e.contacto_id} clienteId={e.cliente_id} className="font-bold">{e.cliente}</ClienteLink>
                    <span className="block truncate text-muted-foreground">{e.servicio}{e.profesional ? ` · con ${e.profesional}` : ""} · se anotó {formatDateTime(e.creado)}</span>
                  </span>
                  {e.avisado_at && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Avisado {formatDateTime(e.avisado_at)}</span>}
                  <div className="flex gap-1.5">
                    {e.contacto_id && <Button asChild size="sm" className="rounded-full"><Link to={`/app/comercio/turnos/calendario?nuevo=1&contacto=${e.contacto_id}`}>Darle turno</Link></Button>}
                    {wa && <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full"><a href={wa} target="_blank" rel="noreferrer" aria-label={`Escribirle a ${e.cliente} por WhatsApp`}><MessageCircle className="h-4 w-4" /></a></Button>}
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-destructive" aria-label={`Sacar a ${e.cliente} de la lista`} onClick={() => quitar(e)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
