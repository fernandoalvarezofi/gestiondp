import { Bell } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { cn } from "@/lib/utils";

/** Campanita con el contador de avisos sin leer; lleva a la bandeja de notificaciones. */
export function NotificationBell({ className }: { className?: string }) {
  const { count } = useUnreadNotifications();
  return (
    <NavLink to="/app/notificaciones" aria-label={count ? `Notificaciones, ${count} sin leer` : "Notificaciones"} className={cn("relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted", className)}>
      <Bell className="h-5 w-5" />
      {count > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 animate-pop-in items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">{count > 9 ? "9+" : count}</span>}
    </NavLink>
  );
}
