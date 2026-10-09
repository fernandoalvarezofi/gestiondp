import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Diálogos de confirmación y de texto de toda la app (reemplazan a window.confirm / window.prompt).
 * Se usan desde cualquier función: `if (!(await confirmar({ ... }))) return;` y `const motivo = await pedirTexto({ ... })`.
 * Un solo <DialogosHost /> montado en App los muestra; se atienden de a uno, en orden.
 */

export type OpcionesConfirmar = {
  titulo: string;
  descripcion?: ReactNode;
  /** Texto del botón principal. Por defecto "Confirmar". */
  confirmar?: string;
  cancelar?: string;
  /** Acción que borra, cancela o no se puede deshacer: botón rojo e ícono de advertencia. */
  peligro?: boolean;
};

export type OpcionesTexto = {
  titulo: string;
  descripcion?: ReactNode;
  etiqueta: string;
  inicial?: string;
  placeholder?: string;
  confirmar?: string;
  peligro?: boolean;
  /** Varias líneas (motivos largos). */
  multilinea?: boolean;
  maximo?: number;
  /** Si es obligatorio, no se puede confirmar vacío. Por defecto true. */
  obligatorio?: boolean;
  /** Devuelve un mensaje de error o null si el valor es válido. */
  validar?: (valor: string) => string | null;
  tipo?: "text" | "number";
  modoTeclado?: "text" | "numeric" | "decimal";
};

type Pedido =
  | { id: number; clase: "confirmar"; opciones: OpcionesConfirmar; resolver: (v: boolean) => void }
  | { id: number; clase: "texto"; opciones: OpcionesTexto; resolver: (v: string | null) => void };

const cola: Pedido[] = [];
let avisar: (() => void) | null = null;
let ultimoId = 0;

function encolar(pedido: Pedido) {
  cola.push(pedido);
  if (avisar) avisar();
  // Sin host montado (pruebas o pantallas sueltas) se usa el diálogo nativo para no bloquear la acción.
  else queueMicrotask(() => {
    if (avisar || !cola.includes(pedido)) return;
    cola.splice(cola.indexOf(pedido), 1);
    if (pedido.clase === "confirmar") pedido.resolver(window.confirm(pedido.opciones.titulo));
    else pedido.resolver(window.prompt(pedido.opciones.titulo, pedido.opciones.inicial ?? ""));
  });
}

/** Pide confirmación. Devuelve true solo si la persona confirma. */
export function confirmar(opciones: OpcionesConfirmar): Promise<boolean> {
  return new Promise((resolver) => encolar({ id: ++ultimoId, clase: "confirmar", opciones, resolver }));
}

/** Pide un texto (motivo, nombre, porcentaje…). Devuelve el texto ya recortado, o null si se cancela. */
export function pedirTexto(opciones: OpcionesTexto): Promise<string | null> {
  return new Promise((resolver) => encolar({ id: ++ultimoId, clase: "texto", opciones, resolver }));
}

export function DialogosHost() {
  const [actual, setActual] = useState<Pedido | null>(null);

  useEffect(() => {
    const siguiente = () => setActual((prev) => prev ?? cola[0] ?? null);
    avisar = siguiente;
    siguiente();
    return () => { if (avisar === siguiente) avisar = null; };
  }, []);

  const cerrar = (valor: boolean | string | null) => {
    if (!actual) return;
    cola.splice(cola.indexOf(actual), 1);
    if (actual.clase === "confirmar") actual.resolver(valor === true);
    else actual.resolver(typeof valor === "string" ? valor : null);
    setActual(cola[0] ?? null);
  };

  if (!actual) return null;
  return actual.clase === "confirmar"
    ? <DialogoConfirmar key={actual.id} opciones={actual.opciones} cerrar={cerrar} />
    : <DialogoTexto key={actual.id} opciones={actual.opciones} cerrar={cerrar} />;
}

function Cabecera({ titulo, descripcion, peligro }: { titulo: string; descripcion?: ReactNode; peligro?: boolean }) {
  return (
    <AlertDialogHeader>
      <div className="flex items-start gap-3">
        {peligro && <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" aria-hidden /></span>}
        <div className="min-w-0 space-y-1.5 text-left">
          <AlertDialogTitle className="text-lg leading-snug">{titulo}</AlertDialogTitle>
          {descripcion ? <AlertDialogDescription asChild><div className="text-sm text-muted-foreground">{descripcion}</div></AlertDialogDescription>
            : <AlertDialogDescription className="sr-only">{titulo}</AlertDialogDescription>}
        </div>
      </div>
    </AlertDialogHeader>
  );
}

function DialogoConfirmar({ opciones, cerrar }: { opciones: OpcionesConfirmar; cerrar: (v: boolean) => void }) {
  return (
    <AlertDialog open onOpenChange={(abierto) => { if (!abierto) cerrar(false); }}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <Cabecera titulo={opciones.titulo} descripcion={opciones.descripcion} peligro={opciones.peligro} />
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="rounded-full">{opciones.cancelar ?? "Volver"}</AlertDialogCancel>
          <Button autoFocus className="rounded-full" variant={opciones.peligro ? "destructive" : "default"} onClick={() => cerrar(true)}>
            {opciones.confirmar ?? "Confirmar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DialogoTexto({ opciones, cerrar }: { opciones: OpcionesTexto; cerrar: (v: string | null) => void }) {
  const [valor, setValor] = useState(opciones.inicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const obligatorio = opciones.obligatorio ?? true;

  useEffect(() => { const t = setTimeout(() => { campo.current?.focus(); campo.current?.select(); }, 30); return () => clearTimeout(t); }, []);

  const enviar = (event: FormEvent) => {
    event.preventDefault();
    const limpio = valor.trim();
    if (obligatorio && !limpio) { setError("Completá este campo."); return; }
    const problema = opciones.validar?.(limpio) ?? null;
    if (problema) { setError(problema); return; }
    cerrar(limpio);
  };

  const comunes = {
    id: "dialogo-texto",
    ref: campo,
    value: valor,
    maxLength: opciones.maximo ?? 300,
    placeholder: opciones.placeholder,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? "dialogo-texto-error" : undefined,
    onChange: (e: { target: { value: string } }) => { setValor(e.target.value); if (error) setError(null); },
    className: cn(error && "border-destructive focus-visible:ring-destructive"),
  };

  return (
    <AlertDialog open onOpenChange={(abierto) => { if (!abierto) cerrar(null); }}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <Cabecera titulo={opciones.titulo} descripcion={opciones.descripcion} peligro={opciones.peligro} />
          <div className="grid gap-1.5">
            <Label htmlFor="dialogo-texto">{opciones.etiqueta}</Label>
            {opciones.multilinea
              ? <Textarea {...comunes} rows={3} />
              : <Input {...comunes} type={opciones.tipo ?? "text"} inputMode={opciones.modoTeclado} />}
            {error && <p id="dialogo-texto-error" role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel type="button" className="rounded-full">Volver</AlertDialogCancel>
            <Button type="submit" className="rounded-full" variant={opciones.peligro ? "destructive" : "default"}>{opciones.confirmar ?? "Aceptar"}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
