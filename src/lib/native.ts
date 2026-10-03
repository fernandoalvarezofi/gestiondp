import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** true cuando la web corre dentro de la app instalada (Android), no en el navegador. */
export const isNativeApp = () => Capacitor.isNativePlatform();

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type NativeWatch = { stop: () => void };

/**
 * Sigue la ubicación también con la pantalla apagada (Android muestra una notificación fija mientras dura).
 * `onError` recibe "denied" si el permiso fue rechazado.
 */
export async function watchNativeLocation(onPoint: (lat: number, lng: number) => void, onError: (reason: "denied" | "other") => void): Promise<NativeWatch> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: "Woref Repartidor",
      backgroundMessage: "Compartiendo tu ubicación con el cliente mientras entregás.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 10,
    },
    (location, error) => {
      if (error) { onError(error.code === "NOT_AUTHORIZED" ? "denied" : "other"); return; }
      if (location) onPoint(location.latitude, location.longitude);
    },
  );
  return { stop: () => { BackgroundGeolocation.removeWatcher({ id }); } };
}
