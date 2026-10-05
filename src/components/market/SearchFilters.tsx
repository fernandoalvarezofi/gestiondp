import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useCategorias } from "@/services/categories";
import { Facetas, FiltrosBusqueda } from "@/services/search";

/** Panel de filtros del marketplace: categorías (con cantidad), marca, rango de precio, oferta y stock. */
export function SearchFilters({ filtros, facetas, onChange }: { filtros: FiltrosBusqueda; facetas: Facetas | null; onChange: (next: Partial<FiltrosBusqueda>) => void }) {
  const { arbol } = useCategorias();
  const [min, setMin] = useState(filtros.min != null ? String(filtros.min) : "");
  const [max, setMax] = useState(filtros.max != null ? String(filtros.max) : "");
  useEffect(() => { setMin(filtros.min != null ? String(filtros.min) : ""); setMax(filtros.max != null ? String(filtros.max) : ""); }, [filtros.min, filtros.max]);

  // Cantidad por categoría: las raíces suman la de sus hijas (y la propia).
  const cuenta = useMemo(() => {
    const porId = new Map((facetas?.categorias ?? []).map((c) => [c.id, c.n]));
    return arbol.map((raiz) => {
      const hijas = raiz.hijas.map((h) => ({ ...h, n: porId.get(h.id) ?? 0 })).filter((h) => h.n > 0);
      return { ...raiz, hijas, total: (porId.get(raiz.id) ?? 0) + hijas.reduce((t, h) => t + h.n, 0) };
    }).filter((raiz) => raiz.total > 0 || raiz.id === filtros.categoria || raiz.hijas.some((h) => h.id === filtros.categoria));
  }, [arbol, facetas, filtros.categoria]);
  const rangoOk = (min === "" || Number(min) >= 0) && (max === "" || Number(max) >= 0) && (min === "" || max === "" || Number(min) <= Number(max));
  const aplicarPrecio = () => { if (rangoOk) onChange({ min: min === "" ? null : Math.floor(Number(min)), max: max === "" ? null : Math.floor(Number(max)) }); };

  return (
    <div className="space-y-6 text-sm">
      <section aria-label="Categorías">
        <h3 className="font-extrabold">Categorías</h3>
        <ul className="mt-2 space-y-0.5">
          <li><button type="button" onClick={() => onChange({ categoria: null })} className={cn("w-full rounded-lg px-2 py-1.5 text-left", !filtros.categoria ? "font-extrabold" : "hover:bg-muted")}>Todas</button></li>
          {cuenta.map((raiz) => {
            const abierta = filtros.categoria === raiz.id || raiz.hijas.some((h) => h.id === filtros.categoria);
            return (
              <li key={raiz.id}>
                <button type="button" aria-pressed={filtros.categoria === raiz.id} onClick={() => onChange({ categoria: raiz.id })} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left", filtros.categoria === raiz.id ? "bg-primary/10 font-extrabold text-primary" : "hover:bg-muted")}>
                  <span>{raiz.nombre}</span><span className="text-xs text-muted-foreground">{raiz.total}</span>
                </button>
                {abierta && raiz.hijas.length > 0 && (
                  <ul className="ml-3 mt-0.5 space-y-0.5 border-l pl-2">
                    {raiz.hijas.map((hija) => (
                      <li key={hija.id}><button type="button" aria-pressed={filtros.categoria === hija.id} onClick={() => onChange({ categoria: hija.id })} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1 text-left", filtros.categoria === hija.id ? "bg-primary/10 font-bold text-primary" : "hover:bg-muted")}><span>{hija.nombre}</span><span className="text-xs text-muted-foreground">{hija.n}</span></button></li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {cuenta.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Los productos todavía no tienen categoría en este resultado.</p>}
      </section>

      {(facetas?.marcas.length ?? 0) > 0 && (
        <section aria-label="Marca">
          <h3 className="font-extrabold">Marca</h3>
          <ul className="mt-2 space-y-0.5">
            {facetas!.marcas.map((m) => {
              const activa = filtros.marca?.toLowerCase() === m.marca.toLowerCase();
              return (
                <li key={m.marca}><button type="button" aria-pressed={activa} onClick={() => onChange({ marca: activa ? null : m.marca })} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left", activa ? "bg-primary/10 font-bold text-primary" : "hover:bg-muted")}>
                  <span className="flex items-center gap-1.5">{activa && <Check className="h-3.5 w-3.5" />}{m.marca}</span><span className="text-xs text-muted-foreground">{m.n}</span></button></li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Precio">
        <h3 className="font-extrabold">Precio</h3>
        {facetas?.precio.min != null && <p className="text-xs text-muted-foreground">Entre {money(facetas.precio.min)} y {money(facetas.precio.max ?? 0)}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Input inputMode="numeric" aria-label="Precio mínimo" placeholder="Mínimo" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && aplicarPrecio()} className="h-9" />
          <span className="text-muted-foreground">–</span>
          <Input inputMode="numeric" aria-label="Precio máximo" placeholder="Máximo" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && aplicarPrecio()} className="h-9" />
        </div>
        {!rangoOk && <p className="mt-1 text-xs font-semibold text-destructive">El mínimo no puede ser mayor al máximo.</p>}
        <Button type="button" size="sm" variant="outline" className="mt-2 rounded-full" disabled={!rangoOk} onClick={aplicarPrecio}>Aplicar</Button>
      </section>

      <section aria-label="Otros filtros" className="space-y-2">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" checked={filtros.ofertas} onChange={(e) => onChange({ ofertas: e.target.checked })} />Solo ofertas</label>
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" checked={filtros.conStock} onChange={(e) => onChange({ conStock: e.target.checked })} />Solo con stock</label>
      </section>
    </div>
  );
}
