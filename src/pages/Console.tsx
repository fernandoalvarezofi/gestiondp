import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Loader2, LogOut, ScrollText, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusinessMetrics } from "@/components/admin/BusinessMetrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminDb, ErrorApp, EstadoSesion, EventoAuditoria, ResumenAdmin } from "@/lib/adminClient";
import { cn } from "@/lib/utils";

type Fase = "cargando" | "ingreso" | "codigo" | "sin_acceso" | "mfa_alta" | "mfa_desafio" | "listo";

const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium" }) : "—");
const hace = (iso: string | null) => {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
};

function Marco({ children, titulo, detalle }: { children: React.ReactNode; titulo: string; detalle?: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-3xl border border-t-4 border-t-brand-orange bg-card p-6 shadow-pop sm:p-8">
        <h1 className="text-2xl font-extrabold">{titulo}</h1>
        {detalle && <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** Consola de administración: base de datos aparte, con login propio y verificación en dos pasos obligatoria. */
export default function Console() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Consola · Woref";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const evaluar = useCallback(async () => {
    const { data: { session } } = await adminDb.auth.getSession();
    if (!session) { setEmail(null); setFase("ingreso"); return; }
    setEmail(session.user.email ?? null);
    const { data: estado, error } = await adminDb.rpc("mi_estado");
    if (error || !estado) { await adminDb.auth.signOut(); setFase("ingreso"); return; }
    const info = estado as EstadoSesion;
    if (!info.admin) { setFase(info.configuracion_inicial ? "codigo" : "sin_acceso"); return; }
    if (info.aal === "aal2") { setFase("listo"); return; }
    const { data: nivel } = await adminDb.auth.mfa.getAuthenticatorAssuranceLevel();
    setFase(nivel?.nextLevel === "aal2" ? "mfa_desafio" : "mfa_alta");
  }, []);
  useEffect(() => { evaluar(); }, [evaluar]);

  const salir = async () => { await adminDb.auth.signOut(); setFase("ingreso"); setEmail(null); };

  if (fase === "cargando") return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-t-[3px] border-t-brand-orange bg-[hsl(220_14%_16%)] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3"><DeliveryBrand inverted /><span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">Consola</span></div>
          {email && <div className="flex items-center gap-3 text-sm"><span className="hidden text-white/70 sm:inline">{email}</span><button type="button" onClick={salir} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold hover:bg-white/10"><LogOut className="h-4 w-4" />Salir</button></div>}
        </div>
      </header>
      {fase === "ingreso" && <Ingreso onListo={evaluar} />}
      {fase === "codigo" && <Codigo onListo={evaluar} />}
      {fase === "sin_acceso" && (
        <Marco titulo="Sin acceso" detalle="Esta cuenta no figura como administradora de Woref.">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <Button type="button" variant="outline" className="mt-6 rounded-full" onClick={salir}>Salir</Button>
        </Marco>
      )}
      {fase === "mfa_alta" && <MfaAlta onListo={evaluar} />}
      {fase === "mfa_desafio" && <MfaDesafio onListo={evaluar} />}
      {fase === "listo" && <Tablero />}
    </div>
  );
}

// ------------------------------------------------------------------ ingreso
function Ingreso({ onListo }: { onListo: () => void }) {
  const [modo, setModo] = useState<"ingresar" | "primer">("ingresar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [busy, setBusy] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (modo === "primer" && clave.length < 12) { toast.error("La contraseña debe tener al menos 12 caracteres"); return; }
    setBusy(true);
    if (modo === "primer") {
      const { error } = await adminDb.auth.signUp({ email: email.trim(), password: clave });
      if (error) { setBusy(false); toast.error(/cerrado|closed/i.test(error.message) ? "El registro ya está cerrado: la configuración inicial se completó." : error.message); return; }
    }
    const { error } = await adminDb.auth.signInWithPassword({ email: email.trim(), password: clave });
    setBusy(false);
    if (error) { toast.error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message); return; }
    onListo();
  };

  return (
    <Marco titulo={modo === "ingresar" ? "Ingresar a la consola" : "Primer uso"} detalle={modo === "ingresar" ? "Acceso exclusivo de administración, separado de las cuentas de la app." : "Creá tu cuenta de administrador. Después te va a pedir el código de un solo uso."}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-clave">Contraseña</Label><Input id="c-clave" type="password" autoComplete={modo === "ingresar" ? "current-password" : "new-password"} required minLength={modo === "primer" ? 12 : 1} value={clave} onChange={(event) => setClave(event.target.value)} />{modo === "primer" && <p className="text-xs text-muted-foreground">Mínimo 12 caracteres. Usá una contraseña que no uses en ningún otro lado.</p>}</div>
        <Button type="submit" className="h-11 w-full rounded-full font-bold" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{modo === "ingresar" ? "Ingresar" : "Crear cuenta"}</Button>
      </form>
      <button type="button" onClick={() => setModo(modo === "ingresar" ? "primer" : "ingresar")} className="mt-5 w-full text-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">{modo === "ingresar" ? "Es mi primer uso" : "Ya tengo cuenta"}</button>
    </Marco>
  );
}

