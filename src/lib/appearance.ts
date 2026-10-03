export type TextSize = "normal" | "large" | "xlarge";
export type Appearance = { textSize: TextSize; reduceMotion: boolean };

const KEY = "woref-apariencia";
export const textSizeLabel: Record<TextSize, string> = { normal: "Normal", large: "Grande", xlarge: "Muy grande" };

const defaults: Appearance = { textSize: "normal", reduceMotion: false };

export function readAppearance(): Appearance {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<Appearance>;
    return { textSize: raw.textSize && raw.textSize in textSizeLabel ? raw.textSize : "normal", reduceMotion: raw.reduceMotion === true };
  } catch {
    return defaults;
  }
}

/** Aplica el tamaño de texto y la reducción de animaciones a toda la app (con rem, todo escala junto). */
export function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  if (value.textSize === "normal") root.removeAttribute("data-textsize"); else root.setAttribute("data-textsize", value.textSize);
  root.classList.toggle("reduce-motion", value.reduceMotion);
}

export function saveAppearance(value: Appearance) {
  try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* sin almacenamiento: se aplica solo en esta sesión */ }
  applyAppearance(value);
}
