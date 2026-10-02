import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { DocEntity, DocSpec, DocType, loadDocs, signedDocUrl, uploadVerificationDoc, VerificationDoc } from "@/lib/verification";
import { cn } from "@/lib/utils";

/** Lista de documentos que tiene que subir una persona o comercio; los archivos son privados (solo ella y administración los ven). */
export function DocumentChecklist({ entidad, entidadId, specs, onChange, locked }: { entidad: DocEntity; entidadId: string; specs: DocSpec[]; onChange?: (docs: VerificationDoc[]) => void; locked?: boolean }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<VerificationDoc[] | null>(null);
  const [busy, setBusy] = useState<DocType | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<DocType | null>(null);

  const reload = useCallback(async () => {
    const list = await loadDocs(entidad, entidadId);
    setDocs(list);
    onChange?.(list);
  }, [entidad, entidadId, onChange]);
  useEffect(() => { reload(); }, [reload]);

  const pick = async (file: File | undefined) => {
    const tipo = target.current;
    if (input.current) input.current.value = "";
    if (!file || !tipo || !user) return;
    setBusy(tipo);
    try {
      await uploadVerificationDoc(file, user.id, entidad, entidadId, tipo);
      toast.success("Documento subido");
      await reload();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const remove = async (doc: VerificationDoc) => {
    setBusy(doc.tipo);
    const { error } = await db.rpc("delivery_documento_quitar", { p_id: doc.id });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    reload();
  };
  const open = async (doc: VerificationDoc) => {
    const url = await signedDocUrl(doc.path);
    if (url) window.open(url, "_blank", "noopener,noreferrer"); else toast.error("No pudimos abrir el documento");
  };

  if (!docs) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div>
      <ul className="space-y-2">
        {specs.map((spec) => {
          const doc = docs.find((item) => item.tipo === spec.tipo);
          return (
            <li key={spec.tipo} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", doc && "border-success/40 bg-success/5")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", doc ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{doc ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{spec.label}{spec.required && <span className="ml-1 text-xs font-semibold text-destructive">obligatorio</span>}</p>
                <p className="text-xs text-muted-foreground">{doc ? `Subido el ${formatDateTime(doc.created_at)}` : spec.hint}</p>
              </div>
              {busy === spec.tipo ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
                <div className="flex gap-1">
                  {doc && <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => open(doc)}>Ver</Button>}
                  {!locked && <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => { target.current = spec.tipo; input.current?.click(); }}><Upload className="h-4 w-4" />{doc ? "Reemplazar" : "Subir"}</Button>}
                  {doc && !locked && <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${spec.label}`} onClick={() => remove(doc)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => pick(event.target.files?.[0])} />
    </div>
  );
}

/** ¿Están todos los documentos obligatorios? */
export const hasRequiredDocs = (docs: VerificationDoc[] | null, specs: DocSpec[]) => Boolean(docs) && specs.filter((spec) => spec.required).every((spec) => docs!.some((doc) => doc.tipo === spec.tipo));
