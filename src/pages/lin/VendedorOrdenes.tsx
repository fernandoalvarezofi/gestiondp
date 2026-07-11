import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, MessageCircle, ExternalLink } from "lucide-react";
import { formatPrice, findMethodMeta } from "@/lib/marketplace";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MarketplacePaymentIcon, MarketplaceProductIcon } from "@/components/lin/MarketplaceIcons";

const ESTADOS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "pagada", label: "Pagadas" },
  { id: "entregada", label: "Entregadas" },
  { id: "cancelada", label: "Canceladas" },
];

const estadoColor = (e: string) => ({
  pendiente: "bg-amber-500/15 text-amber-700",
  pagada: "bg-emerald-500/15 text-emerald-700",
  entregada: "bg-blue-500/15 text-blue-700",
  cancelada: "bg-muted text-muted-foreground",
}[e] || "bg-muted");

export default function VendedorOrdenes() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("todas");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("marketplace_ordenes")
      .select(`*, producto:marketplace_productos!producto_id(titulo,slug,portada_url), comprador:perfiles!comprador_id(nombre,username,avatar_url)`)
      .eq("vendedor_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const updateEstado = async (id: string, estado: string) => {
    const { error } = await (supabase as any).from("marketplace_ordenes").update({ estado }).eq("id", id);
    if (error) toast.error("Error al actualizar"); else { toast.success("Orden actualizada"); load(); }
  };

  const filtered = filter === "todas" ? items : items.filter((o) => o.estado === filter);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/lin/vendedor/productos"><ArrowLeft className="h-4 w-4" /> Mis productos</Link></Button>

      <h1 className="mt-4 text-2xl font-bold">Órdenes recibidas</h1>
      <p className="text-sm text-muted-foreground">Confirmá los pagos para liberar la entrega al comprador.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Button key={e.id} size="sm" variant={filter === e.id ? "default" : "outline"} onClick={() => setFilter(e.id)}>
            {e.label} {filter !== e.id && <span className="ml-1 text-xs opacity-60">({items.filter((x) => e.id === "todas" || x.estado === e.id).length})</span>}
          </Button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Cargando…</p>
          : filtered.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sin órdenes en este estado.</CardContent></Card>
          ) : filtered.map((o) => {
            const meta = findMethodMeta(o.metodo_pago);
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
                        <Avatar className="h-6 w-6"><AvatarImage src={o.comprador?.avatar_url} /><AvatarFallback>{(o.comprador?.nombre || "U").slice(0, 1)}</AvatarFallback></Avatar>
                        <span className="font-medium">{o.comprador?.nombre}</span>
                        <span className="text-muted-foreground">@{o.comprador?.username}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="inline-flex items-center gap-1"><MarketplacePaymentIcon method={o.metodo_pago} className="h-3.5 w-3.5" />{meta.label}</span>
                      </div>

                      {o.comprador_nota && <p className="mt-2 rounded-md bg-secondary/50 p-2 text-xs">"{o.comprador_nota}"</p>}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {o.estado === "pendiente" && (
                          <>
                            <Button size="sm" onClick={() => updateEstado(o.id, "pagada")} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Confirmar pago</Button>
                            <Button size="sm" variant="outline" onClick={() => updateEstado(o.id, "cancelada")} className="gap-1.5"><XCircle className="h-4 w-4" /> Cancelar</Button>
                          </>
                        )}
                        {o.estado === "pagada" && (
                          <Button size="sm" onClick={() => updateEstado(o.id, "entregada")} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Marcar entregada</Button>
                        )}
                        <Button size="sm" variant="outline" asChild className="gap-1.5">
                          <Link to={`/lin/mensajes?to=${o.comprador_id}`}><MessageCircle className="h-4 w-4" /> Mensaje</Link>
                        </Button>
                        {o.payment_link && (
                          <Button size="sm" variant="ghost" asChild className="gap-1.5">
                            <a href={o.payment_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Link de pago</a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
