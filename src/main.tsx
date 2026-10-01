import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: never register service worker inside Lovable preview iframes
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovableproject-dev.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
}

// Cuando se publica una versión nueva, la app instalada se recarga una vez para mostrarla.
if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  // En la primera visita no hay versión anterior: no hace falta recargar.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
