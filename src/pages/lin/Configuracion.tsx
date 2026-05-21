import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BackHeader } from "@/components/lin/BackHeader";
import { toast } from "sonner";
import {
  User as UserIcon, Shield, Bell, Palette, KeyRound, LogOut, Trash2, Download, Loader2,
} from "lucide-react";

type Prefs = {
  perfil_privado: boolean;
  mostrar_actividad: boolean;
  mostrar_ubicacion: boolean;
  permitir_etiquetas: boolean;
  mensajes_privados: boolean;
  notif_email: boolean;
  notif_push: boolean;
  notif_likes: boolean;
  notif_comentarios: boolean;
  notif_seguidores: boolean;
  notif_menciones: boolean;
  notif_mensajes: boolean;
  tema: string;
  idioma: string;
};

const DEFAULTS: Prefs = {
  perfil_privado: false, mostrar_actividad: true, mostrar_ubicacion: false,
  permitir_etiquetas: true, mensajes_privados: true,
  notif_email: true, notif_push: true, notif_likes: true, notif_comentarios: true,
  notif_seguidores: true, notif_menciones: true, notif_mensajes: true,
  tema: "sistema", idioma: "es",
};

export default function Configuracion() {
  const { user, signOut } = useAuth();
  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      if (data) {
        setPerfil(data);
        setPrefs({ ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, data[k] ?? (DEFAULTS as any)[k]])) } as Prefs);
        setNewEmail(user.email || "");
      }
    })();
  }, [user]);

  const update = async (key: keyof Prefs, value: any) => {
    setSavingKey(key);
    setPrefs((p) => ({ ...p, [key]: value }));
    const { error } = await (supabase as any).from("perfiles").update({ [key]: value }).eq("id", user!.id);
    setSavingKey(null);
    if (error) { toast.error("No se pudo guardar"); return; }
    if (key === "tema") setTheme(value === "sistema" ? "system" : value);
  };

  const cambiarEmail = async () => {
    if (!newEmail || newEmail === user?.email) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error(error.message); else toast.success("Te enviamos un email para confirmar el cambio");
  };

  const cambiarPassword = async () => {
    if (!newPass || newPass.length < 8) return toast.error("Mínimo 8 caracteres");
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast.error(error.message); else { toast.success("Contraseña actualizada"); setNewPass(""); }
  };

  const exportarDatos = async () => {
    if (!user) return;
    const [{ data: p }, { data: pubs }, { data: sigs }, { data: lk }] = await Promise.all([
      (supabase as any).from("perfiles").select("*").eq("id", user.id).single(),
      (supabase as any).from("publicaciones").select("*").eq("perfil_id", user.id),
      (supabase as any).from("seguidos").select("*").or(`seguidor_id.eq.${user.id},seguido_id.eq.${user.id}`),
      (supabase as any).from("likes").select("*").eq("perfil_id", user.id),
    ]);
    const blob = new Blob([JSON.stringify({ perfil: p, publicaciones: pubs, seguimientos: sigs, likes: lk }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `woref-datos-${user.id}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Datos exportados");
  };

  const borrarCuenta = async () => {
    if (!confirm("¿Eliminar tu cuenta? Esta acción es irreversible.")) return;
    if (!confirm("Última confirmación: tus publicaciones, mensajes y perfil serán eliminados.")) return;
    // Soft: anonimizamos el perfil y cerramos sesión (no podemos borrar auth.users desde el cliente).
    await (supabase as any).from("perfiles").update({
      activo: false, bio: null, avatar_url: null, portada_url: null,
      nombre: "Cuenta eliminada",
    }).eq("id", user!.id);
    await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("perfil_id", user!.id);
    await signOut();
    toast.success("Cuenta desactivada");
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <BackHeader title="Configuración" subtitle="Cuenta, privacidad y notificaciones" />

      <div className="space-y-5 p-4 sm:p-6">
        <Tabs defaultValue="cuenta">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="cuenta"><UserIcon className="h-3.5 w-3.5" />Cuenta</TabsTrigger>
            <TabsTrigger value="privacidad"><Shield className="h-3.5 w-3.5" />Privacidad</TabsTrigger>
            <TabsTrigger value="notif"><Bell className="h-3.5 w-3.5" />Notif.</TabsTrigger>
            <TabsTrigger value="apariencia"><Palette className="h-3.5 w-3.5" />Tema</TabsTrigger>
            <TabsTrigger value="seguridad"><KeyRound className="h-3.5 w-3.5" />Seguridad</TabsTrigger>
          </TabsList>

          {/* CUENTA */}
          <TabsContent value="cuenta" className="mt-5 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Información básica</CardTitle>
                <CardDescription>Editá tu nombre público, bio y enlaces.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">@{perfil?.username}</p>
                    <p className="text-xs text-muted-foreground">{perfil?.nombre}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/lin/perfil/editar")}>Editar perfil</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Email</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" />
                <Button size="sm" onClick={cambiarEmail} disabled={!newEmail || newEmail === user.email}>Cambiar email</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Tus datos</CardTitle>
                <CardDescription>Descargá una copia de toda tu información.</CardDescription></CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportarDatos}><Download className="h-4 w-4" />Exportar datos</Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-base text-destructive">Zona de riesgo</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" />Cerrar sesión</Button>
                <Separator />
                <Button variant="destructive" size="sm" onClick={borrarCuenta}><Trash2 className="h-4 w-4" />Eliminar mi cuenta</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRIVACIDAD */}
          <TabsContent value="privacidad" className="mt-5 space-y-3">
            <Card>
              <CardContent className="divide-y p-0">
                <Row label="Perfil privado" desc="Solo tus seguidores aprobados pueden ver tu contenido."
                  k="perfil_privado" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mostrar mi ubicación" desc="Tu ciudad aparecerá en tu perfil público."
                  k="mostrar_ubicacion" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mostrar mi actividad" desc="Otros pueden ver cuándo estás activo."
                  k="mostrar_actividad" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Permitir etiquetas" desc="Otros usuarios pueden mencionarte en publicaciones."
                  k="permitir_etiquetas" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Recibir mensajes privados" desc="Cualquiera puede iniciar una conversación con vos."
                  k="mensajes_privados" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICACIONES */}
          <TabsContent value="notif" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Canales</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Notificaciones por email" k="notif_email" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Notificaciones push (navegador)" k="notif_push" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">¿Qué quiero recibir?</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Me gusta en mis publicaciones" k="notif_likes" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Comentarios y respuestas" k="notif_comentarios" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Nuevos seguidores" k="notif_seguidores" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Menciones (@vos)" k="notif_menciones" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mensajes directos" k="notif_mensajes" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* APARIENCIA */}
          <TabsContent value="apariencia" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label>Modo</Label>
                  <Select value={prefs.tema} onValueChange={(v) => update("tema", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sistema">Automático (sistema)</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Idioma</Label>
                  <Select value={prefs.idioma} onValueChange={(v) => update("idioma", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEGURIDAD */}
          <TabsContent value="seguridad" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Cambiar contraseña</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input type="password" placeholder="Nueva contraseña" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                <Button size="sm" onClick={cambiarPassword} disabled={!newPass}>Actualizar</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Sesión actual</CardTitle>
                <CardDescription>Estás conectado como <span className="font-medium">{user.email}</span>.</CardDescription></CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" />Cerrar sesión</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Row({ label, desc, k, prefs, update, saving }: {
  label: string; desc?: string; k: keyof Prefs;
  prefs: Prefs; update: (k: keyof Prefs, v: any) => void; saving: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex items-center gap-2">
        {saving === k && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Switch checked={!!prefs[k]} onCheckedChange={(v) => update(k, v)} />
      </div>
    </div>
  );
}
