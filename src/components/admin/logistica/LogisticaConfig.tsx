import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pedirTexto } from "@/components/ui/dialogos";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { cotizar, Cotizacion, SERVICIOS, Servicio, Sucursal } from "@/services/logistica";
import { DesgloseCotizacion } from "@/components/logistica/comun";

/** Configuración de Woref Logística: sucursales, zonas por código postal, tarifarios y su matriz de precios, y un cotizador de prueba. */

type Zona = { id: string; nombre: string; cps: string; express: boolean; orden: number };
type Tarifario = { id: string; nombre: string; por_defecto: boolean; kg_extra: number; seguro_pct: number; reembolso_pct: number; retiro_precio: number; divisor_volumetrico: number; dias_estandar: number; dias_prioritario: number; activo: boolean };
type Tarifa = { servicio: Servicio; zona_origen: string; zona_destino: string; hasta_kg: number; precio: number };

/** "{[6070,6080),[1000,1500)}" → "6070-6079, 1000-1499" */
export const rangosTexto = (cps: string) => (cps.match(/\[(\d+),(\d+)\)/g) ?? []).map((r) => { const [a, b] = r.slice(1, -1).split(",").map(Number); return b - 1 === a ? `${a}` : `${a}-${b - 1}`; }).join(", ");

export function LogisticaConfig() {
  const [vista, setVista] = useState<"tarifas" | "zonas" | "sucursales" | "probar">("tarifas");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{([["tarifas", "Tarifarios"], ["zonas", "Zonas"], ["sucursales", "Sucursales"], ["probar", "Probar cotización"]] as const).map(([v, t]) => (
        <button key={v} type="button" onClick={() => setVista(v)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-bold", vista === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{t}</button>
      ))}</div>
      <p className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">Los precios, zonas y la sucursal inicial son <b>de ejemplo</b>: revisalos antes de abrir el servicio. Los cambios se aplican a los envíos nuevos; los ya creados conservan su precio.</p>
      {vista === "tarifas" && <Tarifarios />}
      {vista === "zonas" && <Zonas />}
      {vista === "sucursales" && <Sucursales />}
      {vista === "probar" && <Probar />}
    </div>
  );
}

// ───────────────────────── Tarifarios ─────────────────────────

