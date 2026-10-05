import { CSSProperties, FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Search, Tag } from "lucide-react";
import { SmartImage } from "@/components/delivery/SmartImage";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeliveryProduct, money } from "@/lib/delivery";
import { collectionPath, offersPath, searchPath, storePath, sugerencias } from "@/lib/storeRoutes";
import { cn } from "@/lib/utils";

/** Buscador de la tienda con sugerencias mientras se escribe. Enter o "Ver todos" llevan a la página de resultados. */
export function StoreSearch({ slug, products, categorias, preview, radius, initial = "", className }: { slug: string; products: DeliveryProduct[]; categorias: string[]; preview?: boolean; radius?: CSSProperties; initial?: string; className?: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(initial);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const resultado = useMemo(() => sugerencias(products, categorias, term), [products, categorias, term]);
  const hay = resultado.productos.length + resultado.categorias.length > 0;

  const enviar = (event: FormEvent) => {
    event.preventDefault();
    if (preview || !term.trim()) return;
    setOpen(false);
    navigate(searchPath(slug, term));
  };

  return (
    <form role="search" onSubmit={enviar} className={cn("relative", className)}>
      <label className="flex h-10 items-center gap-2 border bg-background/80 px-3 text-foreground" style={radius}>
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
          onFocus={() => { window.clearTimeout(closeTimer.current); setOpen(true); }}
          onBlur={() => { closeTimer.current = window.setTimeout(() => setOpen(false), 150); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="Buscar en la tienda"
          aria-label="Buscar productos"
          aria-expanded={open && hay}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {open && !preview && term.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[18rem] overflow-hidden border bg-card text-card-foreground shadow-pop" style={radius} role="listbox">
          {hay ? (
            <>
              {resultado.categorias.map((c) => (
                <Link key={c} to={collectionPath(slug, c)} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-muted"><Tag className="h-4 w-4 text-muted-foreground" />{c}<span className="ml-auto text-xs font-normal text-muted-foreground">Colección</span></Link>
              ))}
              {resultado.productos.map((p) => (
                <Link key={p.id} to={`${storePath(slug)}/p/${p.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-muted">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted"><SmartImage src={p.imagen_url} width={80} alt="" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nombre}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{money(p.precio)}</span>
                </Link>
              ))}
              <Link to={searchPath(slug, term)} onClick={() => setOpen(false)} className="block border-t px-3 py-2.5 text-sm font-bold hover:bg-muted">Ver todos los resultados para “{term.trim()}”</Link>
            </>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">No encontramos “{term.trim()}”. Probá con otra palabra.</p>
          )}
        </div>
      )}
    </form>
  );
}

/** Menú de categorías del escritorio. */
export function CategoriesMenu({ slug, categorias, preview, label = "Categorías" }: { slug: string; categorias: string[]; preview?: boolean; label?: string }) {
  const navigate = useNavigate();
  if (categorias.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold opacity-80 outline-none hover:opacity-100">{label}<ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        {categorias.map((c) => <DropdownMenuItem key={c} onClick={() => { if (!preview) navigate(collectionPath(slug, c)); }}>{c}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Enlace = { label: string; to?: string; onClick?: () => void };

/** Menú desplegable del celular: inicio, categorías, ofertas y secciones. */
export function StoreMobileMenu({ nombre, slug, categorias, hayOfertas, enlaces, preview, scope, trigger }: { nombre: string; slug: string; categorias: string[]; hayOfertas: boolean; enlaces: Enlace[]; preview?: boolean; scope?: CSSProperties; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ir = (to?: string, onClick?: () => void) => { setOpen(false); if (preview) return; if (onClick) setTimeout(onClick, 250); else if (to) navigate(to); };
  const item = "flex w-full items-center justify-between border-b px-5 py-3.5 text-left text-base font-semibold hover:bg-muted";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger ?? <button type="button" aria-label="Abrir el menú" className="flex h-10 w-10 items-center justify-center lg:hidden"><Menu className="h-5 w-5" /></button>}</SheetTrigger>
      <SheetContent side="left" className="flex w-80 flex-col gap-0 overflow-y-auto p-0" style={scope}>
        <SheetHeader className="border-b p-5 text-left"><SheetTitle className="text-lg font-extrabold">{nombre}</SheetTitle><SheetDescription className="sr-only">Menú de la tienda</SheetDescription></SheetHeader>
        <nav aria-label="Menú de la tienda">
          <button type="button" className={item} onClick={() => ir(storePath(slug))}>Inicio</button>
          {hayOfertas && <button type="button" className={item} onClick={() => ir(offersPath(slug))}>Ofertas</button>}
          {categorias.length > 0 && <p className="bg-muted/60 px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Categorías</p>}
          {categorias.map((c) => <button key={c} type="button" className={item} onClick={() => ir(collectionPath(slug, c))}>{c}</button>)}
          {enlaces.length > 0 && <p className="bg-muted/60 px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">La tienda</p>}
          {enlaces.map((e) => <button key={e.label} type="button" className={item} onClick={() => ir(e.to, e.onClick)}>{e.label}</button>)}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
