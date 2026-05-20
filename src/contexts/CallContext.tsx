import { createContext, useContext, ReactNode } from "react";
import { useCall } from "@/hooks/useCall";

const CallCtx = createContext<ReturnType<typeof useCall> | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const value = useCall();
  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
}

export function useCallCtx() {
  const ctx = useContext(CallCtx);
  if (!ctx) throw new Error("useCallCtx requires CallProvider");
  return ctx;
}
