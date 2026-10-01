import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function Cart() {
  const { user } = useAuth();
  const { store, items, subtotal, updateQuantity, clearCart } = useCart();
  const [address, setAddress] = useState("Av. Corrientes 1234, CABA");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const checkout = async () => {
    if (!user || !store || !items.length || !address.trim()) return;
    setSubmitting(true);
    const total = subtotal + store.costo_envio;
    const { data: order, error } = await (supabase as any).from("delivery_pedidos").insert({ cliente_id: user.id, comercio_id: store.id, direccion_entrega: address.trim(), subtotal, costo_envio: store.costo_envio, total, metodo_pago: "efectivo", notas: notes.trim() || null, entrega_estimada: new Date(Date.now() + 40 * 60 * 1000).toISOString() }).select("id").single();
    if (error || !order) { toast.error("No pudimos crear el pedido"); setSubmitting(false); return; }
    const { error: itemError } = await (supabase as any).from("delivery_pedido_items").insert(items.map((item) => ({ pedido_id: order.id, producto_id: item.id, nombre: item.nombre, precio_unitario: item.precio, cantidad: item.cantidad })));
    if (itemError) { toast.error("El pedido quedó incompleto. Contactá soporte."); setSubmitting(false); return; }
    clearCart();
    toast.success("Pedido confirmado");
    navigate(`/lin/pedidos?pedido=${order.id}`);
  };

  if (!store || !items.length) return <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><ShoppingBag className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-extrabold">Tu carrito está vacío</h1><p className="mt-2 text-sm text-muted-foreground">Explorá comercios y agregá lo que quieras pedir.</p><Button asChild className="mt-6"><Link to="/lin">Ver comercios</Link></Button></div>;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-7 md:grid-cols-[1fr_360px] sm:px-6">
      <section><p className="text-xs font-bold uppercase text-primary">Tu pedido</p><h1 className="mt-1 text-3xl font-extrabold">{store.nombre}</h1><div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className="flex items-center gap-4 rounded-lg border bg-card p-3"><img src={item.imagen_url || "/placeholder.svg"} alt="" loading="lazy" width={80} height={80} className="h-20 w-20 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="font-bold">{item.nombre}</p><p className="mt-1 text-sm text-muted-foreground">{money.format(item.precio)}</p></div><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQuantity(item.id, item.cantidad - 1)}><Minus className="h-4 w-4" /></Button><span className="w-5 text-center font-bold">{item.cantidad}</span><Button size="icon" className="h-9 w-9" onClick={() => updateQuantity(item.id, item.cantidad + 1)}><Plus className="h-4 w-4" /></Button></div></article>)}</div></section>
      <aside className="h-fit rounded-lg border bg-card p-5 shadow-soft md:sticky md:top-24"><h2 className="text-xl font-extrabold">Entrega</h2><label className="mt-5 block text-sm font-bold">Dirección</label><Input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2" /><label className="mt-4 block text-sm font-bold">Notas para el comercio</label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sin cebolla, tocar timbre…" className="mt-2" /><div className="my-5 space-y-2 border-y py-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Productos</span><span>{money.format(subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span>{money.format(store.costo_envio)}</span></div><div className="flex justify-between pt-2 text-lg font-extrabold"><span>Total</span><span>{money.format(subtotal + store.costo_envio)}</span></div></div><Button className="w-full" size="lg" onClick={checkout} disabled={submitting || !address.trim()}>{submitting ? "Confirmando…" : "Confirmar pedido"}</Button><p className="mt-3 text-center text-xs text-muted-foreground">Pago en efectivo al recibir.</p></aside>
    </div>
  );
}