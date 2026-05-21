// Woref — helpers compartidos
import {
  Megaphone, Rocket, Briefcase, BookOpen, Lightbulb, Trophy, PartyPopper,
  Handshake, Users, Radio, PenLine, FileText, Clapperboard, Video, BarChart3, MessageSquare,
  type LucideIcon,
} from "lucide-react";

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

export const TIPO_PUBLICACION: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  update:             { label: "Update",         icon: Megaphone,    color: "text-sky-600 bg-sky-500/10" },
  proyecto:           { label: "Proyecto",       icon: Rocket,       color: "text-violet-600 bg-violet-500/10" },
  oportunidad:        { label: "Oportunidad",    icon: Briefcase,    color: "text-amber-600 bg-amber-500/10" },
  recurso:            { label: "Recurso",        icon: BookOpen,     color: "text-emerald-600 bg-emerald-500/10" },
  idea:               { label: "Idea",           icon: Lightbulb,    color: "text-yellow-600 bg-yellow-500/10" },
  logro:              { label: "Logro",          icon: Trophy,       color: "text-amber-600 bg-amber-500/10" },
  lanzamiento:        { label: "Lanzamiento",    icon: PartyPopper,  color: "text-fuchsia-600 bg-fuchsia-500/10" },
  busco_socio:        { label: "Busco socio",    icon: Handshake,    color: "text-teal-600 bg-teal-500/10" },
  busco_colaborador:  { label: "Busco colab",    icon: Users,        color: "text-cyan-600 bg-cyan-500/10" },
  hiring:             { label: "Hiring",         icon: Radio,        color: "text-rose-600 bg-rose-500/10" },
  contenido_corto:    { label: "Contenido",      icon: PenLine,      color: "text-slate-600 bg-slate-500/10" },
  contenido_largo:    { label: "Artículo",       icon: FileText,     color: "text-slate-600 bg-slate-500/10" },
  video_corto:        { label: "Video corto",    icon: Clapperboard, color: "text-pink-600 bg-pink-500/10" },
  video_largo:        { label: "Video largo",    icon: Video,        color: "text-pink-600 bg-pink-500/10" },
  encuesta:           { label: "Encuesta",       icon: BarChart3,    color: "text-indigo-600 bg-indigo-500/10" },
  general:            { label: "General",        icon: MessageSquare,color: "text-muted-foreground bg-secondary" },
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
