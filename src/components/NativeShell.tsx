import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { isNativeApp } from "@/lib/native";

/** Botón "atrás" de Android: vuelve a la pantalla anterior y, si no hay otra, cierra la app. */
export function NativeShell() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    // Si el plugin nativo no responde, la app sigue funcionando (solo sin el manejo del botón atrás).
    const handle = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) navigate(-1);
      else CapacitorApp.exitApp().catch(() => undefined);
    }).catch(() => null);
    return () => { handle.then((listener) => listener?.remove()).catch(() => undefined); };
  }, [navigate]);
  return null;
}
