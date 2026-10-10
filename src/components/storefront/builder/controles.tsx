import { ArrowDown, ArrowUp, Eye, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MENU_TIPOS, MenuItem, MenuTipo } from "@/lib/storefront";
import { Boton, Destino, DESTINO_NECESITA, DestinoTipo, DESTINOS, EstiloSeccion, NOMBRE_DESTINO } from "@/lib/storefrontSecciones";
import { cn } from "@/lib/utils";
import { Campo, Numero, Opciones } from "./fields";

/** Lo que el editor sabe de la tienda para ofrecer destinos reales (categorías, colecciones, páginas, secciones de la página). */
export type OpcionesSitio = {
  categorias: string[];
  colecciones: { slug: string; nombre: string }[];
  paginas: { slug: string; titulo: string }[];
  anclas: { id: string; nombre: string }[];
  conTurnos: boolean;
  conWhatsapp: boolean;
};

const select = "h-9 w-full rounded-md border bg-background px-2.5 text-sm";

/** Elige adónde lleva un botón o enlace. Solo ofrece destinos que existen en la tienda. */
export function DestinoPicker({ value, onChange, sitio, label = "Lleva a" }: { value: Destino; onChange: (d: Destino) => void; sitio: OpcionesSitio; label?: string }) {
  const necesita = DESTINO_NECESITA[value.tipo];
  const opciones = necesita === "categoria" ? sitio.categorias.map((c) => ({ v: c, t: c })) : necesita === "coleccion" ? sitio.colecciones.map((c) => ({ v: c.slug, t: c.nombre }))
    : necesita === "pagina" ? sitio.paginas.map((p) => ({ v: p.slug, t: p.titulo })) : necesita === "ancla" ? sitio.anclas.map((a) => ({ v: a.id, t: a.nombre })) : [];
  const disponible = (t: DestinoTipo) => (t === "reservar" ? sitio.conTurnos : t === "whatsapp" ? sitio.conWhatsapp : t === "categoria" ? sitio.categorias.length > 0
    : t === "coleccion" ? sitio.colecciones.length > 0 : t === "pagina" ? sitio.paginas.length > 0 : t === "ancla" ? sitio.anclas.length > 0 : true);
  const cambiarTipo = (tipo: DestinoTipo) => {
    const n = DESTINO_NECESITA[tipo];
    const primera = n === "categoria" ? sitio.categorias[0] : n === "coleccion" ? sitio.colecciones[0]?.slug : n === "pagina" ? sitio.paginas[0]?.slug : n === "ancla" ? sitio.anclas[0]?.id : n === "url" ? "https://" : undefined;
    onChange(primera ? { tipo, valor: primera } : { tipo });
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Campo label={label}>
        <select aria-label={label} value={value.tipo} onChange={(e) => cambiarTipo(e.target.value as DestinoTipo)} className={select}>
          {DESTINOS.map((t) => <option key={t} value={t} disabled={!disponible(t) && t !== value.tipo}>{NOMBRE_DESTINO[t]}{!disponible(t) ? " (no disponible)" : ""}</option>)}
        </select>
      </Campo>
      {necesita === "url" ? (
        <Campo label="Dirección"><Input aria-label="Dirección web" value={value.valor ?? ""} maxLength={300} placeholder="https://" onChange={(e) => onChange({ ...value, valor: e.target.value.trim() })} /></Campo>
      ) : necesita ? (
        <Campo label="Cuál">
          <select aria-label="Destino" value={value.valor ?? ""} onChange={(e) => onChange({ ...value, valor: e.target.value })} className={select}>
            {opciones.length === 0 && <option value="">No hay opciones</option>}
            {opciones.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </Campo>
      ) : null}
      {value.tipo === "ancla" && <p className="text-xs text-muted-foreground sm:col-span-2">Para que una sección aparezca acá, poné un “ancla” en su pestaña Estilo.</p>}
    </div>
  );
}

/** Hasta dos botones con texto, destino y estilo. */
export function BotonesEditor({ value, onChange, sitio, max = 2 }: { value: Boton[]; onChange: (b: Boton[]) => void; sitio: OpcionesSitio; max?: number }) {
  const set = (i: number, cambios: Partial<Boton>) => onChange(value.map((b, j) => (j === i ? { ...b, ...cambios } : b)));
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold">Botones</p>
      {value.map((b, i) => (
        <div key={i} className="space-y-2 rounded-xl border p-2.5">
          <div className="flex items-center gap-2">
            <Input aria-label={`Texto del botón ${i + 1}`} value={b.texto} maxLength={30} onChange={(e) => set(i, { texto: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Quitar botón ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <DestinoPicker value={b.destino} sitio={sitio} onChange={(destino) => set(i, { destino })} />
          <Opciones label="Estilo" value={b.estilo} options={[{ id: "primario", label: "Principal" }, { id: "secundario", label: "Contorno" }, { id: "enlace", label: "Enlace" }]} onChange={(estilo) => set(i, { estilo })} />
        </div>
      ))}
      {value.length < max && <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onChange([...value, { texto: value.length ? "Saber más" : "Ver productos", destino: { tipo: "catalogo" }, estilo: value.length ? "secundario" : "primario" }])}><Plus className="h-4 w-4" />Agregar botón</Button>}
    </div>
  );
}

/** Lista de enlaces (menú del encabezado o columna del pie). */
export function MenuEditor({ value, onChange, sitio, max = 12, label = "Enlaces" }: { value: MenuItem[]; onChange: (m: MenuItem[]) => void; sitio: OpcionesSitio; max?: number; label?: string }) {
  const opciones = (tipo: MenuTipo) => tipo === "categoria" ? sitio.categorias.map((c) => ({ v: c, t: c })) : tipo === "coleccion" ? sitio.colecciones.map((c) => ({ v: c.slug, t: c.nombre })) : tipo === "pagina" ? sitio.paginas.map((p) => ({ v: p.slug, t: p.titulo })) : [];
  const agregar = (tipo: MenuTipo) => {
    const def = MENU_TIPOS.find((m) => m.tipo === tipo)!;
    const primera = opciones(tipo)[0];
    onChange([...value, { tipo, texto: primera?.t ?? def.nombre.replace(/ \(.*\)$/, ""), ...(def.necesita === "url" ? { destino: "https://" } : primera ? { destino: primera.v } : {}) }].slice(0, max));
  };
  const mover = (i: number, d: -1 | 1) => { const n = [...value]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((m, i) => {
            const def = MENU_TIPOS.find((x) => x.tipo === m.tipo)!;
            const ops = opciones(m.tipo);
            const set = (c: Partial<MenuItem>) => onChange(value.map((x, j) => (j === i ? { ...x, ...c } : x)));
            return (
              <li key={i} className="space-y-1.5 rounded-xl border p-2">
                <div className="flex items-center gap-1">
                  <Input aria-label="Texto del enlace" maxLength={30} value={m.texto} onChange={(e) => set({ texto: e.target.value })} className="h-9" />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Bajar" disabled={i === value.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" aria-label="Quitar enlace" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {def.necesita === "url" ? <Input aria-label="Enlace" maxLength={200} value={m.destino ?? ""} onChange={(e) => set({ destino: e.target.value.trim() })} placeholder="https://" className="h-9" />
                  : def.necesita ? (
                    <select aria-label="Destino" value={m.destino ?? ""} onChange={(e) => set({ destino: e.target.value })} className={select}>
                      {ops.length === 0 && <option value="">No hay opciones</option>}
                      {ops.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  ) : <p className="px-1 text-xs text-muted-foreground">{def.nombre}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {value.length < max && (
        <select value="" aria-label={`Agregar a ${label}`} onChange={(e) => e.target.value && agregar(e.target.value as MenuTipo)} className="h-9 w-full rounded-full border bg-background px-3 text-sm font-semibold">
          <option value="">+ Agregar enlace…</option>
          {MENU_TIPOS.filter((m) => m.tipo !== "reservar" || sitio.conTurnos).map((m) => <option key={m.tipo} value={m.tipo} disabled={(m.necesita === "pagina" && sitio.paginas.length === 0) || (m.necesita === "coleccion" && sitio.colecciones.length === 0)}>{m.nombre}</option>)}
        </select>
      )}
      {value.some((m) => m.tipo === "url" && !/^https:\/\/[^\s<>"]+$/.test(m.destino ?? "")) && <p className="text-xs font-semibold text-destructive">Un enlace externo tiene que empezar con https:// (si no, se descarta al publicar).</p>}
    </div>
  );
}

const ESPACIOS = ["Nada", "Mínimo", "Poco", "Medio", "Bastante", "Mucho", "Máximo"];

/** Pestaña "Estilo" de cualquier sección: el mismo panel para todas, porque es el mismo contrato (`est`). */
export function EstiloPanel({ value, onChange, ocultarFondo }: { value: EstiloSeccion | undefined; onChange: (est: EstiloSeccion | undefined) => void; ocultarFondo?: boolean }) {
  const est = value ?? {};
  const set = (cambios: Partial<EstiloSeccion>) => {
    const next: EstiloSeccion = { ...est, ...cambios };
    (Object.keys(next) as (keyof EstiloSeccion)[]).forEach((k) => { if (next[k] === undefined || next[k] === "") delete next[k]; });
    onChange(Object.keys(next).length ? next : undefined);
  };
  const fondo = est.fondo ?? "ninguno";
  return (
    <div className="space-y-5">
      <Campo label="Nombre en el editor" hint="Solo lo ves vos, para reconocer la sección en la estructura.">
        <Input aria-label="Nombre de la sección" maxLength={40} value={est.nombre ?? ""} placeholder="Ej.: Promo de verano" onChange={(e) => set({ nombre: e.target.value || undefined })} />
      </Campo>
      {!ocultarFondo && (
        <div className="space-y-2.5">
          <Opciones label="Fondo" value={fondo} onChange={(f) => set(f === "ninguno" ? { fondo: undefined, color: undefined, imagen: undefined, capa: undefined } : { fondo: f, ...(f === "color" ? { color: est.color ?? "#F4F1EC" } : {}) })}
            options={[{ id: "ninguno", label: "Ninguno" }, { id: "suave", label: "Suave" }, { id: "superficie", label: "Superficie" }, { id: "acento", label: "Color de marca" }, { id: "oscuro", label: "Oscuro" }, { id: "color", label: "Otro color" }, { id: "imagen", label: "Foto" }]} />
          {fondo === "color" && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="color" value={est.color ?? "#F4F1EC"} onChange={(e) => set({ color: e.target.value.toUpperCase() })} className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5" aria-label="Color del fondo" />{est.color}
            </label>
          )}
          {fondo === "imagen" && (
            <>
              <ImageUpload label="Foto de fondo" folder="comercios" shape="wide" value={est.imagen ?? ""} onChange={(imagen) => set({ imagen: imagen || undefined })} />
              <Numero label="Oscurecer la foto (para leer el texto)" value={est.capa ?? 40} min={0} max={80} onChange={(capa) => set({ capa })} />
              {!est.imagen && <p className="text-xs font-semibold text-warning">Subí una foto: sin ella la sección se ve sin fondo.</p>}
            </>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <EspacioControl label="Espacio arriba" value={est.arriba} onChange={(arriba) => set({ arriba })} />
        <EspacioControl label="Espacio abajo" value={est.abajo} onChange={(abajo) => set({ abajo })} />
      </div>
      <Opciones label="Ancho del contenido" value={est.ancho ?? "tema"} onChange={(a) => set({ ancho: a === "tema" ? undefined : a })}
        options={[{ id: "tema", label: "Del tema" }, { id: "estrecho", label: "Estrecho" }, { id: "normal", label: "Normal" }, { id: "amplio", label: "Amplio" }, { id: "completo", label: "Todo el ancho" }]} />
      <Opciones label="Alineación de títulos y textos" value={est.alinear ?? "tema"} onChange={(a) => set({ alinear: a === "tema" ? undefined : a })}
        options={[{ id: "tema", label: "Del tema" }, { id: "izquierda", label: "Izquierda" }, { id: "centro", label: "Centrada" }]} />
      <Opciones label="Se ve en" value={est.ver ?? "todos"} onChange={(v) => set({ ver: v === "todos" ? undefined : v })}
        options={[{ id: "todos", label: <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Todas las pantallas</span> }, { id: "escritorio", label: <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />Solo computadora</span> }, { id: "movil", label: <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" />Solo celular</span> }]}
        hint="Para mostrar una versión distinta en celular: duplicá la sección y elegí una para cada pantalla." />
      <Campo label="Ancla (para enlazar a esta sección)" hint="Letras minúsculas, números y guiones. Después podés elegirla como destino de un botón o del menú.">
        <Input aria-label="Ancla de la sección" maxLength={40} value={est.ancla ?? ""} placeholder="ej.: promociones" onChange={(e) => set({ ancla: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-") || undefined })} />
      </Campo>
    </div>
  );
}

function EspacioControl({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between text-sm font-semibold"><span>{label}</span><span className="font-normal text-muted-foreground">{value === undefined ? "Del tema" : ESPACIOS[value]}</span></p>
      <div className="flex items-center gap-2">
        <input type="range" min={0} max={6} value={value ?? 3} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className={cn("w-full accent-[hsl(var(--brand-yellow))]", value === undefined && "opacity-50")} />
        {value !== undefined && <button type="button" onClick={() => onChange(undefined)} className="shrink-0 text-xs font-semibold text-muted-foreground underline">Tema</button>}
      </div>
    </div>
  );
}
