// Vista previa al compartir una tienda online (/t/:slug): los rastreadores de WhatsApp, Instagram, Facebook, X, Telegram y
// buscadores no ejecutan JavaScript, así que reciben el index.html con las etiquetas Open Graph de ESA tienda.
// Las personas siguen recibiendo la app normal (vercel.json solo reescribe a esta función para rastreadores).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://trramubtuzmwtnybudoj.supabase.co";
// Clave pública (anon): la misma que ya viaja dentro de la web; solo da lectura de lo que las reglas de acceso permiten.
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_NmpNZpqeeLFwQsAr7__8kA_A2YK-3h0";
const SITE = "https://woref.vercel.app";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const clip = (value, max) => { const text = String(value ?? "").replace(/\s+/g, " ").trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };

/** Foto para la vista previa: la portada de la tienda o la del local, solo si es https (nunca data: ni http:). */
function previewImage(store) {
  const theme = store.tienda_tema && typeof store.tienda_tema === "object" ? store.tienda_tema : {};
  const candidates = [theme.banner_url, store.imagen_url, store.logo_url];
  const found = candidates.find((url) => typeof url === "string" && /^https:\/\//i.test(url));
  if (!found) return null;
  return found.includes("images.unsplash.com") ? found.replace(/([?&])w=\d+/, "$1w=1200") : found;
}

/** Reemplaza las etiquetas de título, descripción y Open Graph del index.html por las de la tienda. */
export function buildHtml(template, store, slug) {
  const url = `${SITE}/t/${encodeURIComponent(slug)}`;
  const theme = store.tienda_tema && typeof store.tienda_tema === "object" ? store.tienda_tema : {};
  const title = clip(`${theme.titulo || store.nombre} · Tienda online`, 70);
  const description = clip(theme.subtitulo || store.descripcion || `Mirá el catálogo de ${store.nombre} y pedí online, con envío a domicilio o retiro en el local.`, 200);
  const image = previewImage(store);
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  let html = template;
  // Se usa una función para que `const swap = (pattern, replacement) => { html = html.replace(pattern, replacement); };` o `$1` dentro de un nombre de tienda no se interpreten como patrones de reemplazo.
  const swap = (pattern, replacement) => { html = html.replace(pattern, () => replacement); };
  swap(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  swap(/<meta name="description"[^>]*>/, `<meta name="description" content="${d}" />`);
  swap(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${u}" />`);
  swap(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${u}" />`);
  swap(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${t}">`);
  swap(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${d}">`);
  swap(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${t}">`);
  swap(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${d}">`);
  if (image) {
    const i = escapeHtml(image);
    swap(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${i}">`);
    swap(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${i}">`);
  }
  return html;
}

const money = (value) => "$ " + Math.round(Number(value) || 0).toLocaleString("es-AR");

/** Vista previa de una ficha de producto: foto, nombre y precio del producto, con el nombre de la tienda. */
export function buildProductHtml(template, store, product, slug, productId) {
  const url = `${SITE}/t/${encodeURIComponent(slug)}/p/${encodeURIComponent(productId)}`;
  const title = clip(`${product.nombre} · ${store.nombre}`, 70);
  const description = clip(`${money(product.precio)} · ${product.descripcion || `Pedilo online en ${store.nombre}, con envío a domicilio o retiro en el local.`}`, 200);
  const photo = [product.imagen_url, ...(Array.isArray(product.imagenes) ? product.imagenes : []), store.imagen_url].find((u) => typeof u === "string" && /^https:\/\//i.test(u));
  const image = photo ? (photo.includes("images.unsplash.com") ? photo.replace(/([?&])w=\d+/, "$1w=1200") : photo) : null;
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url);
  let html = template;
  const swap = (pattern, replacement) => { html = html.replace(pattern, () => replacement); };
  swap(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  swap(/<meta name="description"[^>]*>/, `<meta name="description" content="${d}" />`);
  swap(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${u}" />`);
  swap(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${u}" />`);
  swap(/<meta property="og:type"[^>]*>/, '<meta property="og:type" content="product" />');
  swap(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${t}">`);
  swap(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${d}">`);
  swap(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${t}">`);
  swap(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${d}">`);
  if (image) {
    const i = escapeHtml(image);
    swap(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${i}">`);
    swap(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${i}">`);
  }
  return html;
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "woref.vercel.app";
  try {
    // La plantilla es el index.html publicado (archivo estático, no pasa por esta función).
    const page = await fetch(`https://${host}/index.html`);
    const template = await page.text();
    let html = template;
    if (/^[a-z0-9-]{1,80}$/.test(slug)) {
      const headers = { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` };
      const query = `${SUPABASE_URL}/rest/v1/delivery_comercios?slug=eq.${slug}&activo=eq.true&select=id,nombre,descripcion,imagen_url,logo_url,tienda_tema&limit=1`;
      const response = await fetch(query, { headers });
      const rows = response.ok ? await response.json() : [];
      const store = Array.isArray(rows) ? rows[0] : null;
      if (store) {
        const productId = String(req.query?.producto ?? "");
        if (/^[0-9a-f-]{36}$/i.test(productId)) {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/delivery_productos?id=eq.${productId}&comercio_id=eq.${store.id}&select=nombre,descripcion,imagen_url,imagenes,precio&limit=1`, { headers });
          const products = pr.ok ? await pr.json() : [];
          html = Array.isArray(products) && products[0] ? buildProductHtml(template, store, products[0], slug, productId) : buildHtml(template, store, slug);
        } else {
          html = buildHtml(template, store, slug);
        }
      }
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(html);
  } catch {
    // Ante cualquier falla, el rastreador recibe la app tal cual y no un error.
    res.setHeader("location", `/index.html`);
    res.status(302).end();
  }
}
