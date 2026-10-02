// Aviso sonoro para el panel del comercio (sin archivos de audio: se genera con Web Audio).
// Los navegadores solo dejan reproducir sonido después de un toque de la persona, por eso hay un paso de "activar".

let context: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  return context;
}

/** Habilita el sonido (tiene que llamarse desde un clic o toque). Devuelve si quedó activo. */
export async function unlockAlarm() {
  const ctx = getContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === "running";
}

export const alarmReady = () => context?.state === "running";

/** Dos tonos cortos y claros, como el aviso de pedido nuevo de las apps de comercios. */
export function playChime() {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  [880, 1175].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const at = start + index * 0.22;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.42);
  });
}
