import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/**
 * true cuando la web corre dentro de la app instalada (Android), no en el navegador.
 * Se lee del objeto que inyecta Capacitor antes de cargar la web: así la versión web no descarga
 * el código de Capacitor solo para preguntar esto.
 */
export const isNativeApp = () => {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
};

export type NativeWatch = { stop: () => void };

/**
 * Sigue la ubicación también con la pantalla apagada (Android muestra una notificación fija mientras dura).
 * `onError` recibe "denied" si el permiso fue rechazado. Capacitor se carga recién acá (solo en la app instalada).
 */
export async function watchNativeLocation(onPoint: (lat: number, lng: number) => void, onError: (reason: "denied" | "other") => void): Promise<NativeWatch> {
  const { registerPlugin } = await import("@capacitor/core");
  const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
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
