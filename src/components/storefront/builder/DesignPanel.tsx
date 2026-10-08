import { Check } from "lucide-react";
import { ColorSwatches } from "@/components/storefront/TemplatePicker";
import { ASPECTOS, Diseno, FUENTES, Fuente, normalizeTheme, RADIOS, Radio, TemaNormalizado } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import { Opciones } from "./fields";

const FONDOS = [
  { id: undefined, nombre: "Automático", color: "#FFFFFF" },
  { id: "#FFFFFF", nombre: "Blanco", color: "#FFFFFF" },
  { id: "#FAF7F2", nombre: "Crema", color: "#FAF7F2" },
  { id: "#F1F5F9", nombre: "Gris suave", color: "#F1F5F9" },
  { id: "#FDF2F8", nombre: "Rosa suave", color: "#FDF2F8" },
  { id: "#0F172A", nombre: "Azul noche", color: "#0F172A" },
  { id: "#0A0A0A", nombre: "Negro", color: "#0A0A0A" },
] as const;

/** Diseño global de la tienda: colores, letras, esquinas, botones, espaciado y forma de los productos. */
export function DesignPanel({ tema, onChange }: { tema: TemaNormalizado; onChange: (cambios: Partial<Diseno> & { color?: string }) => void }) {
  const d = tema.diseno;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-extrabold">Color de tu marca</h3>
        <p className="mb-3 text-sm text-muted-foreground">Se usa en botones, detalles y portadas de color.</p>
        <ColorSwatches value={tema.color} onChange={(color) => onChange({ color })} />
      </section>

      <section>
        <h3 className="mb-2 font-extrabold">Fondo de la página</h3>
        <div className="flex flex-wrap gap-2">
          {FONDOS.map((fondo) => {
            const on = d.fondo === fondo.id;
            return (
              <button key={fondo.nombre} type="button" aria-pressed={on} onClick={() => onChange({ fondo: fondo.id })} className={cn("flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-semibold transition-colors", on ? "border-brand-yellow bg-brand-yellow/10" : "border-transparent bg-muted/60 hover:bg-muted")}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ background: fondo.color }}>{on && <Check className="h-3.5 w-3.5" style={{ color: fondo.color === "#FFFFFF" || fondo.color === "#FAF7F2" || fondo.color === "#F1F5F9" || fondo.color === "#FDF2F8" ? "#111" : "#fff" }} />}</span>
                {fondo.nombre}
              </button>
            );
          })}
          <label className="flex items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-3 text-sm font-semibold">
            <input type="color" value={d.fondo ?? "#FFFFFF"} onChange={(event) => onChange({ fondo: event.target.value.toUpperCase() })} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Elegir otro fondo" />Otro
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Con un fondo oscuro, los textos se vuelven claros solos.</p>
      </section>

      <section>
        <h3 className="mb-2 font-extrabold">Letra de los títulos</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(FUENTES) as Fuente[]).map((fuente) => (
            <button key={fuente} type="button" aria-pressed={d.fuente_titulos === fuente} onClick={() => onChange({ fuente_titulos: fuente })} className={cn("rounded-2xl border-2 p-3 text-left transition-colors", d.fuente_titulos === fuente ? "border-brand-yellow bg-brand-yellow/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
              <span className="block text-2xl font-bold leading-none" style={{ fontFamily: FUENTES[fuente].css }}>{FUENTES[fuente].ejemplo}</span>
              <span className="mt-1 block text-xs font-semibold text-muted-foreground">{FUENTES[fuente].nombre}</span>
            </button>
          ))}
        </div>
        <div className="mt-4"><Opciones label="Letra de los textos" value={d.fuente_texto} options={[{ id: "sans", label: "Moderna" }, { id: "serif", label: "Elegante" }]} onChange={(fuente_texto) => onChange({ fuente_texto })} /></div>
      </section>

      <section className="space-y-5">
        <h3 className="font-extrabold">Forma y estilo</h3>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Esquinas</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(RADIOS) as Radio[]).map((radio) => (
              <button key={radio} type="button" aria-pressed={d.radio === radio} onClick={() => onChange({ radio })} className={cn("rounded-xl border-2 p-2 text-center transition-colors", d.radio === radio ? "border-brand-yellow bg-brand-yellow/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
                <span className="mx-auto block h-9 w-12 border-2 border-foreground/60 bg-background" style={{ borderRadius: RADIOS[radio].css }} />
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">{RADIOS[radio].nombre}</span>
              </button>
            ))}
          </div>
        </div>
        <Opciones label="Botones" value={d.boton} options={[{ id: "relleno", label: "Rellenos" }, { id: "contorno", label: "Solo borde" }]} onChange={(boton) => onChange({ boton })} />
        <Opciones label="Encabezado" value={d.cabecera} options={[{ id: "izquierda", label: "Logo a la izquierda" }, { id: "centro", label: "Logo centrado" }]} onChange={(cabecera) => onChange({ cabecera })} />
        <Opciones label="Ancho de la página" value={d.ancho} options={[{ id: "normal", label: "Normal" }, { id: "amplio", label: "Amplio" }]} onChange={(ancho) => onChange({ ancho })} />
        <Opciones label="Espacio entre bloques" value={d.espaciado} options={[{ id: "compacto", label: "Compacto" }, { id: "normal", label: "Normal" }, { id: "amplio", label: "Amplio" }]} onChange={(espaciado) => onChange({ espaciado })} />
      </section>

      <section className="space-y-5">
        <h3 className="font-extrabold">Tus productos</h3>
        <Opciones label="Cómo se muestran" value={d.descripcion} options={[{ id: false, label: "Tarjetas con foto grande" }, { id: true, label: "Lista con descripción" }]} onChange={(descripcion) => onChange({ descripcion })} hint="La lista con descripción es ideal para cartas de restaurantes." />
        {!d.descripcion && <Opciones label="Forma de la foto" value={d.aspecto} options={ASPECTOS.map((aspecto) => ({ id: aspecto.id, label: aspecto.nombre }))} onChange={(aspecto) => onChange({ aspecto })} />}
      </section>
    </div>
  );
}

/** Para comparar y guardar solo cambios reales. */
export const serializarTema = (tema: TemaNormalizado) => JSON.stringify(normalizeTheme(tema));
