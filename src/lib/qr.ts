import qrcode from "qrcode-generator";

/**
 * Código QR como SVG (sin imágenes externas ni servicios de terceros: el enlace de la tienda no sale de la app).
 * Nivel de corrección "Q" (25 %) para que siga leyéndose aunque el cartel se ensucie o se arrugue.
 */
export function qrSvg(text: string, { margin = 4, dark = "#000000", light = "#FFFFFF" }: { margin?: number; dark?: string; light?: string } = {}): string {
  const qr = qrcode(0, "Q");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const size = count + margin * 2;
  // Un solo trazado: por fila, se unen los módulos oscuros consecutivos.
  let path = "";
  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let col = 0; col <= count; col += 1) {
      const filled = col < count && qr.isDark(row, col);
      if (filled && start < 0) start = col;
      if (!filled && start >= 0) {
        path += `M${start + margin} ${row + margin}h${col - start}v1h-${col - start}z`;
        start = -1;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
