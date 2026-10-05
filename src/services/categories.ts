import { useEffect, useState } from "react";
import { db } from "@/lib/delivery";

export type Categoria = { id: string; parent_id: string | null; slug: string; nombre: string; orden: number };
export type CategoriaRaiz = Categoria & { hijas: Categoria[] };

/** Arma el árbol de dos niveles (raíces con sus hijas), ordenado. */
export function armarArbol(rows: Categoria[]): CategoriaRaiz[] {
  const orden = (a: Categoria, b: Categoria) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");
  return rows.filter((c) => !c.parent_id).sort(orden).map((raiz) => ({ ...raiz, hijas: rows.filter((c) => c.parent_id === raiz.id).sort(orden) }));
}

/** Texto "Raíz › Hija" de una categoría. */
export function rutaDe(id: string | null | undefined, rows: Categoria[]): string | null {
  const cat = rows.find((c) => c.id === id);
  if (!cat) return null;
  const madre = rows.find((c) => c.id === cat.parent_id);
  return madre ? `${madre.nombre} › ${cat.nombre}` : cat.nombre;
}

let cache: Promise<Categoria[]> | null = null;
export function fetchCategorias(): Promise<Categoria[]> {
  cache ??= db.from("categorias").select("id, parent_id, slug, nombre, orden").eq("activa", true).order("orden").then(({ data }: { data: Categoria[] | null }) => data ?? []);
  return cache;
}

export function useCategorias() {
  const [rows, setRows] = useState<Categoria[]>([]);
  useEffect(() => { let alive = true; fetchCategorias().then((r) => { if (alive) setRows(r); }); return () => { alive = false; }; }, []);
  return { rows, arbol: armarArbol(rows) };
}

/** Atributos del producto (clave/valor, hasta 12) <-> lista editable. */
export type AtributoFila = { clave: string; valor: string };
export const MAX_ATRIBUTOS = 12;
export const atributosAFilas = (a: Record<string, string> | null | undefined): AtributoFila[] => Object.entries(a ?? {}).map(([clave, valor]) => ({ clave, valor: String(valor) }));
/** Limpia filas vacías y repetidas; recorta a los límites del servidor (clave 30, valor 60, 12 atributos). */
export function filasAAtributos(filas: AtributoFila[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { clave, valor } of filas) {
    const k = clave.trim().slice(0, 30); const v = valor.trim().slice(0, 60);
    if (!k || !v || k in out) continue;
    if (Object.keys(out).length >= MAX_ATRIBUTOS) break;
    out[k] = v;
  }
  return out;
}
