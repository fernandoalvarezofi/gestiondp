import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type ZoneShape = { id: string; nombre: string; poligono: [number, number][]; cerrada: boolean; activa: boolean; multiplicador: number; recargo: number };

function Clicks({ drawing, onAdd }: { drawing: boolean; onAdd: (point: [number, number]) => void }) {
  useMapEvents({ click: (event) => drawing && onAdd([Math.round(event.latlng.lat * 1e5) / 1e5, Math.round(event.latlng.lng * 1e5) / 1e5]) });
  return null;
}

function Focus({ zone }: { zone?: ZoneShape }) {
  const map = useMap();
  useEffect(() => { if (zone) map.fitBounds(latLngBounds(zone.poligono), { padding: [40, 40], maxZoom: 16 }); }, [zone?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

const colorOf = (zone: ZoneShape) => (!zone.activa ? "#94a3b8" : zone.cerrada ? "#dc2626" : zone.multiplicador > 1 || zone.recargo > 0 ? "#f59e0b" : "#16a34a");

/** Mapa de zonas: polígonos por color (verde normal, ámbar con recargo, rojo cerrada) y dibujo de uno nuevo punto a punto. */
export default function ZonesMap({ zones, selectedId, draft, drawing, onSelect, onAdd, className }: { zones: ZoneShape[]; selectedId: string | null; draft: [number, number][]; drawing: boolean; onSelect: (id: string) => void; onAdd: (point: [number, number]) => void; className?: string }) {
  return (
    <div className={cn("relative z-0 overflow-hidden rounded-3xl border", drawing && "ring-2 ring-primary", className)}>
      <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={13} scrollWheelZoom zoomControl={false} className={cn("h-full w-full", drawing && "cursor-crosshair")}>
        <ZoomControl position="bottomright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        {zones.map((zone) => (
          <Polygon key={zone.id} positions={zone.poligono} pathOptions={{ color: colorOf(zone), weight: zone.id === selectedId ? 4 : 2, fillOpacity: zone.id === selectedId ? 0.3 : 0.15, dashArray: zone.activa ? undefined : "6" }} eventHandlers={{ click: () => !drawing && onSelect(zone.id) }}>
            <Tooltip sticky>{zone.nombre}{zone.cerrada ? " · cerrada" : zone.multiplicador > 1 ? ` · x${zone.multiplicador}` : ""}</Tooltip>
          </Polygon>
        ))}
        {draft.length > 0 && <Polyline positions={[...draft, draft[0]]} pathOptions={{ color: "#F0B900", weight: 3, dashArray: "4" }} />}
        {draft.map((point, index) => <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={5} pathOptions={{ color: "#fff", fillColor: "#F0B900", fillOpacity: 1, weight: 2 }} />)}
        <Clicks drawing={drawing} onAdd={onAdd} />
        <Focus zone={zones.find((zone) => zone.id === selectedId)} />
      </MapContainer>
    </div>
  );
}
