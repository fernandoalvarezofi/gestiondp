// Genera public/sitemap.xml con las páginas públicas y los comercios aprobados.
// Se ejecuta antes de compilar (ver "build" en package.json y vercel.json). Si no se puede consultar la base, deja solo las páginas fijas.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE = (process.env.SITE_URL || "https://woref.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fixed = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/app", changefreq: "daily", priority: "0.9" },
  { path: "/app/promociones", changefreq: "daily", priority: "0.6" },
  { path: "/terminos", changefreq: "yearly", priority: "0.2" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.2" },
];

async function stores() {
  if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("example.supabase.co")) return [];
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_comercios?select=slug,updated_at&activo=eq.true&aprobado=eq.true&order=nombre`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return rows.filter((row) => /^[a-z0-9-]+$/.test(row.slug)).map((row) => ({ path: `/t/${row.slug}`, changefreq: "daily", priority: "0.8", lastmod: row.updated_at }));
  } catch {
    return [];
  }
}

const entries = [...fixed, ...(await stores())];
const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...entries.map((entry) => [
    `  <url>`,
    `    <loc>${SITE}${entry.path}</loc>`,
    entry.lastmod ? `    <lastmod>${new Date(entry.lastmod).toISOString().slice(0, 10)}</lastmod>` : null,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    `  </url>`,
  ].filter(Boolean).join("\n")),
  `</urlset>`,
].join("\n");
writeFileSync(resolve("public/sitemap.xml"), xml + "\n");
console.log(`sitemap.xml generado (${entries.length} páginas)`);
