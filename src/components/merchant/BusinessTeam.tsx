import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/delivery";
import { cambiarRolIntegrante, fetchIntegrantes, fetchMisNegocios, invitarIntegrante, Integrante, Negocio, quitarIntegrante, RolNegocio } from "@/services/business";

export const ROL_NEGOCIO: Record<RolNegocio, { nombre: string; detalle: string }> = {
  owner: { nombre: "Dueño", detalle: "Acceso total al negocio y a todas sus tiendas." },
  admin: { nombre: "Administrador", detalle: "Todo, incluidas las finanzas, en todas las tiendas. No gestiona el equipo." },
  manager: { nombre: "Gerente", detalle: "Pedidos, menú, promociones, opiniones, estadísticas y ajustes. Sin finanzas ni equipo." },
  operator: { nombre: "Operador", detalle: "Solo recibe y prepara pedidos." },
  seller: { nombre: "Vendedor", detalle: "Pedidos y menú (productos, precios y stock)." },
};
const ROLES_ASIGNABLES = ["admin", "manager", "operator", "seller"] as const;
type RolAsignable = (typeof ROLES_ASIGNABLES)[number];

/** Equipo de TODO el negocio (todas sus tiendas y sucursales). Solo el dueño invita y cambia roles; el administrador lo ve. */
export function BusinessTeam({ storeId }: { storeId: string }) {
  const [negocio, setNegocio] = useState<Negocio | null | undefined>(undefined);
  const [integrantes, setIntegrantes] = useState<Integrante[] | null>(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolAsignable>("manager");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    const lista = await fetchMisNegocios();
    const propio = lista.find((n) => n.tiendas.some((t) => t.id === storeId)) ?? null;
    setNegocio(propio);
    setIntegrantes(propio && (propio.rol === "owner" || propio.rol === "admin") ? await fetchIntegrantes(propio.id) : []);
  }, [storeId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (negocio === undefined) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!negocio || (negocio.rol !== "owner" && negocio.rol !== "admin")) return null;
  const esDueno = negocio.rol === "owner";

  const invitar = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await invitarIntegrante(negocio.id, email.trim(), rol);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    // La respuesta es la misma exista o no la cuenta: no se revela quién tiene cuenta en Woref.
    toast.success("Listo. Si esa persona tiene cuenta de Woref con ese email, va a ver la invitación al entrar.");
    setEmail("");
    cargar();
  };
  const cambiar = async (i: Integrante, nuevo: RolAsignable) => {
    const { error } = await cambiarRolIntegrante(negocio.id, i.user_id, nuevo);
    if (error) return toast.error(errorMessage(error));
    cargar();
  };
  const quitar = async (i: Integrante) => {
    if (!window.confirm(i.estado === "invitado" ? "¿Cancelar esta invitación?" : `¿Quitar a ${i.nombre || "esta persona"} del negocio? Pierde el acceso a todas las tiendas al instante.`)) return;
    const { error } = await quitarIntegrante(negocio.id, i.user_id);
    if (error) return toast.error(errorMessage(error));
    cargar();
  };

  return (
    <section className="mt-8 rounded-3xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Building2 className="h-5 w-5" />Equipo de todo el negocio</h2>
      <p className="mt-1 text-sm text-muted-foreground">Las personas de este equipo tienen acceso a <span className="font-bold">todas las tiendas</span> de “{negocio.nombre}” ({negocio.tiendas.length}). Para dar acceso a un solo local, usá el equipo del local de arriba.</p>

      {esDueno && (
        <form onSubmit={invitar} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input type="email" required value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="Email de la persona (tiene que tener cuenta de Woref)" aria-label="Email de la persona a invitar" />
          <select value={rol} onChange={(e) => setRol(e.target.value as RolAsignable)} aria-label="Rol" className="h-10 rounded-md border bg-background px-3 text-sm font-semibold">
            {ROLES_ASIGNABLES.map((r) => <option key={r} value={r}>{ROL_NEGOCIO[r].nombre}</option>)}
          </select>
          <Button type="submit" className="rounded-full" disabled={saving || !email.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Invitar</Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">{ROL_NEGOCIO[rol].detalle}</p>
        </form>
      )}

      {!integrantes ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
        <ul className="mt-4 divide-y rounded-2xl border">
          {integrantes.map((i) => (
            <li key={i.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{i.nombre || "Persona sin nombre"}</p>
                <p className="text-xs text-muted-foreground">{i.estado === "invitado" ? "Invitación pendiente" : i.estado === "suspendido" ? "Suspendido" : "Activo"}</p>
              </div>
              {esDueno && i.rol !== "owner" ? (
                <select value={i.rol} onChange={(e) => cambiar(i, e.target.value as RolAsignable)} aria-label={`Rol de ${i.nombre || "la persona"}`} className="h-9 rounded-md border bg-background px-2 text-sm font-semibold">
                  {ROLES_ASIGNABLES.map((r) => <option key={r} value={r}>{ROL_NEGOCIO[r].nombre}</option>)}
                </select>
              ) : <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{ROL_NEGOCIO[i.rol].nombre}</span>}
              {esDueno && i.rol !== "owner" && <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Quitar del negocio" onClick={() => quitar(i)}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
