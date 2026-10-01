import { Link, useLocation } from "react-router-dom";
import { Bike, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-5 text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary"><Bike className="h-12 w-12 animate-ride" /></span>
        <h1 className="font-display text-7xl font-extrabold text-primary">404</h1>
        <p className="text-xl font-bold">Nos perdimos en el camino</p>
        <p className="text-muted-foreground">La página <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{location.pathname}</code> no existe.</p>
        <Button asChild className="rounded-full"><Link to="/app"><Home className="h-4 w-4" />Volver al inicio</Link></Button>
      </div>
    </div>
  );
};

export default NotFound;
