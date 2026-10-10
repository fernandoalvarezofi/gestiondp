import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bloque, normalizeBloque, normalizeTheme, temaParaGuardar, TemaNormalizado } from "@/lib/storefront";
import { errorMessage } from "@/lib/delivery";
import {
  ClasePagina, descartarBorrador, descartarBorradorPagina, fetchBorrador, fetchPaginas, guardarBorrador, guardarBorradorPagina, Pagina, PaginaDatos, publicarTienda,
} from "@/services/storeBuilder";
import { serializarTema } from "./DesignPanel";

/**
 * Estado del sitio en el editor: tema (diseño, inicio, encabezado, pie) + todas las páginas, con UN historial de deshacer/rehacer
 * y autoguardado en borrador por partes (el tema en `tienda_borrador_guardar`, cada página en `tienda_pagina_borrador_guardar`).
 * Publicar manda todo junto al servidor, que valida, aplica y versiona el sitio completo.
 */

export type PaginaEd = {
  /** Identificador estable en el editor (el id real si ya existe en la base). */
  clave: string;
  tipo: "informativa" | "landing"; clase: ClasePagina; slug: string; titulo: string; contenido: string; bloques: Bloque[];
  estado: "borrador" | "publicada"; seo_titulo: string; seo_descripcion: string; imagen_url: string; orden: number;
};
export type Sitio = { tema: TemaNormalizado; paginas: PaginaEd[] };
export type EstadoGuardado = "listo" | "guardando" | "error";

const HISTORIA_MAX = 80;

const normalizarBloques = (raw: unknown): Bloque[] => (Array.isArray(raw) ? raw : []).map((b, i) => normalizeBloque(b, i)).filter((b): b is Bloque => b !== null && b.tipo !== "catalogo");

function paginaDesde(clave: string, d: Partial<PaginaDatos>): PaginaEd {
  return {
    clave, tipo: d.tipo === "landing" ? "landing" : "informativa", clase: (d.clase ?? "otra") as ClasePagina, slug: d.slug ?? "", titulo: d.titulo ?? "",
    contenido: d.contenido ?? "", bloques: normalizarBloques(d.bloques), estado: d.estado === "publicada" ? "publicada" : "borrador",
    seo_titulo: d.seo_titulo ?? "", seo_descripcion: d.seo_descripcion ?? "", imagen_url: d.imagen_url ?? "", orden: d.orden ?? 0,
  };
}
export function datosDePagina(p: PaginaEd): PaginaDatos {
  return {
    tipo: p.tipo, clase: p.clase, slug: p.slug, titulo: p.titulo.trim(), contenido: p.contenido.trim() ? p.contenido : null, bloques: p.bloques,
    estado: p.estado, seo_titulo: p.seo_titulo.trim() || null, seo_descripcion: p.seo_descripcion.trim() || null, imagen_url: p.imagen_url || null, orden: p.orden,
  };
}
const serPagina = (p: PaginaEd) => JSON.stringify(datosDePagina({ ...p, bloques: normalizarBloques(p.bloques) }));

