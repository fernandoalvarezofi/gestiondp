import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, CheckCheck, CreditCard, Loader2, MessageCircle, Package, RotateCcw, Settings2, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { CATEGORIAS_NOTIFICACION, CategoriaNotificacion, fetchNotificaciones, fetchPreferencias, guardarPreferencia, hace, marcarLeidas, Notificacion, rutaSegura } from "@/services/notifications";

const ICONO: Record<CategoriaNotificacion, typeof Bell> = { pedidos: Package, pagos: CreditCard, turnos: CalendarCheck, devoluciones: RotateCcw, opiniones: Star, mensajes: MessageCircle, sistema: Bell };
const PAGINA = 30;

/** Bandeja de notificaciones: lo nuevo arriba, un toque para abrir y marcar como leído, y las preferencias de aviso al celular. */
export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notificacion[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [prefs, setPrefs] = useState<Record<CategoriaNotificacion, boolean> | null>(null);
  const [verPrefs, setVerPrefs] = useState(false);

  const load = useCallback(async () => {
    try { const rows = await fetchNotificaciones(PAGINA); setItems(rows); setHayMas(rows.length === PAGINA); } catch (error) { toast.error(errorMessage(error)); setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (verPrefs && !prefs) fetchPreferencias().then(setPrefs).catch(() => undefined); }, [verPrefs, prefs]);

  const masViejas = async () => {
    if (!items?.length) return;
    try { const rows = await fetchNotificaciones(PAGINA, items[items.length - 1].id); setItems([...items, ...rows]); setHayMas(rows.length === PAGINA); } catch (error) { toast.error(errorMessage(error)); }
  };
  const abrir = async (n: Notificacion) => {
    if (!n.leida_at) { marcarLeidas([n.id]).catch(() => undefined); setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x)) ?? null); }
    const ruta = rutaSegura(n.url);
    if (ruta) navigate(ruta);
  };
  const todas = async () => { try { await marcarLeidas(); setItems((cur) => cur?.map((x) => ({ ...x, leida_at: x.leida_at ?? new Date().toISOString() })) ?? null); } catch (error) { toast.error(errorMessage(error)); } };
  const cambiar = async (id: CategoriaNotificacion, valor: boolean) => {
    setPrefs((cur) => (cur ? { ...cur, [id]: valor } : cur));
    try { await guardarPreferencia(id, valor); } catch (error) { toast.error(errorMessage(error)); setPrefs((cur) => (cur ? { ...cur, [id]: !valor } : cur)); }
  };
  const sinLeer = (items ?? []).filter((n) => !n.leida_at).length;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Tu cuenta" title="Notificaciones" subtitle={items && (sinLeer ? `${sinLeer} sin leer` : "Estás al día")}
        actions={<div className="flex gap-2">
          {sinLeer > 0 && <Button size="sm" variant="outline" className="rounded-full" onClick={todas}><CheckCheck className="h-4 w-4" />Marcar todo como leído</Button>}
          <Button size="sm" variant={verPrefs ? "secondary" : "ghost"} className="rounded-full" aria-expanded={verPrefs} onClick={() => setVerPrefs((v) => !v)}><Settings2 className="h-4 w-4" />Preferencias</Button>
        </div>} />

      {verPrefs && (
        <section aria-label="Preferencias de aviso" className="mt-5 rounded-3xl border bg-card">
          <div className="border-b p-4"><h2 className="font-extrabold">Avisos al celular</h2><p className="text-sm text-muted-foreground">Todo queda en esta bandeja. Acá elegís de qué querés que te avisemos además al celular o a la computadora.</p></div>
          {!prefs ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
            <ul className="divide-y">
              {CATEGORIAS_NOTIFICACION.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1"><span className="block font-bold">{c.label}</span><span className="block text-sm text-muted-foreground">{c.ayuda}</span></span>
                  <Switch checked={prefs[c.id] !== false} onCheckedChange={(v) => cambiar(c.id, v)} aria-label={`Avisos de ${c.label}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!items ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : items.length === 0 ? <EmptyState className="mt-6" icon={<Bell className="h-7 w-7" />} title="Todavía no tenés notificaciones" text="Acá vas a ver el estado de tus pedidos, pagos, turnos y todo lo que necesite tu atención." />
        : (
          <>
            <ul className="mt-5 divide-y overflow-hidden rounded-3xl border bg-card">
              {items.map((n) => {
                const Icono = ICONO[n.categoria] ?? Bell;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => abrir(n)} className={cn("flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", !n.leida_at && "bg-primary/[0.04]")}>
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", n.leida_at ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}><Icono className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2"><span className={cn("truncate", n.leida_at ? "font-semibold" : "font-extrabold")}>{n.titulo}</span><span className="shrink-0 text-xs text-muted-foreground">{hace(n.created_at)}</span></span>
                        {n.cuerpo && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.cuerpo}</span>}
                      </span>
                      {!n.leida_at && <span aria-label="Sin leer" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {hayMas && <div className="mt-4 flex justify-center"><Button variant="outline" className="rounded-full" onClick={masViejas}>Ver anteriores</Button></div>}
          </>
        )}
    </div>
  );
}
