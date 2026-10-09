import { Plus, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bloque, ICONOS } from "@/lib/storefront";
import { Campo, Interruptor, Numero, Opciones, Texto } from "./fields";

type Patch = (cambios: Record<string, unknown>) => void;

const ALTOS = [{ id: "chico", label: "Bajo" }, { id: "medio", label: "Medio" }, { id: "grande", label: "Alto" }] as const;
const ALINEACIONES = [{ id: "izquierda", label: "Izquierda" }, { id: "centro", label: "Centro" }] as const;

function Enlace({ tipo, url, onChange }: { tipo: "catalogo" | "whatsapp" | "url"; url?: string; onChange: Patch }) {
  return (
    <div className="space-y-2">
      <Opciones label="El botón lleva a" value={tipo} onChange={(value) => onChange({ enlace_tipo: value })} options={[{ id: "catalogo", label: "Mis productos" }, { id: "whatsapp", label: "WhatsApp" }, { id: "url", label: "Otra web" }]} hint={tipo === "whatsapp" ? "Usa el WhatsApp que cargaste en Datos y redes." : undefined} />
      {tipo === "url" && <Input aria-label="Dirección de la web" value={url ?? ""} maxLength={300} placeholder="https://…" onChange={(event) => onChange({ enlace_url: event.target.value })} />}
    </div>
  );
}

