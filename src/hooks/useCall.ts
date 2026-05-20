import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export type LlamadaEstado = "idle" | "sonando" | "conectando" | "activa" | "finalizada" | "rechazada";

export interface Llamada {
  id: string;
  caller_id: string;
  callee_id: string;
  tipo: "audio" | "video";
  estado: string;
  iniciada_at: string;
  contestada_at?: string | null;
}

interface UseCallState {
  llamada: Llamada | null;
  estado: LlamadaEstado;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  iniciarLlamada: (calleeId: string, tipo: "audio" | "video") => Promise<void>;
  contestar: () => Promise<void>;
  rechazar: () => Promise<void>;
  colgar: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  muted: boolean;
  cameraOff: boolean;
}

// Hook global de llamadas. Escucha llamadas entrantes, gestiona WebRTC P2P via Supabase Realtime.
export function useCall(): UseCallState {
  const { user } = useAuth();
  const [llamada, setLlamada] = useState<Llamada | null>(null);
  const [estado, setEstado] = useState<LlamadaEstado>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const llamadaRef = useRef<Llamada | null>(null);
  const pendientesICE = useRef<RTCIceCandidate[]>([]);
  const remoteDescriptionSet = useRef(false);

  llamadaRef.current = llamada;

  const limpiar = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
    remoteDescriptionSet.current = false;
    pendientesICE.current = [];
  }, [localStream]);

  const crearPeerConnection = useCallback((llamadaId: string, otherId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (e) => e.streams[0].getTracks().forEach((t) => remote.addTrack(t));
    pc.onicecandidate = (e) => {
      if (e.candidate && user) {
        (supabase as any).from("senales_webrtc").insert({
          llamada_id: llamadaId,
          emisor_id: user.id,
          receptor_id: otherId,
          tipo: "ice",
          payload: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setEstado("activa");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        toast.error("Conexión perdida");
        colgar();
      }
    };
    pcRef.current = pc;
    return pc;
  }, [user]);

  const obtenerMedia = useCallback(async (tipo: "audio" | "video") => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: tipo === "video" ? { facingMode: "user", width: 640, height: 480 } : false,
    });
    setLocalStream(stream);
    return stream;
  }, []);

  // Iniciar llamada saliente
  const iniciarLlamada = useCallback(async (calleeId: string, tipo: "audio" | "video") => {
    if (!user) return;
    try {
      setEstado("sonando");
      const stream = await obtenerMedia(tipo);
      const { data: llamadaId, error } = await (supabase as any).rpc("iniciar_llamada", { p_callee_id: calleeId, p_tipo: tipo });
      if (error) throw error;
      const { data: ll } = await (supabase as any).from("llamadas").select("*").eq("id", llamadaId).single();
      setLlamada(ll);
      const pc = crearPeerConnection(llamadaId, calleeId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await (supabase as any).from("senales_webrtc").insert({
        llamada_id: llamadaId, emisor_id: user.id, receptor_id: calleeId,
        tipo: "offer", payload: { sdp: offer.sdp, type: offer.type },
      });
    } catch (e: any) {
      toast.error(e.message || "No se pudo iniciar la llamada");
      setEstado("idle");
      limpiar();
    }
  }, [user, obtenerMedia, crearPeerConnection, limpiar]);

  // Contestar llamada entrante
  const contestar = useCallback(async () => {
    if (!user || !llamadaRef.current) return;
    const ll = llamadaRef.current;
    try {
      setEstado("conectando");
      const stream = await obtenerMedia(ll.tipo);
      const pc = crearPeerConnection(ll.id, ll.caller_id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Buscar offer pendiente
      const { data: senales } = await (supabase as any).from("senales_webrtc")
        .select("*").eq("llamada_id", ll.id).eq("tipo", "offer").order("created_at", { ascending: false }).limit(1);
      if (senales?.[0]) {
        await pc.setRemoteDescription(new RTCSessionDescription(senales[0].payload));
        remoteDescriptionSet.current = true;
        // aplicar ICE pendientes
        for (const c of pendientesICE.current) await pc.addIceCandidate(c);
        pendientesICE.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await (supabase as any).from("senales_webrtc").insert({
          llamada_id: ll.id, emisor_id: user.id, receptor_id: ll.caller_id,
          tipo: "answer", payload: { sdp: answer.sdp, type: answer.type },
        });
      }
      await (supabase as any).from("llamadas").update({ estado: "activa", contestada_at: new Date().toISOString() }).eq("id", ll.id);
    } catch (e: any) {
      toast.error(e.message || "No se pudo contestar");
      colgar();
    }
  }, [user, obtenerMedia, crearPeerConnection]);

  const rechazar = useCallback(async () => {
    if (!llamadaRef.current) return;
    await (supabase as any).from("llamadas").update({ estado: "rechazada", finalizada_at: new Date().toISOString() }).eq("id", llamadaRef.current.id);
    setEstado("rechazada");
    setLlamada(null);
    limpiar();
  }, [limpiar]);

  const colgar = useCallback(async () => {
    if (llamadaRef.current) {
      const inicio = new Date(llamadaRef.current.contestada_at || llamadaRef.current.iniciada_at).getTime();
      const duracion = Math.floor((Date.now() - inicio) / 1000);
      await (supabase as any).from("llamadas")
        .update({ estado: "finalizada", finalizada_at: new Date().toISOString(), duracion })
        .eq("id", llamadaRef.current.id);
    }
    setEstado("finalizada");
    setLlamada(null);
    limpiar();
    setTimeout(() => setEstado("idle"), 500);
  }, [limpiar]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMuted((m) => !m);
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCameraOff((c) => !c);
  }, [localStream]);

  // Escuchar llamadas entrantes y señales
  useEffect(() => {
    if (!user) return;
    const ch = (supabase as any).channel(`calls-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "llamadas", filter: `callee_id=eq.${user.id}` },
        (p: any) => {
          if (llamadaRef.current) return; // ocupado
          setLlamada(p.new);
          setEstado("sonando");
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "llamadas" },
        (p: any) => {
          const ll = llamadaRef.current;
          if (!ll || p.new.id !== ll.id) return;
          if (["finalizada", "rechazada"].includes(p.new.estado) && estado !== "idle") {
            toast.info(p.new.estado === "rechazada" ? "Llamada rechazada" : "Llamada finalizada");
            setLlamada(null);
            limpiar();
            setEstado("idle");
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "senales_webrtc", filter: `receptor_id=eq.${user.id}` },
        async (p: any) => {
          const ll = llamadaRef.current;
          const pc = pcRef.current;
          if (!ll || !pc || p.new.llamada_id !== ll.id) return;
          try {
            if (p.new.tipo === "answer" && !remoteDescriptionSet.current) {
              await pc.setRemoteDescription(new RTCSessionDescription(p.new.payload));
              remoteDescriptionSet.current = true;
              for (const c of pendientesICE.current) await pc.addIceCandidate(c);
              pendientesICE.current = [];
            } else if (p.new.tipo === "ice") {
              const cand = new RTCIceCandidate(p.new.payload);
              if (remoteDescriptionSet.current) await pc.addIceCandidate(cand);
              else pendientesICE.current.push(cand);
            }
          } catch (e) { /* ignorar candidatos viejos */ }
        })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user, limpiar, estado]);

  return { llamada, estado, localStream, remoteStream, iniciarLlamada, contestar, rechazar, colgar, toggleMute, toggleCamera, muted, cameraOff };
}
