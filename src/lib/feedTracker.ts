import { supabase } from "@/integrations/supabase/client";

const PESOS: Record<string, number> = {
  view: 0.2,
  dwell: 0.5,
  like: 2,
  comment: 3,
  share: 4,
  save: 3,
  repost: 3,
  profile_visit: 1.5,
};

let queue: any[] = [];
let timer: any = null;

export function trackEvento(args: { perfilId: string; publicacionId?: string | null; autorId?: string | null; accion: keyof typeof PESOS | string; dwellMs?: number }) {
  if (!args.perfilId) return;
  queue.push({
    perfil_id: args.perfilId,
    publicacion_id: args.publicacionId || null,
    autor_id: args.autorId || null,
    accion: args.accion,
    peso: PESOS[args.accion] || 1,
    dwell_ms: args.dwellMs || null,
  });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

async function flush() {
  if (queue.length === 0) return;
  const lote = queue.splice(0);
  try {
    await (supabase as any).from("feed_eventos").insert(lote);
  } catch (e) {
    // silenciar; tracking no debe romper la app
  }
}
