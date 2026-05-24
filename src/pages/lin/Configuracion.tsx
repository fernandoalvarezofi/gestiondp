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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BackHeader } from "@/components/lin/BackHeader";
import { initials } from "@/lib/worefHelpers";
import { toast } from "sonner";
import {
  User as UserIcon, Shield, Bell, Palette, KeyRound, LogOut, Trash2, Download, Loader2,
  Eye, VolumeX, Ban, Film, Globe, ShieldCheck, X, Plus, Smartphone, Mail,
} from "lucide-react";
import { useConfirm } from "@/components/lin/ConfirmDialog";


type Prefs = Record<string, any>;

const DEFAULTS: Prefs = {
  perfil_privado: false, mostrar_actividad: true, mostrar_ubicacion: false,
  permitir_etiquetas: true, mensajes_privados: true,
  notif_email: true, notif_push: true, notif_likes: true, notif_comentarios: true,
  notif_seguidores: true, notif_menciones: true, notif_mensajes: true,
  notif_sonido: true, notif_resumen_semanal: true,
  autoplay_videos: true, data_saver: false, sensible_blur: true,
  tema: "sistema", idioma: "es", idioma_contenido: "es",
  palabras_filtradas: [] as string[],
};

const TABS = [
  { v: "cuenta", icon: UserIcon, label: "Cuenta" },
  { v: "privacidad", icon: Shield, label: "Privacidad" },
  { v: "notif", icon: Bell, label: "Notificaciones" },
  { v: "contenido", icon: Film, label: "Contenido" },
  { v: "bloqueos", icon: Ban, label: "Bloqueos" },
  { v: "apariencia", icon: Palette, label: "Apariencia" },
  { v: "seguridad", icon: KeyRound, label: "Seguridad" },
];

