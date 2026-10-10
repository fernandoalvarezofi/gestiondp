import { useState } from "react";
import { FileText, Megaphone, Plus, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bloque, BloqueTipo, bloqueNuevo, CATALOGO_ORDENES, CatalogoOrden, ColumnaPie, nuevoId, Plantilla, TemaNormalizado } from "@/lib/storefront";
import { CLASE_PAGINA, ClasePagina, PAGINAS_SUGERIDAS } from "@/services/storeBuilder";
import { cn } from "@/lib/utils";
import { Campo, Interruptor, Opciones, Texto } from "./fields";
import { MenuEditor, OpcionesSitio } from "./controles";
import type { PaginaEd } from "./useSitio";

type SetTema = (cambios: Partial<TemaNormalizado>) => void;
const sec = (tipo: BloqueTipo, plantilla: Plantilla, cambios: Record<string, unknown> = {}) => ({ ...bloqueNuevo(tipo, plantilla), ...cambios, id: nuevoId() }) as Bloque;

/** Encabezado de todas las páginas: disposición, comportamiento al bajar, anuncio, buscador y menú. */
export function HeaderPanel({ tema, onChange, onDiseno, sitio }: { tema: TemaNormalizado; onChange: SetTema; onDiseno: (c: { cabecera: "izquierda" | "centro" }) => void; sitio: OpcionesSitio }) {
  const cab = tema.cabecera ?? { fija: true, transparente: false };
  const portadaConFoto = tema.bloques.find((b) => b.visible)?.tipo === "portada";
  return (
    <div className="space-y-5">
      <Opciones label="Disposición" value={tema.diseno.cabecera} options={[{ id: "izquierda", label: "Logo a la izquierda" }, { id: "centro", label: "Logo centrado" }]} onChange={(cabecera) => onDiseno({ cabecera })} />
      <Interruptor label="Fijo al bajar" hint="El encabezado queda visible mientras la persona recorre la página." value={cab.fija} onChange={(fija) => onChange({ cabecera: { ...cab, fija } })} />
      <Interruptor label="Transparente sobre la portada" hint={portadaConFoto ? "En el inicio, se apoya sobre la foto de la portada y se vuelve sólido al bajar (portadas de foto completa)." : "Necesita que la primera sección del inicio sea una portada con foto."}
        value={cab.transparente} onChange={(transparente) => onChange({ cabecera: { ...cab, transparente } })} />
      <Texto label="Barra de anuncio (arriba de todo)" value={tema.anuncio} max={160} placeholder="Ej.: Envío gratis en compras de más de $20.000" onChange={(anuncio) => onChange({ anuncio })} />
      <Interruptor label="Buscador en el encabezado" value={tema.mostrar_busqueda !== false} onChange={(mostrar_busqueda) => onChange({ mostrar_busqueda })} />
      <MenuEditor label="Menú" value={tema.menu ?? []} sitio={sitio} onChange={(menu) => onChange({ menu })} />
      {(tema.menu ?? []).length === 0 && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Sin menú propio se muestra uno automático: categorías, productos, ofertas, Nosotros y Contacto.</p>}
    </div>
  );
}

