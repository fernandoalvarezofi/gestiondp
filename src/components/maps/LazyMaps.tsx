import { ComponentProps, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

// El mapa (Leaflet) pesa: se descarga solo en las pantallas que lo muestran.
const DeliveryMapImpl = lazy(() => import("./DeliveryMap").then((module) => ({ default: module.DeliveryMap })));
const LocationPickerImpl = lazy(() => import("./DeliveryMap").then((module) => ({ default: module.LocationPicker })));

const Placeholder = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;

export function MapView(props: ComponentProps<typeof DeliveryMapImpl>) {
  return <Suspense fallback={<Placeholder className={props.className} />}><DeliveryMapImpl {...props} /></Suspense>;
}

export function MapPicker(props: ComponentProps<typeof LocationPickerImpl>) {
  return <Suspense fallback={<Placeholder className={props.className} />}><LocationPickerImpl {...props} /></Suspense>;
}
