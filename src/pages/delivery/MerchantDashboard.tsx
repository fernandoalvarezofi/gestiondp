import { FormEvent, useEffect, useState } from "react";
import { Check, PackageOpen, Plus, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const states = ["pendiente", "confirmado", "preparando", "en_camino", "entregado", "cancelado"];
const labels: Record<string, string> = { pendiente: "Pendiente", confirmado: "Confirmado", preparando: "Preparando", en_camino: "En camino", entregado: "Entregado", cancelado: "Cancelado" };
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: owned } = await (supabase as any).from("delivery_comercios").select("*").eq("propietario_id", user.id).limit(1).maybeSingle();
    setStore(owned || null);
    if (!owned) return;
    const [{ data: catalog }, { data: received }] = await Promise.all([
      (supabase as any).from("delivery_productos").select("*").eq("comercio_id", owned.id).order("created_at", { ascending: false }),
      (supabase as any).from("delivery_pedidos").select("*, items:delivery_pedido_items(nombre,cantidad)").eq("comercio_id", owned.id).order("created_at", { ascending: false }),
    ]);
    setProducts(catalog || []);
    setOrders(received || []);
  };

  useEffect(() => { load(); }, [user]);

  const createStore = async () => {
    if (!user) return;
    const slug = `mi-comercio-${user.id.slice(0, 8)}`;
    const { error } = await (supabase as any).from("delivery_comercios").insert({ propietario_id: user.id, nombre: "Mi comercio", slug, categoria: "comida", descripcion: "Comercio listo para recibir pedidos.", direccion: "Buenos Aires", imagen_url: "/delivery/store.jpg" });
    if (error) return toast.error("No pudimos crear el comercio");
    toast.success("Comercio creado");
    load();
  };

  const addProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!store || !name.trim() || Number(price) <= 0) return;
    const { error } = await (supabase as any).from("delivery_productos").insert({ comercio_id: store.id, nombre: name.trim(), categoria: "Destacados", precio: Number(price), disponible: true });
    if (error) return toast.error("No pudimos agregar el producto");
    setName(""); setPrice(""); toast.success("Producto agregado"); load();
  };

  const updateStatus = async (id: string, estado: string) => {
    const { error } = await (supabase as any).from("delivery_pedidos").update({ estado }).eq("id", id);
    if (error) return toast.error("No pudimos actualizar el pedido");
    load();
  };

  if (!store) return <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-7 w-7" /></span><h1 className="mt-5 text-3xl font-extrabold">Abrí tu comercio</h1><p className="mt-2 text-sm text-muted-foreground">Creá el espacio de tu negocio, cargá productos y empezá a recibir pedidos.</p><Button className="mt-6" onClick={createStore}><Plus className="h-4 w-4" /> Crear mi comercio</Button></div>;

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-primary">Panel comercial</p><h1 className="mt-1 text-3xl font-extrabold">{store.nombre}</h1></div><span className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-bold text-success"><Check className="h-4 w-4" /> Recibiendo pedidos</span></div><div className="mt-7 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-lg border bg-card p-5"><h2 className="text-xl font-extrabold">Catálogo</h2><form onSubmit={addProduct} className="mt-4 grid grid-cols-[1fr_120px_auto] gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto" /><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="1" placeholder="Precio" /><Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button></form><div className="mt-5 space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between rounded-md bg-muted p-3"><span className="font-semibold">{product.nombre}</span><span className="font-bold">{money.format(product.precio)}</span></div>)}</div></section><section className="rounded-lg border bg-card p-5"><h2 className="text-xl font-extrabold">Pedidos recibidos</h2>{orders.length ? <div className="mt-4 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-md border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">Pedido #{order.id.slice(0, 6).toUpperCase()}</p><p className="mt-1 text-sm text-muted-foreground">{order.items?.map((item: any) => `${item.cantidad}× ${item.nombre}`).join(" · ")}</p></div><p className="font-extrabold">{money.format(order.total)}</p></div><div className="mt-4 flex flex-wrap gap-2">{states.map((state) => <Button key={state} size="sm" variant={order.estado === state ? "default" : "outline"} onClick={() => updateStatus(order.id, state)}>{labels[state]}</Button>)}</div></article>)}</div> : <div className="mt-8 text-center text-muted-foreground"><PackageOpen className="mx-auto h-8 w-8" /><p className="mt-2 text-sm">Todavía no recibiste pedidos.</p></div>}</section></div></div>;
}