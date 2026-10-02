import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const report = vi.fn();
vi.mock("@/lib/monitor", () => ({ reportError: (...args: unknown[]) => report(...args) }));

const Broken = () => { throw new Error("pantalla rota"); };

describe("ErrorBoundary", () => {
  it("muestra un aviso con salida y reporta el error en vez de dejar la pantalla en blanco", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/app");
    expect(report).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("no interfiere cuando todo anda bien", () => {
    render(<ErrorBoundary><p>todo bien</p></ErrorBoundary>);
    expect(screen.getByText("todo bien")).toBeInTheDocument();
  });
});
