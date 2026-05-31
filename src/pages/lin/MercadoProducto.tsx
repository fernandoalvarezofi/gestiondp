import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ArrowLeft, Heart, ShieldCheck, Zap, ChevronRight, MessageCircle, Store, ExternalLink } from "lucide-react";
import { formatPrice, findMethodMeta, PRODUCT_TYPES, type PayoutMethod } from "@/lib/marketplace";
import { toast } from "sonner";

export default function MercadoProducto() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [vendedor, setVendedor] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      setLoading(true);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug || "");
      const baseSelect = `*, vendedor:perfiles!vendedor_id(id,nombre,username,avatar_url,verificado,bio), categoria:marketplace_categorias!categoria_id(nombre,slug,color)`;
      const q1 = (supabase as any).from("marketplace_productos").select(baseSelect);
      let { data: prod } = isUUID
        ? await q1.eq("id", slug).maybeSingle()
        : await q1.eq("slug", slug).maybeSingle();
      if (!prod && !isUUID) {
        const q2 = (supabase as any).from("marketplace_productos").select(baseSelect);
        const fb = await q2.eq("id", slug).maybeSingle();
        prod = fb.data;
      }
      if (!active) return;
      if (!prod) { setLoading(false); toast.error("Producto no encontrado"); navigate("/lin/mercado"); return; }
      setP(prod);
      const [{ data: vp }, { data: rv }] = await Promise.all([
        (supabase as any).from("vendedor_perfiles").select("*").eq("id", prod.vendedor_id).maybeSingle(),
        (supabase as any).from("marketplace_reviews").select(`*, comprador:perfiles!comprador_id(nombre,username,avatar_url)`).eq("producto_id", prod.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!active) return;
      setVendedor(vp);
      setReviews(rv || []);
      setLoading(false);
      (supabase as any).rpc("incrementar_vistas", { p_publicacion_id: prod.id }).then(() => {}, () => {});
      if (user) {
        const { data: f } = await (supabase as any).from("marketplace_favoritos").select("id").eq("producto_id", prod.id).eq("perfil_id", user.id).maybeSingle();
        if (active) setFav(!!f);
      }
    })();
    return () => { active = false; };
  }, [slug, user]);

  const toggleFav = async () => {
    if (!user || !p) { navigate("/auth"); return; }
    if (fav) {
      await (supabase as any).from("marketplace_favoritos").delete().eq("producto_id", p.id).eq("perfil_id", user.id);
      setFav(false);
    } else {
      await (supabase as any).from("marketplace_favoritos").insert({ producto_id: p.id, perfil_id: user.id });
      setFav(true);
    }
  };

  const handleBuy = async (method: PayoutMethod) => {
    if (!user || !p) { navigate("/auth"); return; }
    if (user.id === p.vendedor_id) { toast.error("No podés comprar tu propio producto"); return; }
    const { data: orden, error } = await (supabase as any).from("marketplace_ordenes").insert({
      comprador_id: user.id,
      vendedor_id: p.vendedor_id,
      producto_id: p.id,
      monto: p.precio,
      moneda: p.moneda,
      metodo_pago: method.id,
      payment_link: method.link,
      comprador_nota: nota || null,
      estado: method.id === "coordinar" ? "pendiente" : "pendiente",
    }).select().single();
    if (error) { toast.error("No se pudo crear la orden"); return; }
    toast.success("Orden creada. Completá el pago y el vendedor confirmará.");
    setCheckoutOpen(false);
    if (method.id === "coordinar") {
      navigate(`/lin/mensajes?to=${p.vendedor_id}`);
    } else if (method.link) {
      window.open(method.link, "_blank", "noopener");
      setTimeout(() => navigate("/lin/mis-compras"), 800);
    } else {
      navigate("/lin/mis-compras");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg font-semibold">Producto no encontrado</p>
        <Button asChild className="mt-4"><Link to="/lin/mercado">Volver al mercado</Link></Button>
      </div>
    );
  }

  const galleryAll: string[] = [p.portada_url, ...(Array.isArray(p.galeria) ? p.galeria : [])].filter(Boolean);
  const cover = galleryAll[galleryIdx] || p.portada_url;
  const payoutMethods: PayoutMethod[] = Array.isArray(vendedor?.payout_methods) ? vendedor.payout_methods : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/lin/mercado"><ArrowLeft className="h-4 w-4" /> Volver al mercado</Link></Button>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* MEDIA + INFO */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-secondary/30">
            <div className="aspect-video">
              {cover ? (
                <img src={cover} alt={p.titulo} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-7xl opacity-30">
                  {PRODUCT_TYPES.find((t) => t.id === p.tipo)?.icon ?? "📦"}
                </div>
              )}
            </div>
            {galleryAll.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {galleryAll.map((g, i) => (
                  <button key={i} onClick={() => setGalleryIdx(i)} className={`shrink-0 overflow-hidden rounded-md border-2 ${i === galleryIdx ? "border-primary" : "border-transparent"}`}>
                    <img src={g} className="h-16 w-24 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {p.categoria && <Badge style={{ background: p.categoria.color, color: "white" }}>{p.categoria.nombre}</Badge>}
              <Badge variant="outline" className="gap-1">
                {PRODUCT_TYPES.find((t) => t.id === p.tipo)?.icon} {PRODUCT_TYPES.find((t) => t.id === p.tipo)?.label}
              </Badge>
              {p.destacado && <Badge className="gap-1 bg-amber-500"><Star className="h-3 w-3 fill-current" /> Destacado</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{p.titulo}</h1>
            {p.resumen && <p className="mt-2 text-muted-foreground">{p.resumen}</p>}

            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              {p.total_reviews > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">{Number(p.rating_promedio).toFixed(1)}</span>
                  <span>· {p.total_reviews} reseñas</span>
                </div>
              )}
              <span>•</span>
              <span>{p.total_ventas} ventas</span>
              <span>•</span>
              <span>{p.total_vistas} vistas</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="mb-3 font-semibold">Descripción</h2>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{p.descripcion}</div>
              {p.demo_url && (
                <Button asChild variant="outline" className="mt-4 gap-1.5">
                  <a href={p.demo_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Ver demo</a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* REVIEWS */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 font-semibold">Reseñas ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin reseñas todavía. Sé el primero después de comprar.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarImage src={r.comprador?.avatar_url} /><AvatarFallback>{(r.comprador?.nombre || "U").slice(0, 1)}</AvatarFallback></Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{r.comprador?.nombre}</p>
                          <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />)}</div>
                        </div>
                      </div>
                      {r.comentario && <p className="mt-2 text-sm">{r.comentario}</p>}
                      {r.respuesta_vendedor && (
                        <div className="mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
                          <p className="text-xs font-semibold text-muted-foreground">Respuesta del vendedor</p>
                          <p className="mt-1">{r.respuesta_vendedor}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR — precio + vendedor */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-primary">{formatPrice(Number(p.precio), p.moneda)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Pago directo al vendedor · sin comisión</p>

              <Button onClick={() => setCheckoutOpen(true)} size="lg" className="mt-4 w-full gap-1.5" disabled={payoutMethods.length === 0}>
                <Zap className="h-4 w-4" /> {payoutMethods.length === 0 ? "Vendedor sin métodos de pago" : "Comprar ahora"}
              </Button>
              <Button onClick={toggleFav} variant="outline" className="mt-2 w-full gap-1.5">
                <Heart className={`h-4 w-4 ${fav ? "fill-red-500 text-red-500" : ""}`} /> {fav ? "Guardado" : "Guardar"}
              </Button>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>Entrega digital protegida tras confirmación de pago</span></div>
                <div className="flex items-start gap-2"><Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span>Acceso inmediato a la descarga o link de entrega</span></div>
                <div className="flex items-start gap-2"><Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Soporte directo del creador por DM</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Vendedor */}
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendedor</p>
              <Link to={`/lin/perfil/${p.vendedor?.username}`} className="flex items-center gap-3 group">
                <Avatar className="h-12 w-12"><AvatarImage src={p.vendedor?.avatar_url} /><AvatarFallback>{(p.vendedor?.nombre || "U").slice(0, 1)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-primary">{p.vendedor?.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.vendedor?.username}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              {vendedor && (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="font-bold">{vendedor.total_productos}</p><p className="text-muted-foreground">Productos</p></div>
                  <div><p className="font-bold">{vendedor.total_ventas}</p><p className="text-muted-foreground">Ventas</p></div>
                  <div><p className="font-bold">{Number(vendedor.rating_promedio).toFixed(1)}★</p><p className="text-muted-foreground">Rating</p></div>
                </div>
              )}
              {vendedor?.bio_comercial && <p className="mt-3 text-sm text-muted-foreground">{vendedor.bio_comercial}</p>}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5">
                <Link to={`/lin/mensajes?to=${p.vendedor_id}`}><MessageCircle className="h-4 w-4" /> Mensaje al vendedor</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CHECKOUT SHEET */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Completar compra</SheetTitle>
            <SheetDescription>{p.titulo} · <span className="font-bold text-primary">{formatPrice(Number(p.precio), p.moneda)}</span></SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Elegí cómo pagar</p>
              <p className="mb-3 text-xs text-muted-foreground">Cada vendedor configura sus propios métodos. Al elegir uno, abre el link de pago y se crea tu orden.</p>
              <div className="space-y-2">
                {payoutMethods.map((m, i) => {
                  const meta = findMethodMeta(m.id);
                  return (
                    <button
                      key={i}
                      onClick={() => handleBuy(m)}
                      className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xl">{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{m.label || meta.label}</p>
                        {m.link && <p className="truncate text-xs text-muted-foreground">{m.link}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Nota para el vendedor (opcional)</p>
              <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Necesito factura, tengo dudas, etc." rows={3} />
            </div>

            <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldCheck className="mb-1 inline h-3.5 w-3.5" /> El vendedor confirmará tu pago manualmente. Luego vas a poder descargar el producto desde <b>Mis compras</b>.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
