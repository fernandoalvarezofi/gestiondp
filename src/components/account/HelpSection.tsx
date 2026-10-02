import { Link } from "react-router-dom";
import { Bike, FileText, Headset, ShieldCheck, Store } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";

const faqs = [
  { q: "¿Cuánto tarda mi pedido?", a: "Cada comercio muestra su tiempo estimado. Cuando confirmás, ves la hora de llegada y el estado en tiempo real desde Mis pedidos." },
  { q: "¿Puedo cancelar un pedido?", a: "Sí, mientras el comercio no lo haya aceptado. Entrá al pedido y tocá “Cancelar pedido”. Si ya lo aceptaron, escribinos y lo resolvemos." },
  { q: "¿Para qué sirve el código de entrega?", a: "Es un código de 4 números que le das al repartidor cuando recibís el pedido (o el paquete). Así confirmamos que llegó a la persona correcta." },
  { q: "¿Cómo uso un cupón?", a: "Copiá el código desde Cupones y promociones y pegalo en el carrito antes de confirmar. El descuento se aplica automáticamente." },
  { q: "¿Cómo envío un paquete?", a: "Tocá “Envíos” en el inicio, elegí dónde retirarlo y dónde entregarlo, y vas a ver el precio antes de confirmar. Se paga en efectivo al repartidor." },
  { q: "¿Qué hago si hay un problema con mi pedido?", a: "Entrá al pedido y tocá “Tuve un problema”. Elegí qué pasó y lo revisa el equipo de Woref; te respondemos por ahí mismo." },
  { q: "¿Cómo sumo mi comercio?", a: "Desde Paneles → Sumá tu comercio podés crear tu tienda, cargar productos y empezar a recibir pedidos." },
];

/** Preguntas frecuentes, accesos a los paneles y documentos legales. */
export function HelpSection() {
  const roles = useDeliveryRoles();
  const panels = [
    { to: "/app/comercio", label: roles.storeId ? "Panel de mi comercio" : "Sumá tu comercio", hint: roles.storeId ? "Pedidos, menú y finanzas" : "Vendé con Woref", icon: Store },
    { to: "/app/repartidor", label: roles.isCourier ? "Panel de repartidor" : "Quiero ser repartidor", hint: roles.isCourier ? "Ofertas y ganancias" : "Generá ingresos extra", icon: Bike },
    ...(roles.isAdmin ? [{ to: "/app/admin", label: "Administración", hint: "Gestión de la plataforma", icon: ShieldCheck }] : []),
  ];
  return (
    <div className="space-y-8">
      <Link to="/app/ayuda" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"><Headset className="h-5 w-5" /></span><span><span className="block font-extrabold">Hablar con soporte</span><span className="block text-sm text-muted-foreground">Tus consultas y reclamos, con respuesta en la app</span></span></Link>
      <section>
        <h3 className="font-extrabold">Preguntas frecuentes</h3>
        <Accordion type="single" collapsible className="mt-1">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left font-bold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <section>
        <h3 className="font-extrabold">Paneles</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {panels.map(({ to, label, hint, icon: Icon }) => (
            <li key={to}><Link to={to} className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-muted"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span><span className="block font-bold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span></Link></li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-extrabold">Legales</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link to="/terminos" className="flex items-center gap-2 font-semibold text-primary hover:underline"><FileText className="h-4 w-4" />Términos y condiciones</Link></li>
          <li><Link to="/privacidad" className="flex items-center gap-2 font-semibold text-primary hover:underline"><FileText className="h-4 w-4" />Política de privacidad</Link></li>
        </ul>
      </section>
    </div>
  );
}
