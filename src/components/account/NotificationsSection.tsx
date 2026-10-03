import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BellRing, Loader2, Moon, Sun } from "lucide-react";
import { Appearance, readAppearance, saveAppearance, TextSize, textSizeLabel } from "@/lib/appearance";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Prefs = { push_mensajes: boolean; push_promos: boolean; email_novedades: boolean };
const defaults: Prefs = { push_mensajes: true, push_promos: true, email_novedades: false };

/** Avisos (push y email) y apariencia de la app. */
export function NotificationsSection() {
  const { user } = useAuth();
  const push = usePushNotifications();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const updateAppearance = (patch: Partial<Appearance>) => { const next = { ...appearance, ...patch }; setAppearance(next); saveAppearance(next); };

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_preferencias").select("push_mensajes,push_promos,email_novedades").eq("perfil_id", user.id).maybeSingle();
    setPrefs({ ...defaults, ...(data ?? {}) });
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const togglePush = async (checked: boolean) => {
    if (!checked) { await push.disable(); toast.success("Notificaciones desactivadas en este dispositivo"); return; }
    const result = await push.enable();
    if (result.ok) toast.success(result.message); else toast.error(result.message);
  };
  const setPref = async (key: keyof Prefs, value: boolean) => {
    if (!user || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await db.from("delivery_preferencias").upsert({ perfil_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "perfil_id" });
    if (error) { toast.error(errorMessage(error)); load(); }
  };

  const pushHint = push.state === "denied" ? "Bloqueadas: habilitalas desde el candado del navegador"
    : push.state === "unsupported" ? "Este navegador no permite notificaciones"
    : push.state === "ios-install" ? "En iPhone, instalá Woref en tu pantalla de inicio" : "Avisos del estado de tus pedidos y envíos en este dispositivo";

  const rows: { key: keyof Prefs; title: string; hint: string }[] = [
    { key: "push_mensajes", title: "Mensajes del comercio y del repartidor", hint: "Te avisamos cuando te escriben por el chat de un pedido." },
    { key: "push_promos", title: "Promociones y cupones", hint: "Ofertas de los comercios que te interesan." },
    { key: "email_novedades", title: "Novedades por email", hint: "Noticias de Woref y resúmenes ocasionales." },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h3 className="flex items-center gap-2 font-extrabold"><BellRing className="h-5 w-5 text-primary" />Notificaciones</h3>
        <ul className="mt-3 divide-y rounded-2xl border">
          <li className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1"><span className="block font-bold">Avisos en este dispositivo</span><span className="block text-xs text-muted-foreground">{pushHint}</span></span>
            <Switch checked={push.state === "on"} disabled={!["on", "off"].includes(push.state)} onCheckedChange={togglePush} aria-label="Avisos en este dispositivo" />
          </li>
          {!prefs ? <li className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></li> : rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1"><span className="block font-bold">{row.title}</span><span className="block text-xs text-muted-foreground">{row.hint}</span></span>
              <Switch checked={prefs[row.key]} onCheckedChange={(checked) => setPref(row.key, checked)} aria-label={row.title} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Los avisos del estado de un pedido en curso siempre se envían: son parte del servicio.</p>
      </section>

      <section>
        <h3 className="font-extrabold">Apariencia</h3>
        <div role="radiogroup" aria-label="Tema" className="mt-3 grid max-w-sm grid-cols-2 gap-2">
          {([["light", "Claro", Sun], ["dark", "Oscuro", Moon]] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)} className={cn("flex items-center gap-2 rounded-2xl border p-3 font-bold", theme === value ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}><Icon className="h-5 w-5" />{label}</button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-extrabold">Accesibilidad</h3>
        <p className="mt-1 text-sm text-muted-foreground">Se guarda en este dispositivo.</p>
        <div role="radiogroup" aria-label="Tamaño del texto" className="mt-3 grid max-w-md grid-cols-3 gap-2">
          {(Object.keys(textSizeLabel) as TextSize[]).map((size) => (
            <button key={size} type="button" role="radio" aria-checked={appearance.textSize === size} onClick={() => updateAppearance({ textSize: size })} className={cn("rounded-2xl border p-3 font-bold", appearance.textSize === size ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}>
              <span className={cn("block leading-none", size === "normal" ? "text-base" : size === "large" ? "text-xl" : "text-2xl")}>Aa</span>
              <span className="mt-1 block text-xs">{textSizeLabel[size]}</span>
            </button>
          ))}
        </div>
        <ul className="mt-3 max-w-md divide-y rounded-2xl border">
          <li className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1"><span className="block font-bold">Reducir animaciones</span><span className="block text-xs text-muted-foreground">Menos movimiento en transiciones y efectos.</span></span>
            <Switch checked={appearance.reduceMotion} onCheckedChange={(checked) => updateAppearance({ reduceMotion: checked })} aria-label="Reducir animaciones" />
          </li>
        </ul>
      </section>
    </div>
  );
}
