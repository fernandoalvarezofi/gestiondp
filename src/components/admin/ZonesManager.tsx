import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { CloudRain, Loader2, PenLine, Trash2, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ZoneShape } from "@/components/admin/ZonesMap";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ajusteValor, useAjustes } from "@/hooks/useAjustes";
import { db, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/ui/dialogos";

const ZonesMap = lazy(() => import("@/components/admin/ZonesMap"));

type ZoneRow = ZoneShape & { nota: string | null };
type Demand = { pendientes: number; repartidores_libres: number; ratio: number; recargo: number };

/** Zonas de entrega (geocercas) con recargo o cierre, y tarifa dinámica por demanda y clima. */
export function ZonesManager() {
  const [zones, setZones] = useState<ZoneRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [demand, setDemand] = useState<Demand | null>(null);
  const { ajustes, refresh } = useAjustes();

  const load = useCallback(async () => {
    const { data, error } = await db.from("delivery_zonas").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(errorMessage(error));
    setZones(((data || []) as (ZoneRow & { poligono: [number, number][] })[]).map((zone) => ({ ...zone, multiplicador: Number(zone.multiplicador), recargo: Number(zone.recargo) })));
  }, []);
  const loadDemand = useCallback(async () => {
    const { data } = await db.rpc("delivery_demanda_actual");
    setDemand((data as unknown as Demand) || null);
  }, []);

  useEffect(() => {
    load(); loadDemand();
    const timer = window.setInterval(loadDemand, 30000);
    return () => window.clearInterval(timer);
  }, [load, loadDemand]);

  const selected = zones?.find((zone) => zone.id === selectedId) || null;
  const update = async (id: string, patch: Partial<Pick<ZoneRow, "activa" | "cerrada" | "multiplicador" | "recargo" | "nombre" | "nota">>) => {
    const { error } = await db.from("delivery_zonas").update(patch).eq("id", id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Zona actualizada: rige para los pedidos nuevos");
    load();
  };
  const create = async () => {
    setSaving(true);
    const { data, error } = await db.from("delivery_zonas").insert({ nombre: name.trim(), poligono: draft }).select("id").single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Zona creada");
    setDrawing(false); setDraft([]); setName("");
    await load();
    setSelectedId(data.id);
  };
  const remove = async (zone: ZoneRow) => {
    if (!(await confirmar({ titulo: `¿Borrar la zona “${zone.nombre}”?`, descripcion: "Las direcciones dentro de esta zona pasan a usar la tarifa general o quedan fuera de cobertura.", confirmar: "Borrar zona", peligro: true }))) return;
    const { error } = await db.from("delivery_zonas").delete().eq("id", zone.id);
    if (error) return toast.error(errorMessage(error));
    setSelectedId(null);
    load();
  };
  const setAjuste = async (clave: string, valor: number) => {
    const { error } = await db.rpc("delivery_admin_guardar_ajuste", { p_clave: clave, p_valor: valor });
    if (error) return toast.error(errorMessage(error));
    refresh();
    toast.success("Guardado: ya rige para los pedidos nuevos");
  };

  const weatherOn = ajusteValor(ajustes, "clima_activo", 0) >= 1;
  const autoOn = ajusteValor(ajustes, "surge_auto", 1) >= 1;
  const weatherPct = ajusteValor(ajustes, "clima_recargo_pct", 15);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-3xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-extrabold"><Zap className="h-4 w-4 text-warning" />Tarifa por demanda</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sube sola cuando hay más pedidos esperando repartidor que repartidores libres.</p>
            </div>
            <Switch checked={autoOn} onCheckedChange={(value) => setAjuste("surge_auto", value ? 1 : 0)} aria-label="Tarifa por demanda" />
          </div>
          <p className="mt-3 text-sm">
            {demand ? <><span className="font-black">{demand.pendientes}</span> pedidos esperando · <span className="font-black">{demand.repartidores_libres}</span> repartidores libres · recargo actual <span className={cn("font-black", demand.recargo > 0 && "text-warning")}>+{Math.round(demand.recargo * 100)}%</span></> : "Calculando…"}
          </p>
        </section>
        <section className="rounded-3xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-extrabold"><CloudRain className="h-4 w-4 text-primary" />Recargo por mal clima</h2>
              <p className="mt-1 text-sm text-muted-foreground">Activalo con lluvia o tormenta: +{weatherPct}% en los envíos, y los repartidores cobran más.</p>
            </div>
            <Switch checked={weatherOn} onCheckedChange={(value) => setAjuste("clima_activo", value ? 1 : 0)} aria-label="Recargo por clima" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">El porcentaje se cambia en Configuración → “Recargo por clima”.</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-3xl border"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
          <ZonesMap zones={zones || []} selectedId={selectedId} draft={draft} drawing={drawing} onSelect={setSelectedId} onAdd={(point) => setDraft((current) => [...current, point])} className="h-[420px] lg:h-[540px]" />
        </Suspense>

        <aside className="space-y-3">
          {drawing ? (
            <section className="rounded-3xl border bg-card p-4">
              <h3 className="font-extrabold">Nueva zona</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tocá el mapa para marcar las esquinas ({draft.length} puntos, mínimo 3).</p>
              <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Nombre (ej.: Barrio Norte)" className="mt-3" aria-label="Nombre de la zona" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" disabled={!draft.length} onClick={() => setDraft((current) => current.slice(0, -1))}><Undo2 className="h-4 w-4" />Deshacer</Button>
                <Button size="sm" className="rounded-full" disabled={saving || draft.length < 3 || name.trim().length < 2} onClick={create}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar zona</Button>
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setDrawing(false); setDraft([]); }}>Cancelar</Button>
              </div>
            </section>
          ) : (
            <Button className="w-full rounded-full" onClick={() => { setDrawing(true); setSelectedId(null); }}><PenLine className="h-4 w-4" />Dibujar zona nueva</Button>
          )}

          {selected && !drawing && (
            <section className="rounded-3xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-black">{selected.nombre}</h3>
                <button type="button" aria-label="Borrar zona" onClick={() => remove(selected)} className="rounded-full p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <label className="flex items-center justify-between gap-3 font-semibold">Zona activa<Switch checked={selected.activa} onCheckedChange={(value) => update(selected.id, { activa: value })} /></label>
                <label className="flex items-center justify-between gap-3 font-semibold">Sin entregas (cerrada)<Switch checked={selected.cerrada} onCheckedChange={(value) => update(selected.id, { cerrada: value })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="zone-mult" className="text-xs font-bold">Multiplicador (1 a 3)</label><Input id="zone-mult" key={`m-${selected.id}-${selected.multiplicador}`} inputMode="decimal" defaultValue={selected.multiplicador} onBlur={(event) => { const value = Number(event.target.value.replace(",", ".")); if (value !== selected.multiplicador && value >= 1 && value <= 3) update(selected.id, { multiplicador: value }); }} /></div>
                  <div><label htmlFor="zone-fee" className="text-xs font-bold">Recargo fijo ($)</label><Input id="zone-fee" key={`r-${selected.id}-${selected.recargo}`} inputMode="numeric" defaultValue={selected.recargo} onBlur={(event) => { const value = Number(event.target.value.replace(/\D/g, "")); if (value !== selected.recargo && value <= 20000) update(selected.id, { recargo: value }); }} /></div>
                </div>
                <p className="text-xs text-muted-foreground">Un envío de {money(1000)} en esta zona sale {money(Math.round((1000 * selected.multiplicador + selected.recargo) / 10) * 10)} (sin contar demanda ni clima).</p>
              </div>
            </section>
          )}

          {zones && zones.length === 0 && !drawing && <EmptyState title="Todavía no hay zonas" text="Dibujá una para cobrar recargo en un barrio lejano, o cerrar entregas donde no querés operar." />}
          {zones && zones.length > 0 && (
            <ul className="space-y-1.5">
              {zones.map((zone) => (
                <li key={zone.id}>
                  <button type="button" onClick={() => { setSelectedId(zone.id); setDrawing(false); }} className={cn("flex w-full items-center justify-between gap-2 rounded-2xl border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50", zone.id === selectedId && "ring-2 ring-primary")}>
                    <span className="font-bold">{zone.nombre}</span>
                    <span className="text-xs text-muted-foreground">{!zone.activa ? "Inactiva" : zone.cerrada ? "Cerrada" : zone.multiplicador > 1 || zone.recargo > 0 ? `x${zone.multiplicador}${zone.recargo ? ` +${money(zone.recargo)}` : ""}` : "Normal"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
