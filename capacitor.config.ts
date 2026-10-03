import type { CapacitorConfig } from "@capacitor/cli";

// App Android del repartidor. El identificador (appId) no se puede cambiar una vez publicada en Google Play.
const config: CapacitorConfig = {
  appId: "app.woref.repartidor",
  appName: "Woref Repartidor",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false },
};

export default config;
