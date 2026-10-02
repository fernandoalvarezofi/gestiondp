import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { roleLabel, roleSummary, TeamRole, useMerchant } from "./context";

type Member = { id: string; email: string; rol: Exclude<TeamRole, "dueno">; estado: "invitado" | "activo"; nombre: string | null };
const roles = ["encargado", "operador"] as const;

/** Equipo del local: el dueño invita por email y elige qué puede hacer cada persona. */
export default function MerchantTeam() {
  const { store, access } = useMerchant();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("operador");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_equipo_listar", { p_comercio: store.id });
    if (error) { toast.error(errorMessage(error)); setMembers([]); return; }
    setMembers(data || []);
  }, [store.id]);
  useEffect(() => { load(); }, [load]);

  if (!access.permisos.includes("equipo")) return <EmptyState title="Solo el dueño administra el equipo" text="Pedile al dueño del comercio que te sume o te cambie el rol." />;

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await db.rpc("delivery_equipo_invitar", { p_comercio: store.id, p_email: email.trim(), p_rol: role });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Invitación enviada. La persona la ve al entrar a Woref con ese email.");
    setEmail("");
    load();
  };
  const changeRole = async (member: Member, next: (typeof roles)[number]) => {
    const { error } = await db.rpc("delivery_equipo_cambiar_rol", { p_id: member.id, p_rol: next });
    if (error) return toast.error(errorMessage(error));
    load();
  };
  const remove = async (member: Member) => {
    if (!window.confirm(member.estado === "invitado" ? `¿Cancelar la invitación a ${member.email}?` : `¿Quitar a ${member.nombre || member.email} del equipo? Pierde el acceso al instante.`)) return;
    const { error } = await db.rpc("delivery_equipo_quitar", { p_id: member.id });
    if (error) return toast.error(errorMessage(error));
    load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><UserPlus className="h-5 w-5 text-primary" />Sumar a alguien al equipo</h2>
        <p className="mt-1 text-sm text-muted-foreground">La persona tiene que tener cuenta en Woref (o crearla) con ese email. Al entrar ve la invitación y decide si la acepta.</p>
        <form onSubmit={invite} className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" required maxLength={200} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@ejemplo.com" aria-label="Email de la persona" />
            <Button type="submit" className="rounded-full" disabled={saving || !email.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Invitar</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((value) => (
              <button key={value} type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={cn("rounded-2xl border p-3 text-left", role === value ? "border-primary bg-primary/5" : "bg-background hover:bg-muted")}>
                <span className="block font-bold">{roleLabel[value]}</span>
                <span className="block text-xs text-muted-foreground">{roleSummary[value]}</span>
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Equipo</h2>
        <ul className="mt-3 divide-y">
          <li className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-black text-primary">D</span>
            <div className="min-w-0 flex-1"><p className="font-bold">Vos</p><p className="text-xs text-muted-foreground">{roleSummary.dueno}</p></div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Dueño</span>
          </li>
          {!members && <li className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></li>}
          {members?.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-black uppercase">{(member.nombre || member.email)[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{member.nombre || member.email}</p>
                <p className="truncate text-xs text-muted-foreground">{member.nombre && `${member.email} · `}{member.estado === "invitado" ? "Invitación pendiente" : "Activo"}</p>
              </div>
              <select value={member.rol} onChange={(event) => changeRole(member, event.target.value as (typeof roles)[number])} aria-label={`Rol de ${member.email}`} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold">
                {roles.map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
              </select>
              <Button size="icon" variant="ghost" aria-label={`Quitar a ${member.email}`} onClick={() => remove(member)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        {members?.length === 0 && <p className="py-2 text-sm text-muted-foreground">Todavía no sumaste a nadie. Podés invitar a un encargado o a quien prepara los pedidos.</p>}
      </section>
    </div>
  );
}
