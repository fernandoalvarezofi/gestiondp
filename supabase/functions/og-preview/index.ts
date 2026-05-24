import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WorefBot/1.0; +https://woref.com)" },
      redirect: "follow",
    }).catch(() => null);
    clearTimeout(timeout);

    if (!res || !res.ok) {
      return new Response(JSON.stringify({ url, error: "No se pudo cargar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = (await res.text()).slice(0, 200_000);
    const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
    const decode = (s?: string) =>
      s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    const title =
      decode(pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)) ||
      decode(pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)) ||
      decode(pick(/<title[^>]*>([^<]+)<\/title>/i));
    const description =
      decode(pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)) ||
      decode(pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i));
    let image =
      pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const siteName = decode(pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i));

    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, res.url).toString(); } catch { image = undefined; }
    }

    const u = new URL(res.url);
    return new Response(JSON.stringify({
      url: res.url, title, description, image, siteName, host: u.hostname.replace(/^www\./, ""),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
