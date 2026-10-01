import { supabase } from "@/integrations/supabase/client";

const BUCKET = "delivery";
const MAX_SIDE = 1600;

/** Achica la foto en el navegador (máx. 1600 px, JPEG) para que suba rápido y pese poco. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo tiene que ser una imagen");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  return blob || file;
}

/** Sube una foto a la carpeta del usuario y devuelve su URL pública. */
export async function uploadImage(file: File, userId: string, folder: "comercios" | "productos" | "perfiles") {
  if (file.size > 15 * 1024 * 1024) throw new Error("La foto es muy pesada (máximo 15 MB)");
  const blob = await compress(file);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(error.message.includes("row-level security") ? "No tenés permiso para subir esta foto" : "No pudimos subir la foto. Probá de nuevo.");
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