export function useSitio(store: { id: string; tienda_tema?: unknown }) {
  const [sitio, setSitioRaw] = useState<Sitio>(() => ({ tema: normalizeTheme(store.tienda_tema), paginas: [] }));
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>("listo");
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardadoAt, setGuardadoAt] = useState<string | null>(null);
  const [historial, setHistorial] = useState({ atras: 0, adelante: 0 });

  const sitioRef = useRef(sitio);
  const historia = useRef<{ p: Sitio[]; f: Sitio[] }>({ p: [], f: [] });
  const ultimoCambio = useRef(0);
  // Lo que sabe el servidor de cada parte (fuera del historial: deshacer no "des-crea" una página guardada).
  const ids = useRef(new Map<string, string>());
  const publicadas = useRef(new Map<string, string>());
  const guardadas = useRef(new Map<string, string>());
  const temaPublicado = useRef(serializarTema(normalizeTheme(store.tienda_tema)));
  const temaGuardado = useRef(temaPublicado.current);
  const cola = useRef<Promise<void>>(Promise.resolve());

  const sincronizar = () => setHistorial({ atras: historia.current.p.length, adelante: historia.current.f.length });
  const reemplazar = useCallback((s: Sitio, limpiar = false) => {
    sitioRef.current = s; setSitioRaw(s);
    if (limpiar) { historia.current = { p: [], f: [] }; sincronizar(); }
  }, []);

  /** Cambio con historial. Lo que se escribe letra a letra se agrupa en un solo paso. */
  const cambiar = useCallback((fn: (s: Sitio) => Sitio) => {
    const actual = sitioRef.current;
    const next = fn(actual);
    if (next === actual) return;
    const ahora = Date.now();
    if (ahora - ultimoCambio.current > 700) historia.current.p = [...historia.current.p.slice(-(HISTORIA_MAX - 1)), actual];
    ultimoCambio.current = ahora;
    historia.current.f = [];
    sitioRef.current = next; setSitioRaw(next); sincronizar();
  }, []);
  const deshacer = useCallback(() => {
    const prev = historia.current.p.pop();
    if (!prev) return;
    historia.current.f = [sitioRef.current, ...historia.current.f].slice(0, HISTORIA_MAX);
    ultimoCambio.current = 0;
    sitioRef.current = prev; setSitioRaw(prev); sincronizar();
  }, []);
  const rehacer = useCallback(() => {
    const [next, ...resto] = historia.current.f;
    if (!next) return;
    historia.current.f = resto;
    historia.current.p = [...historia.current.p, sitioRef.current].slice(-HISTORIA_MAX);
    ultimoCambio.current = 0;
    sitioRef.current = next; setSitioRaw(next); sincronizar();
  }, []);

  // ---- carga (y recarga después de publicar o restaurar)
  const cargar = useCallback(async (temaEnLinea: unknown) => {
    setErrorCarga(null);
    try {
      const [borrador, filas] = await Promise.all([fetchBorrador(store.id), fetchPaginas(store.id)]);
      ids.current = new Map(); publicadas.current = new Map(); guardadas.current = new Map();
      const paginas = filas.map((f: Pagina) => {
        ids.current.set(f.id, f.id);
        const enLinea = paginaDesde(f.id, f);
        if (f.publicada_at || f.estado === "publicada") publicadas.current.set(f.id, serPagina(enLinea));
        const ed = f.borrador ? paginaDesde(f.id, f.borrador) : enLinea;
        guardadas.current.set(f.id, serPagina(ed));
        return ed;
      }).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));
      temaPublicado.current = serializarTema(normalizeTheme(temaEnLinea));
      const tema = normalizeTheme(borrador ? borrador.tema : temaEnLinea);
      temaGuardado.current = serializarTema(tema);
      setGuardadoAt(borrador?.updated_at ?? null);
      reemplazar({ tema, paginas }, true);
      setCargado(true);
      return Boolean(borrador) || filas.some((f) => f.borrador);
    } catch (error) {
      setErrorCarga(errorMessage(error, "No pudimos abrir el editor"));
      return false;
    }
  }, [store.id, reemplazar]);

  // ---- autoguardado por partes (en fila, para no crear dos veces una página nueva)
  const guardarAhora = useCallback(() => {
    const tarea = cola.current.then(async () => {
      const s = sitioRef.current;
      const temaSer = serializarTema(s.tema);
      const pendientes = s.paginas.filter((p) => serPagina(p) !== guardadas.current.get(p.clave));
      if (temaSer === temaGuardado.current && pendientes.length === 0) return;
      setGuardado("guardando");
      try {
        if (temaSer !== temaGuardado.current) {
          if (temaSer === temaPublicado.current) await descartarBorrador(store.id);
          else setGuardadoAt(await guardarBorrador(store.id, temaParaGuardar(normalizeTheme(s.tema))));
          temaGuardado.current = temaSer;
        }
        for (const p of pendientes) {
          const ser = serPagina(p);
          const id = ids.current.get(p.clave) ?? null;
          if (id && ser === publicadas.current.get(p.clave)) await descartarBorradorPagina(id);
          else {
            const r = await guardarBorradorPagina(store.id, id, datosDePagina(p));
            ids.current.set(p.clave, r.id);
            setGuardadoAt(r.at);
          }
          guardadas.current.set(p.clave, ser);
        }
        setGuardado("listo"); setErrorGuardado(null);
      } catch (error) {
        setGuardado("error"); setErrorGuardado(errorMessage(error, "No pudimos guardar el borrador"));
      }
    });
    cola.current = tarea.catch(() => undefined);
    return tarea;
  }, [store.id]);

  useEffect(() => {
    if (!cargado) return;
    const t = window.setTimeout(() => { void guardarAhora(); }, 1500);
    return () => window.clearTimeout(t);
  }, [sitio, cargado, guardarAhora]);

  // ---- estado de publicación
  const temaSinPublicar = useMemo(() => serializarTema(sitio.tema) !== temaPublicado.current, [sitio.tema, cargado]); // eslint-disable-line react-hooks/exhaustive-deps
  const paginasSinPublicar = useMemo(() => sitio.paginas.filter((p) => serPagina(p) !== publicadas.current.get(p.clave)).map((p) => p.clave), [sitio.paginas, cargado]); // eslint-disable-line react-hooks/exhaustive-deps
  const sinPublicar = temaSinPublicar || paginasSinPublicar.length > 0;
  const esPublicada = useCallback((clave: string) => publicadas.current.has(clave), []);

  const publicar = useCallback(async (nota: string, recargarTienda: () => Promise<{ tienda_tema?: unknown } | null>) => {
    await guardarAhora();
    if (guardadoRef.current === "error") throw new Error(errorGuardadoRef.current ?? "Hay cambios que no se pudieron guardar");
    const tema = serializarTema(sitioRef.current.tema) !== temaPublicado.current ? temaParaGuardar(normalizeTheme(sitioRef.current.tema)) : null;
    await publicarTienda(store.id, tema, nota);
    const enLinea = await recargarTienda();
    await cargar(enLinea?.tienda_tema ?? sitioRef.current.tema);
  }, [guardarAhora, cargar, store.id]);

  /** Descarta todo lo no publicado (tema y páginas). */
  const descartarTodo = useCallback(async (temaEnLinea: unknown) => {
    await cola.current;
    await descartarBorrador(store.id).catch(() => undefined);
    for (const [clave, id] of ids.current) {
      if (guardadas.current.get(clave) !== publicadas.current.get(clave)) await descartarBorradorPagina(id).catch(() => undefined);
    }
    await cargar(temaEnLinea);
  }, [cargar, store.id]);

  /** La página se borra en la base en el acto (no se puede deshacer). */
  const olvidarPagina = useCallback((clave: string) => {
    ids.current.delete(clave); publicadas.current.delete(clave); guardadas.current.delete(clave);
    const s = sitioRef.current;
    reemplazar({ ...s, paginas: s.paginas.filter((p) => p.clave !== clave) }, true);
  }, [reemplazar]);

  const guardadoRef = useRef(guardado); guardadoRef.current = guardado;
  const errorGuardadoRef = useRef(errorGuardado); errorGuardadoRef.current = errorGuardado;

  return {
    sitio, cambiar, deshacer, rehacer, historial, cargar, cargado, errorCarga, guardado, errorGuardado, guardadoAt, guardarAhora,
    sinPublicar, temaSinPublicar, paginasSinPublicar, esPublicada, publicar, descartarTodo, olvidarPagina, idDe: (clave: string) => ids.current.get(clave) ?? null,
  };
}
