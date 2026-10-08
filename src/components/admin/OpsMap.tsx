import { useEffect } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type OpsPoint = { key: string; lat: number; lng: number; kind: "courier-free" | "courier-busy" | "order-ok" | "order-warn" | "order-late" | "store" | "parcel"; label: string; selected?: boolean };

const palette: Record<OpsPoint["kind"], { color: string; glyph: string }> = {
  "courier-free": { color: "#16a34a", glyph: "M" },
  "courier-busy": { color: "#2563eb", glyph: "M" },
  "order-ok": { color: "#7c3aed", glyph: "P" },
  "order-warn": { color: "#f59e0b", glyph: "P" },
  "order-late": { color: "#dc2626", glyph: "!" },
  store: { color: "#14332b", glyph: "L" },
  parcel: { color: "#d97706", glyph: "E" },
};

const icon = (point: OpsPoint) => {
  const { color, glyph } = palette[point.kind];
  const size = point.selected ? 36 : 28;
  return divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:#fff;font:800 ${point.selected ? 14 : 12}px/1 system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)${point.selected ? ";outline:3px solid " + color + "66" : ""}">${glyph}</div>`,
  });
};

function Fit({ points, focus }: { points: OpsPoint[]; focus: string | null }) {
  const map = useMap();
  const key = points.map((point) => point.key).sort().join("|");
  useEffect(() => {
    const target = focus ? points.find((point) => point.key === focus) : null;
    if (target) { map.setView([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true }); return; }
    if (!points.length) return;
    map.fitBounds(latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [50, 50], maxZoom: 15 });
  }, [key, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Mapa de operaciones: repartidores, pedidos (por urgencia), locales con pedidos y envíos. */
export default function OpsMap({ points, focus, onSelect, className }: { points: OpsPoint[]; focus: string | null; onSelect: (key: string) => void; className?: string }) {
  return (
    <div className={cn("relative z-0 overflow-hidden rounded-3xl border", className)}>
      <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={14} scrollWheelZoom zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        {points.map((point) => (
          <Marker key={point.key} position={[point.lat, point.lng]} icon={icon({ ...point, selected: point.key === focus })} eventHandlers={{ click: () => onSelect(point.key) }} zIndexOffset={point.kind.startsWith("courier") ? 500 : point.kind === "order-late" ? 400 : 0}>
            <Tooltip direction="top" offset={[0, -14]}>{point.label}</Tooltip>
          </Marker>
        ))}
        <Fit points={points} focus={focus} />
      </MapContainer>
    </div>
  );
}
