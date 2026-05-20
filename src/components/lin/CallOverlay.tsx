import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming } from "lucide-react";
import { useCallCtx } from "@/contexts/CallContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/worefHelpers";
import { useAuth } from "@/contexts/AuthContext";

export function CallOverlay() {
  const { user } = useAuth();
  const { llamada, estado, localStream, remoteStream, contestar, rechazar, colgar, toggleMute, toggleCamera, muted, cameraOff } = useCallCtx();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [otro, setOtro] = useState<any>(null);
  const [duracion, setDuracion] = useState(0);

  useEffect(() => {
    if (!llamada || !user) { setOtro(null); return; }
    const otroId = llamada.caller_id === user.id ? llamada.callee_id : llamada.caller_id;
    (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").eq("id", otroId).maybeSingle()
      .then(({ data }: any) => setOtro(data));
  }, [llamada, user]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (estado !== "activa") { setDuracion(0); return; }
    const inicio = Date.now();
    const t = setInterval(() => setDuracion(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(t);
  }, [estado]);

  if (!llamada || estado === "idle") return null;

  const esEntrante = user && llamada.callee_id === user.id && estado === "sonando";
  const esVideo = llamada.tipo === "video";
  const dur = `${Math.floor(duracion / 60).toString().padStart(2, "0")}:${(duracion % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-6 text-white">
      <audio ref={remoteAudioRef} autoPlay />

      {/* Vista remota */}
      {esVideo && estado === "activa" ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Avatar className="h-32 w-32 ring-4 ring-white/10">
            <AvatarImage src={otro?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-3xl">{initials(otro?.nombre)}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-semibold">{otro?.nombre || "Cargando…"}</h2>
            <p className="text-sm text-white/60">
              {estado === "sonando" && esEntrante && <><PhoneIncoming className="inline h-4 w-4" /> Llamada entrante {esVideo ? "de video" : ""}</>}
              {estado === "sonando" && !esEntrante && "Llamando…"}
              {estado === "conectando" && "Conectando…"}
              {estado === "activa" && dur}
            </p>
          </div>
        </div>
      )}

      {/* Local preview en esquina */}
      {esVideo && localStream && estado === "activa" && (
        <div className="absolute right-4 top-4 z-10 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* Controles */}
      <div className="z-10 flex w-full max-w-md items-center justify-center gap-6 pb-4">
        {esEntrante ? (
          <>
            <button onClick={rechazar} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-xl transition-transform hover:scale-105 active:scale-95">
              <PhoneOff className="h-7 w-7" />
            </button>
            <button onClick={contestar} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-xl transition-transform hover:scale-105 active:scale-95">
              <Phone className="h-7 w-7" />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute} className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition ${muted ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`}>
              {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            {esVideo && (
              <button onClick={toggleCamera} className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition ${cameraOff ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`}>
                {cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </button>
            )}
            <button onClick={colgar} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-xl transition-transform hover:scale-105 active:scale-95">
              <PhoneOff className="h-7 w-7" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
