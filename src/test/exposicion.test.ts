import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guardas de código para que no vuelva la exposición de datos cerrada en la Fase 0 (ver ARCHITECTURE.md T1/T2).
// Las pruebas contra la base están en supabase/tests/001_exposicion.sql.

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "integrations" ? [] : archivos(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const fuentes = archivos("src").map((path) => ({ path, texto: readFileSync(path, "utf8") }));

describe("exposición de datos (guardas de código)", () => {
  it("nadie pide todas las columnas de delivery_comercios (la API ya no devuelve comisión ni frecuencia de liquidación)", () => {
    const malos = fuentes.filter(({ texto }) => /from\("delivery_comercios"\)\s*\.select\(\s*["'`]\*["'`]/.test(texto)).map(({ path }) => path);
    expect(malos).toEqual([]);
  });

  it("nadie lee el teléfono directamente de perfiles (se usa delivery_mi_perfil)", () => {
    const malos = fuentes.filter(({ texto }) => /from\("perfiles"\)\s*\.select\([^)]*telefono/.test(texto)).map(({ path }) => path);
    expect(malos).toEqual([]);
  });

  it("nadie pide todas las columnas de perfiles", () => {
    const malos = fuentes.filter(({ texto }) => /from\("perfiles"\)\s*\.select\(\s*["'`]\*["'`]/.test(texto)).map(({ path }) => path);
    expect(malos).toEqual([]);
  });

  it("no hay claves secretas en el código del front", () => {
    const malos = fuentes.filter(({ texto }) => /service_role|sb_secret_|SERVICE_ROLE_KEY/.test(texto)).map(({ path }) => path);
    expect(malos).toEqual([]);
  });
});
