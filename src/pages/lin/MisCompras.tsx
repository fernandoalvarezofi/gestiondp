import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star, Download, MessageCircle, ExternalLink, ShoppingBag, ArrowLeft } from "lucide-react";
import { formatPrice, findMethodMeta } from "@/lib/marketplace";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { MarketplacePaymentIcon, MarketplaceProductIcon } from "@/components/lin/MarketplaceIcons";

const estadoColor = (e: string) => ({
  pendiente: "bg-amber-500/15 text-amber-700",
  pagada: "bg-emerald-500/15 text-emerald-700",
  entregada: "bg-blue-500/15 text-blue-700",
  cancelada: "bg-muted text-muted-foreground",
}[e] || "bg-muted");

export default function MisCompras() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comentario, setComentario] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("marketplace_ordenes")
      .select(`*, producto:marketplace_productos!producto_id(id,titulo,slug,portada_url), vendedor:perfiles!vendedor_id(nombre,username,avatar_url), review:marketplace_reviews!orden_id(id)`)
      .eq("comprador_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const descargar = async (orden: any) => {
    setDownloading(orden.id);
    const { data: archivos } = await (supabase as any)
      .from("marketplace_archivos")
      .select("*")
      .eq("producto_id", orden.producto?.id);
    if (!archivos || archivos.length === 0) {
      toast.info("El vendedor aún no subió la entrega. Contactalo por DM.");
      setDownloading(null);
      return;
    }
    for (const a of archivos) {
      if (a.contenido_externo) {
        window.open(a.contenido_externo, "_blank", "noopener");
      } else if (a.storage_path) {
        const { data } = await (supabase as any).storage.from("marketplace-archivos").createSignedUrl(a.storage_path, 3600);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
      }
    }
    setDownloading(null);
  };

  const submitReview = async () => {
    if (!reviewOpen || !user) return;
    const { error } = await (supabase as any).from("marketplace_reviews").insert({
      orden_id: reviewOpen.id,
      producto_id: reviewOpen.producto.id,
      comprador_id: user.id,
      vendedor_id: reviewOpen.vendedor_id,
      rating,
      comentario: comentario.trim() || null,
    });
    if (error) toast.error("Error al enviar reseña"); else { toast.success("¡Gracias por tu reseña!"); setReviewOpen(null); setRating(5); setComentario(""); load(); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/lin/mercado"><ArrowLeft className="h-4 w-4" /> Mercado</Link></Button>

      <h1 className="mt-4 text-2xl font-bold">Mis compras</h1>
      <p className="text-sm text-muted-foreground">Tus órdenes y descargas digitales.</p>

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Cargando…</p>
          : items.length === 0 ? (
            <Card><CardContent className="p-10 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-semibold">Aún no tenés compras</p>
              <Button asChild className="mt-3"><Link to="/lin/mercado">Explorar Mercado</Link></Button>
            </CardContent></Card>
          ) : items.map((o) => {
            const meta = findMethodMeta(o.metodo_pago);
            const canDownload = o.estado === "pagada" || o.estado === "entregada";
            const hasReview = Array.isArray(o.review) && o.review.length > 0;
            return (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {o.producto?.portada_url ? <img src={o.producto.portada_url} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center opacity-40"><MarketplaceProductIcon /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/lin/mercado/${o.producto?.slug}`} className="block truncate font-semibold hover:underline">{o.producto?.titulo}</Link>
                          <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "PPp", { locale: es })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatPrice(Number(o.monto), o.moneda)}</p>
                          <Badge className={estadoColor(o.estado)}>{o.estado}</Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Avatar className="h-6 w-6"><AvatarImage src={o.vendedor?.avatar_url} /><AvatarFallback>{(o.vendedor?.nombre || "U").slice(0, 1)}</AvatarFallback></Avatar>
                        <span className="font-medium">{o.vendedor?.nombre}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="inline-flex items-center gap-1"><MarketplacePaymentIcon method={o.metodo_pago} className="h-3.5 w-3.5" />{meta.label}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {canDownload && (
                          <Button size="sm" onClick={() => descargar(o)} disabled={downloading === o.id} className="gap-1.5">
                            <Download className="h-4 w-4" /> {downloading === o.id ? "Abriendo…" : "Descargar entrega"}
                          </Button>
                        )}
                        {o.estado === "pendiente" && o.payment_link && (
                          <Button size="sm" variant="outline" asChild className="gap-1.5">
                            <a href={o.payment_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Volver al pago</a>
                          </Button>
                        )}
                        {canDownload && !hasReview && (
                          <Button size="sm" variant="outline" onClick={() => setReviewOpen(o)} className="gap-1.5"><Star className="h-4 w-4" /> Dejar reseña</Button>
                        )}
                        <Button size="sm" variant="ghost" asChild className="gap-1.5">
                          <Link to={`/lin/mensajes?to=${o.vendedor_id}`}><MessageCircle className="h-4 w-4" /> Contactar vendedor</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Dialog open={!!reviewOpen} onOpenChange={(o) => !o && setReviewOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reseñar "{reviewOpen?.producto?.titulo}"</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Contale a otros compradores cómo te fue (opcional)" rows={4} />
            <Button onClick={submitReview} className="w-full">Publicar reseña</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
