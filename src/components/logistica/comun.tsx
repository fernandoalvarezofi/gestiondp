import { useEffect, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateTime, money } from "@/lib/delivery";
import { qrSvg } from "@/lib/qr";
import { code128Svg } from "@/lib/code128";
import { cn } from "@/lib/utils";
import { Bulto, BultoLog, Cotizacion, enlaceSeguimiento, EnvioLog, ESTADOS_LOG, EstadoLog, EventoLog, pasoDe, PASOS_LOG, SERVICIOS, Sucursal, sucursalesActivas } from "@/services/logistica";

/** Piezas de interfaz compartidas por el panel del comercio, la operación y el seguimiento público. */

export function EstadoEnvio({ estado, className }: { estado: EstadoLog; className?: string }) {
  const e = ESTADOS_LOG[estado];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold", e.clase, className)}>{e.corto}</span>;
}

/** Barra de pasos: Creado → Recibido → En viaje → En reparto → Entregado. */
export function ProgresoEnvio({ estado }: { estado: EstadoLog }) {
  const actual = pasoDe(estado);
  const desviado = actual < 0;
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Progreso del envío">
      {PASOS_LOG.map((paso, i) => {
        const hecho = !desviado && i <= actual;
        return (
          <li key={paso.texto} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", hecho ? (estado === "visita_fallida" && i === actual ? "bg-destructive" : "bg-primary") : "bg-muted")} />
            <p className={cn("mt-1.5 truncate text-[11px] font-semibold", hecho ? "text-foreground" : "text-muted-foreground")} aria-current={i === actual ? "step" : undefined}>{paso.texto}</p>
          </li>
        );
      })}
    </ol>
  );
}

export type EventoVista = { estado: EstadoLog; descripcion: string; fecha: string; lugar?: string | null; detalle?: string | null; interno?: boolean };
export const eventosVista = (eventos: EventoLog[], sucursales: Record<string, Sucursal>): EventoVista[] =>
  eventos.map((e) => ({ estado: e.estado, descripcion: e.descripcion, fecha: e.created_at, lugar: e.sucursal_id ? sucursales[e.sucursal_id]?.nombre : null, detalle: e.detalle, interno: !e.visible }));

