// Woref — helpers compartidos
export const TIPO_USUARIO: Record<string, string> = {
  emprendedor: "Emprendedor",
  empresa: "Empresa",
  inversor: "Inversor",
  marca: "Marca",
  freelancer: "Freelancer",
  atleta: "Atleta",
  creador: "Creador",
  profesional: "Profesional",
  institucion: "Institución",
};

export const TIPO_PUBLICACION: Record<string, { label: string; emoji: string }> = {
  update: { label: "Update", emoji: "📣" },
  proyecto: { label: "Proyecto", emoji: "🚀" },
  oportunidad: { label: "Oportunidad", emoji: "💼" },
  recurso: { label: "Recurso", emoji: "📚" },
  idea: { label: "Idea", emoji: "💡" },
  logro: { label: "Logro", emoji: "🏆" },
  lanzamiento: { label: "Lanzamiento", emoji: "🎉" },
  busco_socio: { label: "Busco socio", emoji: "🤝" },
  busco_colaborador: { label: "Busco colab", emoji: "👥" },
  hiring: { label: "Hiring", emoji: "📢" },
  contenido_corto: { label: "Contenido", emoji: "✍️" },
  contenido_largo: { label: "Artículo", emoji: "📝" },
  video_corto: { label: "Video corto", emoji: "🎬" },
  video_largo: { label: "Video largo", emoji: "🎥" },
  encuesta: { label: "Encuesta", emoji: "📊" },
  general: { label: "General", emoji: "💬" },
};

export const FORMATO_PUBLICACION: Record<string, string> = {
  texto: "Texto",
  imagen: "Imagen",
  video_corto: "Video corto",
  video_largo: "Video largo",
  articulo: "Artículo",
  proyecto: "Proyecto",
  encuesta: "Encuesta",
  recurso: "Recurso",
};

export const ESTADO_PROYECTO: Record<string, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-blue-100 text-blue-700" },
  en_desarrollo: { label: "En desarrollo", color: "bg-amber-100 text-amber-700" },
  lanzado: { label: "Lanzado", color: "bg-emerald-100 text-emerald-700" },
  pausado: { label: "Pausado", color: "bg-gray-100 text-gray-700" },
  completado: { label: "Completado", color: "bg-purple-100 text-purple-700" },
  buscando_equipo: { label: "Buscando equipo", color: "bg-orange-100 text-orange-700" },
  buscando_inversion: { label: "Buscando inversión", color: "bg-pink-100 text-pink-700" },
};

export function initials(name?: string | null) {
  if (!name) return "??";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export function formatTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function formatNumber(n?: number | null) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
