import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto con formato simple escrito por el comercio, convertido a elementos de React (nunca HTML crudo: no hay forma de
 * inyectar código). Admite:
 *   ## Título · ### Subtítulo · párrafos separados por una línea en blanco · listas con "- " o "1. " ·
 *   **negrita** · *cursiva* · [texto](https://enlace) (solo https y direcciones internas que empiezan con /).
 */
export type BloqueRich =
  | { tipo: "h2" | "h3" | "p"; texto: string }
  | { tipo: "ul" | "ol"; items: string[] };

export function parseRichText(fuente: string): BloqueRich[] {
  const out: BloqueRich[] = [];
  const lineas = fuente.replace(/\r\n?/g, "\n").split("\n");
  let parrafo: string[] = [];
  let lista: { tipo: "ul" | "ol"; items: string[] } | null = null;
  const cerrar = () => {
    if (parrafo.length) { out.push({ tipo: "p", texto: parrafo.join(" ") }); parrafo = []; }
    if (lista) { out.push(lista); lista = null; }
  };
  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (!linea) { cerrar(); continue; }
    const h = linea.match(/^(#{2,3})\s+(.+)$/);
    if (h) { cerrar(); out.push({ tipo: h[1].length === 2 ? "h2" : "h3", texto: h[2] }); continue; }
    const ul = linea.match(/^[-*•]\s+(.+)$/);
    const ol = linea.match(/^\d{1,3}[.)]\s+(.+)$/);
    if (ul || ol) {
      const tipo = ul ? "ul" : "ol";
      if (parrafo.length) { out.push({ tipo: "p", texto: parrafo.join(" ") }); parrafo = []; }
      if (!lista || lista.tipo !== tipo) { if (lista) out.push(lista); lista = { tipo, items: [] }; }
      lista.items.push((ul ?? ol)![1]);
      continue;
    }
    if (lista) { out.push(lista); lista = null; }
    parrafo.push(linea);
  }
  cerrar();
  return out;
}

const ENLACE_SEGURO = /^(https:\/\/[^\s<>"]+|\/[A-Za-z0-9/_\-?=&.#%]*)$/;

/** Negrita, cursiva y enlaces dentro de una línea. */
export function renderInline(texto: string, claveBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]{1,120})\]\(([^)\s]{1,300})\)/g;
  let ultimo = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index));
    const k = `${claveBase}-${n++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else if (m[3] && ENLACE_SEGURO.test(m[4])) {
      const externo = m[4].startsWith("https://");
      out.push(<a key={k} href={m[4]} className="font-semibold underline underline-offset-2" {...(externo ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{m[3]}</a>);
    } else out.push(m[0]);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo));
  return out;
}

export function RichText({ texto, className, headingStyle }: { texto: string | null | undefined; className?: string; headingStyle?: React.CSSProperties }) {
  if (!texto?.trim()) return null;
  return (
    <div className={cn("space-y-4 leading-relaxed", className)}>
      {parseRichText(texto).map((b, i) => (
        <Fragment key={i}>
          {b.tipo === "h2" && <h2 className="pt-2 text-2xl font-extrabold" style={headingStyle}>{renderInline(b.texto, `h${i}`)}</h2>}
          {b.tipo === "h3" && <h3 className="pt-1 text-lg font-extrabold" style={headingStyle}>{renderInline(b.texto, `h${i}`)}</h3>}
          {b.tipo === "p" && <p>{renderInline(b.texto, `p${i}`)}</p>}
          {b.tipo === "ul" && <ul className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}>{renderInline(it, `u${i}-${j}`)}</li>)}</ul>}
          {b.tipo === "ol" && <ol className="list-decimal space-y-1 pl-5">{b.items.map((it, j) => <li key={j}>{renderInline(it, `o${i}-${j}`)}</li>)}</ol>}
        </Fragment>
      ))}
    </div>
  );
}