export default function Configuracion() {
  const { user, signOut } = useAuth();
  const confirm = useConfirm();

  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [palabra, setPalabra] = useState("");
  const [bloqueados, setBloqueados] = useState<any[]>([]);
  const [silenciados, setSilenciados] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      if (data) {
        setPerfil(data);
        setPrefs({ ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, data[k] ?? (DEFAULTS as any)[k]])) });
        setNewEmail(user.email || "");
      }
      const [{ data: b }, { data: s }] = await Promise.all([
        (supabase as any).from("bloqueos").select("id, bloqueado:perfiles!bloqueado_id(id,nombre,username,avatar_url)").eq("perfil_id", user.id),
        (supabase as any).from("silenciados").select("id, silenciado:perfiles!silenciado_id(id,nombre,username,avatar_url)").eq("perfil_id", user.id),
      ]);
      setBloqueados(b || []); setSilenciados(s || []);
    })();
  }, [user]);

  const update = async (key: string, value: any) => {
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
    URL.revokeObjectURL(url); toast.success("Datos exportados");
  };

  const borrarCuenta = async () => {
    const ok1 = await confirm({ title: "¿Eliminar tu cuenta?", description: "Esta acción es irreversible. Tus publicaciones, mensajes y perfil serán eliminados.", confirmText: "Continuar", destructive: true });
    if (!ok1) return;
    const ok2 = await confirm({ title: "Última confirmación", description: "Esta es tu última oportunidad para cancelar. ¿Estás seguro?", confirmText: "Eliminar definitivamente", destructive: true });
    if (!ok2) return;
    await (supabase as any).from("perfiles").update({
      activo: false, bio: null, avatar_url: null, portada_url: null, nombre: "Cuenta eliminada",
    }).eq("id", user!.id);
    await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("perfil_id", user!.id);
    await signOut(); toast.success("Cuenta desactivada"); navigate("/");
  };


  const addPalabra = async () => {
    const w = palabra.trim().toLowerCase();
    if (!w || (prefs.palabras_filtradas as string[]).includes(w)) return;
    const nuevas = [...(prefs.palabras_filtradas as string[]), w];
    setPalabra(""); await update("palabras_filtradas", nuevas);
  };
  const quitarPalabra = async (w: string) => {
    const nuevas = (prefs.palabras_filtradas as string[]).filter((x) => x !== w);
    await update("palabras_filtradas", nuevas);
  };

  const desbloquear = async (id: string) => {
    await (supabase as any).from("bloqueos").delete().eq("id", id);
    setBloqueados((s) => s.filter((b) => b.id !== id));
    toast.success("Usuario desbloqueado");
  };
  const desactivarSilencio = async (id: string) => {
    await (supabase as any).from("silenciados").delete().eq("id", id);
    setSilenciados((s) => s.filter((b) => b.id !== id));
    toast.success("Ya no está silenciado");
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <BackHeader title="Configuración" subtitle="Personalizá tu experiencia en Woref" />
      <div className="space-y-5 p-4 sm:p-6">
        <Tabs defaultValue="cuenta">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
            {TABS.map(({ v, icon: I, label }) => (
              <TabsTrigger key={v} value={v} className="gap-1.5 text-xs"><I className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></TabsTrigger>
            ))}
          </TabsList>

          {/* CUENTA */}
          <TabsContent value="cuenta" className="mt-5 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Información básica</CardTitle>
                <CardDescription>Tu identidad pública en la plataforma.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12"><AvatarImage src={perfil?.avatar_url || ""} /><AvatarFallback>{initials(perfil?.nombre)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{perfil?.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">@{perfil?.username}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/lin/perfil/editar")}>Editar perfil</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Email</CardTitle>
                <CardDescription>Usado para iniciar sesión y notificaciones.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" /></div>
                <Button size="sm" onClick={cambiarEmail} disabled={!newEmail || newEmail === user.email}>Cambiar email</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Tus datos</CardTitle>
                <CardDescription>Descargá una copia completa de tu información (perfil, posts, seguimientos, likes).</CardDescription></CardHeader>
              <CardContent><Button variant="outline" size="sm" onClick={exportarDatos}><Download className="h-4 w-4" />Exportar datos en JSON</Button></CardContent>
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
              <CardHeader><CardTitle className="text-base">Visibilidad del perfil</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Perfil privado" desc="Solo tus seguidores aprobados pueden ver tu contenido."
                  k="perfil_privado" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mostrar mi ubicación" desc="Tu ciudad aparecerá en tu perfil público."
                  k="mostrar_ubicacion" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mostrar estado de actividad" desc="Otros pueden ver cuándo estás conectado."
                  k="mostrar_actividad" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Interacciones</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Permitir que me etiqueten" desc="Otros pueden mencionarte en publicaciones y comentarios."
                  k="permitir_etiquetas" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Recibir mensajes de cualquiera" desc="Si lo desactivás, solo te escriben quienes seguís."
                  k="mensajes_privados" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Filtros de palabras</CardTitle>
                <CardDescription>Ocultá publicaciones y comentarios que contengan estas palabras.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Ej: spam" value={palabra} onChange={(e) => setPalabra(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPalabra()} />
                  <Button size="sm" onClick={addPalabra}><Plus className="h-4 w-4" />Agregar</Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(prefs.palabras_filtradas as string[]).length === 0 && <p className="text-xs text-muted-foreground">Sin palabras filtradas.</p>}
                  {(prefs.palabras_filtradas as string[]).map((w) => (
                    <Badge key={w} variant="secondary" className="gap-1 rounded-full pr-1">
                      {w}
                      <button onClick={() => quitarPalabra(w)} className="rounded-full p-0.5 hover:bg-background"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICACIONES */}
          <TabsContent value="notif" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Canales</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Email" desc="Recibí un resumen y alertas importantes por correo." k="notif_email" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Push del navegador" k="notif_push" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Sonido al recibir" k="notif_sonido" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Resumen semanal" desc="Un email cada lunes con tus métricas y actividad." k="notif_resumen_semanal" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">¿Qué quiero saber?</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Me gusta en mis publicaciones" k="notif_likes" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Comentarios y respuestas" k="notif_comentarios" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Nuevos seguidores" k="notif_seguidores" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Menciones (@vos)" k="notif_menciones" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Mensajes directos" k="notif_mensajes" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENIDO */}
          <TabsContent value="contenido" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Reproducción</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                <Row label="Reproducción automática de videos" desc="Los videos en el feed se reproducen al estar en pantalla." k="autoplay_videos" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Modo ahorro de datos" desc="Cargá las imágenes en menor calidad y desactivá autoplay." k="data_saver" prefs={prefs} update={update} saving={savingKey} />
                <Row label="Desenfocar contenido sensible" desc="Ocultá imágenes marcadas como sensibles hasta que las toques." k="sensible_blur" prefs={prefs} update={update} saving={savingKey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Idioma del contenido</CardTitle>
                <CardDescription>Preferí ver posts en este idioma cuando sea posible.</CardDescription></CardHeader>
              <CardContent>
                <Select value={prefs.idioma_contenido} onValueChange={(v) => update("idioma_contenido", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="all">Todos los idiomas</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BLOQUEOS */}
          <TabsContent value="bloqueos" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ban className="h-4 w-4" />Bloqueados ({bloqueados.length})</CardTitle>
                <CardDescription>No pueden ver tu contenido ni interactuar con vos.</CardDescription></CardHeader>
              <CardContent className="divide-y p-0">
                {bloqueados.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No bloqueaste a nadie.</p>
                  : bloqueados.map((b) => (
                    <UserRow key={b.id} u={b.bloqueado} action={<Button size="sm" variant="outline" onClick={() => desbloquear(b.id)}>Desbloquear</Button>} />
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><VolumeX className="h-4 w-4" />Silenciados ({silenciados.length})</CardTitle>
                <CardDescription>No verás sus posts pero ellos no se enteran.</CardDescription></CardHeader>
              <CardContent className="divide-y p-0">
                {silenciados.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No silenciaste a nadie.</p>
                  : silenciados.map((b) => (
                    <UserRow key={b.id} u={b.silenciado} action={<Button size="sm" variant="outline" onClick={() => desactivarSilencio(b.id)}>Activar</Button>} />
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* APARIENCIA */}
          <TabsContent value="apariencia" className="mt-5 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: "light", l: "Claro" }, { v: "dark", l: "Oscuro" }, { v: "sistema", l: "Sistema" }].map((t) => (
                    <button key={t.v} onClick={() => update("tema", t.v)}
                      className={`rounded-xl border-2 p-3 text-center text-sm font-medium transition ${prefs.tema === t.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label>Idioma de la interfaz</Label>
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
              <CardHeader><CardTitle className="text-base">Cambiar contraseña</CardTitle>
                <CardDescription>Usá una contraseña fuerte y única.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Input type="password" placeholder="Mínimo 8 caracteres" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                <Button size="sm" onClick={cambiarPassword} disabled={!newPass}>Actualizar contraseña</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Autenticación en dos pasos</CardTitle>
                <CardDescription>Una capa extra de seguridad para tu cuenta.</CardDescription></CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" disabled>Próximamente</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Sesión actual</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-3 flex items-center gap-3 rounded-xl border p-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Este dispositivo</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Activo</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" />Cerrar sesión</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Row({ label, desc, k, prefs, update, saving }: any) {
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

function UserRow({ u, action }: { u: any; action: React.ReactNode }) {
  if (!u) return null;
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar className="h-10 w-10"><AvatarImage src={u.avatar_url || ""} /><AvatarFallback>{initials(u.nombre)}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{u.nombre}</p>
        <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
      </div>
      {action}
    </div>
  );
}