/** Pie de todas las páginas: texto, columnas de enlaces propias y enlaces automáticos. */
export function FooterPanel({ tema, onChange, sitio }: { tema: TemaNormalizado; onChange: SetTema; sitio: OpcionesSitio }) {
  const columnas = tema.pie_columnas ?? [];
  const setCol = (i: number, c: Partial<ColumnaPie>) => onChange({ pie_columnas: columnas.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  return (
    <div className="space-y-5">
      <Texto label="Texto del pie" value={tema.pie} max={300} multiline placeholder="Ej.: Hecho en Lincoln desde 1998. CUIT 20-12345678-9." onChange={(pie) => onChange({ pie })} hint="Vacío: se usa la descripción del local." />
      <Interruptor label="Enlaces automáticos" hint="Categorías, ofertas, colecciones y páginas publicadas en una columna “Tienda”." value={tema.pie_auto !== false} onChange={(pie_auto) => onChange({ pie_auto })} />
      {columnas.map((col, i) => (
        <div key={i} className="space-y-3 rounded-2xl border p-3">
          <div className="flex items-center gap-2">
            <Input aria-label={`Título de la columna ${i + 1}`} maxLength={30} value={col.titulo} placeholder="Título de la columna" onChange={(e) => setCol(i, { titulo: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive" aria-label={`Quitar columna ${i + 1}`} onClick={() => onChange({ pie_columnas: columnas.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <MenuEditor label="Enlaces" max={8} value={col.enlaces} sitio={sitio} onChange={(enlaces) => setCol(i, { enlaces })} />
        </div>
      ))}
      {columnas.length < 3 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ pie_columnas: [...columnas, { titulo: columnas.length ? "Ayuda" : "Información", enlaces: [] }] })}><Plus className="h-4 w-4" />Agregar columna de enlaces</Button>}
      <p className="text-xs text-muted-foreground">Dirección, horarios y medios de pago salen de Configuración del local.</p>
    </div>
  );
}

/** Ajustes globales del catálogo (orden inicial). */
export function CatalogoGlobal({ tema, onChange }: { tema: TemaNormalizado; onChange: SetTema }) {
  return (
    <Campo label="Orden inicial de los productos" hint="Se aplica al catálogo, a las colecciones y a la búsqueda.">
      <select value={tema.catalogo_orden ?? "relevancia"} onChange={(e) => onChange({ catalogo_orden: e.target.value as CatalogoOrden })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Orden inicial">
        {CATALOGO_ORDENES.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </Campo>
  );
}

export const slugDe = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

/** Ajustes de una página: título, dirección, visibilidad, texto principal y SEO. */
export function PaginaPanel({ pagina, onChange, publicada, onEliminar, storeSlug }: { pagina: PaginaEd; onChange: (c: Partial<PaginaEd>) => void; publicada: boolean; onEliminar: () => void; storeSlug: string }) {
  return (
    <div className="space-y-5">
      <Texto label="Título" value={pagina.titulo} max={90} onChange={(titulo) => onChange({ titulo, ...(!publicada && !pagina.slug.length ? { slug: slugDe(titulo) } : {}) })} />
      <Campo label="Dirección" hint={publicada ? "Cambiarla rompe los enlaces que ya compartiste." : undefined}>
        <div className="flex items-center rounded-md border bg-muted/40 pl-3 text-sm">
          <span className="shrink-0 text-muted-foreground">/t/{storeSlug}/pagina/</span>
          <input aria-label="Dirección de la página" value={pagina.slug} maxLength={70} onChange={(e) => onChange({ slug: slugDe(e.target.value) || e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className="h-10 min-w-0 flex-1 rounded-r-md bg-background px-2 outline-none" />
        </div>
      </Campo>
      <Opciones label="En la tienda" value={pagina.estado} options={[{ id: "publicada", label: "Visible" }, { id: "borrador", label: "Oculta" }]} onChange={(estado) => onChange({ estado })}
        hint={pagina.estado === "publicada" ? "Aparece en el pie y se puede enlazar desde el menú y los botones." : "Nadie la ve, aunque publiques el resto de los cambios."} />
      <Opciones label="Tipo" value={pagina.clase} options={(Object.keys(CLASE_PAGINA) as ClasePagina[]).map((c) => ({ id: c, label: CLASE_PAGINA[c] }))} onChange={(clase) => onChange({ clase })} />
      <Texto label="Texto principal (opcional)" value={pagina.contenido} max={20000} multiline onChange={(contenido) => onChange({ contenido, tipo: contenido.trim() ? "informativa" : "landing" })}
        hint="Se muestra como artículo arriba de las secciones. Admite ## títulos, listas con “- ”, **negrita** y enlaces." />
      <ImageUpload label="Imagen principal (también al compartir)" folder="comercios" shape="wide" value={pagina.imagen_url} onChange={(imagen_url) => onChange({ imagen_url })} className="max-w-sm" />
      <div className="space-y-3 rounded-2xl border p-3">
        <p className="text-sm font-extrabold">Buscadores</p>
        <Texto label={`Título para Google (${pagina.seo_titulo.length}/70)`} value={pagina.seo_titulo} max={70} placeholder={pagina.titulo} onChange={(seo_titulo) => onChange({ seo_titulo })} />
        <Texto label="Descripción para Google" value={pagina.seo_descripcion} max={170} multiline onChange={(seo_descripcion) => onChange({ seo_descripcion })} />
      </div>
      <Button type="button" variant="outline" className="w-full rounded-full text-destructive hover:text-destructive" onClick={onEliminar}><Trash2 className="h-4 w-4" />Eliminar página</Button>
    </div>
  );
}

/** Alta de página: sugeridas con texto inicial, en blanco o landing de campaña con secciones de ejemplo. */
export function NuevaPaginaDialog({ open, onOpenChange, existentes, onCrear, plantilla }: {
  open: boolean; onOpenChange: (v: boolean) => void; existentes: string[]; onCrear: (p: Omit<PaginaEd, "clave">) => void; plantilla: Plantilla;
}) {
  const [titulo, setTitulo] = useState("");
  const libre = (slug: string) => { let s = slug || "pagina"; let n = 2; while (existentes.includes(s)) s = `${slug}-${n++}`; return s; };
  const base = { estado: "borrador" as const, seo_titulo: "", seo_descripcion: "", imagen_url: "", orden: existentes.length };
  const crearLanding = () => {
    const t = titulo.trim() || "Nueva campaña";
    onCrear({ ...base, tipo: "landing", clase: "campana", titulo: t, slug: libre(slugDe(t)), contenido: "", bloques: [
      sec("contenido", plantilla, { antetitulo: "Por tiempo limitado", titulo: t, nivel: "h1", tamano: "grande", imagen_pos: "derecha", est: { arriba: 5, abajo: 5 } }),
      sec("productos", plantilla, { titulo: "Productos de la campaña", fuente: "ofertas" }),
      sec("cta", plantilla),
    ] });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogTitle className="text-xl font-black">Nueva página</DialogTitle>
        <DialogDescription>Se crea oculta y como borrador: la armás, la marcás como visible y publicás.</DialogDescription>
        <div className="space-y-2">
          <p className="text-sm font-bold">Páginas que toda tienda necesita</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAGINAS_SUGERIDAS.map((s) => {
              const ya = existentes.includes(s.slug);
              return (
                <button key={s.slug} type="button" disabled={ya} onClick={() => onCrear({ ...base, tipo: "informativa", clase: s.clase, titulo: s.titulo, slug: s.slug, contenido: s.contenido, bloques: [] })}
                  className={cn("flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition-colors hover:border-foreground/40", ya && "cursor-not-allowed opacity-50")}>
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />{s.titulo}{ya && <span className="ml-auto text-xs font-normal text-muted-foreground">Ya existe</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-bold">Página propia</p>
          <Input aria-label="Título de la nueva página" maxLength={90} value={titulo} placeholder="Ej.: Día de la Madre" onChange={(e) => setTitulo(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" disabled={titulo.trim().length < 2} onClick={() => onCrear({ ...base, tipo: "landing", clase: "otra", titulo: titulo.trim(), slug: libre(slugDe(titulo)), contenido: "", bloques: [sec("contenido", plantilla, { titulo: titulo.trim(), nivel: "h1", imagen_pos: "ninguna", botones: [] })] })}><FileText className="h-4 w-4" />En blanco</Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={crearLanding}><Megaphone className="h-4 w-4" />Landing de campaña</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
