import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { docLabel, DocEntity, loadDocs, signedDocUrl, VerificationDoc } from "@/lib/verification";

type Item = VerificationDoc & { url: string | null };

/** Para administración: muestra los documentos de una persona o comercio con enlaces temporales. */
export function DocumentViewer({ entidad, entidadId }: { entidad: DocEntity; entidadId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const docs = await loadDocs(entidad, entidadId);
      const withUrls = await Promise.all(docs.map(async (doc) => ({ ...doc, url: await signedDocUrl(doc.path) })));
      if (active) setItems(withUrls);
    })();
    return () => { active = false; };
  }, [entidad, entidadId]);

  if (!items) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (items.length === 0) return <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Todavía no subió documentos.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-2xl border bg-card">
          {item.url && !item.path.endsWith(".pdf") ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={docLabel[item.tipo]} className="h-44 w-full bg-muted object-contain" /></a>
          ) : (
            <a href={item.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex h-44 items-center justify-center bg-muted text-muted-foreground"><FileText className="h-10 w-10" /></a>
          )}
          <p className="p-2.5 text-sm font-bold">{docLabel[item.tipo]}</p>
        </li>
      ))}
    </ul>
  );
}
