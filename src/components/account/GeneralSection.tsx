import { FormEvent, useEffect, useState } from "react";
import { fetchMyProfile } from "@/services/profile";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/authErrors";
import { db, errorMessage } from "@/lib/delivery";

const PHONE = /^[0-9+()\s-]{8,25}$/;

/** Datos personales: foto, nombre, teléfono y email de la cuenta. */
export function GeneralSection({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saved, setSaved] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchMyProfile().then((data) => {
      setName(data?.nombre ?? ""); setPhone(data?.telefono ?? ""); setAvatar(data?.avatar_url ?? "");
      setSaved({ name: data?.nombre ?? "", phone: data?.telefono ?? "" });
      setLoaded(true);
    });
  }, [user]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Ingresá tu nombre");
    if (phone.trim() && !PHONE.test(phone.trim())) return toast.error("Revisá el teléfono: solo números, espacios, + ( ) -");
    setSaving(true);
    const { error } = await db.from("perfiles").update({ nombre: name.trim(), telefono: phone.trim() || null }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Datos actualizados");
    setSaved({ name: name.trim(), phone: phone.trim() });
    onSaved();
  };

  const saveAvatar = async (url: string) => {
    if (!user) return;
    setAvatar(url);
    const { error } = await db.from("perfiles").update({ avatar_url: url || null }).eq("id", user.id);
    if (error) toast.error(errorMessage(error)); else { toast.success("Foto actualizada"); onSaved(); }
  };

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault();
    const next = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return toast.error("Ingresá un email válido");
    if (next === user?.email?.toLowerCase()) return toast.error("Ese ya es tu email");
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setChangingEmail(false);
    if (error) return toast.error(authErrorMessage(error.message));
    toast.success("Listo. Si te pedimos confirmar, revisá la bandeja del nuevo email.");
    setEmail("");
  };

  if (!loaded) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <ImageUpload label="Foto de perfil" folder="perfiles" shape="round" value={avatar} onChange={saveAvatar} />
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="acc-name">Nombre y apellido</Label><Input id="acc-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} autoComplete="name" /></div>
        <div className="space-y-1.5"><Label htmlFor="acc-phone">Teléfono</Label><Input id="acc-phone" type="tel" inputMode="tel" value={phone} maxLength={25} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="2355 40-0000" /><p className="text-xs text-muted-foreground">Lo usan los repartidores y comercios para contactarte por tu pedido.</p></div>
        <Button type="submit" className="rounded-full sm:w-fit" disabled={saving || (name.trim() === saved.name && phone.trim() === saved.phone)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</Button>
      </form>
      <section className="border-t pt-6">
        <h3 className="flex items-center gap-2 font-extrabold"><Mail className="h-5 w-5 text-primary" />Email de la cuenta</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tu email actual es <span className="font-bold text-foreground">{user?.email}</span>. Lo usás para ingresar y recuperar tu contraseña.</p>
        <form onSubmit={changeEmail} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Nuevo email" maxLength={200} autoComplete="email" aria-label="Nuevo email" />
          <Button type="submit" variant="outline" className="rounded-full" disabled={changingEmail || !email.trim()}>{changingEmail && <Loader2 className="h-4 w-4 animate-spin" />}Cambiar email</Button>
        </form>
      </section>
    </div>
  );
}
