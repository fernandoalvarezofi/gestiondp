import { Component, ErrorInfo, ReactNode } from "react";
import { reportError } from "@/lib/monitor";

/** Si una pantalla falla al dibujarse, en vez de dejar todo en blanco se muestra un aviso con salida y se informa el error. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `Pantalla (${info.componentStack?.split("\n")[1]?.trim() ?? "?"})`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl" aria-hidden>🛵</span>
        <h1 className="mt-5 text-2xl font-extrabold">Algo salió mal</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">Ya avisamos al equipo. Probá recargar la pantalla; si el problema sigue, volvé al inicio. Tus pedidos y tu carrito están a salvo.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground">Recargar</button>
          <a href="/app" className="flex h-11 items-center rounded-full border px-6 font-bold">Ir al inicio</a>
        </div>
      </div>
    );
  }
}
