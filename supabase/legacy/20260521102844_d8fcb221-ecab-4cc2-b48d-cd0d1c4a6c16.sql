
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS perfil_privado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_actividad boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permitir_etiquetas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_likes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_comentarios boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_seguidores boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_menciones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_mensajes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tema text NOT NULL DEFAULT 'sistema',
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'es';
