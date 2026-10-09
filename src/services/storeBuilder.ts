import { db } from "@/lib/delivery";
import type { TiendaTema } from "@/lib/storefront";

/** Constructor de la tienda: borrador en el servidor, publicación validada, versiones, páginas, dominio y preparación. */

export type Borrador = { tema: TiendaTema; updated_at: string } | null;
export type Version = { id: string; nota: string | null; created_at: string; publicado_por: string | null; tema: TiendaTema };
export type ClasePagina = "nosotros" | "contacto" | "faq" | "envios" | "cambios" | "privacidad" | "condiciones" | "campana" | "marca" | "otra";
export type Pagina = {
  id: string; comercio_id: string; tipo: "informativa" | "landing"; clase: ClasePagina; slug: string; titulo: string; contenido: string | null; bloques: unknown[];
  estado: "borrador" | "publicada"; seo_titulo: string | null; seo_descripcion: string | null; imagen_url: string | null; orden: number; updated_at: string;
};
export type Dominio = { dominio: string; estado: "pendiente" | "activo" | "rechazado"; token: string; nota: string | null } | null;
export type ItemPreparacion = { clave: string; ok: boolean; titulo: string; detalle: string; grave: boolean };

export async function fetchBorrador(comercio: string): Promise<Borrador> {
  const { data } = await db.from("delivery_tienda_borradores").select("tema, updated_at").eq("comercio_id", comercio).maybeSingle();
  return (data as Borrador) ?? null;
}
export async function guardarBorrador(comercio: string, tema: TiendaTema): Promise<string> {
  const { data, error } = await db.rpc("tienda_borrador_guardar", { p_comercio: comercio, p_tema: tema });
  if (error) throw error;
  return data as string;
}
export async function descartarBorrador(comercio: string) { const { error } = await db.rpc("tienda_borrador_descartar", { p_comercio: comercio }); if (error) throw error; }
export async function publicarTienda(comercio: string, tema: TiendaTema, nota?: string) {
  const { error } = await db.rpc("tienda_publicar", { p_comercio: comercio, p_tema: tema, p_nota: nota?.trim() || null });
  if (error) throw error;
}
export async function fetchVersiones(comercio: string): Promise<Version[]> {
  const { data } = await db.from("delivery_tienda_versiones").select("id, nota, created_at, publicado_por, tema").eq("comercio_id", comercio).order("created_at", { ascending: false }).limit(40);
  return (data ?? []) as Version[];
}
export async function restaurarVersion(id: string): Promise<TiendaTema> {
  const { data, error } = await db.rpc("tienda_restaurar_version", { p_version: id });
  if (error) throw error;
  return data as TiendaTema;
}
export async function fetchPaginas(comercio: string): Promise<Pagina[]> {
  const { data } = await db.from("delivery_tienda_paginas").select("*").eq("comercio_id", comercio).order("orden").order("titulo");
  return (data ?? []) as Pagina[];
}
export async function guardarPagina(comercio: string, id: string | null, pagina: Partial<Pagina>): Promise<string> {
  const { data, error } = await db.rpc("tienda_pagina_guardar", { p_comercio: comercio, p_id: id, p: pagina });
  if (error) throw error;
  return data as string;
}
export async function borrarPagina(id: string) { const { error } = await db.from("delivery_tienda_paginas").delete().eq("id", id); if (error) throw error; }
export async function fetchDominio(comercio: string): Promise<Dominio> {
  const { data } = await db.from("delivery_tienda_dominios").select("dominio, estado, token, nota").eq("comercio_id", comercio).maybeSingle();
  return (data as Dominio) ?? null;
}
export async function solicitarDominio(comercio: string, dominio: string): Promise<Dominio> {
  const { data, error } = await db.rpc("tienda_dominio_solicitar", { p_comercio: comercio, p_dominio: dominio });
  if (error) throw error;
  return (data as Dominio) ?? null;
}
export async function fetchPreparacion(comercio: string): Promise<ItemPreparacion[]> {
  const { data, error } = await db.rpc("tienda_preparacion", { p_comercio: comercio });
  if (error) throw error;
  return (data ?? []) as ItemPreparacion[];
}

/** Páginas que conviene tener, con un texto inicial para completar (el comercio las edita antes de publicar). */
export const PAGINAS_SUGERIDAS: { clase: ClasePagina; titulo: string; slug: string; contenido: string }[] = [
  { clase: "nosotros", titulo: "Nosotros", slug: "nosotros", contenido: "## Quiénes somos\nContá cómo empezó tu negocio, quiénes lo hacen y qué los hace distintos.\n\n## Qué hacemos\n- Lo que vendés u ofrecés\n- Cómo lo hacés\n- Por qué te eligen" },
  { clase: "contacto", titulo: "Contacto", slug: "contacto", contenido: "## Escribinos\nRespondemos de lunes a viernes. También podés escribirnos por Woref desde el botón de mensajes.\n\n## Dónde estamos\nIndicá tu dirección, cómo llegar y los horarios de atención." },
  { clase: "faq", titulo: "Preguntas frecuentes", slug: "preguntas-frecuentes", contenido: "### ¿Hacen envíos?\nSí, a la zona que figura al hacer el pedido.\n\n### ¿Cómo pago?\nEfectivo, transferencia o los medios que ves al confirmar.\n\n### ¿Puedo cambiar un producto?\nSí, mirá nuestra política de cambios." },
  { clase: "envios", titulo: "Envíos", slug: "envios", contenido: "## Zonas y tiempos\nIndicá hasta dónde llegás y en cuánto tiempo. El costo exacto se calcula con tu dirección al hacer el pedido.\n\n## Retiro en el local\nSi preferís, podés retirarlo sin costo." },
  { clase: "cambios", titulo: "Cambios y devoluciones", slug: "cambios-y-devoluciones", contenido: "## Cambios\nPodés cambiar tu compra dentro de los 30 días con el comprobante, sin uso y en su empaque.\n\n## Botón de arrepentimiento\nSi compraste online, podés arrepentirte dentro de los 10 días corridos desde la entrega (Ley 24.240 de Defensa del Consumidor). Pedilo desde Woref en tu pedido o en /arrepentimiento." },
  { clase: "privacidad", titulo: "Privacidad", slug: "privacidad", contenido: "## Tus datos\nUsamos tu nombre, teléfono y dirección solo para preparar y entregar tus pedidos. No los vendemos ni los compartimos con terceros fuera de la entrega.\n\nWoref procesa la cuenta y los pagos según su propia política de privacidad: [ver política](/privacidad)." },
  { clase: "condiciones", titulo: "Términos y condiciones", slug: "terminos-y-condiciones", contenido: "## Condiciones de venta\nLos precios incluyen impuestos y pueden cambiar sin aviso; se respeta el precio del momento en que confirmaste el pedido.\n\nLas condiciones generales de uso de Woref están en [Términos](/terminos)." },
];
export const CLASE_PAGINA: Record<ClasePagina, string> = {
  nosotros: "Nosotros", contacto: "Contacto", faq: "Preguntas frecuentes", envios: "Envíos", cambios: "Cambios y devoluciones", privacidad: "Privacidad", condiciones: "Términos", campana: "Campaña", marca: "Marca", otra: "Otra",
};