/** Controles de cada tipo de bloque. Los cambios se mandan a `onChange` y la vista previa se actualiza al instante. */
export function BlockSettings({ bloque, categorias, colecciones = [], onChange }: { bloque: Bloque; categorias: string[]; colecciones?: { slug: string; nombre: string }[]; onChange: Patch }) {
  switch (bloque.tipo) {
    case "servicios":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={200} multiline onChange={(texto) => onChange({ texto })} />
          <Opciones label="Estilo" value={bloque.estilo} options={[{ id: "tarjetas", label: "Tarjetas" }, { id: "lista", label: "Lista" }]} onChange={(estilo) => onChange({ estilo })} />
          <Numero label="Cuántos servicios mostrar" value={bloque.cantidad} min={1} max={12} onChange={(cantidad) => onChange({ cantidad })} />
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Muestra tus servicios con turnos (Reservas y turnos → Servicios). Si no tenés servicios activos, el bloque no se ve.</p>
        </div>
      );
    case "portada":
      return (
        <div className="space-y-4">
          <Opciones label="Estilo de portada" value={bloque.estilo} onChange={(estilo) => onChange({ estilo })} options={[{ id: "simple", label: "Foto completa" }, { id: "boutique", label: "Foto + datos" }, { id: "galeria", label: "Editorial" }, { id: "impacto", label: "De color" }, { id: "gourmet", label: "Arco" }, { id: "atelier", label: "Revista" }, { id: "urbano", label: "Urbano" }, { id: "mercado", label: "Mercado" }, { id: "estudio", label: "Estudio (turnos)" }, { id: "taller", label: "Polaroids" }]} />
          <ImageUpload label="Foto de portada (si no subís una, usamos la de tu local)" folder="comercios" value={bloque.imagen_url} onChange={(imagen_url) => onChange({ imagen_url })} className="max-w-sm" />
          <Texto label="Título" value={bloque.titulo} max={80} placeholder="El nombre de tu comercio" onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Frase bajo el título" value={bloque.subtitulo} max={200} onChange={(subtitulo) => onChange({ subtitulo })} />
          <Texto label="Texto del botón" value={bloque.boton} max={24} placeholder="Ver productos" onChange={(boton) => onChange({ boton })} />
          {(bloque.estilo === "simple" || bloque.estilo === "boutique") && (
            <>
              <Opciones label="Altura" value={bloque.alto} options={[...ALTOS]} onChange={(alto) => onChange({ alto })} />
              <Opciones label="Texto" value={bloque.alineacion} options={[...ALINEACIONES]} onChange={(alineacion) => onChange({ alineacion })} />
              <Numero label="Oscurecer la foto" value={bloque.oscurecer} min={0} max={80} onChange={(oscurecer) => onChange({ oscurecer })} />
            </>
          )}
        </div>
      );
    case "texto":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={800} multiline onChange={(texto) => onChange({ texto })} />
          <Opciones label="Alineación" value={bloque.alineacion} options={[...ALINEACIONES]} onChange={(alineacion) => onChange({ alineacion })} />
          <Opciones label="Fondo" value={bloque.fondo} options={[{ id: "ninguno", label: "Sin fondo" }, { id: "suave", label: "Suave" }, { id: "color", label: "Color de marca" }]} onChange={(fondo) => onChange({ fondo })} />
        </div>
      );
    case "imagen_texto":
      return (
        <div className="space-y-4">
          <ImageUpload label="Foto" folder="comercios" value={bloque.imagen_url} onChange={(imagen_url) => onChange({ imagen_url })} className="max-w-sm" />
          <Opciones label="La foto va a la" value={bloque.lado} options={[{ id: "izquierda", label: "Izquierda" }, { id: "derecha", label: "Derecha" }]} onChange={(lado) => onChange({ lado })} />
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={600} multiline onChange={(texto) => onChange({ texto })} />
          <Texto label="Texto del botón (vacío = sin botón)" value={bloque.boton} max={24} onChange={(boton) => onChange({ boton })} />
          {bloque.boton && <Enlace tipo={bloque.enlace_tipo} url={bloque.enlace_url} onChange={onChange} />}
        </div>
      );
    case "banner":
      return (
        <div className="space-y-4">
          <ImageUpload label="Imagen del banner (sin imagen se usa el color de tu marca)" folder="comercios" value={bloque.imagen_url} onChange={(imagen_url) => onChange({ imagen_url })} className="max-w-sm" />
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={200} onChange={(texto) => onChange({ texto })} />
          <Texto label="Texto del botón (vacío = sin botón)" value={bloque.boton} max={24} onChange={(boton) => onChange({ boton })} />
          {bloque.boton && <Enlace tipo={bloque.enlace_tipo} url={bloque.enlace_url} onChange={onChange} />}
          <Opciones label="Altura" value={bloque.alto} options={[...ALTOS]} onChange={(alto) => onChange({ alto })} />
        </div>
      );
    case "colecciones":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Opciones label="Estilo" value={bloque.estilo} options={[{ id: "tarjetas", label: "Tarjetas con foto" }, { id: "circulos", label: "Círculos" }, { id: "lista", label: "Cuadrados" }]} onChange={(estilo) => onChange({ estilo })} />
          <p className="text-xs text-muted-foreground">Se arma solo con tus categorías de productos. Se muestra cuando tenés al menos dos.</p>
        </div>
      );
    case "productos":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Opciones label="Qué mostrar" value={bloque.fuente} options={[{ id: "destacados", label: "Destacados" }, { id: "nuevos", label: "Novedades" }, { id: "ofertas", label: "En oferta" }, { id: "categoria", label: "Una sección" }, { id: "coleccion", label: "Una colección" }, { id: "todos", label: "Todos" }]} onChange={(fuente) => onChange({ fuente })}
            hint={bloque.fuente === "destacados" ? "Son los productos que marcás con estrella en tu catálogo." : bloque.fuente === "nuevos" ? "Los últimos productos que cargaste." : bloque.fuente === "ofertas" ? "Los que tienen precio rebajado u oferta activa." : undefined} />
          {bloque.fuente === "coleccion" && (
            <Campo label="Colección" hint={colecciones.length === 0 ? "Todavía no armaste colecciones: creálas en Catálogo → Colecciones." : undefined}>
              <select value={bloque.coleccion ?? ""} onChange={(event) => onChange({ coleccion: event.target.value || undefined })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" aria-label="Colección">
                <option value="">Elegí una…</option>
                {colecciones.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
          {bloque.fuente === "categoria" && (
            <Campo label="Categoría">
              <select value={bloque.categoria ?? ""} onChange={(event) => onChange({ categoria: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" aria-label="Categoría">
                <option value="">Elegí una…</option>
                {categorias.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Campo>
          )}
          <Numero label="Cantidad de productos" value={bloque.cantidad} min={2} max={12} onChange={(cantidad) => onChange({ cantidad })} />
          <Numero label="Columnas en pantalla grande" value={bloque.columnas} min={2} max={5} onChange={(columnas) => onChange({ columnas })} />
        </div>
      );
    case "catalogo":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Numero label="Columnas en pantalla grande" value={bloque.columnas} min={2} max={5} onChange={(columnas) => onChange({ columnas })} />
          <Interruptor label="Filtros y orden (estilo marketplace)" hint="Categorías, rango de precio, solo ofertas y ordenar por precio, descuento o novedad." value={bloque.filtros} onChange={(filtros) => onChange({ filtros })} />
        </div>
      );
    case "galeria":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Opciones label="Columnas" value={bloque.columnas} options={[{ id: 2, label: "2" }, { id: 3, label: "3" }, { id: 4, label: "4" }]} onChange={(columnas) => onChange({ columnas })} />
          <ul className="space-y-3">
            {bloque.imagenes.map((imagen, index) => (
              <li key={`${imagen.url}-${index}`} className="flex items-start gap-3 rounded-xl border p-2">
                <img src={imagen.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <Input aria-label={`Texto de la foto ${index + 1}`} value={imagen.texto ?? ""} maxLength={80} placeholder="Texto opcional" onChange={(event) => onChange({ imagenes: bloque.imagenes.map((item, i) => (i === index ? { ...item, texto: event.target.value } : item)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar foto ${index + 1}`} onClick={() => onChange({ imagenes: bloque.imagenes.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          {bloque.imagenes.length < 8 && <ImageUpload label={`Agregar foto (${bloque.imagenes.length}/8)`} folder="comercios" value="" onChange={(url) => onChange({ imagenes: [...bloque.imagenes, { url }] })} className="max-w-xs" />}
        </div>
      );
    case "confianza":
      return (
        <div className="space-y-3">
          {bloque.items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <select aria-label={`Ícono ${index + 1}`} value={item.icono} onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, icono: event.target.value } : row)) })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                  {ICONOS.map((icono) => <option key={icono.id} value={icono.id}>{icono.nombre}</option>)}
                </select>
                <Input aria-label={`Título ${index + 1}`} value={item.titulo} maxLength={40} placeholder="Título" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, titulo: event.target.value } : row)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ventaja ${index + 1}`} onClick={() => onChange({ items: bloque.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Input aria-label={`Texto ${index + 1}`} value={item.texto ?? ""} maxLength={90} placeholder="Texto corto (opcional)" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, texto: event.target.value } : row)) })} />
            </div>
          ))}
          {bloque.items.length < 4 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ items: [...bloque.items, { icono: "calidad", titulo: "Nueva ventaja", texto: "" }] })}><Plus className="h-4 w-4" />Agregar ventaja</Button>}
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          {bloque.items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label={`Pregunta ${index + 1}`} value={item.p} maxLength={120} placeholder="Pregunta" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, p: event.target.value } : row)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar pregunta ${index + 1}`} onClick={() => onChange({ items: bloque.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Input aria-label={`Respuesta ${index + 1}`} value={item.r} maxLength={400} placeholder="Respuesta" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, r: event.target.value } : row)) })} />
            </div>
          ))}
          {bloque.items.length < 8 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ items: [...bloque.items, { p: "", r: "" }] })}><Plus className="h-4 w-4" />Agregar pregunta</Button>}
        </div>
      );
    case "opiniones":
      return <div className="space-y-4"><Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} /><p className="text-xs text-muted-foreground">Muestra las opiniones con comentario que dejan tus clientes. Aparece cuando hay al menos una.</p></div>;
    case "contacto":
      return <div className="space-y-4"><Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} /><p className="text-xs text-muted-foreground">Usa la dirección, los horarios y las redes que cargaste en tu comercio y en Datos y redes.</p></div>;
    case "cinta":
      return (
        <div className="space-y-3">
          <Opciones label="Estilo" value={bloque.estilo} options={[{ id: "acento", label: "Color de la tienda" }, { id: "oscuro", label: "Oscuro" }, { id: "claro", label: "Con líneas" }]} onChange={(estilo) => onChange({ estilo })} />
          {bloque.items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input aria-label={`Frase ${index + 1}`} value={item} maxLength={60} placeholder="Ej.: Envío gratis desde $20.000" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? event.target.value : row)) })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Quitar frase ${index + 1}`} onClick={() => onChange({ items: bloque.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {bloque.items.length < 6 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ items: [...bloque.items, ""] })}><Plus className="h-4 w-4" />Agregar frase</Button>}
          <p className="text-xs text-muted-foreground">Las frases se repiten y se mueven de a una. Con "reducir movimiento" activado en el dispositivo quedan quietas.</p>
        </div>
      );
    case "newsletter":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={200} multiline onChange={(texto) => onChange({ texto })} />
          <Texto label="Texto del botón" value={bloque.boton} max={24} onChange={(boton) => onChange({ boton })} />
          <p className="text-xs text-muted-foreground">Los emails que dejen tus clientes se guardan en “Suscriptores” (pestaña Compartir), donde los podés descargar.</p>
        </div>
      );
    case "politicas":
      return (
        <div className="space-y-3">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          {bloque.items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label={`Título de la política ${index + 1}`} value={item.t} maxLength={40} placeholder="Ej.: Envíos" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, t: event.target.value } : row)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar política ${index + 1}`} onClick={() => onChange({ items: bloque.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <textarea aria-label={`Texto de la política ${index + 1}`} value={item.x} maxLength={600} rows={3} placeholder="Explicá cómo funciona" className="w-full rounded-md border bg-background px-3 py-2 text-sm" onChange={(event) => onChange({ items: bloque.items.map((row, i) => (i === index ? { ...row, x: event.target.value } : row)) })} />
            </div>
          ))}
          {bloque.items.length < 4 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ items: [...bloque.items, { t: "", x: "" }] })}><Plus className="h-4 w-4" />Agregar política</Button>}
          <p className="text-xs text-muted-foreground">Estas políticas también se muestran en la ficha de cada producto.</p>
        </div>
      );
    case "oferta":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Texto label="Texto" value={bloque.texto} max={200} multiline onChange={(texto) => onChange({ texto })} />
          <Campo label="La oferta termina el" hint="Se muestra un reloj hasta esa fecha y la oferta desaparece sola al terminar.">
            <Input type="datetime-local" aria-label="Fecha y hora de fin" value={(bloque.hasta ?? "").slice(0, 16)} onChange={(event) => onChange({ hasta: event.target.value || undefined })} />
          </Campo>
          <Texto label="Texto del botón" value={bloque.boton} max={24} onChange={(boton) => onChange({ boton })} />
          <Enlace tipo={bloque.enlace_tipo} url={bloque.enlace_url} onChange={onChange} />
        </div>
      );
    case "video":
      return (
        <div className="space-y-4">
          <Texto label="Título" value={bloque.titulo} max={80} onChange={(titulo) => onChange({ titulo })} />
          <Campo label="Enlace del video" hint="Pegá un enlace de YouTube (youtube.com/watch?v=… o youtu.be/…) o de Vimeo.">
            <Input aria-label="Enlace del video" value={bloque.url ?? ""} maxLength={200} placeholder="https://www.youtube.com/watch?v=…" onChange={(event) => onChange({ url: event.target.value })} />
          </Campo>
          <Texto label="Texto debajo" value={bloque.texto} max={200} onChange={(texto) => onChange({ texto })} />
        </div>
      );
    case "separador":
      return (
        <div className="space-y-4">
          <Opciones label="Altura" value={bloque.alto} options={[...ALTOS]} onChange={(alto) => onChange({ alto })} />
          <Interruptor label="Mostrar una línea" value={bloque.linea} onChange={(linea) => onChange({ linea })} />
        </div>
      );
  }
}
