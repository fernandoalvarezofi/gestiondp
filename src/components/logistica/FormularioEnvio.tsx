import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAvisoSalida } from "@/hooks/useAvisoSalida";
import { errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Bulto, cotizar, Cotizacion, crearEnvio, Cuenta, Servicio } from "@/services/logistica";
import { BultosEditor, DesgloseCotizacion, ServicioPicker, useSucursales } from "./comun";

export type FormEnvio = {
  servicio: Servicio; origen_modo: "retiro" | "sucursal"; entrega_modo: "domicilio" | "sucursal"; rem_direccion: string; rem_ciudad: string; rem_cp: string; sucursal_origen_id: string;
  des_nombre: string; des_telefono: string; des_email: string; des_dni: string; des_direccion: string; des_ciudad: string; des_provincia: string; des_cp: string; des_notas: string; sucursal_destino_id: string;
  valor_declarado: string; reembolso: string; contenido: string; referencia: string; pedido_id: string;
};

/**
 * Formulario de envío con cotización en vivo. Lo usa el comercio (con `comercio`) y administración para cuentas de empresas
 * (solo `cuenta`). El precio final lo vuelve a calcular el servidor al crear; la clave evita duplicados si se reintenta.
 */
export function FormularioEnvio({ comercio, cuenta, inicial, onCreado }: { comercio?: string; cuenta: Cuenta; inicial?: Partial<FormEnvio>; onCreado: (r: { id: string; numero: string }) => void }) {
  const { lista: sucursales } = useSucursales();
  const clave = useRef(crypto.randomUUID());
  const [f, setF] = useState<FormEnvio>({
    servicio: "estandar", origen_modo: "retiro", entrega_modo: "domicilio", rem_direccion: cuenta.direccion_retiro ?? "", rem_ciudad: cuenta.ciudad ?? "", rem_cp: cuenta.cp ? String(cuenta.cp) : "", sucursal_origen_id: "",
    des_nombre: "", des_telefono: "", des_email: "", des_dni: "", des_direccion: "", des_ciudad: "", des_provincia: "Buenos Aires", des_cp: "", des_notas: "", sucursal_destino_id: "",
    valor_declarado: "", reembolso: "", contenido: "", referencia: "", pedido_id: "", ...inicial,
  });
  const [bultos, setBultos] = useState<Bulto[]>([{ peso_kg: 1 }]);
  const [q, setQ] = useState<Cotizacion | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tocado, setTocado] = useState(false);
  useAvisoSalida(tocado && !busy);
  const set = <K extends keyof FormEnvio>(k: K, v: FormEnvio[K]) => { setTocado(true); setF((x) => ({ ...x, [k]: v })); };

  const sucOrigen = sucursales.find((s) => s.id === f.sucursal_origen_id);
  const sucDestino = sucursales.find((s) => s.id === f.sucursal_destino_id);
  const cpOrigen = f.origen_modo === "sucursal" ? sucOrigen?.cp : /^\d{4}$/.test(f.rem_cp) ? Number(f.rem_cp) : undefined;
  const cpDestino = f.entrega_modo === "sucursal" ? sucDestino?.cp : /^\d{4}$/.test(f.des_cp) ? Number(f.des_cp) : undefined;
  const bultosOk = bultos.every((b) => b.peso_kg > 0 && b.peso_kg <= 50);

  // Cotización en vivo (el precio final lo vuelve a calcular el servidor al crear).
  useEffect(() => {
    if (!cpOrigen || !cpDestino || !bultosOk) { setQ(null); return; }
    let vivo = true;
    setCotizando(true);
    const t = setTimeout(async () => {
      try {
        const r = await cotizar({ cuenta: comercio ? null : cuenta.id, comercio: comercio ?? null, servicio: f.servicio, cpOrigen, cpDestino, bultos, valor: Number(f.valor_declarado) || 0, reembolso: Number(f.reembolso) || 0, retiro: f.origen_modo === "retiro" });
        if (vivo) setQ(r);
      } catch (e) { if (vivo) setQ({ ok: false, motivo: errorMessage(e) }); } finally { if (vivo) setCotizando(false); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [comercio, cuenta.id, f.servicio, cpOrigen, cpDestino, bultos, bultosOk, f.valor_declarado, f.reembolso, f.origen_modo]);

  const faltan: string[] = [];
  if (f.origen_modo === "retiro" && (f.rem_direccion.trim().length < 3 || f.rem_ciudad.trim().length < 2 || !/^\d{4}$/.test(f.rem_cp))) faltan.push("dirección, ciudad y código postal de retiro");
  if (f.origen_modo === "sucursal" && !sucOrigen) faltan.push("sucursal de despacho");
  if (f.des_nombre.trim().length < 2) faltan.push("nombre del destinatario");
  if (!/^[0-9+() -]{6,30}$/.test(f.des_telefono.trim())) faltan.push("teléfono del destinatario");
  if (f.entrega_modo === "domicilio" && (f.des_direccion.trim().length < 3 || f.des_ciudad.trim().length < 2 || !/^\d{4}$/.test(f.des_cp))) faltan.push("dirección, ciudad y código postal de entrega");
  if (f.entrega_modo === "sucursal" && !sucDestino) faltan.push("sucursal de entrega");
  if (f.des_dni && !/^\d{6,9}$/.test(f.des_dni)) faltan.push("DNI sin puntos");
  if (!bultosOk) faltan.push("peso de cada bulto (hasta 50 kg)");

  const crear = async () => {
    setBusy(true);
    try {
      const r = await crearEnvio({ ...f, clave: clave.current, ...(comercio ? { comercio_id: comercio } : { cuenta_id: cuenta.id }), bultos, valor_declarado: Number(f.valor_declarado) || 0, reembolso: Number(f.reembolso) || 0,
        sucursal_origen_id: f.origen_modo === "sucursal" ? f.sucursal_origen_id : null, sucursal_destino_id: f.entrega_modo === "sucursal" ? f.sucursal_destino_id : null, pedido_id: f.pedido_id || null });
      setTocado(false);
      onCreado(r);
    } catch (e) { toast.error(errorMessage(e)); setBusy(false); }
  };

  const caja = "rounded-2xl border bg-card p-4 space-y-3";
  return (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className={caja} aria-labelledby="s-serv"><h3 id="s-serv" className="font-bold">Servicio</h3>
            <ServicioPicker value={f.servicio} onChange={(s) => set("servicio", s)} />
          </section>

          <section className={caja} aria-labelledby="s-origen"><h3 id="s-origen" className="font-bold">Origen</h3>
            <Segmento value={f.origen_modo} onChange={(v) => set("origen_modo", v)} opciones={[["retiro", comercio ? "Lo retiran en mi local" : "Retiro a domicilio"], ["sucursal", "Lo dejo en una sucursal"]]} />
            {f.origen_modo === "retiro" ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_120px]">
                <label className="text-xs font-semibold">Dirección de retiro<Input value={f.rem_direccion} onChange={(e) => set("rem_direccion", e.target.value)} maxLength={200} className="mt-1" /></label>
                <label className="text-xs font-semibold">Ciudad<Input value={f.rem_ciudad} onChange={(e) => set("rem_ciudad", e.target.value)} maxLength={80} className="mt-1" /></label>
                <label className="text-xs font-semibold">Código postal<Input value={f.rem_cp} onChange={(e) => set("rem_cp", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="mt-1" /></label>
              </div>
            ) : <SucursalSelect value={f.sucursal_origen_id} onChange={(v) => set("sucursal_origen_id", v)} sucursales={sucursales} />}
          </section>

          <section className={caja} aria-labelledby="s-dest"><h3 id="s-dest" className="font-bold">Destinatario</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold">Nombre y apellido<Input value={f.des_nombre} onChange={(e) => set("des_nombre", e.target.value)} maxLength={120} className="mt-1" autoComplete="off" /></label>
              <label className="text-xs font-semibold">Teléfono<Input value={f.des_telefono} onChange={(e) => set("des_telefono", e.target.value)} maxLength={30} inputMode="tel" className="mt-1" /></label>
              <label className="text-xs font-semibold">Email (opcional, recibe el seguimiento)<Input value={f.des_email} onChange={(e) => set("des_email", e.target.value)} maxLength={160} type="email" className="mt-1" /></label>
              <label className="text-xs font-semibold">DNI (opcional, sin puntos)<Input value={f.des_dni} onChange={(e) => set("des_dni", e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className="mt-1" /></label>
            </div>
            <Segmento value={f.entrega_modo} onChange={(v) => set("entrega_modo", v)} opciones={[["domicilio", "Entrega a domicilio"], ["sucursal", "Retira en sucursal"]]} />
            {f.entrega_modo === "domicilio" ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                <label className="text-xs font-semibold sm:col-span-3">Dirección (calle, número, piso)<Input value={f.des_direccion} onChange={(e) => set("des_direccion", e.target.value)} maxLength={200} className="mt-1" /></label>
                <label className="text-xs font-semibold">Ciudad<Input value={f.des_ciudad} onChange={(e) => set("des_ciudad", e.target.value)} maxLength={80} className="mt-1" /></label>
                <label className="text-xs font-semibold">Provincia<Input value={f.des_provincia} onChange={(e) => set("des_provincia", e.target.value)} maxLength={60} className="mt-1" /></label>
                <label className="text-xs font-semibold">Código postal<Input value={f.des_cp} onChange={(e) => set("des_cp", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="mt-1" /></label>
              </div>
            ) : <SucursalSelect value={f.sucursal_destino_id} onChange={(v) => set("sucursal_destino_id", v)} sucursales={sucursales} />}
            <label className="block text-xs font-semibold">Indicaciones para la entrega (opcional)<Textarea value={f.des_notas} onChange={(e) => set("des_notas", e.target.value)} maxLength={300} className="mt-1 min-h-[56px] resize-none" placeholder="Entre calles, timbre, horario…" /></label>
          </section>

          <section className={caja} aria-labelledby="s-paq"><h3 id="s-paq" className="font-bold">Paquetes</h3>
            <BultosEditor value={bultos} onChange={(b) => { setTocado(true); setBultos(b); }} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold">Contenido (opcional)<Input value={f.contenido} onChange={(e) => set("contenido", e.target.value)} maxLength={120} className="mt-1" placeholder="Ropa, repuestos…" /></label>
              <label className="text-xs font-semibold">Tu referencia (opcional)<Input value={f.referencia} onChange={(e) => set("referencia", e.target.value)} maxLength={40} className="mt-1" placeholder="N.º de venta o factura" /></label>
              <label className="text-xs font-semibold">Valor declarado (para el seguro)<Input value={f.valor_declarado} onChange={(e) => set("valor_declarado", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1" placeholder="$ 0" /></label>
              <label className="text-xs font-semibold">Cobrar al entregar (contra reembolso)<Input value={f.reembolso} onChange={(e) => set("reembolso", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1" placeholder="$ 0 = no cobrar" /></label>
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <h3 className="font-bold">Precio</h3>
          {q ? <DesgloseCotizacion q={q} /> : <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{cotizando ? "Calculando…" : "Completá origen, destino y peso para ver el precio."}</p>}
          {faltan.length > 0 && <p className="text-xs text-muted-foreground">Falta: {faltan.join(", ")}.</p>}
          <Button className="w-full rounded-full" size="lg" disabled={busy || faltan.length > 0 || !q?.ok} onClick={crear}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Crear envío</Button>
          <p className="text-xs text-muted-foreground">Al crearlo se genera la etiqueta para imprimir. {cuenta.condicion_pago === "cuenta_corriente" ? "Se suma a la cuenta corriente." : "Se cobra al recibir el paquete."}</p>
        </aside>
      </div>
  );
}

export function Segmento<T extends string>({ value, onChange, opciones }: { value: T; onChange: (v: T) => void; opciones: [T, string][] }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border bg-muted/40 p-1">
      {opciones.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", value === v ? "bg-background shadow-sm" : "text-muted-foreground")}>{t}</button>)}
    </div>
  );
}

export function SucursalSelect({ value, onChange, sucursales }: { value: string; onChange: (v: string) => void; sucursales: { id: string; nombre: string; direccion: string; ciudad: string; horario: string | null }[] }) {
  if (sucursales.length === 0) return <p className="text-sm text-muted-foreground">No hay sucursales habilitadas todavía.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sucursal">
      {sucursales.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id} onClick={() => onChange(s.id)} className={cn("rounded-xl border p-3 text-left text-sm", value === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60")}>
          <span className="font-bold">{s.nombre}</span><span className="block text-xs text-muted-foreground">{s.direccion}, {s.ciudad}{s.horario ? ` · ${s.horario}` : ""}</span>
        </button>
      ))}
    </div>
  );
}
