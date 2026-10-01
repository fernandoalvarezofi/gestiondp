import { useRef, useState } from "react";
import { Camera, ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { img } from "@/lib/delivery";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  onChange: (url: string) => void;
  folder: "comercios" | "productos" | "perfiles";
  label: string;
  shape?: "wide" | "square" | "round";
  className?: string;
};

export function ImageUpload({ value, onChange, folder, label, shape = "wide", className }: Props) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      onChange(await uploadImage(file, user.id, folder));
      toast.success("Foto subida");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const frame = shape === "wide" ? "aspect-[16/9] w-full" : shape === "round" ? "h-24 w-24 rounded-full" : "aspect-square w-36";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={cn("group relative flex items-center justify-center overflow-hidden border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary", shape === "round" ? "rounded-full" : "rounded-2xl", frame, value && "border-solid")}
          aria-label={value ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}
        >
          {value ? (
            <>
              <img src={img(value, 600)} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="mr-1.5 h-4 w-4" />Cambiar</span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1 p-3 text-center text-xs font-semibold"><ImagePlus className="h-6 w-6" />Subir foto</span>
          )}
          {uploading && <span className="absolute inset-0 flex items-center justify-center bg-card/80"><Loader2 className="h-6 w-6 animate-spin text-primary" /></span>}
        </button>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setLinkMode((current) => !current)}><Link2 className="h-4 w-4" />Usar link</Button>
          {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}><Trash2 className="h-4 w-4" />Quitar</Button>}
        </div>
      </div>
      {linkMode && <Input type="url" placeholder="https://…" defaultValue={value || ""} onBlur={(event) => onChange(event.target.value.trim())} />}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => pick(event.target.files?.[0])} />
    </div>
  );
}
