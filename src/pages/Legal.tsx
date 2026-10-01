import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";

type Section = { title: string; body: string[] };

const UPDATED = "1 de octubre de 2026";

const terminos: Section[] = [
  { title: "1. Qué es Woref", body: ["Woref es una plataforma que conecta a personas que quieren comprar productos (clientes) con comercios que los venden y con repartidores independientes que los entregan. Woref no elabora ni vende los productos: cada comercio es responsable de lo que ofrece, de sus precios, de su calidad y de cumplir las normas que le correspondan."] },
  { title: "2. Tu cuenta", body: ["Para pedir necesitás una cuenta con datos verdaderos. Sos responsable de cuidar tu contraseña y de lo que se haga desde tu cuenta.", "Podemos suspender cuentas que se usen para fraude, abuso, pedidos falsos o que incumplan estos términos."] },
  { title: "3. Pedidos y precios", body: ["Al confirmar un pedido aceptás pagar el total que se muestra: productos, costo de envío, tarifa de servicio y propina, menos los descuentos que correspondan. El total final lo calcula el sistema al confirmar.", "El comercio puede rechazar un pedido (por ejemplo, por falta de stock). Si lo rechaza, no se cobra.", "Podés cancelar tu pedido mientras el comercio no lo haya aceptado. Después de aceptado, contactanos desde la sección Ayuda."] },
  { title: "4. Entrega", body: ["Los tiempos de entrega son estimados. Para recibir el pedido le das al repartidor el código de entrega que ves en la app. No compartas ese código antes de recibir tu pedido.", "Si el producto llega en mal estado o falta algo, avisanos dentro de las 24 horas desde la sección Ayuda."] },
  { title: "5. Pagos", body: ["Podés pagar con los medios que se muestran al confirmar. Los pagos en efectivo o con tarjeta al recibir se hacen directamente al entregar el pedido. Los pagos online se procesan a través de un proveedor de pagos externo; Woref no guarda los datos de tu tarjeta."] },
  { title: "6. Cupones y promociones", body: ["Los cupones tienen condiciones (monto mínimo, vencimiento, un uso por persona, comercio específico). No son canjeables por dinero y pueden darse de baja si se detecta un uso abusivo."] },
  { title: "7. Comercios", body: ["Los comercios que se suman a Woref deben tener la habilitación correspondiente, informar precios reales y finales, respetar la información de alérgenos y cumplir con la normativa de defensa del consumidor. Woref puede revisar, aprobar, pausar o dar de baja comercios."] },
  { title: "8. Repartidores", body: ["Los repartidores usan Woref de forma independiente, eligen cuándo conectarse y qué pedidos tomar. Deben cumplir las normas de tránsito y tratar con respeto a clientes y comercios."] },
  { title: "9. Responsabilidad", body: ["Woref trabaja para que la plataforma funcione siempre, pero puede haber interrupciones. En la medida que lo permita la ley, Woref no responde por daños indirectos derivados del uso de la plataforma. Nada de esto limita tus derechos como consumidor según la Ley 24.240."] },
  { title: "10. Cambios y contacto", body: ["Podemos actualizar estos términos; si el cambio es importante, te lo avisamos en la app. Para cualquier consulta, escribinos desde la sección Ayuda de tu perfil."] },
];

const privacidad: Section[] = [
  { title: "1. Qué datos usamos", body: ["Nombre, email y teléfono de tu cuenta; las direcciones que guardás; tus pedidos, opiniones y favoritos; y datos técnicos básicos de uso (dispositivo y navegador) para que la app funcione bien.", "Si sos comercio o repartidor, también los datos que cargás en tu panel (dirección del local, horarios, vehículo)."] },
  { title: "2. Para qué los usamos", body: ["Para procesar y entregar tus pedidos, mostrarte el seguimiento, avisarte cambios de estado, prevenir fraudes, darte soporte y mejorar el servicio. No vendemos tus datos."] },
  { title: "3. Con quién los compartimos", body: ["Con el comercio y el repartidor de cada pedido compartimos solo lo necesario para entregarlo: tu nombre, la dirección de entrega, el teléfono de contacto y las notas del pedido.", "Con proveedores que nos ayudan a operar (alojamiento, base de datos, procesamiento de pagos), que solo pueden usarlos para prestarnos ese servicio."] },
  { title: "4. Cuánto tiempo los guardamos", body: ["Mientras tengas tu cuenta y, después, el tiempo que exijan las obligaciones legales y contables."] },
  { title: "5. Tus derechos", body: ["Podés acceder, rectificar, actualizar o pedir la eliminación de tus datos en cualquier momento, escribiéndonos desde la sección Ayuda. Muchos datos los podés editar directamente desde tu perfil.", "La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales."] },
  { title: "6. Seguridad", body: ["Usamos conexiones cifradas y controles de acceso para que cada persona vea solo lo que le corresponde. Ningún sistema es 100% infalible: si detectamos un problema que te afecte, te lo vamos a informar."] },
  { title: "7. Cambios", body: ["Si cambiamos esta política de forma importante, te lo avisamos en la app."] },
];

export default function Legal({ doc }: { doc: "terminos" | "privacidad" }) {
  const navigate = useNavigate();
  const sections = doc === "terminos" ? terminos : privacidad;
  const title = doc === "terminos" ? "Términos y condiciones" : "Política de privacidad";
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/"><DeliveryBrand /></Link>
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Volver</button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {UPDATED}</p>
        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-extrabold">{section.title}</h2>
              {section.body.map((paragraph) => <p key={paragraph.slice(0, 30)} className="mt-2 leading-relaxed text-muted-foreground">{paragraph}</p>)}
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Ver también: {doc === "terminos" ? <Link to="/privacidad" className="font-semibold text-primary hover:underline">Política de privacidad</Link> : <Link to="/terminos" className="font-semibold text-primary hover:underline">Términos y condiciones</Link>}
        </p>
      </main>
    </div>
  );
}
