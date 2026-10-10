import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";
import type { Branch } from "@/pages/delivery/merchant/context";

/** Clave donde el panel del comercio recuerda qué negocio abrir (la lee `MerchantLayout`). */
export const NEGOCIO_ACTIVO_KEY = "woref-sucursal";

/**
 * Negocios que la persona administra (propios o como parte del equipo), con su tipo: tienda online o sitio web.
 * Lo calcula el servidor (`delivery_mis_comercios`), así que solo aparecen los que de verdad puede abrir.
 */
export function useMisNegocios() {
  const { user, loading: cargandoSesion } = useAuth();
  const [negocios, setNegocios] = useState<Branch[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) { setNegocios([]); setCargando(false); return; }
    setCargando(true);
    const { data, error: falla } = await db.rpc("delivery_mis_comercios");
    setError(Boolean(falla));
    setNegocios(falla ? [] : ((data || []) as Branch[]));
    setCargando(false);
  }, [user]);

  useEffect(() => { if (!cargandoSesion) void cargar(); }, [cargar, cargandoSesion]);

  const sitios = negocios.filter((n) => n.tipo_sitio === "sitio");
  return { negocios, sitios, cargando: cargando || cargandoSesion, error, recargar: cargar, conSesion: Boolean(user) };
}

/** Abre el panel en un negocio concreto (y opcionalmente en una sección), recordándolo como el activo. */
export function useAbrirNegocio() {
  const navigate = useNavigate();
  return useCallback((id: string, seccion = "") => {
    try { window.localStorage.setItem(NEGOCIO_ACTIVO_KEY, id); } catch { /* sin almacenamiento: el panel abre el primero */ }
    navigate(seccion ? `/app/comercio/${seccion}` : "/app/comercio");
  }, [navigate]);
}
