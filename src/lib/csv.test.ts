import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("detecta el separador ; y lee comillas con saltos de línea", () => {
    expect(parseCsv('Nombre;Precio\n"Pizza; grande";9500\r\n"Dice ""hola""";100')).toEqual([["Nombre", "Precio"], ["Pizza; grande", "9500"], ['Dice "hola"', "100"]]);
  });
  it("detecta la coma y descarta filas vacías", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("ignora el BOM inicial", () => {
    expect(parseCsv("﻿a;b\n1;2")[0]).toEqual(["a", "b"]);
  });
  it("hace ida y vuelta con toCsv y neutraliza fórmulas", () => {
    const csv = toCsv(["x", "y"], [["=cmd()", "ok"]]);
    expect(parseCsv(csv)[1]).toEqual(["'=cmd()", "ok"]);
  });
});