function Codigo({ onListo }: { onListo: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await adminDb.rpc("reclamar_admin", { p_codigo: codigo.trim().toUpperCase() });
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^.*?:\s*/, "")); return; }
    toast.success("Listo: sos la administradora de Woref");
    onListo();
  };
  return (
    <Marco titulo="Código de un solo uso" detalle="Ingresá el código que recibiste para configurar la consola. Sirve una sola vez y después se borra.">
      <form onSubmit={enviar} className="space-y-4">
        <Input aria-label="Código" value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" className="h-12 text-center font-mono text-lg tracking-widest" autoComplete="off" required />
        <Button type="submit" className="h-11 w-full rounded-full font-bold" disabled={busy || codigo.trim().length < 8}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar</Button>
      </form>
    </Marco>
  );
}

// ------------------------------------------------------------------ verificación en dos pasos
function MfaAlta({ onListo }: { onListo: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secreto: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Si quedó un intento anterior sin verificar, se descarta antes de crear otro.
      const { data: lista } = await adminDb.auth.mfa.listFactors();
      for (const viejo of lista?.all ?? []) if (viejo.status === "unverified") await adminDb.auth.mfa.unenroll({ factorId: viejo.id });
      const { data, error } = await adminDb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Consola ${new Date().toISOString().slice(0, 10)}` });
      if (!vivo) return;
      if (error || !data) { toast.error(error?.message ?? "No pudimos crear la verificación"); return; }
      setFactor({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
    })();
    return () => { vivo = false; };
  }, []);

  const verificar = async (event: FormEvent) => {
    event.preventDefault();
    if (!factor) return;
    setBusy(true);
    const { error } = await adminDb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo.trim() });
    setBusy(false);
    if (error) { toast.error("El código no es correcto. Probá con el que muestra tu app ahora."); return; }
    toast.success("Verificación en dos pasos activada");
    onListo();
  };

  return (
    <Marco titulo="Activá la verificación en dos pasos" detalle="Es obligatoria para entrar a la consola. Escaneá el QR con una app de autenticación (Google Authenticator, Authy, 1Password…).">
      {!factor ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <form onSubmit={verificar} className="space-y-4">
          <div className="mx-auto w-48 rounded-2xl border bg-white p-2"><img src={factor.qr} alt="Código QR para tu app de autenticación" className="h-full w-full" /></div>
          <p className="text-center text-xs text-muted-foreground">¿No podés escanear? Ingresá esta clave a mano: <span className="select-all break-all font-mono font-bold text-foreground">{factor.secreto}</span></p>
          <Input aria-label="Código de 6 dígitos" inputMode="numeric" maxLength={6} value={codigo} onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ""))} placeholder="123456" className="h-12 text-center font-mono text-xl tracking-[0.4em]" autoComplete="one-time-code" />
          <Button type="submit" className="h-11 w-full rounded-full font-bold" disabled={busy || codigo.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Activar</Button>
          <p className="text-xs text-muted-foreground">Guardá la clave en un lugar seguro: si perdés el celular, es la forma de recuperar el acceso.</p>
        </form>
      )}
    </Marco>
  );
}

function MfaDesafio({ onListo }: { onListo: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const verificar = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { data: lista } = await adminDb.auth.mfa.listFactors();
    const factor = lista?.totp?.[0];
    if (!factor) { setBusy(false); toast.error("No encontramos tu verificación en dos pasos"); return; }
    const { error } = await adminDb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo.trim() });
    setBusy(false);
    if (error) { toast.error("El código no es correcto"); setCodigo(""); return; }
    onListo();
  };
  return (
    <Marco titulo="Verificación en dos pasos" detalle="Ingresá el código de 6 dígitos de tu app de autenticación.">
      <form onSubmit={verificar} className="space-y-4">
        <Input aria-label="Código de 6 dígitos" autoFocus inputMode="numeric" maxLength={6} value={codigo} onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ""))} placeholder="123456" className="h-12 text-center font-mono text-xl tracking-[0.4em]" autoComplete="one-time-code" />
        <Button type="submit" className="h-11 w-full rounded-full font-bold" disabled={busy || codigo.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Verificar</Button>
      </form>
    </Marco>
  );
}

// ------------------------------------------------------------------ tablero
function Tablero() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Tabs defaultValue="negocio">
        <TabsList className="mb-5 grid h-auto w-full max-w-xl grid-cols-4 rounded-2xl p-1">
          <TabsTrigger value="negocio" className="rounded-xl py-2 font-bold">Negocio</TabsTrigger>
          <TabsTrigger value="resumen" className="rounded-xl py-2 font-bold">Resumen</TabsTrigger>
          <TabsTrigger value="auditoria" className="rounded-xl py-2 font-bold">Auditoría</TabsTrigger>
          <TabsTrigger value="errores" className="rounded-xl py-2 font-bold">Errores</TabsTrigger>
        </TabsList>
        <TabsContent value="negocio"><BusinessMetrics /></TabsContent>
        <TabsContent value="resumen"><Resumen /></TabsContent>
        <TabsContent value="auditoria"><Auditoria /></TabsContent>
        <TabsContent value="errores"><Errores /></TabsContent>
      </Tabs>
    </main>
  );
}

function Resumen() {
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [cadena, setCadena] = useState<{ total: number; rotos: number; primer_roto: number | null } | null>(null);
  const [verificando, setVerificando] = useState(false);
  useEffect(() => { adminDb.rpc("resumen").then(({ data }) => setDatos((data as ResumenAdmin) ?? null)); }, []);

  const verificar = async () => {
    setVerificando(true);
    const { data, error } = await adminDb.rpc("verificar_cadena");
    setVerificando(false);
    if (error) { toast.error(error.message); return; }
    const fila = (Array.isArray(data) ? data[0] : data) as { total: number; rotos: number; primer_roto: number | null } | undefined;
    setCadena(fila ?? { total: 0, rotos: 0, primer_roto: null });
  };

  if (!datos) return <div className="h-40 animate-pulse rounded-3xl bg-card" />;
  const tarjetas = [
    { titulo: "Registros de auditoría", valor: datos.auditoria_total.toLocaleString("es-AR"), nota: `Último recibido ${hace(datos.ultimo_evento_recibido)}` },
    { titulo: "Errores en 24 h", valor: datos.errores_24h.toLocaleString("es-AR"), nota: `${datos.errores_total.toLocaleString("es-AR")} en total` },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {tarjetas.map((item) => (
          <div key={item.titulo} className="rounded-3xl border border-l-4 border-l-brand-orange bg-card p-5"><p className="text-sm font-semibold text-muted-foreground">{item.titulo}</p><p className="mt-1 font-display text-4xl font-extrabold tabular-nums">{item.valor}</p><p className="mt-1 text-xs text-muted-foreground">{item.nota}</p></div>
        ))}
      </div>
      <section className="rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="h-5 w-5" />Integridad de la auditoría</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Cada registro está encadenado al anterior con una huella (hash). Si alguien altera o borra uno, la cadena se rompe y se detecta acá.</p></div>
          <Button type="button" className="rounded-full font-bold" onClick={verificar} disabled={verificando}>{verificando && <Loader2 className="h-4 w-4 animate-spin" />}Verificar ahora</Button>
        </div>
        {cadena && (
          <p className={cn("mt-4 flex items-start gap-2 rounded-2xl p-4 text-sm font-semibold", cadena.rotos === 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")} role="status">
            {cadena.rotos === 0 ? <><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Los {cadena.total.toLocaleString("es-AR")} registros están íntegros: nada fue alterado ni borrado.</> : <><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{cadena.rotos} registros no coinciden con su huella (el primero es el n.º {cadena.primer_roto}). Hubo una alteración: investigá de inmediato.</>}
          </p>
        )}
      </section>
    </div>
  );
}

const PAGINA = 50;
function Auditoria() {
  const [filas, setFilas] = useState<EventoAuditoria[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [accion, setAccion] = useState("");
  const [entidad, setEntidad] = useState("");
  const [abierta, setAbierta] = useState<number | null>(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setFilas(null);
    let consulta = adminDb.from("auditoria_eventos").select("*").order("id", { ascending: false }).range(pagina * PAGINA, pagina * PAGINA + PAGINA);
    if (accion.trim()) consulta = consulta.ilike("accion", `%${accion.trim().replace(/[%_]/g, "")}%`);
    if (entidad.trim()) consulta = consulta.ilike("entidad", `%${entidad.trim().replace(/[%_]/g, "")}%`);
    consulta.then(({ data, error }) => {
      if (!vivo) return;
      if (error) { toast.error(error.message); setFilas([]); return; }
      const lista = (data ?? []) as EventoAuditoria[];
      setHayMas(lista.length > PAGINA);
      setFilas(lista.slice(0, PAGINA));
    });
    return () => { vivo = false; };
  }, [pagina, accion, entidad]);

  const cambios = (detalle: Record<string, unknown>) => Object.entries(detalle).map(([campo, valor]) => {
    const v = valor as { de?: unknown; a?: unknown };
    return v && typeof v === "object" && ("de" in v || "a" in v) ? `${campo}: ${JSON.stringify(v.de)} → ${JSON.stringify(v.a)}` : `${campo}: ${JSON.stringify(valor)}`;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Filtrar por acción" placeholder="Acción (ej.: comercios.cambiar)" value={accion} onChange={(event) => { setPagina(0); setAccion(event.target.value); }} className="max-w-xs bg-card" />
        <Input aria-label="Filtrar por entidad" placeholder="Entidad (ej.: delivery_pedidos)" value={entidad} onChange={(event) => { setPagina(0); setEntidad(event.target.value); }} className="max-w-xs bg-card" />
      </div>
      <div className="overflow-x-auto rounded-3xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Entidad</th><th className="px-4 py-3">Quién</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {filas === null && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {filas?.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><ScrollText className="mx-auto mb-2 h-6 w-6" />No hay registros con esos filtros.</td></tr>}
            {filas?.map((fila) => (
              <Fragment key={fila.id}>
                <tr className="border-b last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{cuando(fila.ocurrio_at)}</td>
                  <td className="px-4 py-3 font-semibold">{fila.accion}</td>
                  <td className="px-4 py-3"><span className="text-muted-foreground">{fila.entidad}</span>{fila.entidad_id && <span className="ml-1 font-mono text-xs">{fila.entidad_id.slice(0, 8)}</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fila.actor_id ? fila.actor_id.slice(0, 8) : "sistema"}</td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={() => setAbierta(abierta === fila.id ? null : fila.id)} className="text-xs font-bold underline-offset-4 hover:underline" aria-expanded={abierta === fila.id}>{abierta === fila.id ? "Ocultar" : "Ver detalle"}</button></td>
                </tr>
                {abierta === fila.id && (
                  <tr key={`${fila.id}-d`} className="border-b bg-muted/30">
                    <td colSpan={5} className="px-4 py-3">
                      <ul className="space-y-1 font-mono text-xs">{cambios(fila.detalle).map((linea) => <li key={linea}>{linea}</li>)}</ul>
                      <p className="mt-2 text-[11px] text-muted-foreground">N.º {fila.id} · recibido {cuando(fila.recibido_at)} · huella <span className="font-mono">{fila.hash.slice(0, 16)}…</span>{fila.actor_id && <> · actor <span className="font-mono">{fila.actor_id}</span></>}</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" className="rounded-full" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anteriores</Button>
        <span className="text-sm text-muted-foreground">Página {pagina + 1}</span>
        <Button type="button" variant="outline" className="rounded-full" disabled={!hayMas} onClick={() => setPagina((p) => p + 1)}>Siguientes</Button>
      </div>
    </div>
  );
}

function Errores() {
  const [filas, setFilas] = useState<ErrorApp[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  useEffect(() => {
    adminDb.from("errores_app").select("*").order("id", { ascending: false }).limit(500).then(({ data, error }) => {
      if (error) { toast.error(error.message); setFilas([]); return; }
      setFilas((data ?? []) as ErrorApp[]);
    });
  }, []);
  const grupos = useMemo(() => {
    const mapa = new Map<string, { huella: string; cantidad: number; ultimo: ErrorApp }>();
    for (const fila of filas ?? []) {
      const actual = mapa.get(fila.huella);
      if (actual) actual.cantidad += 1; else mapa.set(fila.huella, { huella: fila.huella, cantidad: 1, ultimo: fila });
    }
    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  }, [filas]);

  if (filas === null) return <div className="h-40 animate-pulse rounded-3xl bg-card" />;
  if (!grupos.length) return <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground"><Bug className="mx-auto mb-2 h-6 w-6" />No hay errores registrados. Todo en orden.</div>;
  return (
    <ul className="space-y-3">
      {grupos.map((grupo) => (
        <li key={grupo.huella} className="rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-extrabold text-destructive">{grupo.cantidad}×</span>
            <div className="min-w-0 flex-1"><p className="break-words font-semibold">{grupo.ultimo.mensaje}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{grupo.ultimo.url ?? "sin dirección"} · último {cuando(grupo.ultimo.ocurrio_at)}</p></div>
            {grupo.ultimo.stack && <button type="button" onClick={() => setAbierto(abierto === grupo.huella ? null : grupo.huella)} className="shrink-0 text-xs font-bold underline-offset-4 hover:underline" aria-expanded={abierto === grupo.huella}>{abierto === grupo.huella ? "Ocultar" : "Detalle"}</button>}
          </div>
          {abierto === grupo.huella && grupo.ultimo.stack && <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-muted p-3 text-xs">{grupo.ultimo.stack}</pre>}
        </li>
      ))}
    </ul>
  );
}
