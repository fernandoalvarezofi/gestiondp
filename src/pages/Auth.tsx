import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";
import { z } from "zod";
import { authErrorMessage } from "@/lib/authErrors";
import { toast as notify } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";

const loginSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido").max(255),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "El nombre es obligatorio").max(100, "El nombre debe tener menos de 100 caracteres"),
});

type AuthStyle = "mint" | "dark" | "photo";

// El inicio de sesión con Google pasa por Lovable: solo funciona en sus dominios.
const googleAvailable = typeof window !== "undefined" && /(^|\.)(lovable\.app|lovable\.dev|lovableproject\.com|lovableproject-dev\.com)$/.test(window.location.hostname);

export default function Auth() {
  const { session, loading } = useAuth();

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(searchParams.get("registro") !== "1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authStyle] = useState<AuthStyle>("photo");
  const [forgot, setForgot] = useState(false);
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? searchParams.get("next") ?? undefined;
    return <Navigate to={from && from.startsWith("/app") && !from.startsWith("//") ? from : "/app"} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const schema = isLogin ? loginSchema : signupSchema;
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => { errs[err.path[0] as string] = err.message; });
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
      } else {
        const data = parsed.data as z.infer<typeof signupSchema>;
        const { data: result, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: data.fullName },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        // Si la confirmación por email está desactivada, la sesión llega en el acto y se entra directo.
        if (!result.session) {
          toast({
            title: "Revisá tu email",
            description: "Te enviamos un link para confirmar tu cuenta. Puede tardar unos minutos o llegar a spam.",
          });
        }
      }
    } catch (error) {
      toast({
        title: "No pudimos continuar",
        description: authErrorMessage((error as Error).message || ""),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = authStyle === "dark";
  const isPhoto = authStyle === "photo";
  const isMint = authStyle === "mint";

  const leftPanelClasses = isMint
    ? "bg-surface-mint"
    : isDark
    ? "bg-teal-dark"
    : "relative";

  const textColor = isMint ? "text-foreground" : "text-white";
  const subtextColor = isMint ? "text-muted-foreground" : "text-white/85";
  const footerColor = isMint ? "text-muted-foreground/60" : "text-white/60";

  return (
    <div className="flex min-h-screen max-lg:flex-col">
      {/* Portada de marca en el celular */}
      <div className="border-b-4 border-brand-orange bg-[hsl(220_14%_16%)] px-6 pb-14 pt-8 text-white max-lg:rounded-b-[32px] lg:hidden">
        <DeliveryBrand inverted />
        <h1 className="mt-7 text-[32px] font-extrabold leading-[1.05] tracking-tight">Lo que necesitás,<br />llega hoy.</h1>
        <p className="mt-2 max-w-xs text-[15px] font-medium text-white/85">Comida, súper, farmacia y más, con seguimiento en tiempo real.</p>
      </div>
      {/* Left panel */}
      <div className={`hidden overflow-hidden border-r-4 border-brand-orange bg-[hsl(220_14%_16%)] lg:flex lg:w-1/2 ${leftPanelClasses}`}>
        {isPhoto && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=80&auto=format&fit=crop)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220_14%_14%)]/95 via-[hsl(220_14%_16%)]/88 to-black/70" />
          </>
        )}

        {isDark && (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: "radial-gradient(ellipse at 30% 80%, hsl(var(--teal-data) / 0.4), transparent 60%)",
            }}
          />
        )}

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <DeliveryBrand inverted />

          <div className="space-y-6">
            <h1 className={`font-display text-5xl lg:text-6xl font-bold leading-[1.02] tracking-tight ${textColor}`}>
              Lo que necesitás,<br />
              llega hoy.
            </h1>
            <p className={`text-lg max-w-md leading-relaxed ${subtextColor}`}>
              Comida, supermercado, farmacia y tiendas cerca tuyo, con seguimiento en tiempo real.
            </p>
            <ul className={`space-y-2 text-sm ${subtextColor}`}>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-orange" /> Seguí tu pedido en vivo, del local a tu puerta</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-orange" /> Código de entrega en cada pedido</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-orange" /> Cupones de bienvenida y envíos gratis</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-orange" /> Sumá tu comercio o repartí con nosotros</li>
            </ul>
          </div>

          <p className={`text-sm ${footerColor}`}>
            © {new Date().getFullYear()} Woref.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-start p-6 sm:p-12 lg:justify-center bg-white dark:bg-card">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-1">
            {isLogin ? "Bienvenido de nuevo" : "Crear cuenta"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {isLogin ? "Iniciá sesión para pedir en Woref" : "Creá tu cuenta y hacé tu primer pedido"}
          </p>

          {forgot ? <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} /> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Pérez"
                  required
                  maxLength={100}
                />
                {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                maxLength={255}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {isLogin && <button type="button" onClick={() => setForgot(true)} className="text-xs font-semibold text-primary hover:underline">¿Olvidaste tu contraseña?</button>}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={128}
              />
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Iniciar sesión" : "Crear cuenta"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {!isLogin && (
              <p className="text-center text-xs text-muted-foreground">
                Al crear tu cuenta aceptás los <Link to="/terminos" className="font-semibold text-primary hover:underline">Términos y condiciones</Link> y la <Link to="/privacidad" className="font-semibold text-primary hover:underline">Política de privacidad</Link>.
              </p>
            )}
          </form>
          )}

          {googleAvailable && (<>
          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-card px-2 text-xs text-muted-foreground">
              o
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) {
                toast({ title: "Error", description: String(error), variant: "destructive" });
              }
            }}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Iniciar sesión con Google
          </Button>
          </>)}

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}
            </span>{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return notify.error("Escribí un email válido");
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/restablecer` });
    setSending(false);
    if (error) return notify.error(authErrorMessage(error.message));
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-2xl bg-success/10 p-4 text-sm">Si existe una cuenta con <span className="font-bold">{email}</span>, te llega un email con un link para crear una contraseña nueva. Revisá también spam.</p>
        <Button variant="outline" className="w-full" onClick={onBack}>Volver a iniciar sesión</Button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <p className="text-sm text-muted-foreground">Escribí el email de tu cuenta y te mandamos un link para crear una contraseña nueva.</p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required maxLength={255} autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}</Button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-medium text-primary hover:underline">Volver</button>
    </form>
  );
}