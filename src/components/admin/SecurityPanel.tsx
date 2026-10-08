import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { AdminMfaNotice } from "@/components/admin/AdminMfaNotice";
import { ListRow, Metric, MetricStrip, PageIntro, RowList, Section, StatusPill } from "@/components/panel/kit";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";

type Seguridad = {
  admins: { nombre: string; email: string; mfa: boolean; ultimo_ingreso: string | null; soy_yo: boolean }[];
  suspendidos: number; repartidores_pausados: number; controles_pendientes: number; acciones_admin_24h: number; errores_24h: number;
};

/** Seguridad (administración): quién tiene acceso total, si usa verificación en dos pasos y señales para revisar. */
export function SecurityPanel() {
  const [data, setData] = useState<Seguridad | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    db.rpc("delivery_admin_seguridad").then(({ data: res, error: err }: { data: Seguridad | null; error: unknown }) => { if (err) setError(errorMessage(err)); else setData(res); });
  }, []);
  const sinMfa = data?.admins.filter((a) => !a.mfa).length ?? 0;

  return (
    <div className="space-y-6">
      <PageIntro title="Seguridad" description="Accesos de administración y señales que conviene revisar." />
      <AdminMfaNotice />
      {error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
      {!data && !error && <div className="h-28 animate-pulse rounded-3xl bg-muted" />}
      {data && (
        <>
          <MetricStrip cols={4}>
            <Metric label="Admins sin 2FA" value={sinMfa} hint={sinMfa ? "Deberían activarla" : "Todos protegidos"} />
            <Metric label="Clientes suspendidos" value={data.suspendidos} hint="Por antifraude o soporte" />
            <Metric label="Acciones de admin (24 h)" value={data.acciones_admin_24h} hint="Registradas en Auditoría" />
            <Metric label="Errores de la app (24 h)" value={data.errores_24h} hint="Vistos por los usuarios" />
          </MetricStrip>
          <Section title="Administradores" description="Tienen acceso total a la plataforma">
            <RowList>
              {data.admins.map((a) => (
                <ListRow key={a.email}
                  lead={a.mfa ? <ShieldCheck className="h-5 w-5 text-success" aria-label="Con 2FA" /> : <ShieldAlert className="h-5 w-5 text-destructive" aria-label="Sin 2FA" />}
                  title={<span className="flex items-center gap-2">{a.nombre}{a.soy_yo && <StatusPill>Vos</StatusPill>}</span>}
                  meta={`${a.email} · ${a.ultimo_ingreso ? `último ingreso ${formatDateTime(a.ultimo_ingreso)}` : "nunca ingresó"}`}
                  trailing={a.mfa ? <StatusPill tone="success">2FA activa</StatusPill> : <StatusPill tone="danger">Sin 2FA</StatusPill>} />
              ))}
            </RowList>
            {sinMfa > 0 && <p className="mt-2 text-sm text-muted-foreground">Cada administrador activa la verificación en dos pasos desde <Link to="/app/perfil/seguridad" className="font-bold text-primary underline">Mi cuenta → Seguridad</Link>.</p>}
          </Section>
          <Section title="Para revisar">
            <RowList>
              <ListRow to="/app/admin/repartidores" title="Repartidores pausados" trailing={<StatusPill>{data.repartidores_pausados}</StatusPill>} />
              <ListRow to="/app/admin/repartidores" title="Selfies de control pendientes" trailing={<StatusPill tone={data.controles_pendientes ? "brand" : "neutral"}>{data.controles_pendientes}</StatusPill>} />
              <ListRow to="/app/admin/clientes" title="Clientes suspendidos" trailing={<StatusPill>{data.suspendidos}</StatusPill>} />
              <ListRow to="/app/admin/auditoria" title="Auditoría de acciones" trailing={<StatusPill>{data.acciones_admin_24h}</StatusPill>} />
              <ListRow to="/app/admin/errores" title="Errores de la app" trailing={<StatusPill tone={data.errores_24h ? "danger" : "neutral"}>{data.errores_24h}</StatusPill>} />
            </RowList>
          </Section>
        </>
      )}
    </div>
  );
}
