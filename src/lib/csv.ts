/** Convierte una tabla en CSV (con BOM para que Excel lo abra bien en español). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    // Una celda que empieza con = + - @ puede ejecutarse como fórmula en Excel: se neutraliza.
    if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
