import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, Ban, Check, CheckCheck, ExternalLink, Flag, ImagePlus, Loader2, MapPin, MoreVertical, SendHorizontal, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { estadoCorto, errorMessage, type EstadoPedido } from "@/lib/delivery";
import { envioEstadoLabel, type EnvioEstado } from "@/lib/envios";
import { viajeEstadoLabel, type ViajeEstado } from "@/lib/remis";
import { cn } from "@/lib/utils";
import { db } from "@/lib/delivery";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import {
  archivarHilo, bloquearConsulta, enviarMensaje, fetchHiloInfo, fetchMensajes, linkUbicacion, marcarLeido, MAX_MENSAJE, reportarMensaje,
  respuestasRapidas, subirFoto, urlFoto, type HiloInfo, type Mensaje,
} from "@/services/messaging";

const hora = (v: string) => new Date(v).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dia = (v: string) => new Date(v).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

/** Estado legible del contexto (pedido, envío o viaje). */
export function estadoContexto(contexto: string, estado: string | null) {
  if (!estado) return null;
  if (contexto === "pedido") return estadoCorto[estado as EstadoPedido] ?? estado;
  if (contexto === "envio") return envioEstadoLabel[estado as EnvioEstado] ?? estado;
  if (contexto === "viaje") return viajeEstadoLabel[estado as ViajeEstado] ?? estado;
  return null;
}

function FotoMensaje({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let active = true; urlFoto(path).then((u) => { if (active) setUrl(u); }); return () => { active = false; }; }, [path]);
  if (!url) return <div className="h-40 w-52 animate-pulse rounded-xl bg-black/10" />;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto enviada en la conversación" className="max-h-64 max-w-[220px] rounded-xl object-cover" /></a>;
}

/**
 * Conversación de cualquier contexto de Woref (pedido, viaje, envío o consulta).
 * Tiempo real para mensajes y lecturas, "escribiendo…", respuestas rápidas, ubicación, fotos y reportes.
 */
