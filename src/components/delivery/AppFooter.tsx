import { Link } from "react-router-dom";
import { Bike, Headset, KeyRound, MapPinned, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const promises = [
  { icon: MapPinned, title: "Seguimiento en vivo", text: "Mirá en el mapa dónde está tu pedido." },
  { icon: KeyRound, title: "Código de entrega", text: "Tu pedido se entrega solo con tu código." },
  { icon: ShieldCheck, title: "Precios claros", text: "Ves el total final antes de pedir." },
  { icon: Headset, title: "Ayuda cuando la necesites", text: "Reportá un problema desde tu pedido." },
];

/** Pie de página (escritorio): compromisos con el cliente y enlaces institucionales. */
export function AppFooter() {
  return (
    <footer className="mt-16 hidden border-t bg-card md:block">
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-6 px-8 py-8">
        {promises.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
            <div><p className="text-sm font-extrabold">{title}</p><p className="text-[13px] text-muted-foreground">{text}</p></div>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-8 py-6 text-sm">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-semibold text-muted-foreground">
            <Link to="/app/ayuda" className="hover:text-foreground">Centro de ayuda</Link>
            <Link to="/app/comercio" className="hover:text-foreground">Sumá tu comercio</Link>
            <Link to="/app/repartidor" className="flex items-center gap-1 hover:text-foreground"><Bike className="h-4 w-4" />Repartí con Woref</Link>
            <Link to="/terminos" className="hover:text-foreground">Términos</Link>
            <Link to="/privacidad" className="hover:text-foreground">Privacidad</Link>
          </nav>
          <p className="text-muted-foreground">© {new Date().getFullYear()} Woref</p>
        </div>
      </div>
    </footer>
  );
}
