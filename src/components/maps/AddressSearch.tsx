import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddressSuggestion, currentPosition, reverseGeocode, searchAddresses } from "@/lib/geo";

/** Buscador de direcciones con autocompletado y botón "usar mi ubicación". */
export function AddressSearch({ onPick, placeholder = "Buscá tu dirección (calle y altura)", autoFocus }: { onPick: (suggestion: AddressSuggestion) => void; placeholder?: string; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) { picked.current = false; return; }
    if (query.trim().length < 3) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchAddresses(query, undefined, controller.signal));
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error("No pudimos buscar direcciones. Probá de nuevo.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const choose = (suggestion: AddressSuggestion) => {
    picked.current = true;
    setQuery(suggestion.label);
    setOpen(false);
    onPick(suggestion);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const point = await currentPosition();
      const found = await reverseGeocode(point);
      choose(found || { ...point, label: "Mi ubicación", detail: "" });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="relative">
      <label className="flex h-12 items-center gap-2 rounded-xl border bg-background px-3 focus-within:border-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input autoFocus={autoFocus} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => results.length && setOpen(true)} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Buscar dirección" autoComplete="off" />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </label>
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-[600] mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-pop" role="listbox">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lng}-${result.label}`}>
              <button type="button" onClick={() => choose(result)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{result.label}</span><span className="block truncate text-xs text-muted-foreground">{result.detail}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !searching && query.trim().length >= 3 && results.length === 0 && (
        <p className="absolute inset-x-0 top-full z-[600] mt-1 rounded-xl border bg-popover p-3 text-sm text-muted-foreground shadow-pop">No encontramos esa dirección. Probá con calle y altura, o usá tu ubicación.</p>
      )}
      <Button type="button" variant="ghost" size="sm" className="mt-1 text-primary" onClick={locate} disabled={locating}>
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Usar mi ubicación actual
      </Button>
    </div>
  );
}
