import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlarmClock, ChevronLeft, ChevronRight, Download, Loader2, MessageCircle, Plus, Search, Send, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Metric, MetricStrip, PageIntro } from "@/components/panel/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, toCsv } from "@/lib/csv";
import { errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  Contacto, etiquetasCrm, FiltroLista, guardarContacto, iniciales, listarClientes, relativo, resumenCrm, ResumenCrm, Segmento, SEGMENTOS,
} from "@/services/crm";
import { useMerchant } from "../context";

const PAGINA = 50;
type Chip = Segmento | "con_tareas" | "marketing" | "todos";
const CHIPS: { id: Chip; texto: string }[] = [
  { id: "todos", texto: "Todos" }, { id: "nuevo", texto: "Nuevos" }, { id: "recurrente", texto: "Recurrentes" }, { id: "vip", texto: "VIP" },
  { id: "inactivo", texto: "Inactivos" }, { id: "interesado", texto: "Interesados" }, { id: "ocasional", texto: "Ocasionales" },
  { id: "con_tareas", texto: "Con seguimientos" }, { id: "marketing", texto: "Aceptan novedades" },
];
/** Segmento del CRM -> segmento de Campañas (avisos push), cuando hay uno equivalente. */
const A_CAMPANA: Partial<Record<Chip, string>> = { todos: "todos_clientes", nuevo: "nuevos", inactivo: "inactivos", recurrente: "recientes" };

