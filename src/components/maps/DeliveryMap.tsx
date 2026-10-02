import { useEffect } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type MapMarker = GeoPoint & { kind: "store" | "home" | "courier"; label?: string };

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const glyph = {
  store: '<path d="M3 9l1-5h16l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6" />',
  home: '<path d="M3 11l9-7 9 7M5 10v10h14V10" />',
  courier: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-7h5l3 7M10 10l-2-3H5" />',
};
const colors = { store: "hsl(163 44% 14%)", home: "hsl(6 100% 60%)", courier: "hsl(214 84% 52%)" };

const icon = (kind: MapMarker["kind"]) => divIcon({
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  html: `<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colors[kind]};box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;border:3px solid #fff">
    <svg style="transform:rotate(45deg)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph[kind]}</svg></div>`,
});

/** Leaflet calcula su tamaño al montarse; dentro de ventanas animadas hay que recalcularlo o queda gris. */
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const timers = [100, 300, 600].map((delay) => window.setTimeout(() => map.invalidateSize(), delay));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => { timers.forEach((timer) => window.clearTimeout(timer)); observer.disconnect(); };
  }, [map]);
  return null;
}

function FitToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const key = markers.map((marker) => `${marker.lat.toFixed(4)},${marker.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) { map.setView([markers[0].lat, markers[0].lng], 15); return; }
    map.fitBounds(latLngBounds(markers.map((marker) => [marker.lat, marker.lng])), { padding: [48, 48], maxZoom: 16 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Mapa de solo lectura con comercio, destino y repartidor. */
export function DeliveryMap({ markers, className }: { markers: MapMarker[]; className?: string }) {
  const first = markers[0] || DEFAULT_CENTER;
  return (
    <div className={cn("relative z-0 overflow-hidden rounded-2xl", className)}>
      <MapContainer center={[first.lat, first.lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        {markers.map((marker) => (
          <Marker key={`${marker.kind}-${marker.lat}-${marker.lng}`} position={[marker.lat, marker.lng]} icon={icon(marker.kind)}>
            {marker.label && <Tooltip direction="top" offset={[0, -36]}>{marker.label}</Tooltip>}
          </Marker>
        ))}
        <FitToMarkers markers={markers} />
        <KeepSized />
      </MapContainer>
    </div>
  );
}

function CenterTracker({ onMove }: { onMove: (point: GeoPoint) => void }) {
  const map = useMapEvents({
    // Solo cuando la persona arrastra el mapa: si el mapa se recentra solo (al elegir una dirección) no hay que pisarla.
    dragend: () => {
      const center = map.getCenter();
      onMove({ lat: Math.round(center.lat * 1e7) / 1e7, lng: Math.round(center.lng * 1e7) / 1e7 });
    },
  });
  return null;
}

function Recenter({ point }: { point: GeoPoint }) {
  const map = useMap();
  useEffect(() => {
    const center = map.getCenter();
    if (Math.abs(center.lat - point.lat) > 1e-5 || Math.abs(center.lng - point.lng) > 1e-5) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16));
  }, [point.lat, point.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Selector de ubicación: se mueve el mapa y el pin queda fijo en el centro. */
export function LocationPicker({ value, onChange, className }: { value: GeoPoint; onChange: (point: GeoPoint) => void; className?: string }) {
  return (
    <div className={cn("relative z-0 overflow-hidden rounded-2xl", className)}>
      <MapContainer center={[value.lat, value.lng]} zoom={16} className="h-full w-full">
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <CenterTracker onMove={onChange} />
        <Recenter point={value} />
        <KeepSized />
      </MapContainer>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <div className="flex h-10 w-10 -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] border-[3px] border-white bg-primary shadow-pop">
          <span className="h-2.5 w-2.5 rotate-45 rounded-full bg-white" />
        </div>
      </div>
      <p className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-full bg-card/95 px-3 py-1 text-xs font-bold shadow-soft">Mové el mapa para ubicar el pin en la puerta</p>
    </div>
  );
}

export default DeliveryMap;
