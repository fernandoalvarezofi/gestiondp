import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Bell, ChevronRight, Heart, HelpCircle, LockKeyhole, MapPin, Receipt, ShieldCheck, Ticket, Trophy, UserCircle } from "lucide-react";
import { AddressesSection } from "@/components/account/AddressesSection";
import { GeneralSection } from "@/components/account/GeneralSection";
import { HelpSection } from "@/components/account/HelpSection";
import { NotificationsSection } from "@/components/account/NotificationsSection";
import { PrivacySection } from "@/components/account/PrivacySection";
import { SecuritySection } from "@/components/account/SecuritySection";
import { TeamInvitations } from "@/components/merchant/TeamInvitations";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, img } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "general", label: "Datos personales", hint: "Foto, nombre, teléfono y email", icon: UserCircle },
  { id: "seguridad", label: "Seguridad", hint: "Contraseña, sesiones y dispositivos", icon: LockKeyhole },
  { id: "direcciones", label: "Direcciones", hint: "Tus lugares de entrega", icon: MapPin },
  { id: "notificaciones", label: "Notificaciones y apariencia", hint: "Avisos, emails y tema", icon: Bell },
  { id: "privacidad", label: "Privacidad y datos", hint: "Descargar o eliminar tu cuenta", icon: ShieldCheck },
  { id: "ayuda", label: "Ayuda y paneles", hint: "Preguntas, comercio, repartidor", icon: HelpCircle },
] as const;

const shortcuts = [
  { to: "/app/club", label: "Woref Club", icon: Trophy },
  { to: "/app/pedidos", label: "Mis pedidos", icon: Receipt },
  { to: "/app/favoritos", label: "Favoritos", icon: Heart },
  { to: "/app/promociones", label: "Cupones", icon: Ticket },
];

/** Mi cuenta: menú de secciones; en el celular se ve como lista y cada sección abre su pantalla. */
export default function Profile() {
  const { user } = useAuth();
  const roles = useDeliveryRoles();
  const { seccion } = useParams();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);
  const current = SECTIONS.find((item) => item.id === seccion);

  useEffect(() => {
    if (!user) return;
    db.from("perfiles").select("avatar_url").eq("id", user.id).maybeSingle().then(({ data }: { data: { avatar_url: string | null } | null }) => setAvatar(data?.avatar_url ?? null));
  }, [user, roles.nombre]);

  // En pantallas anchas abrimos la primera sección en vez de mostrar un panel vacío.
  useEffect(() => {
    if (!seccion && window.matchMedia("(min-width: 1024px)").matches) navigate("/app/perfil/general", { replace: true });
  }, [seccion, navigate]);

  if (seccion && !current) return <Navigate to="/app/perfil" replace />;

  const initials = (roles.nombre || user?.email || "?").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  const refreshProfile = () => roles.refresh();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <header className={cn("flex items-center gap-4", current && "max-lg:hidden")}>
        {avatar ? <img src={img(avatar, 200)} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-black uppercase text-primary-foreground">{initials}</span>}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Mi cuenta</p>
          <h1 className="truncate text-2xl font-extrabold">{roles.nombre || "Perfil"}</h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </header>

      <TeamInvitations className={cn("mt-5", current && "max-lg:hidden")} onAccepted={refreshProfile} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav className={cn("space-y-3", current && "max-lg:hidden")} aria-label="Secciones de mi cuenta">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
            {shortcuts.map(({ to, label, icon: Icon }) => (
              <li key={to}><Link to={to} className="flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center text-xs font-bold hover:bg-muted"><Icon className="h-5 w-5 text-primary" />{label}</Link></li>
            ))}
          </ul>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card lg:divide-y-0 lg:space-y-1 lg:border-0 lg:bg-transparent">
            {SECTIONS.map(({ id, label, hint, icon: Icon }) => (
              <li key={id}>
                <Link to={`/app/perfil/${id}`} className={cn("flex items-center gap-3 p-4 hover:bg-muted/60 lg:rounded-2xl lg:border lg:border-transparent lg:p-3", current?.id === id && "lg:border-primary/30 lg:bg-primary/5 lg:text-primary")}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{label}</span><span className="block text-xs font-normal text-muted-foreground">{hint}</span></span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground lg:hidden" />
                </Link>
              </li>
            ))}
          </ul>
          <ul className="hidden gap-1 lg:block">
            {shortcuts.map(({ to, label, icon: Icon }) => (
              <li key={to}><Link to={to} className="flex items-center gap-3 rounded-2xl p-3 text-sm font-semibold text-muted-foreground hover:bg-muted"><Icon className="h-5 w-5" />{label}</Link></li>
            ))}
          </ul>
        </nav>

        <section className={cn("min-w-0 rounded-3xl border bg-card p-4 sm:p-6", !current && "max-lg:hidden")}>
          {current ? (
            <>
              <h2 className="text-xl font-extrabold">{current.label}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{current.hint}</p>
              {current.id === "general" && <GeneralSection onSaved={refreshProfile} />}
              {current.id === "seguridad" && <SecuritySection />}
              {current.id === "direcciones" && <AddressesSection />}
              {current.id === "notificaciones" && <NotificationsSection />}
              {current.id === "privacidad" && <PrivacySection />}
              {current.id === "ayuda" && <HelpSection />}
            </>
          ) : (
            <div className="hidden flex-col items-center py-16 text-center lg:flex">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
              <p className="mt-3 font-extrabold">Elegí una sección</p>
              <p className="text-sm text-muted-foreground">Administrá tus datos, tu seguridad y tus preferencias.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
