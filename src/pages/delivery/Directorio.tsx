import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Globe, Hand, MapPin, Phone, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";
import { DirectorioItem, formatOsmHours, loadDirectorio, mapsLink, normalize, phoneLink } from "@/lib/directorio";
import { cn } from "@/lib/utils";

/** Comercios de Lincoln que todavía no están en Woref: los vecinos marcan cuáles quieren que se sumen. */
export default function Directorio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<DirectorioItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [rubro, setRubro] = useState<string | null>(null);

  const load = async () => setItems(await loadDirectorio());
  useEffect(() => { load(); }, []);

  const rubros = useMemo(() => [...new Set((items || []).map((item) => item.rubro))].sort(), [items]);
  const visible = useMemo(() => (items || []).filter((item) => (!rubro || item.rubro === rubro) && (!query.trim() || normalize(`${item.nombre} ${item.rubro} ${item.direccion ?? ""}`).includes(normalize(query.trim())))), [items, rubro, query]);

  const mark = async (item: DirectorioItem, tipo: "quiero_pedir" | "es_mi_comercio") => {
    if (!user) { toast.info("Ingresá para avisarnos."); navigate("/auth", { state: { from: "/app/directorio" } }); return; }
    const active = tipo === "quiero_pedir" ? !item.quiero_pedir : !item.es_mio;
    const { error } = await db.rpc("delivery_directorio_interes", { p_id: item.id, p_tipo: tipo, p_activo: active });
    if (error) return toast.error(errorMessage(error));
    toast.success(tipo === "quiero_pedir" ? (active ? "¡Gracias! Se lo vamos a proponer." : "Listo, sacamos tu voto.") : active ? "Perfecto. Te contactamos para sumarlo." : "Listo.");
    load();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader eyebrow="Próximamente en Woref" title="Comercios de Lincoln" subtitle="Todavía no reciben pedidos por la app. Marcá cuáles querés que se sumen y los invitamos." />

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un comercio" aria-label="Buscar un comercio" className="h-12 rounded-full pl-11" />
      </div>
      {rubros.length > 1 && (
        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Rubros">
          {[null, ...rubros].map((value) => (
            <button key={value ?? "todos"} type="button" role="tab" aria-selected={rubro === value} onClick={() => setRubro(value)} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold", rubro === value ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{value ?? "Todos"}</button>
          ))}
        </div>
      )}

      {items === null ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-3xl bg-muted" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState className="mt-6" icon={<Store className="h-7 w-7" />} title="No encontramos ese comercio" text="Probá con otro nombre o rubro." />
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {visible.map((item) => {
            const hours = formatOsmHours(item.horario);
            return (
              <li key={item.id} className="flex flex-col rounded-3xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted"><Store className="h-5 w-5 text-muted-foreground" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{item.nombre}</p>
                    <p className="text-xs font-bold text-primary">{item.rubro}</p>
                  </div>
                  {item.interesados > 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">{item.interesados} {item.interesados === 1 ? "vecino lo quiere" : "vecinos lo quieren"}</span>}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {item.direccion && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{item.direccion}</li>}
                  {hours && <li className="flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0" />{hours}</li>}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.telefono && <Button asChild size="sm" variant="outline" className="rounded-full"><a href={phoneLink(item.telefono)}><Phone className="h-4 w-4" />Llamar</a></Button>}
                  <Button asChild size="sm" variant="outline" className="rounded-full"><a href={mapsLink(item)} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" />Cómo llegar</a></Button>
                  {item.web && /^https?:\/\//.test(item.web) && <Button asChild size="sm" variant="outline" className="rounded-full"><a href={item.web} target="_blank" rel="noopener noreferrer"><Globe className="h-4 w-4" />Sitio</a></Button>}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button size="sm" variant={item.quiero_pedir ? "default" : "secondary"} className="rounded-full font-bold" aria-pressed={item.quiero_pedir} onClick={() => mark(item, "quiero_pedir")}><Hand className="h-4 w-4" />{item.quiero_pedir ? "Querés pedir acá" : "Quiero pedir acá"}</Button>
                  <Button size="sm" variant="ghost" className="rounded-full font-bold" aria-pressed={item.es_mio} onClick={() => mark(item, "es_mi_comercio")}>{item.es_mio ? "Pediste sumarlo ✓" : "Es mi comercio"}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Datos de ubicación y rubro © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>. Si falta tu comercio o hay un dato mal, escribinos desde Ayuda.</p>
    </div>
  );
}
