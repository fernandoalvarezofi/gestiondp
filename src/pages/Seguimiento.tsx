import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, MapPin, PackageSearch, Search } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/delivery";
import { ESTADOS_LOG, fechaCorta, Seguimiento as Datos, seguimiento } from "@/services/logistica";
import { EstadoEnvio, LineaTiempo, ProgresoEnvio } from "@/components/logistica/comun";

/** Seguimiento público de un envío de Woref Logística (/seguimiento/WR…). Sin datos personales: solo estado, ciudad y movimientos. */
export default function Seguimiento() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(numero ?? "");
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = numero ? `Envío ${numero.toUpperCase()} · Woref` : "Seguí tu envío · Woref";
    if (!numero) { setDatos(undefined); return; }
    let vivo = true;
    setDatos(undefined); setError(false);
    seguimiento(numero).then((d) => { if (vivo) setDatos(d); }).catch(() => { if (vivo) { setError(true); setDatos(null); } });
    return () => { vivo = false; };
  }, [numero]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const c = codigo.trim().toUpperCase().replace(/\s/g, "");
    if (c) navigate(`/seguimiento/${encodeURIComponent(c)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="glass glass-strong mx-2 mt-2 rounded-2xl"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"><Link to="/" aria-label="Woref"><DeliveryBrand /></Link><span className="text-sm font-semibold text-muted-foreground">Seguimiento de envíos</span></div></header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <form onSubmit={buscar} className="flex gap-2" role="search">
          <label className="relative flex-1"><span className="sr-only">Número de envío</span><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Número de envío (WR…)" className="h-11 pl-9 font-mono uppercase" maxLength={24} autoComplete="off" /></label>
          <Button type="submit" className="h-11 rounded-full px-5">Buscar</Button>
        </form>

        {!numero ? (
          <div className="rounded-3xl border bg-card p-8 text-center"><PackageSearch className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-3 text-xl font-extrabold">Seguí tu envío</h1><p className="mt-1 text-sm text-muted-foreground">Ingresá el número que figura en la etiqueta o en el mensaje que te mandó el vendedor.</p></div>
        ) : datos === undefined ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        : datos === null ? (
          <div className="rounded-3xl border bg-card p-8 text-center"><h1 className="text-lg font-extrabold">{error ? "No pudimos consultar el envío" : "No encontramos ese envío"}</h1><p className="mt-1 text-sm text-muted-foreground">{error ? "Probá de nuevo en un momento." : "Revisá el número: empieza con WR y tiene 10 números."}</p></div>
        ) : (
          <>
            <section className="rounded-3xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-semibold text-muted-foreground">Envío {datos.bultos > 1 ? `· ${datos.bultos} bultos` : ""}</p><h1 className="font-mono text-2xl font-extrabold">{datos.numero}</h1></div>
                <EstadoEnvio estado={datos.estado} className="text-sm" />
              </div>
              <p className="mt-3 text-lg font-bold">{ESTADOS_LOG[datos.estado].texto}</p>
              <p className="text-sm text-muted-foreground">
                {datos.estado === "entregado" ? `Entregado el ${formatDateTime(datos.entregado_at)}${datos.receptor ? ` · recibió ${datos.receptor}` : ""}`
                  : datos.fecha_estimada && !["cancelado", "devuelto", "siniestrado"].includes(datos.estado) ? <>Llega aprox. el <b className="capitalize text-foreground">{fechaCorta(datos.fecha_estimada)}</b></> : null}
              </p>
              {!["cancelado", "devuelto", "siniestrado", "en_devolucion"].includes(datos.estado) && <div className="mt-4"><ProgresoEnvio estado={datos.estado} /></div>}
              <p className="mt-4 text-sm">{datos.origen ? <><span className="text-muted-foreground">De</span> {datos.origen} <span className="text-muted-foreground">a</span> </> : <span className="text-muted-foreground">Destino: </span>}{datos.destino}</p>
              {datos.estado === "visita_fallida" && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Pasamos y no pudimos entregarlo. Vamos a intentar de nuevo; si necesitás coordinar, comunicate con quien te lo mandó.</p>}
            </section>
            {datos.sucursal_destino && (
              <section className="flex gap-3 rounded-3xl border bg-card p-5"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm"><p className="font-bold">Lo retirás en {datos.sucursal_destino.nombre}</p><p>{datos.sucursal_destino.direccion}, {datos.sucursal_destino.ciudad}</p>{datos.sucursal_destino.horario && <p className="text-muted-foreground">{datos.sucursal_destino.horario}</p>}<p className="mt-1 text-xs text-muted-foreground">Llevá tu DNI. Te avisamos cuando esté disponible.</p></div>
              </section>
            )}
            <section className="rounded-3xl border bg-card p-5"><h2 className="mb-3 font-bold">Movimientos</h2>
              <LineaTiempo eventos={datos.eventos.map((e) => ({ estado: e.estado, descripcion: e.descripcion, fecha: e.fecha, lugar: e.lugar }))} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