export function ChatThread({ hiloId, onActivity, showHeader = true, className }: { hiloId: string; onActivity?: () => void; showHeader?: boolean; className?: string }) {
  const [info, setInfo] = useState<HiloInfo | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [otroLeido, setOtroLeido] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const fotoInput = useRef<HTMLInputElement>(null);
  const canal = useRef<ReturnType<typeof db.channel> | null>(null);
  const ultimoAviso = useRef(0);
  const escribiendoTimer = useRef<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [i, pagina] = await Promise.all([fetchHiloInfo(hiloId), fetchMensajes(hiloId)]);
      setInfo(i); setMensajes(pagina.mensajes); setOtroLeido(pagina.otro_leido_at); setHayMas(pagina.mensajes.length >= 60);
      if (i.rol !== "admin") { await marcarLeido(hiloId); onActivity?.(); }
    } catch (error) { toast.error(errorMessage(error)); setMensajes((cur) => cur ?? []); }
  }, [hiloId, onActivity]);

  useEffect(() => {
    setInfo(null); setMensajes(null); setEscribiendo(false);
    cargar();
    const ch = db.channel(`hilo-${hiloId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "msg_mensajes", filter: `hilo_id=eq.${hiloId}` }, () => { setEscribiendo(false); cargar(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "msg_lecturas", filter: `hilo_id=eq.${hiloId}` }, () => {
        fetchMensajes(hiloId).then((p) => setOtroLeido(p.otro_leido_at)).catch(() => undefined);
      })
      .subscribe();
    // "Escribiendo…": aviso efímero entre las partes (no se guarda).
    const typing = db.channel(`escribiendo-${hiloId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "escribiendo" }, () => {
        setEscribiendo(true);
        if (escribiendoTimer.current) window.clearTimeout(escribiendoTimer.current);
        escribiendoTimer.current = window.setTimeout(() => setEscribiendo(false), 4000);
      })
      .subscribe();
    canal.current = typing;
    // Respaldo por si se corta el tiempo real.
    const timer = window.setInterval(cargar, 30000);
    return () => { db.removeChannel(ch); db.removeChannel(typing); window.clearInterval(timer); canal.current = null; };
  }, [hiloId, cargar]);

  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes?.length, escribiendo]);

  const avisarEscribiendo = () => {
    if (Date.now() - ultimoAviso.current < 2500 || !canal.current) return;
    ultimoAviso.current = Date.now();
    canal.current.send({ type: "broadcast", event: "escribiendo", payload: {} });
  };

  const mandar = async (mensaje: Parameters<typeof enviarMensaje>[1]) => {
    setEnviando(true);
    try { await enviarMensaje(hiloId, mensaje); await cargar(); return true; }
    catch (error) { toast.error(errorMessage(error)); return false; }
    finally { setEnviando(false); }
  };
  const enviarTexto = async (e: FormEvent) => {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor || enviando) return;
    // Se limpia al instante (como en cualquier chat); si falla, el texto vuelve a la caja.
    setTexto("");
    if (!(await mandar({ tipo: "texto", texto: valor }))) setTexto(valor);
  };
  const compartirUbicacion = () => {
    if (!navigator.geolocation) { toast.error("Tu dispositivo no permite compartir la ubicación"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { mandar({ tipo: "ubicacion", lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); },
      () => toast.error("No pudimos obtener tu ubicación. Revisá el permiso del navegador."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const elegirFoto = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try { const path = await subirFoto(hiloId, file); await enviarMensaje(hiloId, { tipo: "foto", foto: path }); await cargar(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setEnviando(false); if (fotoInput.current) fotoInput.current.value = ""; }
  };
  const cargarAnteriores = async () => {
    if (!mensajes?.length) return;
    try { const p = await fetchMensajes(hiloId, mensajes[0].id); setMensajes([...p.mensajes, ...mensajes]); setHayMas(p.mensajes.length >= 60); }
    catch (error) { toast.error(errorMessage(error)); }
  };
  const reportar = async (m: Mensaje) => {
    const motivo = await pedirTexto({ titulo: "Reportar mensaje", descripcion: "Lo revisa el equipo de Woref. La otra persona no se entera de que lo reportaste.", etiqueta: "¿Qué pasó?", inicial: "Mensaje ofensivo", multilinea: true, maximo: 300, confirmar: "Reportar" });
    if (!motivo) return;
    try { await reportarMensaje(m.id, motivo); toast.success("Gracias. Lo vamos a revisar."); } catch (error) { toast.error(errorMessage(error)); }
  };
  const archivar = async (valor: boolean) => {
    try { await archivarHilo(hiloId, valor); toast.success(valor ? "Conversación archivada" : "Conversación recuperada"); onActivity?.(); } catch (error) { toast.error(errorMessage(error)); }
  };
  const bloquear = async () => {
    if (!info) return;
    if (!info.bloqueado && !(await confirmar({ titulo: "¿Bloquear a esta persona?", descripcion: "No va a poder escribirle más consultas a tu local. Podés desbloquearla después.", confirmar: "Bloquear", peligro: true }))) return;
    try { await bloquearConsulta(hiloId, !info.bloqueado); toast.success(info.bloqueado ? "Desbloqueado" : "Bloqueado"); cargar(); } catch (error) { toast.error(errorMessage(error)); }
  };

  const rapidas = info ? respuestasRapidas(info.rol, info.canal) : [];
  const estado = info ? estadoContexto(info.contexto, info.estado) : null;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {showHeader && info && (
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold leading-tight">{info.titulo}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {info.subtitulo}{estado && <span className="rounded-full bg-primary/10 px-1.5 py-px font-bold text-primary">{estado}</span>}
            </p>
          </div>
          {info.url && <Button asChild variant="ghost" size="sm" className="rounded-full text-xs font-bold"><Link to={info.url}>Ver<ExternalLink className="h-3.5 w-3.5" /></Link></Button>}
          {info.rol !== "admin" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Opciones de la conversación"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => archivar(true)}><Archive className="h-4 w-4" />Archivar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => archivar(false)}><ArchiveRestore className="h-4 w-4" />Sacar de archivadas</DropdownMenuItem>
                {info.contexto === "consulta" && info.rol === "comercio" && <DropdownMenuItem onClick={bloquear} className="text-destructive"><Ban className="h-4 w-4" />{info.bloqueado ? "Desbloquear" : "Bloquear consultas"}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/40 p-3 sm:p-4" aria-live="polite">
        {!mensajes && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {hayMas && <div className="flex justify-center pb-2"><Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={cargarAnteriores}>Ver mensajes anteriores</Button></div>}
        {mensajes && mensajes.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay mensajes. Escribí el primero.</p>}
        {mensajes?.map((m, i) => {
          const nuevoDia = i === 0 || new Date(mensajes[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString();
          const leido = m.mio && otroLeido != null && new Date(otroLeido) >= new Date(m.created_at);
          return (
            <div key={m.id}>
              {nuevoDia && <p className="py-2 text-center text-[11px] font-bold capitalize text-muted-foreground">{dia(m.created_at)}</p>}
              <div className={cn("group flex items-end gap-1", m.mio ? "justify-end" : "justify-start")}>
                {!m.mio && info?.rol !== "admin" && !m.oculto && (
                  <button type="button" onClick={() => reportar(m)} className="order-2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100" aria-label="Reportar mensaje" title="Reportar"><Flag className="h-3.5 w-3.5" /></button>
                )}
                <div className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm", m.mio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card", m.tipo === "rapido" && !m.mio && "border border-primary/20")}>
                  {m.oculto ? <p className="flex items-center gap-1.5 italic opacity-80"><ShieldAlert className="h-3.5 w-3.5" />Mensaje ocultado por moderación</p>
                    : m.tipo === "ubicacion" && m.lat != null && m.lng != null ? (
                      <a href={linkUbicacion(m.lat, m.lng)} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold underline-offset-2 hover:underline"><MapPin className="h-4 w-4 shrink-0" />Ubicación compartida · abrir en el mapa</a>
                    ) : m.tipo === "foto" && m.foto_path ? <FotoMensaje path={m.foto_path} />
                    : <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                  <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", m.mio ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {hora(m.created_at)}
                    {m.mio && (leido ? <CheckCheck className="h-3.5 w-3.5" aria-label="Leído" /> : <Check className="h-3.5 w-3.5" aria-label="Enviado" />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {escribiendo && <p className="px-1 text-xs font-semibold text-muted-foreground" role="status">Escribiendo…</p>}
        <div ref={fin} />
      </div>

      {info && !info.puede_escribir ? (
        <p className="border-t bg-card p-3 text-center text-xs font-semibold text-muted-foreground">{info.motivo_cerrado}</p>
      ) : info && (
        <div className="border-t bg-card">
          {rapidas.length > 0 && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 pt-2.5" aria-label="Respuestas rápidas">
              {rapidas.map((r) => (
                <button key={r} type="button" disabled={enviando} onClick={() => mandar({ tipo: "rapido", texto: r })} className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{r}</button>
              ))}
            </div>
          )}
          <form onSubmit={enviarTexto} className="flex items-center gap-1.5 p-3">
            <input ref={fotoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => fotoInput.current?.click()} disabled={enviando} aria-label="Enviar una foto" title="Foto"><ImagePlus className="h-5 w-5" /></Button>
            {info.contexto !== "consulta" && <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={compartirUbicacion} disabled={enviando} aria-label="Compartir mi ubicación" title="Ubicación"><MapPin className="h-5 w-5" /></Button>}
            <input value={texto} onChange={(e) => { setTexto(e.target.value); avisarEscribiendo(); }} maxLength={MAX_MENSAJE} placeholder="Escribí un mensaje…" aria-label="Mensaje"
              className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-primary" />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={enviando || !texto.trim()} aria-label="Enviar">{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}</Button>
          </form>
          <p className="px-3 pb-2 text-center text-[10.5px] text-muted-foreground">Tus datos de contacto no se comparten: todo pasa por Woref.</p>
        </div>
      )}
    </div>
  );
}
