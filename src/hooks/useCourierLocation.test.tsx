import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });
const stop = vi.fn();
let native = false;
let nativeOnPoint: ((lat: number, lng: number) => void) | null = null;
let nativeOnError: ((reason: "denied" | "other") => void) | null = null;

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "courier-1" } }) }));
vi.mock("@/lib/delivery", () => ({ db: { from: () => ({ upsert }) } }));
vi.mock("@/lib/native", () => ({
  isNativeApp: () => native,
  watchNativeLocation: vi.fn(async (onPoint, onError) => { nativeOnPoint = onPoint; nativeOnError = onError; return { stop }; }),
}));

import { useShareCourierLocation } from "./useCourierLocation";

describe("useShareCourierLocation en la app instalada", () => {
  beforeEach(() => { vi.clearAllMocks(); native = true; nativeOnPoint = null; nativeOnError = null; });

  it("no sigue la ubicación si no hay un pedido en curso", () => {
    const { result } = renderHook(() => useShareCourierLocation(false));
    expect(result.current.status).toBe("idle");
    expect(nativeOnPoint).toBeNull();
  });

  it("guarda la posición del repartidor que llega del servicio en segundo plano", async () => {
    const { result } = renderHook(() => useShareCourierLocation(true));
    await waitFor(() => expect(nativeOnPoint).not.toBeNull());
    act(() => { nativeOnPoint!(-34.87, -61.53); });
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(upsert.mock.calls[0][0]).toMatchObject({ repartidor_id: "courier-1", latitud: -34.87, longitud: -61.53 });
    expect(result.current.status).toBe("sharing");
    expect(result.current.position).toEqual({ lat: -34.87, lng: -61.53 });
  });

  it("envía como máximo una posición cada 10 segundos", async () => {
    renderHook(() => useShareCourierLocation(true));
    await waitFor(() => expect(nativeOnPoint).not.toBeNull());
    act(() => { nativeOnPoint!(-34.87, -61.53); nativeOnPoint!(-34.871, -61.531); nativeOnPoint!(-34.872, -61.532); });
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
  });

  it("avisa cuando el permiso de ubicación fue rechazado", async () => {
    const { result } = renderHook(() => useShareCourierLocation(true));
    await waitFor(() => expect(nativeOnError).not.toBeNull());
    act(() => { nativeOnError!("denied"); });
    expect(result.current.status).toBe("denied");
  });

  it("detiene el servicio en segundo plano al terminar la entrega", async () => {
    const { unmount } = renderHook(() => useShareCourierLocation(true));
    await waitFor(() => expect(nativeOnPoint).not.toBeNull());
    await act(async () => { await Promise.resolve(); });
    unmount();
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
