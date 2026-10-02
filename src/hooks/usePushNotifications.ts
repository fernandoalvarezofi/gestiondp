import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";

// Clave pública VAPID (es pública por diseño; la privada vive solo en el servidor).
const VAPID_PUBLIC_KEY = "BAmt7pfioZ9nLUDS9yh-lH9miRbydOEIgNN5bl0Rsg5aY6uxUknpeapsmoJ5GKpOsMC46pbu4wTndDM_1gHmW78";

function toUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on" | "loading";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Estado y alta/baja de las notificaciones push en este dispositivo. */
export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("loading");

  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const refresh = useCallback(async () => {
    if (!supported) { setState(isIos() && !isStandalone() ? "ios-install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setState(subscription && Notification.permission === "granted" ? "on" : "off");
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    if (!user || !supported) return { ok: false, message: "Este navegador no permite notificaciones" };
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { await refresh(); return { ok: false, message: "Para recibir avisos, permití las notificaciones del sitio" }; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY) });
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await db.rpc("delivery_guardar_suscripcion", { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth, p_dispositivo: navigator.userAgent.slice(0, 120) });
      if (error) throw error;
      setState("on");
      return { ok: true, message: "¡Listo! Te vamos a avisar en este dispositivo" };
    } catch (error) {
      await refresh();
      return { ok: false, message: errorMessage(error, "No pudimos activar las notificaciones") };
    }
  }, [user, supported, refresh]);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await db.from("delivery_push_suscripciones").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
  }, []);

  return { state, enable, disable };
}
