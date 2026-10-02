import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { BellRing, Bike, ChevronRight, Heart, HelpCircle, KeyRound, LogOut, MapPin, Moon, Receipt, ShieldCheck, Store, Ticket, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { AddressForm, AddressList, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { PageHeader } from "@/components/delivery/Common";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/authErrors";
import { db, errorMessage } from "@/lib/delivery";

const faqs = [
  { q: "¿Cuánto tarda mi pedido?", a: "Cada comercio muestra su tiempo estimado. Cuando confirmás, ves la hora de llegada y el estado en tiempo real desde Mis pedidos." },
  { q: "¿Puedo cancelar un pedido?", a: "Sí, mientras el comercio no lo haya aceptado. Entrá al pedido y tocá “Cancelar pedido”. Si ya lo aceptaron, escribinos y lo resolvemos." },
  { q: "¿Para qué sirve el código de entrega?", a: "Es un código de 4 números que le das al repartidor cuando recibís el pedido. Así confirmamos que llegó a la persona correcta." },
  { q: "¿Cómo uso un cupón?", a: "Copiá el código desde Cupones y promociones y pegalo en el carrito antes de confirmar. El descuento se aplica automáticamente." },
  { q: "¿Cómo sumo mi comercio?", a: "Desde Perfil → Mi comercio podés crear tu tienda, cargar productos y empezar a recibir pedidos en minutos." },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const roles = useDeliveryRoles();
  const { theme, setTheme } = useTheme();
  const push = usePushNotifications();
  const togglePush = async (checked: boolean) => {
    if (!checked) { await push.disable(); toast.success("Notificaciones desactivadas en este dispositivo"); return; }
    const result = await push.enable();
    if (result.ok) toast.success(result.message); else toast.error(result.message);
  };
  const { addresses, reload } = useSavedAddresses();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { setName(roles.nombre); }, [roles.nombre]);
  useEffect(() => {
    if (!user) return;
    db.from("perfiles").select("telefono").eq("id", user.id).maybeSingle().then(({ data }: { data: { telefono: string | null } | null }) => {
      setPhone(data?.telefono || "");
      setSavedPhone(data?.telefono || "");
    });
  }, [user]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    if (phone.trim() && phone.replace(/\D/g, "").length < 8) return toast.error("Revisá el teléfono: parece incompleto");
    setSavingName(true);
    const { error } = await db.from("perfiles").update({ nombre: name.trim(), telefono: phone.trim() || null }).eq("id", user.id);
    setSavingName(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Datos actualizados");
    setSavedPhone(phone.trim());
    roles.refresh();
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("La contraseña tiene que tener al menos 8 caracteres");
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) return toast.error(authErrorMessage(error.message));
    setNewPassword("");
    toast.success("Contraseña actualizada");
  };

  const links = [
    { to: "/app/pedidos", label: "Mis pedidos", icon: Receipt },
    { to: "/app/favoritos", label: "Favoritos", icon: Heart },
    { to: "/app/promociones", label: "Cupones y promociones", icon: Ticket },
    { to: "/app/comercio", label: roles.storeId ? "Panel de mi comercio" : "Sumá tu comercio", icon: Store, hint: roles.storeId ? undefined : "Vendé con Woref" },
    { to: "/app/repartidor", label: roles.isCourier ? "Panel de repartidor" : "Quiero ser repartidor", icon: Bike, hint: roles.isCourier ? undefined : "Generá ingresos extra" },
    ...(roles.isAdmin ? [{ to: "/app/admin", label: "Administración", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Mi cuenta" title={roles.nombre || "Perfil"} subtitle={user?.email} />

      <section className="mt-6 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><UserCircle className="h-5 w-5 text-primary" />Datos personales</h2>
        <form onSubmit={saveName} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Tu nombre" aria-label="Nombre" />
          <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} placeholder="Teléfono" aria-label="Teléfono" />
          <Button type="submit" variant="outline" disabled={savingName || (name.trim() === roles.nombre && phone.trim() === savedPhone)}>Guardar</Button>
        </form>
        <form onSubmit={changePassword} className="mt-4 flex gap-2 border-t pt-4">
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} placeholder="Contraseña nueva" aria-label="Contraseña nueva" />
          <Button type="submit" variant="outline" disabled={savingPassword || !newPassword}><KeyRound className="h-4 w-4" />Cambiar</Button>
        </form>
      </section>

      <section className="mt-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><MapPin className="h-5 w-5 text-primary" />Mis direcciones</h2>
        <div className="mt-3">
          {addresses.length > 0 && <AddressList addresses={addresses} onDeleted={reload} />}
          {addingAddress || addresses.length === 0 ? (
            <div className="mt-3"><AddressForm onSaved={() => { setAddingAddress(false); reload(); }} /></div>
          ) : (
            <Button variant="outline" className="mt-3 rounded-full" onClick={() => setAddingAddress(true)}>Agregar dirección</Button>
          )}
        </div>
      </section>

      <nav className="mt-4 divide-y overflow-hidden rounded-3xl border bg-card">
        {links.map(({ to, label, icon: Icon, hint }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-muted/60">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block font-bold">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
        <label className="flex cursor-pointer items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Moon className="h-5 w-5" /></span>
          <span className="flex-1 font-bold">Modo oscuro</span>
          <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
        </label>
        <label className="flex cursor-pointer items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><BellRing className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block font-bold">Notificaciones en este dispositivo</span>
            <span className="block text-xs text-muted-foreground">
              {push.state === "denied" ? "Bloqueadas en el navegador: habilitalas desde el candado de la barra de direcciones" :
                push.state === "unsupported" ? "Este navegador no permite notificaciones" :
                push.state === "ios-install" ? "En iPhone, agregá Woref a la pantalla de inicio para activarlas" : "Estado de tus pedidos y avisos de tus paneles"}
            </span>
          </span>
          <Switch checked={push.state === "on"} disabled={!["on", "off"].includes(push.state)} onCheckedChange={togglePush} />
        </label>
      </nav>

      <section className="mt-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><HelpCircle className="h-5 w-5 text-primary" />Ayuda</h2>
        <Accordion type="single" collapsible className="mt-1">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left font-bold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Button variant="outline" className="mt-6 w-full rounded-full text-destructive" onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</Button>
      <p className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground"><Link to="/terminos" className="hover:text-foreground">Términos y condiciones</Link><Link to="/privacidad" className="hover:text-foreground">Política de privacidad</Link></p>
    </div>
  );
}
