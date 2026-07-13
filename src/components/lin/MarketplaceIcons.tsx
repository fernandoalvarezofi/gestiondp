import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type IconProps = { className?: string };

const paths: Record<string, ReactNode> = {
  archive: <><path d="M4 7.5h16" /><path d="M6 7.5v10A2.5 2.5 0 0 0 8.5 20h7a2.5 2.5 0 0 0 2.5-2.5v-10" /><path d="M7 4h10l3 3.5H4L7 4Z" /><path d="M9.5 11h5" /></>,
  key: <><circle cx="8" cy="13" r="3.5" /><path d="M11.5 13H20" /><path d="M17 13v2.5" /><path d="M14.5 13v2" /></>,
  handshake: <><path d="m7 12 3-3 3 3" /><path d="m10 9 2-2 5 5" /><path d="M5 10 3 12l5 5a2 2 0 0 0 2.8 0l.2-.2" /><path d="m17 12 2 2-5 5a2 2 0 0 1-2.8 0L8 15.8" /><path d="M3 12V7h4" /><path d="M21 14V9h-4" /></>,
  course: <><path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" /><path d="M7 10v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V10" /><path d="M20 8v6" /></>,
  web: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16" /><path d="M8 13h4" /><path d="M8 16h8" /><path d="M15 13h1" /></>,
  ai: <><path d="M12 3.5v3" /><path d="M12 17.5v3" /><path d="M3.5 12h3" /><path d="M17.5 12h3" /><rect x="7" y="7" width="10" height="10" rx="2.5" /><path d="M10 11h.01" /><path d="M14 11h.01" /><path d="M10.5 14h3" /></>,
  card: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M3.5 10h17" /><path d="M7 14h4" /></>,
  wallet: <><path d="M5 7.5h13A2.5 2.5 0 0 1 20.5 10v6A2.5 2.5 0 0 1 18 18.5H5A2.5 2.5 0 0 1 2.5 16V8A2.5 2.5 0 0 1 5 5.5h11" /><path d="M16 13h4.5" /><circle cx="16" cy="13" r=".5" /></>,
  store: <><path d="M5 10h14l-1-5H6l-1 5Z" /><path d="M6 10v9h12v-9" /><path d="M9 19v-5h6v5" /><path d="M4 10c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2" /></>,
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.6l-1.5 1.5" /><path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.6l1.5-1.5" /></>,
  chat: <><path d="M5 5.5h14v9H9l-4 4v-13Z" /><path d="M8.5 9.5h7" /><path d="M8.5 12h4" /></>,
  transfer: <><path d="M5 8h14" /><path d="M7 8V6l5-2 5 2v2" /><path d="M7 11v5" /><path d="M12 11v5" /><path d="M17 11v5" /><path d="M5 18h14" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  palette: <><circle cx="12" cy="12" r="8.5" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16" cy="10" r="1" /><path d="M12 20.5c-1.5 0-2-1-2-2s1-2 2.5-2 3 .5 3-1-1.5-1.5-1.5-3" /></>,
  code: <><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></>,
  chart: <><path d="M4 20V6" /><path d="M4 20h16" /><path d="M8 20v-6" /><path d="M12 20v-9" /><path d="M16 20v-4" /><path d="m8 10 4-4 4 4 3-3" /></>,
  music: <><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="2.5" /><circle cx="17" cy="16" r="2.5" /></>,
  video: <><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2z" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  book: <><path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" /><path d="M17 7.5h2v12H8" /><path d="M8 8h5" /><path d="M8 11.5h5" /></>,
  briefcase: <><rect x="3.5" y="8" width="17" height="11" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3.5 13h17" /></>,
  sparkles: <><path d="M12 4v4" /><path d="M12 16v4" /><path d="M4 12h4" /><path d="M16 12h4" /><path d="m6.5 6.5 2 2" /><path d="m15.5 15.5 2 2" /><path d="m17.5 6.5-2 2" /><path d="m8.5 15.5-2 2" /></>,
  package: <><path d="M3.5 7.5 12 4l8.5 3.5-8.5 3.5z" /><path d="M3.5 7.5v9L12 20l8.5-3.5v-9" /><path d="M12 11v9" /></>,
};

// Map lucide-icon names (as stored in DB) to our custom line-icon set
const LUCIDE_TO_CUSTOM: Record<string, string> = {
  Palette: "palette",
  Code: "code",
  Sparkles: "ai",
  GraduationCap: "course",
  Globe: "web",
  Briefcase: "briefcase",
  Package: "package",
  TrendingUp: "chart",
  Music: "music",
  Film: "video",
  Image: "image",
  BookOpen: "book",
  LayoutGrid: "grid",
};

function BaseIcon({ name, className }: IconProps & { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cn("h-5 w-5 text-primary", className)} aria-hidden="true">
      {paths[name] ?? paths.archive}
    </svg>
  );
}

export function MarketplaceProductIcon({ type, className }: IconProps & { type?: string }) {
  const name = ({ archivo: "archive", licencia: "key", servicio: "handshake", curso: "course", web: "web", ia: "ai" } as Record<string, string>)[type || ""] || "archive";
  return <BaseIcon name={name} className={className} />;
}

export function MarketplacePaymentIcon({ method, className }: IconProps & { method?: string }) {
  const name = ({ stripe_link: "card", mercadopago: "wallet", paypal: "wallet", gumroad: "store", lemon: "store", paddle: "card", binance: "wallet", transferencia: "transfer", coordinar: "chat", otro: "link" } as Record<string, string>)[method || ""] || "link";
  return <BaseIcon name={name} className={className} />;
}

export function MarketplaceCategoryIcon({ slug, name, icono, className }: IconProps & { slug?: string; name?: string; icono?: string | null }) {
  if (icono && LUCIDE_TO_CUSTOM[icono]) return <BaseIcon name={LUCIDE_TO_CUSTOM[icono]} className={className} />;
  const text = `${slug || ""} ${name || ""}`.toLowerCase();
  const iconName =
      text.includes("dise") ? "palette"
    : text.includes("curso") || text.includes("educ") || text.includes("tutorial") ? "course"
    : text.includes("ebook") || text.includes("guia") || text.includes("guía") || text.includes("libro") ? "book"
    : text.includes("audio") || text.includes("music") || text.includes("músic") ? "music"
    : text.includes("video") || text.includes("motion") || text.includes("film") ? "video"
    : text.includes("foto") || text.includes("stock") || text.includes("imag") ? "image"
    : text.includes("marketing") ? "chart"
    : text.includes("software") || text.includes("licen") ? "key"
    : text.includes("codigo") || text.includes("código") || text.includes("code") || text.includes("desarrollo") || text.includes("dev") ? "code"
    : text.includes("template") || text.includes("plantilla") ? "grid"
    : text.includes("web") || text.includes("landing") ? "web"
    : text.includes("serv") || text.includes("consult") ? "handshake"
    : text.includes("herramient") ? "sparkles"
    : text.includes("ia") || text.includes("ai") || text.includes("autom") ? "ai"
    : text.includes("producto") || text.includes("digital") ? "package"
    : text.includes("pago") ? "card"
    : "package";
  return <BaseIcon name={iconName} className={className} />;
}
