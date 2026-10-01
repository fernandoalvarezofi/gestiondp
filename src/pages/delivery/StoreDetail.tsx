import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Bike, Clock3, Minus, Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryStore } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

type Product = { id: string; comercio_id: string; nombre: string; descripcion?: string | null; categoria: string; imagen_url?: string | null; precio: number; precio_anterior?: number | null; disponible: boolean };
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function StoreDetail() {
  const { slug } = useParams();
  const { items, addItem, updateQuantity } = useCart();
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      const { data: found } = await (supabase as any).from("delivery_comercios").select("*").eq("slug", slug).maybeSingle();
      if (!found) return;
      setStore(found);
      const { data } = await (supabase as any).from("delivery_productos").select("*").eq("comercio_id", found.id).order("destacado", { ascending: false });
      setProducts(data || []);
    })();
  }, [slug]);

  if (!store) return <div className="mx-auto max-w-6xl px-4 py-12"><div className="h-72 animate-pulse rounded-lg bg-muted" /></div>;
  const categories = [...new Set(products.map((product) => product.categoria))];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <div className="relative aspect-[16/7] min-h-[260px] overflow-hidden rounded-lg">
        <img src={store.imagen_url || "/placeholder.svg"} alt={store.nombre} width={1200} height={800} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground sm:p-9">
          <p className="text-xs font-bold uppercase">{store.categoria}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{store.nombre}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-semibold">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{store.rating}</span>
            <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{store.tiempo_min}-{store.tiempo_max} min</span>
            <span className="flex items-center gap-1"><Bike className="h-4 w-4" />{money.format(store.costo_envio)}</span>
          </div>
        </div>
      </div>
      <p className="mt-5 max-w-2xl text-muted-foreground">{store.descripcion}</p>

      {categories.map((category) => (
        <section key={category} className="pt-9">
          <h2 className="mb-4 text-2xl font-extrabold">{category}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {products.filter((product) => product.categoria === category).map((product) => {
              const cartItem = items.find((item) => item.id === product.id);
              return (
                <article key={product.id} className="grid grid-cols-[1fr_112px] gap-4 rounded-lg border bg-card p-4 shadow-soft">
                  <div className="min-w-0">
                    <h3 className="font-bold">{product.nombre}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.descripcion}</p>
                    <div className="mt-4 flex items-center gap-2"><span className="font-extrabold">{money.format(product.precio)}</span>{product.precio_anterior && <span className="text-xs text-muted-foreground line-through">{money.format(product.precio_anterior)}</span>}</div>
                  </div>
                  <div className="relative overflow-hidden rounded-md bg-muted">
                    <img src={product.imagen_url || store.imagen_url || "/placeholder.svg"} alt={product.nombre} loading="lazy" width={240} height={180} className="h-full w-full object-cover" />
                    {cartItem ? (
                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-md bg-card p-1 shadow-pop">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQuantity(product.id, cartItem.cantidad - 1)}><Minus className="h-4 w-4" /></Button>
                        <span className="text-sm font-bold">{cartItem.cantidad}</span>
                        <Button size="icon" className="h-8 w-8" onClick={() => addItem(product, { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio })}><Plus className="h-4 w-4" /></Button>
                      </div>
                    ) : <Button size="icon" className="absolute bottom-2 right-2 h-9 w-9 shadow-pop" onClick={() => { addItem(product, { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio }); toast.success("Agregado al carrito"); }}><Plus className="h-4 w-4" /></Button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}