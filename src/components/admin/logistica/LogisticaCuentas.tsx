import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Metric, MetricStrip } from "@/components/panel/kit";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Cuenta, EnvioLog, estadoCuenta, EstadoCuenta } from "@/services/logistica";
import { EstadoEnvio } from "@/components/logistica/comun";
import { FormularioEnvio } from "@/components/logistica/FormularioEnvio";

/** CRM de cuentas de Woref Logística: comercios, empresas y particulares, con condiciones comerciales, cuenta corriente y agenda comercial. */

type FilaCuenta = Cuenta & { envios: { count: number }[] };
const ESTADO_CUENTA: Record<Cuenta["estado"], { texto: string; clase: string }> = {
  prospecto: { texto: "Prospecto", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" }, activa: { texto: "Activa", clase: "bg-success/15 text-success" }, suspendida: { texto: "Suspendida", clase: "bg-destructive/10 text-destructive" },
};
const TIPO_CUENTA: Record<Cuenta["tipo"], string> = { comercio: "Comercio de Woref", empresa: "Empresa", particular: "Particular" };

export function LogisticaCuentas() {
  const [abierta, setAbierta] = useState<string | "nueva" | null>(null);
  if (abierta) return <FichaCuenta id={abierta === "nueva" ? null : abierta} onVolver={() => setAbierta(null)} onCreada={(id) => setAbierta(id)} />;
  return <ListaCuentas onAbrir={setAbierta} />;
}

function ListaCuentas({ onAbrir }: { onAbrir: (id: string | "nueva") => void }) {
  const [rows, setRows] = useState<FilaCuenta[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Cuenta["estado"] | "todas">("todas");
  const cargar = useCallback(async () => {
    let query = db.from("log_cuentas").select("*, envios:log_envios(count)").order("updated_at", { ascending: false }).limit(300);
    const t = q.trim().replace(/[%,()]/g, "");
    if (t) query = /^\d+$/.test(t) ? query.or(`numero.eq.${t},cuit.ilike.%${t}%`) : query.or(`razon_social.ilike.%${t}%,nombre_fantasia.ilike.%${t}%,email.ilike.%${t}%`);
    if (estado !== "todas") query = query.eq("estado", estado);
    const { data, error: e } = await query;
    if (e) { setError(e); return; }
    setError(null); setRows(data ?? []);
  }, [q, estado]);
  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-2">{(["todas", "activa", "prospecto", "suspendida"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setEstado(v)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-bold", estado === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{v === "todas" ? "Todas" : ESTADO_CUENTA[v].texto}</button>
        ))}</div>
        <label className="relative lg:ml-auto lg:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Razón social, N.º de cuenta, CUIT, email" className="pl-9" aria-label="Buscar cuentas" /></label>
        <Button className="rounded-full" onClick={() => onAbrir("nueva")}><Plus className="mr-1.5 h-4 w-4" /> Nueva cuenta</Button>
      </div>
      {error && !rows ? <ErrorState error={error} onRetry={cargar} /> : !rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState icon={<Building2 className="h-7 w-7" />} title="No hay cuentas con este filtro" text="Los comercios de Woref tienen su cuenta automáticamente al crear su primer envío. Las empresas y particulares se dan de alta acá." /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground"><tr><th className="p-3">Cuenta</th><th className="p-3">Tipo</th><th className="p-3">Contacto</th><th className="p-3">Condición</th><th className="p-3">Estado</th><th className="p-3 text-right">Envíos</th></tr></thead>
            <tbody className="divide-y">{rows.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onAbrir(c.id)}>
                <td className="p-3"><p className="font-semibold">{c.razon_social}</p><p className="text-xs text-muted-foreground">N.º {c.numero}{c.cuit ? ` · CUIT ${c.cuit}` : ""}{c.etiquetas.length ? ` · ${c.etiquetas.join(", ")}` : ""}</p></td>
                <td className="p-3 text-xs">{TIPO_CUENTA[c.tipo]}</td>
                <td className="p-3 text-xs">{c.contacto_nombre ?? "—"}<br /><span className="text-muted-foreground">{c.email ?? c.telefono ?? ""}</span></td>
                <td className="p-3 text-xs">{c.condicion_pago === "cuenta_corriente" ? `Cta. cte.${c.limite_credito > 0 ? ` (${money(c.limite_credito)})` : ""}` : "Contado"}</td>
                <td className="p-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_CUENTA[c.estado].clase)}>{ESTADO_CUENTA[c.estado].texto}</span></td>
                <td className="p-3 text-right font-semibold tabular-nums">{c.envios?.[0]?.count ?? 0}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Actividad = { id: string; tipo: string; titulo: string; detalle: string | null; vence_at: string | null; completada_at: string | null; created_at: string };
type Rendicion = { id: string; numero: number; monto: number; cantidad: number; estado: "pendiente" | "pagada"; referencia: string | null; created_at: string };
type Pago = { id: string; monto: number; medio: string; referencia: string | null; fecha: string };
const TIPOS_ACT: Record<string, string> = { nota: "Nota", llamada: "Llamada", email: "Email", reunion: "Reunión", tarea: "Tarea", whatsapp: "WhatsApp" };

function FichaCuenta({ id, onVolver, onCreada }: { id: string | null; onVolver: () => void; onCreada: (id: string) => void }) {
  const [c, setC] = useState<Cuenta | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ tipo: "empresa", estado: "activa", condicion_pago: "contado", limite_credito: "0" });
  const [tarifarios, setTarifarios] = useState<{ id: string; nombre: string; por_defecto: boolean }[]>([]);
  const [ec, setEc] = useState<EstadoCuenta | null>(null);
  const [envios, setEnvios] = useState<EnvioLog[]>([]);
  const [acts, setActs] = useState<Actividad[]>([]);
  const [rend, setRend] = useState<Rendicion[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [nuevaAct, setNuevaAct] = useState({ tipo: "llamada", titulo: "", detalle: "", vence_at: "" });
  const [busy, setBusy] = useState(false);
  const [creandoEnvio, setCreandoEnvio] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    const { data: t } = await db.from("log_tarifarios").select("id, nombre, por_defecto").eq("activo", true).order("nombre");
    setTarifarios(t ?? []);
    if (!id) return;
    const [a, b, d, r, p] = await Promise.all([
      db.from("log_cuentas").select("*").eq("id", id).single(),
      db.from("log_envios").select("*").eq("cuenta_id", id).order("created_at", { ascending: false }).limit(30),
      db.from("log_actividades").select("*").eq("cuenta_id", id).order("created_at", { ascending: false }),
      db.from("log_rendiciones").select("*").eq("cuenta_id", id).order("created_at", { ascending: false }).limit(20),
      db.from("log_pagos").select("*").eq("cuenta_id", id).order("fecha", { ascending: false }).limit(20),
    ]);
    if (a.error) { setError(a.error); return; }
    const cu = a.data as Cuenta;
    setC(cu); setEnvios(b.data ?? []); setActs(d.data ?? []); setRend(r.data ?? []); setPagos(p.data ?? []);
    setForm(Object.fromEntries(Object.entries(cu).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v)])));
    estadoCuenta(id).then(setEc).catch(() => setEc(null));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const guardar = async () => {
    setBusy(true);
    const p = { ...form, etiquetas: (form.etiquetas ?? "").split(",").map((x) => x.trim()).filter(Boolean), limite_credito: Number(form.limite_credito) || 0 };
    const { data, error: e } = await db.rpc("log_cuenta_guardar", { p_id: id, p });
    setBusy(false);
    if (e) return toast.error(errorMessage(e));
    toast.success(id ? "Cuenta guardada" : "Cuenta creada");
    if (!id) onCreada(data); else cargar();
  };
  const run = async (fn: () => Promise<{ error: unknown }>, ok: string) => { const { error: e } = await fn(); if (e) toast.error(errorMessage(e)); else { toast.success(ok); cargar(); } };
  const pago = async () => {
    const monto = await pedirTexto({ titulo: "Registrar pago", etiqueta: "Monto recibido ($)", placeholder: "0", confirmar: "Siguiente" });
    if (!monto) return;
    const ref = await pedirTexto({ titulo: "Referencia del pago", descripcion: "Transferencia: número de operación. Se registra como transferencia.", etiqueta: "Referencia", obligatorio: false, confirmar: "Registrar pago" });
    if (ref === null) return;
    run(() => db.rpc("log_pago_registrar", { p_cuenta: id, p_monto: Number(monto.replace(/[^\d.,]/g, "").replace(",", ".")), p_medio: "transferencia", p_referencia: ref }), "Pago registrado");
  };
  const pagarRendicion = async (r: Rendicion) => {
    const ref = await pedirTexto({ titulo: `Transferir rendición ${r.numero}`, descripcion: `${money(r.monto)} por ${r.cantidad} cobros contra reembolso. Avisamos al cliente.`, etiqueta: "Referencia de la transferencia", confirmar: "Marcar transferida" });
    if (ref !== null) run(() => db.rpc("log_rendicion_pagar", { p_id: r.id, p_referencia: ref }), "Rendición transferida");
  };
  const agregarAct = async () => {
    const { error: e } = await db.rpc("log_actividad_guardar", { p_cuenta: id, p_id: null, p: { ...nuevaAct, vence_at: nuevaAct.vence_at ? new Date(nuevaAct.vence_at).toISOString() : "" } });
    if (e) return toast.error(errorMessage(e));
    setNuevaAct({ tipo: "llamada", titulo: "", detalle: "", vence_at: "" }); cargar();
  };

  if (error) return <ErrorState error={error} onRetry={cargar} />;
  if (id && !c) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (creandoEnvio && c) return (
    <div className="space-y-4">
      <button type="button" onClick={() => setCreandoEnvio(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {c.razon_social}</button>
      <h2 className="text-xl font-extrabold">Nuevo envío para la cuenta {c.numero}</h2>
      <FormularioEnvio cuenta={c} onCreado={(r) => { toast.success(`Envío ${r.numero} creado`); setCreandoEnvio(false); cargar(); }} />
    </div>
  );

  const campo = (k: string, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => <label className="text-xs font-semibold">{label}<Input value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="mt-1" {...extra} /></label>;
  const select = (k: string, label: string, opciones: [string, string][]) => (
    <label className="text-xs font-semibold">{label}<select value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
  );
  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Cuentas</button>
      <header className="flex flex-wrap items-center gap-3">
        <div><p className="text-xs font-semibold text-muted-foreground">{c ? `Cuenta N.º ${c.numero} · ${TIPO_CUENTA[c.tipo]}` : "Nueva cuenta"}</p><h2 className="text-2xl font-extrabold">{c?.razon_social ?? "Alta de cuenta"}</h2></div>
        {c && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_CUENTA[c.estado].clase)}>{ESTADO_CUENTA[c.estado].texto}</span>}
        {c && c.estado === "activa" && <Button className="ml-auto rounded-full" onClick={() => setCreandoEnvio(true)}><Plus className="mr-1.5 h-4 w-4" /> Crear envío</Button>}
      </header>
      {c && ec && (
        <MetricStrip cols={4}>
          <Metric label="Saldo" value={money(ec.saldo)} hint={`Facturado ${money(ec.facturado)} · pagado ${money(ec.pagado)}`} />
          <Metric label="Este mes" value={ec.mes_envios} hint={money(ec.mes_monto)} />
          <Metric label="CR cobrado sin rendir" value={money(ec.reembolsos_sin_rendir)} />
          <Metric label="Rendiciones pendientes" value={money(ec.rendiciones_pendientes)} />
        </MetricStrip>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 font-bold">Datos y condiciones comerciales</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {select("tipo", "Tipo", [["empresa", "Empresa"], ["particular", "Particular"], ["comercio", "Comercio de Woref"]])}
              {select("estado", "Estado", [["activa", "Activa"], ["prospecto", "Prospecto"], ["suspendida", "Suspendida"]])}
              {campo("razon_social", "Razón social", { maxLength: 120 })}{campo("nombre_fantasia", "Nombre de fantasía", { maxLength: 120 })}{campo("cuit", "CUIT", { inputMode: "numeric", maxLength: 13 })}
              {select("condicion_iva", "Condición IVA", [["", "—"], ["responsable_inscripto", "Responsable inscripto"], ["monotributo", "Monotributo"], ["exento", "Exento"], ["consumidor_final", "Consumidor final"]])}
              {campo("contacto_nombre", "Contacto", { maxLength: 80 })}{campo("email", "Email", { type: "email", maxLength: 160 })}{campo("telefono", "Teléfono", { maxLength: 30 })}
              {campo("direccion_retiro", "Dirección de retiro", { maxLength: 200 })}{campo("ciudad", "Ciudad", { maxLength: 80 })}{campo("provincia", "Provincia", { maxLength: 60 })}{campo("cp", "CP", { inputMode: "numeric", maxLength: 4 })}
              {select("tarifario_id", "Tarifario", [["", "General (por defecto)"], ...tarifarios.filter((t) => !t.por_defecto).map((t) => [t.id, t.nombre] as [string, string])])}
              {select("condicion_pago", "Forma de pago", [["contado", "Contado"], ["cuenta_corriente", "Cuenta corriente"]])}
              {campo("limite_credito", "Límite de crédito ($, 0 = sin límite)", { inputMode: "numeric" })}
              {campo("etiquetas", "Etiquetas (separadas por coma)", { maxLength: 200 })}
            </div>
            <label className="mt-3 block text-xs font-semibold">Notas internas<Textarea value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} maxLength={2000} className="mt-1 min-h-[70px]" /></label>
            <Button className="mt-3 rounded-full" disabled={busy || (form.razon_social ?? "").trim().length < 2} onClick={guardar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{id ? "Guardar cambios" : "Crear cuenta"}</Button>
          </section>
          {c && (
            <section className="rounded-2xl border bg-card">
              <h3 className="border-b p-4 font-bold">Últimos envíos</h3>
              {envios.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Sin envíos todavía.</p> : (
                <ul className="divide-y">{envios.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 p-3 text-sm"><span className="font-mono text-xs font-bold">{e.numero}</span><span className="min-w-0 flex-1 truncate">{e.des_nombre} · {e.des_ciudad}</span><EstadoEnvio estado={e.estado} /><span className="w-24 text-right tabular-nums">{money(e.precio_total)}</span></li>
                ))}</ul>
              )}
            </section>
          )}
        </div>
        {c && (
          <aside className="space-y-4">
            <section className="rounded-2xl border bg-card p-4">
              <h3 className="mb-2 font-bold">Agenda comercial</h3>
              <div className="space-y-2">
                <div className="flex gap-2"><select value={nuevaAct.tipo} onChange={(e) => setNuevaAct({ ...nuevaAct, tipo: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Tipo">{Object.entries(TIPOS_ACT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <Input value={nuevaAct.titulo} onChange={(e) => setNuevaAct({ ...nuevaAct, titulo: e.target.value })} placeholder="Ej.: Llamar por tarifa especial" maxLength={120} className="h-9" aria-label="Título" /></div>
                <Textarea value={nuevaAct.detalle} onChange={(e) => setNuevaAct({ ...nuevaAct, detalle: e.target.value })} placeholder="Detalle (opcional)" maxLength={2000} className="min-h-[56px]" aria-label="Detalle" />
                <div className="flex gap-2"><Input type="datetime-local" value={nuevaAct.vence_at} onChange={(e) => setNuevaAct({ ...nuevaAct, vence_at: e.target.value })} className="h-9" aria-label="Vence" />
                  <Button size="sm" className="h-9 rounded-full" disabled={nuevaAct.titulo.trim().length < 2} onClick={agregarAct}>Agregar</Button></div>
              </div>
              <ul className="mt-3 space-y-2">{acts.map((a) => (
                <li key={a.id} className={cn("rounded-xl border p-2.5 text-sm", a.completada_at && "opacity-60")}>
                  <div className="flex items-start gap-2">
                    <button type="button" aria-label={a.completada_at ? "Marcar pendiente" : "Marcar hecha"} onClick={() => run(() => db.rpc("log_actividad_guardar", { p_cuenta: id, p_id: a.id, p: { ...a, completada: !a.completada_at, vence_at: a.vence_at ?? "" } }), a.completada_at ? "Marcada pendiente" : "Hecho")}
                      className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", a.completada_at && "border-success bg-success text-white")}>{a.completada_at && <Check className="h-3 w-3" />}</button>
                    <div className="min-w-0 flex-1"><p className={cn("font-semibold", a.completada_at && "line-through")}>{TIPOS_ACT[a.tipo] ?? a.tipo} · {a.titulo}</p>{a.detalle && <p className="text-xs text-muted-foreground">{a.detalle}</p>}
                      <p className={cn("text-[11px] text-muted-foreground", !a.completada_at && a.vence_at && new Date(a.vence_at) < new Date() && "font-bold text-destructive")}>{a.vence_at ? `Vence ${formatDateTime(a.vence_at)}` : formatDateTime(a.created_at)}</p></div>
                    <button type="button" aria-label="Borrar" onClick={async () => { if (await confirmar({ titulo: "Borrar actividad", confirmar: "Borrar", peligro: true })) run(() => db.rpc("log_actividad_eliminar", { p_id: a.id }), "Borrada"); }} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}</ul>
            </section>
            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Cuenta corriente</h3><Button size="sm" variant="outline" className="h-8 rounded-full" onClick={pago}>Registrar pago</Button></div>
              {pagos.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos registrados.</p> : <ul className="space-y-1 text-sm">{pagos.map((p) => <li key={p.id} className="flex justify-between"><span>{new Date(`${p.fecha}T12:00:00`).toLocaleDateString("es-AR")} · {p.medio}{p.referencia ? ` · ${p.referencia}` : ""}</span><span className="font-semibold tabular-nums">{money(p.monto)}</span></li>)}</ul>}
            </section>
            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Rendiciones</h3>
                {ec && ec.reembolsos_sin_rendir > 0 && <Button size="sm" className="h-8 rounded-full" onClick={() => run(() => db.rpc("log_rendicion_generar", { p_cuenta: id }), "Rendición generada")}>Generar ({money(ec.reembolsos_sin_rendir)})</Button>}</div>
              {rend.length === 0 ? <p className="text-sm text-muted-foreground">Sin rendiciones.</p> : <ul className="space-y-2 text-sm">{rend.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2"><span>N.º {r.numero} · {r.cantidad} cobros<br /><span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}{r.referencia ? ` · ${r.referencia}` : ""}</span></span>
                  <span className="text-right"><b className="tabular-nums">{money(r.monto)}</b><br />{r.estado === "pendiente" ? <button type="button" className="text-xs font-bold text-primary hover:underline" onClick={() => pagarRendicion(r)}>Marcar transferida</button> : <span className="text-xs font-semibold text-success">Transferida</span>}</span></li>
              ))}</ul>}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