/** Línea de tiempo del envío, de lo más nuevo a lo más viejo. */
export function LineaTiempo({ eventos }: { eventos: EventoVista[] }) {
  if (eventos.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {eventos.map((e, i) => (
        <li key={`${e.fecha}-${i}`} className="relative">
          <span className={cn("absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full ring-4 ring-background", i === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
          <p className={cn("text-sm", i === 0 ? "font-bold" : "font-semibold")}>{e.descripcion}{e.interno && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Interno</span>}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(e.fecha)}{e.lugar ? ` · ${e.lugar}` : ""}</p>
          {e.detalle && <p className="mt-0.5 text-xs text-muted-foreground">{e.detalle}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Editor de bultos: peso y medidas de cada paquete (el precio usa el mayor entre peso real y volumétrico). */
export function BultosEditor({ value, onChange, max = 20 }: { value: Bulto[]; onChange: (b: Bulto[]) => void; max?: number }) {
  const set = (i: number, patch: Partial<Bulto>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const num = (v: string) => (v === "" ? null : Math.max(0, Number(v.replace(",", "."))));
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] items-end gap-2">
          <span className="pb-2.5 text-xs font-bold text-muted-foreground">#{i + 1}</span>
          <label className="text-xs font-semibold">Peso (kg)<Input inputMode="decimal" value={b.peso_kg || ""} onChange={(e) => set(i, { peso_kg: num(e.target.value) ?? 0 })} className="mt-1" aria-label={`Peso del bulto ${i + 1}`} /></label>
          <label className="text-xs font-semibold">Alto (cm)<Input inputMode="decimal" value={b.alto_cm ?? ""} onChange={(e) => set(i, { alto_cm: num(e.target.value) })} className="mt-1" /></label>
          <label className="text-xs font-semibold">Ancho (cm)<Input inputMode="decimal" value={b.ancho_cm ?? ""} onChange={(e) => set(i, { ancho_cm: num(e.target.value) })} className="mt-1" /></label>
          <label className="text-xs font-semibold">Largo (cm)<Input inputMode="decimal" value={b.largo_cm ?? ""} onChange={(e) => set(i, { largo_cm: num(e.target.value) })} className="mt-1" /></label>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" disabled={value.length >= max} onClick={() => onChange([...value, { peso_kg: 1 }])} className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Agregar bulto</button>
        {value.length > 1 && <button type="button" onClick={() => onChange(value.slice(0, -1))} className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold hover:bg-muted"><Minus className="h-3.5 w-3.5" /> Quitar el último</button>}
      </div>
    </div>
  );
}

/** Desglose de una cotización. */
export function DesgloseCotizacion({ q, className }: { q: Cotizacion | null; className?: string }) {
  if (!q) return null;
  if (q.ok === false) return <p className={cn("rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive", className)}>{(q as { motivo: string }).motivo}</p>;
  const filas: [string, number][] = [["Flete", q.flete], ["Seguro", q.seguro], ["Comisión contra reembolso", q.comision_reembolso], ["Retiro a domicilio", q.retiro]];
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <p className="text-xs font-semibold text-muted-foreground">{q.zona_origen_nombre} → {q.zona_destino_nombre} · {q.peso_facturable} kg facturables{q.peso_vol > q.peso_real ? " (por volumen)" : ""}</p>
      <dl className="mt-2 space-y-1 text-sm">
        {filas.filter(([, v]) => v > 0).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{money(v)}</dd></div>)}
        <div className="flex justify-between border-t pt-1.5 text-base"><dt className="font-bold">Total</dt><dd className="font-extrabold tabular-nums">{money(q.total)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Llega aprox. el {new Date(`${q.fecha_estimada}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} ({q.dias} {q.dias === 1 ? "día hábil" : "días hábiles"}).</p>
    </div>
  );
}

/** Selector de servicio con tarjetas. */
export function ServicioPicker({ value, onChange, expressDisponible = true }: { value: keyof typeof SERVICIOS; onChange: (s: keyof typeof SERVICIOS) => void; expressDisponible?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Servicio" className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(SERVICIOS) as (keyof typeof SERVICIOS)[]).map((s) => {
        const off = s === "express" && !expressDisponible;
        return (
          <button key={s} type="button" role="radio" aria-checked={value === s} disabled={off} onClick={() => onChange(s)}
            className={cn("rounded-2xl border p-3 text-left transition disabled:opacity-40", value === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/60")}>
            <span className="flex items-center justify-between text-sm font-bold">{SERVICIOS[s].texto}{value === s && <Check className="h-4 w-4 text-primary" />}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{off ? "Solo dentro de la misma zona" : SERVICIOS[s].detalle}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Vista previa en pantalla de una etiqueta (la impresión usa `imprimirEtiquetas`). */
export function CodigoBarras({ texto, alto = 48, className }: { texto: string; alto?: number; className?: string }) {
  const svg = code128Svg(texto, alto);
  return (
    <svg viewBox={`0 0 ${svg.ancho} ${alto}`} className={cn("h-12 w-full", className)} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${texto}`}>
      <rect width={svg.ancho} height={alto} fill="#fff" />
      {svg.rects.map((r, i) => <rect key={i} x={r.x} y={0} width={r.w} height={alto} fill="#000" />)}
    </svg>
  );
}

const esc = (s: string | number | null | undefined) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTML de las etiquetas (una por bulto, 10 × 15 cm), con código de barras del bulto y QR al seguimiento. */
export type ParaEtiqueta = { envio: EnvioLog; bultos: BultoLog[] };
export function etiquetasHtml(items: ParaEtiqueta[], sucursales: Record<string, Sucursal>): string {
  const titulo = items.length === 1 ? items[0].envio.numero : `${items.length} envíos`;
  return paginaEtiquetas(titulo, items.map(({ envio, bultos }) => etiquetasDeEnvio(envio, bultos, sucursales)).join(""));
}

function etiquetasDeEnvio(envio: EnvioLog, bultos: BultoLog[], sucursales: Record<string, Sucursal>): string {
  const destinoSuc = envio.sucursal_destino_id ? sucursales[envio.sucursal_destino_id] : null;
  const qr = qrSvg(enlaceSeguimiento(envio.numero), { margin: 1 });
  const etiquetas = bultos.map((b) => {
    const bar = code128Svg(b.codigo, 70);
    const barras = `<svg viewBox="0 0 ${bar.ancho} 70" preserveAspectRatio="none" style="width:100%;height:22mm">${bar.rects.map((r) => `<rect x="${r.x}" y="0" width="${r.w}" height="70"/>`).join("")}</svg>`;
    return `<section class="et">
      <header><b>WOREF</b><span>${esc(SERVICIOS[envio.servicio].texto.toUpperCase())}</span></header>
      <div class="bloque"><small>DESTINATARIO</small><p class="grande">${esc(envio.des_nombre)}</p>
        <p>${destinoSuc ? `RETIRA EN SUCURSAL: ${esc(destinoSuc.nombre)}<br>${esc(destinoSuc.direccion)}` : esc(envio.des_direccion)}</p>
        <p class="grande">${esc(envio.des_cp)} · ${esc(envio.des_ciudad)}, ${esc(envio.des_provincia)}</p><p>Tel. ${esc(envio.des_telefono)}</p>
        ${envio.des_notas ? `<p class="nota">${esc(envio.des_notas)}</p>` : ""}</div>
      <div class="fila"><div class="bloque"><small>REMITENTE</small><p>${esc(envio.rem_nombre)}</p><p>${esc(envio.rem_ciudad ?? "")} (${esc(envio.rem_cp)})</p></div>
        <div class="qr">${qr}</div></div>
      ${Number(envio.reembolso) > 0 ? `<div class="cr">COBRAR CONTRA REEMBOLSO ${esc(money(envio.reembolso))}</div>` : ""}
      <div class="fila meta"><span>Bulto <b>${b.nro} de ${envio.bultos}</b></span><span>${esc(b.peso_kg)} kg</span>${envio.referencia ? `<span>Ref. ${esc(envio.referencia)}</span>` : ""}</div>
      <div class="barras">${barras}<p>${esc(b.codigo)}</p></div>
    </section>`;
  }).join("");
  return etiquetas;
}

function paginaEtiquetas(titulo: string, etiquetas: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas ${esc(titulo)}</title><style>
    @page{size:100mm 150mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000}
    .et{width:100mm;height:150mm;padding:5mm;display:flex;flex-direction:column;gap:2.5mm;page-break-after:always;border:1px dashed #bbb}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:2mm;font-size:16pt}header span{font-size:11pt;font-weight:bold;border:2px solid #000;padding:1mm 2mm}
    small{font-size:7pt;font-weight:bold;letter-spacing:.08em}p{margin:.6mm 0;font-size:9.5pt;line-height:1.25}.grande{font-size:13pt;font-weight:bold}.nota{font-style:italic;font-size:8.5pt}
    .fila{display:flex;gap:3mm;align-items:flex-start;justify-content:space-between}.qr svg{width:24mm;height:24mm}.meta{font-size:9pt;border-top:1px solid #000;padding-top:1.5mm}
    .cr{background:#000;color:#fff;font-weight:bold;text-align:center;padding:1.8mm;font-size:11pt}.barras{margin-top:auto;text-align:center}.barras p{font-family:monospace;font-size:12pt;font-weight:bold;letter-spacing:.1em}
    @media print{.et{border:0}}
  </style></head><body>${etiquetas}<script>window.onload=function(){window.print()}</script></body></html>`;
}

/** Abre las etiquetas en una pestaña nueva y lanza la impresión. */
export function imprimirEtiquetas(items: ParaEtiqueta[], sucursales: Record<string, Sucursal>) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(etiquetasHtml(items, sucursales));
  w.document.close();
  return true;
}

/** Sucursales indexadas por id (se usan en etiquetas y líneas de tiempo). */
export function useSucursales() {
  const [lista, setLista] = useState<Sucursal[]>([]);
  useEffect(() => { sucursalesActivas().then(setLista).catch(() => setLista([])); }, []);
  return { lista, porId: Object.fromEntries(lista.map((s) => [s.id, s])) as Record<string, Sucursal> };
}