/** CRM del comercio: clientes con su relación real con el local (compras, turnos, conversaciones y seguimientos). */
export default function CrmClientes() {
  const { store } = useMerchant();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chip = (params.get("segmento") as Chip) || "todos";
  const etiqueta = params.get("etiqueta") || "";
  const orden = (params.get("orden") as FiltroLista["orden"]) || "reciente";
  const [texto, setTexto] = useState(params.get("q") || "");
  const [q, setQ] = useState(texto);
  const [offset, setOffset] = useState(0);
  const [lista, setLista] = useState<{ total: number; items: Contacto[] } | null>(null);
  const [resumen, setResumen] = useState<ResumenCrm | null>(null);
  const [etiquetas, setEtiquetas] = useState<{ etiqueta: string; cantidad: number }[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [exportando, setExportando] = useState(false);
  const pedido = useRef(0);

  const setParam = (clave: string, valor: string | null) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(clave, valor); else p.delete(clave);
    setParams(p, { replace: true });
    setOffset(0);
  };
  useEffect(() => { const t = window.setTimeout(() => { setQ(texto); setOffset(0); }, 300); return () => window.clearTimeout(t); }, [texto]);

  const filtro: FiltroLista = useMemo(() => ({ q, segmento: chip === "todos" ? null : chip, etiqueta: etiqueta || null, orden }), [q, chip, etiqueta, orden]);

  const cargar = useCallback(async () => {
    const actual = ++pedido.current;
    setCargando(true); setError(null);
    try {
      const r = await listarClientes(store.id, filtro, PAGINA, offset);
      if (actual === pedido.current) setLista(r);
    } catch (e) { if (actual === pedido.current) setError(new Error(errorMessage(e))); }
    finally { if (actual === pedido.current) setCargando(false); }
  }, [store.id, filtro, offset]);
  useEffect(() => { cargar(); }, [cargar]);

  const cargarResumen = useCallback(() => {
    resumenCrm(store.id).then(setResumen, () => undefined);
    etiquetasCrm(store.id).then(setEtiquetas, () => undefined);
  }, [store.id]);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  const exportar = async () => {
    setExportando(true);
    try {
      const r = await listarClientes(store.id, filtro, 5000, 0);
      const csv = toCsv(["Nombre", "Teléfono", "Email", "Segmento", "Etiquetas", "Pedidos", "Turnos", "Gastado", "Última interacción", "Acepta novedades", "Con cuenta Woref"],
        r.items.map((c) => [c.nombre, c.telefono ?? "", c.email ?? "", SEGMENTOS[c.segmento].texto, c.etiquetas.join(", "), c.pedidos, c.turnos, Number(c.gastado),
          c.ultima_interaccion ? formatDateTime(c.ultima_interaccion) : "", c.acepta_marketing ? "sí" : "no", c.con_cuenta ? "sí" : "no"]));
      downloadCsv(`clientes-${store.slug || "local"}.csv`, csv);
      toast.success(`Exportamos ${r.items.length} clientes`);
    } catch (e) { toast.error(errorMessage(e, "No pudimos exportar")); }
    finally { setExportando(false); }
  };

  const total = lista?.total ?? 0;
  const conteo = (c: Chip) => (!resumen ? null : c === "todos" ? resumen.total : c === "con_tareas" ? null : c === "marketing" ? resumen.con_marketing : resumen.segmentos[c as Segmento] ?? 0);
  const campana = A_CAMPANA[chip];

  return (
    <div className="space-y-5">
      <PageIntro title="Clientes" description="Quiénes te compran y reservan, cómo es su relación con tu local y a quién conviene contactar."
        actions={<>
          <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/app/comercio/clientes/seguimientos"><AlarmClock className="h-4 w-4" />Seguimientos{resumen && resumen.tareas_pendientes > 0 && <span className="rounded-full bg-foreground px-1.5 text-[11px] text-background">{resumen.tareas_pendientes}</span>}</Link></Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={exportar} disabled={exportando || !total}>{exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exportar</Button>
          <Button size="sm" className="rounded-full" onClick={() => setNuevo(true)}><Plus className="h-4 w-4" />Nuevo cliente</Button>
        </>} />

      <MetricStrip cols={5}>
        <Metric label="Clientes" value={resumen ? resumen.total : "…"} hint={resumen ? `${resumen.nuevos_30d} nuevos en 30 días` : undefined} />
        <Metric label="Recurrentes y VIP" value={resumen ? (resumen.segmentos.recurrente ?? 0) + (resumen.segmentos.vip ?? 0) : "…"} hint="Vuelven a comprar o reservar" />
        <Metric label="Seguimientos vencidos" value={resumen ? resumen.tareas_vencidas : "…"} hint={resumen ? `${resumen.tareas_hoy} para hoy` : undefined} />
        <Metric label="Consultas sin responder" value={resumen ? resumen.consultas_sin_responder : "…"} hint={<Link to="/app/comercio/mensajes" className="font-bold text-primary hover:underline">Ir a mensajes</Link>} />
        <Metric label="Aceptan novedades" value={resumen ? resumen.con_marketing : "…"} hint="Con consentimiento" />
      </MetricStrip>

      <div className="space-y-3 rounded-2xl border bg-card p-3">
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Segmentos">
          {CHIPS.map((c) => {
            const n = conteo(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={chip === c.id} title={c.id in SEGMENTOS ? SEGMENTOS[c.id as Segmento].ayuda : undefined}
                onClick={() => setParam("segmento", c.id === "todos" ? null : c.id)}
                className={cn("h-8 shrink-0 rounded-full border px-3 text-[13px] font-bold transition-colors", chip === c.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {c.texto}{n != null && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border bg-background px-4">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, teléfono o email" aria-label="Buscar cliente" maxLength={80} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {etiquetas.length > 0 && (
            <select aria-label="Etiqueta" value={etiqueta} onChange={(e) => setParam("etiqueta", e.target.value || null)} className="h-10 rounded-full border bg-background px-3 text-sm font-semibold">
              <option value="">Todas las etiquetas</option>
              {etiquetas.map((t) => <option key={t.etiqueta} value={t.etiqueta}>{t.etiqueta} ({t.cantidad})</option>)}
            </select>
          )}
          <select aria-label="Ordenar" value={orden} onChange={(e) => setParam("orden", e.target.value === "reciente" ? null : e.target.value)} className="h-10 rounded-full border bg-background px-3 text-sm font-semibold">
            <option value="reciente">Actividad reciente</option>
            <option value="gasto">Más gastaron</option>
            <option value="operaciones">Más compras y turnos</option>
            <option value="nombre">Nombre (A-Z)</option>
            <option value="antiguedad">Más antiguos</option>
          </select>
        </div>
        {campana && total > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <Send className="h-4 w-4" />¿Querés avisarles algo?
            <Link to={`/app/comercio/campanas?segmento=${campana}`} className="font-bold text-primary hover:underline">Enviar una campaña a este grupo</Link>
          </p>
        )}
      </div>

      {error ? <ErrorState title="No pudimos cargar tus clientes" error={error} onRetry={cargar} />
        : !lista ? <div className="space-y-2" aria-busy="true" aria-label="Cargando clientes">{[0, 1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-16 w-full rounded-2xl" />)}</div>
        : lista.items.length === 0 ? (
          (resumen?.total ?? 0) === 0 && !q && chip === "todos" && !etiqueta
            ? <EmptyState icon={<Users className="h-7 w-7" />} title="Todavía no tenés clientes" text="Cada persona que te compra, reserva un turno o te escribe aparece acá sola. También podés cargar clientes a mano." action={<Button className="rounded-full" onClick={() => setNuevo(true)}><Plus className="h-4 w-4" />Cargar un cliente</Button>} />
            : <EmptyState icon={<Search className="h-7 w-7" />} title="Ningún cliente coincide" text="Probá con otro texto, otro segmento u otra etiqueta." />
        ) : (
          <div className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", cargando && "opacity-60")} aria-busy={cargando}>
            {/* Escritorio: tabla. Celular: lista con lo esencial. */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b bg-muted/40 text-left text-[12.5px] text-muted-foreground">
                <tr><th className="p-3 font-semibold">Cliente</th><th className="p-3 font-semibold">Contacto</th><th className="p-3 font-semibold">Segmento</th><th className="p-3 text-right font-semibold">Compras y turnos</th><th className="p-3 text-right font-semibold">Gastado</th><th className="p-3 font-semibold">Última interacción</th><th className="p-3 font-semibold">Próximo turno</th></tr>
              </thead>
              <tbody className="divide-y">
                {lista.items.map((c) => (
                  <tr key={c.id} tabIndex={0} onClick={() => navigate(`/app/comercio/clientes/${c.id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/app/comercio/clientes/${c.id}`)}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{iniciales(c.nombre)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{c.nombre}</p>
                          <p className="flex flex-wrap gap-1 text-[11.5px] text-muted-foreground">
                            {c.con_cuenta ? "Cuenta Woref" : "Sin cuenta"}
                            {c.etiquetas.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-muted px-1.5 font-semibold text-foreground">{t}</span>)}
                            {c.tareas_vencidas > 0 && <span className="rounded-full bg-destructive/10 px-1.5 font-bold text-destructive">{c.tareas_vencidas} seguimiento vencido</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-[13px]"><p className="tabular-nums">{c.telefono || "—"}</p><p className="truncate text-muted-foreground">{c.email || ""}</p></td>
                    <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", SEGMENTOS[c.segmento].clase)} title={SEGMENTOS[c.segmento].ayuda}>{SEGMENTOS[c.segmento].texto}</span></td>
                    <td className="p-3 text-right tabular-nums">{c.pedidos} <span className="text-muted-foreground">ped.</span> · {c.turnos} <span className="text-muted-foreground">turnos</span></td>
                    <td className="p-3 text-right font-bold tabular-nums">{money(c.gastado)}</td>
                    <td className="p-3 text-[13px] text-muted-foreground">{relativo(c.ultima_interaccion)}</td>
                    <td className="p-3 text-[13px]">{c.proximo_turno ? formatDateTime(c.proximo_turno) : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {lista.items.map((c) => (
                <li key={c.id}>
                  <Link to={`/app/comercio/clientes/${c.id}`} className="flex items-center gap-3 p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{iniciales(c.nombre)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate font-bold">{c.nombre}</span><span className={cn("shrink-0 rounded-full px-1.5 text-[11px] font-bold", SEGMENTOS[c.segmento].clase)}>{SEGMENTOS[c.segmento].texto}</span></span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{c.operaciones} compras y turnos · {money(c.gastado)} · {relativo(c.ultima_interaccion)}</span>
                    </span>
                    {c.tareas_vencidas > 0 && <AlarmClock className="h-4 w-4 shrink-0 text-destructive" aria-label="Seguimiento vencido" />}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[13px]">
              <span className="text-muted-foreground tabular-nums">{offset + 1}–{Math.min(offset + PAGINA, total)} de {total}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={cargando || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGINA))}><ChevronLeft className="h-4 w-4" />Anteriores</Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={cargando || offset + PAGINA >= total} onClick={() => setOffset(offset + PAGINA)}>Siguientes<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground"><MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Ves los datos que cada persona le dio a tu local al comprar, reservar o suscribirse. Usá esos datos solo para atenderla, y las novedades solo con quienes aceptan recibirlas.</p>

      <NuevoClienteDialog open={nuevo} onOpenChange={setNuevo} storeId={store.id} onCreado={(id) => { cargarResumen(); navigate(`/app/comercio/clientes/${id}`); }} />
    </div>
  );
}

/** Alta manual (por ejemplo, alguien que llamó o vino al local y no tiene cuenta). */
export function NuevoClienteDialog({ open, onOpenChange, storeId, onCreado }: { open: boolean; onOpenChange: (v: boolean) => void; storeId: string; onCreado: (id: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [notas, setNotas] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (open) { setNombre(""); setTelefono(""); setEmail(""); setEtiquetas(""); setNotas(""); setAcepta(false); } }, [open]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("Escribí el nombre");
    setGuardando(true);
    try {
      const id = await guardarContacto(storeId, null, { nombre, telefono: telefono || null, email: email || null, notas: notas || null, acepta_marketing: acepta, etiquetas: etiquetas.split(",").map((t) => t.trim()).filter(Boolean) });
      toast.success("Cliente cargado");
      onOpenChange(false);
      onCreado(id);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-2 text-xl font-extrabold"><UserRound className="h-5 w-5" />Nuevo cliente</DialogTitle>
        <DialogDescription>Para alguien que te contactó por teléfono o vino al local. Los clientes que compran o reservan en Woref se agregan solos.</DialogDescription>
        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cn-nombre">Nombre y apellido</Label><Input id="cn-nombre" required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="cn-tel">Teléfono</Label><Input id="cn-tel" type="tel" inputMode="tel" maxLength={30} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="2355 123456" /></div>
          <div className="space-y-1.5"><Label htmlFor="cn-mail">Email</Label><Input id="cn-mail" type="email" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cn-tags">Etiquetas (separadas por coma)</Label><Input id="cn-tags" maxLength={300} value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Ej.: mayorista, cumpleaños en mayo" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cn-notas">Notas internas</Label><Textarea id="cn-notas" maxLength={4000} value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[72px]" /></div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>Aceptó recibir novedades y promociones de tu local</span></label>
          <Button type="submit" className="rounded-full sm:col-span-2" disabled={guardando}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cliente</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