function Tarifarios() {
  const [lista, setLista] = useState<Tarifario[] | null>(null);
  const [sel, setSel] = useState<string>("");
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [servicio, setServicio] = useState<Servicio>("estandar");
  const [origen, setOrigen] = useState("");
  const [edit, setEdit] = useState<Partial<Tarifario>>({});
  const cargar = useCallback(async () => {
    const [{ data: t }, { data: z }] = await Promise.all([db.from("log_tarifarios").select("*").order("por_defecto", { ascending: false }).order("nombre"), db.from("log_zonas").select("*").order("orden")]);
    setLista(t ?? []); setZonas(z ?? []);
    setSel((s) => s || t?.[0]?.id || ""); setOrigen((o) => o || z?.[0]?.id || "");
  }, []);
  const cargarTarifas = useCallback(async () => { if (!sel) return; const { data } = await db.from("log_tarifas").select("servicio, zona_origen, zona_destino, hasta_kg, precio").eq("tarifario_id", sel); setTarifas(data ?? []); }, [sel]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarTarifas(); setEdit(lista?.find((t) => t.id === sel) ?? {}); }, [cargarTarifas, sel, lista]);

  const bandas = useMemo(() => [...new Set(tarifas.filter((t) => t.servicio === servicio && t.zona_origen === origen).map((t) => Number(t.hasta_kg)))].sort((a, b) => a - b), [tarifas, servicio, origen]);
  const precio = (zd: string, kg: number) => tarifas.find((t) => t.servicio === servicio && t.zona_origen === origen && t.zona_destino === zd && Number(t.hasta_kg) === kg)?.precio;
  const guardarCelda = async (zd: string, kg: number, valor: string) => {
    const actual = precio(zd, kg);
    const nuevo = valor.trim() === "" ? null : Number(valor.replace(",", "."));
    if (nuevo !== null && (!Number.isFinite(nuevo) || nuevo < 0)) return toast.error("Precio inválido");
    if ((actual ?? null) === nuevo) return;
    const { error } = await db.rpc("log_tarifa_guardar", { p_tarifario: sel, p_servicio: servicio, p_zona_origen: origen, p_zona_destino: zd, p_hasta_kg: kg, p_precio: nuevo });
    if (error) return toast.error(errorMessage(error));
    cargarTarifas();
  };
  const agregarBanda = async () => {
    const kg = await pedirTexto({ titulo: "Nueva franja de peso", descripcion: "Precio para envíos de hasta este peso facturable. Después cargás el precio de cada destino.", etiqueta: "Hasta (kg)", placeholder: "10", confirmar: "Agregar" });
    const n = Number((kg ?? "").replace(",", "."));
    if (!kg || !(n > 0)) return;
    const zd = zonas[0]?.id;
    if (!zd) return;
    const { error } = await db.rpc("log_tarifa_guardar", { p_tarifario: sel, p_servicio: servicio, p_zona_origen: origen, p_zona_destino: zd, p_hasta_kg: n, p_precio: 0 });
    if (error) toast.error(errorMessage(error)); else cargarTarifas();
  };
  const guardarTarifario = async (id: string | null, p: Record<string, unknown>) => {
    const { data, error } = await db.rpc("log_tarifario_guardar", { p_id: id, p });
    if (error) { toast.error(errorMessage(error)); return null; }
    toast.success("Tarifario guardado"); await cargar(); return data as string;
  };
  const nuevo = async () => {
    const nombre = await pedirTexto({ titulo: "Nuevo tarifario", descripcion: "Se copian los precios del tarifario elegido; podés aplicar un ajuste porcentual (ej.: -10 para un cliente grande).", etiqueta: "Nombre", placeholder: "Mayoristas", confirmar: "Siguiente" });
    if (!nombre) return;
    const ajuste = await pedirTexto({ titulo: "Ajuste sobre los precios", etiqueta: "Porcentaje (+/-)", inicial: "0", confirmar: "Crear tarifario" });
    if (ajuste === null) return;
    const id = await guardarTarifario(null, { nombre, copiar_de: sel, ajuste_pct: Number(ajuste.replace(",", ".")) || 0 });
    if (id) setSel(id);
  };

  if (!lista) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const tf = lista.find((t) => t.id === sel);
  const num = (k: keyof Tarifario, label: string, sufijo = "") => (
    <label className="text-xs font-semibold">{label}<Input inputMode="decimal" value={String(edit[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="mt-1" aria-label={label} />{sufijo && <span className="text-[10px] text-muted-foreground">{sufijo}</span>}</label>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm font-semibold" aria-label="Tarifario">{lista.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.por_defecto ? " (por defecto)" : ""}</option>)}</select>
        <Button variant="outline" className="rounded-full" onClick={nuevo}><Plus className="mr-1.5 h-4 w-4" /> Nuevo tarifario</Button>
      </div>
      {tf && (
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="mb-3 font-bold">Recargos y plazos</h3>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <label className="text-xs font-semibold">Nombre<Input value={String(edit.nombre ?? "")} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} className="mt-1" /></label>
            {num("kg_extra", "Precio por kg extra ($)", "Sobre la franja más alta")}{num("seguro_pct", "Seguro (% del declarado)")}{num("reembolso_pct", "Comisión contra reembolso (%)")}
            {num("retiro_precio", "Retiro a domicilio ($)")}{num("divisor_volumetrico", "Divisor volumétrico", "cm³ por kg (4000 o 5000)")}{num("dias_estandar", "Días hábiles estándar")}{num("dias_prioritario", "Días hábiles prioritario")}
          </div>
          <Button className="mt-3 rounded-full" onClick={() => guardarTarifario(tf.id, edit as Record<string, unknown>)}>Guardar</Button>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto font-bold">Precios del flete</h3>
          <select value={servicio} onChange={(e) => setServicio(e.target.value as Servicio)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Servicio">{(Object.keys(SERVICIOS) as Servicio[]).map((s) => <option key={s} value={s}>{SERVICIOS[s].texto}</option>)}</select>
          <label className="text-sm">Desde <select value={origen} onChange={(e) => setOrigen(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Zona de origen">{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
          <Button size="sm" variant="outline" className="rounded-full" onClick={agregarBanda}><Plus className="mr-1 h-4 w-4" /> Franja de peso</Button>
        </div>
        {bandas.length === 0 ? <p className="text-sm text-muted-foreground">No hay precios para este servicio y origen. Agregá una franja de peso.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs font-semibold text-muted-foreground"><tr><th className="p-2">Hasta</th>{zonas.map((z) => <th key={z.id} className="p-2">{z.nombre}{servicio === "express" && !z.express ? " ✕" : ""}</th>)}</tr></thead>
              <tbody className="divide-y">{bandas.map((kg) => (
                <tr key={kg}><td className="p-2 font-semibold">{kg} kg</td>
                  {zonas.map((z) => { const p = precio(z.id, kg); return (
                    <td key={z.id} className="p-1.5"><Input key={`${sel}-${servicio}-${origen}-${z.id}-${kg}-${p}`} defaultValue={p ?? ""} placeholder="—" inputMode="decimal" className="h-9 tabular-nums" aria-label={`Hasta ${kg} kg a ${z.nombre}`} onBlur={(e) => guardarCelda(z.id, kg, e.target.value)} /></td>
                  ); })}
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Celda vacía = sin servicio a ese destino. Se guarda al salir de la celda. Express solo se cotiza dentro de la misma zona y si la zona lo permite.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────────────────── Zonas ─────────────────────────

function Zonas() {
  const [zonas, setZonas] = useState<Zona[] | null>(null);
  const [form, setForm] = useState<{ id: string | null; nombre: string; rangos: string; express: boolean; orden: string } | null>(null);
  const cargar = useCallback(async () => { const { data } = await db.from("log_zonas").select("*").order("orden"); setZonas(data ?? []); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const guardar = async () => {
    if (!form) return;
    const { error } = await db.rpc("log_zona_guardar", { p_id: form.id, p_nombre: form.nombre, p_rangos: form.rangos, p_express: form.express, p_orden: Number(form.orden) || 100 });
    if (error) return toast.error(errorMessage(error));
    toast.success("Zona guardada"); setForm(null); cargar();
  };
  if (!zonas) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Cada código postal cae en la primera zona (por orden) que lo contiene. Dejá una zona amplia al final (ej.: 1000-9999) como “Resto del país”.</p>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{zonas.map((z) => (
        <li key={z.id} className="flex flex-wrap items-center gap-3 p-4">
          <span className="w-8 text-xs font-bold text-muted-foreground">{z.orden}</span>
          <div className="min-w-0 flex-1"><p className="font-semibold">{z.nombre}{z.express && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Express</span>}</p><p className="truncate font-mono text-xs text-muted-foreground">{rangosTexto(z.cps)}</p></div>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setForm({ id: z.id, nombre: z.nombre, rangos: rangosTexto(z.cps), express: z.express, orden: String(z.orden) })}>Editar</Button>
        </li>
      ))}</ul>
      {form ? (
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_100px]"><label className="text-xs font-semibold">Nombre<Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={60} className="mt-1" /></label>
            <label className="text-xs font-semibold">Orden<Input value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value.replace(/\D/g, "") })} className="mt-1" /></label></div>
          <label className="block text-xs font-semibold">Códigos postales (ej.: 6070-6079, 6100)<Input value={form.rangos} onChange={(e) => setForm({ ...form, rangos: e.target.value })} className="mt-1 font-mono" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.express} onChange={(e) => setForm({ ...form, express: e.target.checked })} /> Permite Express (entrega en el día dentro de la zona)</label>
          <div className="flex gap-2"><Button className="rounded-full" onClick={guardar}>Guardar</Button><Button variant="ghost" className="rounded-full" onClick={() => setForm(null)}>Cancelar</Button></div>
        </section>
      ) : <Button variant="outline" className="rounded-full" onClick={() => setForm({ id: null, nombre: "", rangos: "", express: false, orden: String((zonas.at(-1)?.orden ?? 0) + 10) })}><Plus className="mr-1.5 h-4 w-4" /> Nueva zona</Button>}
    </div>
  );
}

// ───────────────────────── Sucursales ─────────────────────────

const VACIA = { codigo: "", nombre: "", tipo: "sucursal", direccion: "", ciudad: "", provincia: "Buenos Aires", cp: "", telefono: "", horario: "", activa: true };

function Sucursales() {
  const [lista, setLista] = useState<Sucursal[] | null>(null);
  const [form, setForm] = useState<(typeof VACIA & { id: string | null }) | null>(null);
  const cargar = useCallback(async () => { const { data } = await db.from("log_sucursales").select("*").order("codigo"); setLista(data ?? []); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const guardar = async () => {
    if (!form) return;
    const { id, ...p } = form;
    const { error } = await db.rpc("log_sucursal_guardar", { p_id: id, p });
    if (error) return toast.error(errorMessage(error));
    toast.success("Sucursal guardada"); setForm(null); cargar();
  };
  if (!lista) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const campo = (k: keyof typeof VACIA, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => form && <label className="text-xs font-semibold">{label}<Input value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1" {...extra} /></label>;
  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{lista.map((s) => (
        <li key={s.id} className={cn("flex flex-wrap items-center gap-3 p-4", !s.activa && "opacity-60")}>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold">{s.codigo}</span>
          <div className="min-w-0 flex-1"><p className="font-semibold">{s.nombre} <span className="text-xs font-normal text-muted-foreground">· {s.tipo === "centro" ? "Centro de distribución" : s.tipo === "punto" ? "Punto de retiro" : "Sucursal"}{!s.activa ? " · inactiva" : ""}</span></p><p className="truncate text-xs text-muted-foreground">{s.direccion}, {s.ciudad} ({s.cp}){s.horario ? ` · ${s.horario}` : ""}</p></div>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setForm({ ...VACIA, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ""])), cp: String(s.cp), activa: s.activa, id: s.id })}>Editar</Button>
        </li>
      ))}</ul>
      {form ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {campo("codigo", "Código (2-8 letras/números)", { maxLength: 8 })}{campo("nombre", "Nombre", { maxLength: 80 })}
            <label className="text-xs font-semibold">Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="centro">Centro de distribución</option><option value="sucursal">Sucursal</option><option value="punto">Punto de retiro</option></select></label>
            {campo("direccion", "Dirección", { maxLength: 200 })}{campo("ciudad", "Ciudad", { maxLength: 80 })}{campo("provincia", "Provincia", { maxLength: 60 })}
            {campo("cp", "Código postal", { inputMode: "numeric", maxLength: 4 })}{campo("telefono", "Teléfono", { maxLength: 30 })}{campo("horario", "Horario", { maxLength: 120, placeholder: "Lun a vie 9 a 18 h" })}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa (visible para clientes)</label>
          <div className="flex gap-2"><Button className="rounded-full" onClick={guardar}>Guardar</Button><Button variant="ghost" className="rounded-full" onClick={() => setForm(null)}>Cancelar</Button></div>
        </section>
      ) : <Button variant="outline" className="rounded-full" onClick={() => setForm({ ...VACIA, id: null })}><Plus className="mr-1.5 h-4 w-4" /> Nueva sucursal</Button>}
    </div>
  );
}

// ───────────────────────── Probar cotización ─────────────────────────

function Probar() {
  const [p, setP] = useState({ servicio: "estandar" as Servicio, origen: "6070", destino: "1425", kg: "2", valor: "0", reembolso: "0", retiro: true });
  const [q, setQ] = useState<Cotizacion | null>(null);
  const probar = async () => {
    try { setQ(await cotizar({ servicio: p.servicio, cpOrigen: Number(p.origen), cpDestino: Number(p.destino), bultos: [{ peso_kg: Number(p.kg.replace(",", ".")) || 1 }], valor: Number(p.valor) || 0, reembolso: Number(p.reembolso) || 0, retiro: p.retiro })); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold">Servicio<select value={p.servicio} onChange={(e) => setP({ ...p, servicio: e.target.value as Servicio })} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{(Object.keys(SERVICIOS) as Servicio[]).map((s) => <option key={s} value={s}>{SERVICIOS[s].texto}</option>)}</select></label>
          <label className="text-xs font-semibold">Peso (kg)<Input value={p.kg} onChange={(e) => setP({ ...p, kg: e.target.value })} className="mt-1" /></label>
          <label className="text-xs font-semibold">CP origen<Input value={p.origen} onChange={(e) => setP({ ...p, origen: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="mt-1" /></label>
          <label className="text-xs font-semibold">CP destino<Input value={p.destino} onChange={(e) => setP({ ...p, destino: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="mt-1" /></label>
          <label className="text-xs font-semibold">Valor declarado<Input value={p.valor} onChange={(e) => setP({ ...p, valor: e.target.value.replace(/\D/g, "") })} className="mt-1" /></label>
          <label className="text-xs font-semibold">Contra reembolso<Input value={p.reembolso} onChange={(e) => setP({ ...p, reembolso: e.target.value.replace(/\D/g, "") })} className="mt-1" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.retiro} onChange={(e) => setP({ ...p, retiro: e.target.checked })} /> Con retiro a domicilio</label>
        <Button className="rounded-full" onClick={probar}>Cotizar con el tarifario general</Button>
      </div>
      <div>{q ? <DesgloseCotizacion q={q} /> : <p className="text-sm text-muted-foreground">Así lo ve el cliente al crear un envío.</p>}</div>
    </section>
  );
}
