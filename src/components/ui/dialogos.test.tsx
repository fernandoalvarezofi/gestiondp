import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DialogosHost, confirmar, pedirTexto } from "./dialogos";

describe("diálogos de la app", () => {
  it("confirmar devuelve true al aceptar y false al volver", async () => {
    render(<DialogosHost />);
    let si: Promise<boolean>;
    act(() => { si = confirmar({ titulo: "¿Eliminar la zona?", confirmar: "Borrar zona", peligro: true }); });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("¿Eliminar la zona?");
    fireEvent.click(screen.getByRole("button", { name: "Borrar zona" }));
    await expect(si!).resolves.toBe(true);

    let no: Promise<boolean>;
    act(() => { no = confirmar({ titulo: "¿Cancelar el pedido?" }); });
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    await expect(no!).resolves.toBe(false);
  });

  it("pedirTexto valida antes de cerrar y devuelve el texto recortado", async () => {
    render(<DialogosHost />);
    let valor: Promise<string | null>;
    act(() => { valor = pedirTexto({ titulo: "Código", etiqueta: "Código de 4 dígitos", validar: (v) => (/^\d{4}$/.test(v) ? null : "El código tiene 4 números") }); });
    const campo = await screen.findByLabelText("Código de 4 dígitos");
    fireEvent.change(campo, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El código tiene 4 números");
    fireEvent.change(campo, { target: { value: " 1234 " } });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await expect(valor!).resolves.toBe("1234");
  });

  it("no deja confirmar vacío un texto obligatorio y devuelve null al cancelar", async () => {
    render(<DialogosHost />);
    let valor: Promise<string | null>;
    act(() => { valor = pedirTexto({ titulo: "Motivo", etiqueta: "Motivo" }); });
    fireEvent.click(await screen.findByRole("button", { name: "Aceptar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Completá este campo.");
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await expect(valor!).resolves.toBeNull();
  });

  it("atiende los pedidos de a uno y en orden", async () => {
    render(<DialogosHost />);
    let a: Promise<boolean>; let b: Promise<boolean>;
    act(() => { a = confirmar({ titulo: "Primero", confirmar: "Sí 1" }); b = confirmar({ titulo: "Segundo", confirmar: "Sí 2" }); });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Primero");
    fireEvent.click(screen.getByRole("button", { name: "Sí 1" }));
    await expect(a!).resolves.toBe(true);
    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("Segundo"));
    fireEvent.click(screen.getByRole("button", { name: "Sí 2" }));
    await expect(b!).resolves.toBe(true);
  });
});
