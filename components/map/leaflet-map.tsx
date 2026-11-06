"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { TONE_COLORS, type PointTone } from "./tones";

/** Samarqand viloyati — the view when there is nothing to fit to. */
const DEFAULT_CENTER: LatLngExpression = [39.654, 66.959];
const DEFAULT_ZOOM = 9;

export { TONE_COLORS, type PointTone } from "./tones";

export interface MapPoint {
  id: number;
  latitude: number;
  longitude: number;
  code: string;
  title: string;
  place?: string;
  stage?: string;
  birds?: number | null;
  days?: string | null;
  tone: PointTone;
  href: string;
}

/**
 * react-leaflet removes the Leaflet map in its effect cleanup; Next.js may hide a route with <Activity>
 * (effects cleaned up, state kept), so a fresh key per effect mount keeps the map alive after navigation.
 */
export function useMapGeneration(): number {
  const counter = useRef(0);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    counter.current += 1;
    setGeneration(counter.current);
    return () => setGeneration(0);
  }, []);
  return generation;
}

function FitToPoints({ points }: { points: readonly MapPoint[] }) {
  const map = useMap();
  const signature = points.map((p) => `${p.id}:${p.latitude}:${p.longitude}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14);
      return;
    }
    map.fitBounds(latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])), {
      padding: [36, 36],
      maxZoom: 14,
    });
    // `signature` captures every change of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

/** Households at the same spot are one numbered marker (separate dots would hide each other). */
function groupByPosition(points: readonly MapPoint[]) {
  const groups = new Map<string, { key: string; latitude: number; longitude: number; points: MapPoint[] }>();
  for (const point of points) {
    const key = `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.points.push(point);
    else groups.set(key, { key, latitude: point.latitude, longitude: point.longitude, points: [point] });
  }
  return [...groups.values()];
}

function countIcon(count: number, color: string) {
  return divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -12],
    html:
      `<span style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;` +
      `border-radius:9999px;background:${color};border:2px solid #fff;color:#fff;font:600 12px/1 system-ui,sans-serif;` +
      `box-shadow:0 1px 4px rgb(15 58 107/.35)">${count}</span>`,
  });
}

function PointDetails({ point }: { point: MapPoint }) {
  return (
    <div className="min-w-48 text-ink">
      <p className="text-xs font-semibold tracking-wide" style={{ color: TONE_COLORS[point.tone] }}>
        {point.code}
      </p>
      <p className="text-sm font-semibold leading-snug">{point.title}</p>
      {point.place && <p className="mt-0.5 text-xs text-muted">{point.place}</p>}
      {point.stage && <p className="mt-1.5 text-[13px]">{point.stage}</p>}
      {(point.birds !== undefined && point.birds !== null) || point.days ? (
        <p className="mt-1 text-[13px]">
          {point.birds !== undefined && point.birds !== null && (
            <>
              🐔 <b className="tabular-nums">{fmtNumber(point.birds)}</b> bosh
            </>
          )}
          {point.days && <span className="ml-2">📅 {point.days}</span>}
        </p>
      ) : null}
      <Link href={point.href} className="mt-2 inline-block text-sm font-medium text-accent! hover:underline">
        Xonadonni ochish →
      </Link>
    </div>
  );
}

export default function LeafletMap({ points, className }: { points: readonly MapPoint[]; className?: string }) {
  const generation = useMapGeneration();
  const visible = useMemo(
    () => points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [points],
  );
  const groups = useMemo(() => groupByPosition(visible), [visible]);

  if (generation === 0) return <div className={className} aria-hidden />;

  return (
    <div className={cn("relative isolate z-0", className)}>
      <MapContainer key={generation} center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="size-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToPoints points={visible} />
        {groups.map((group) =>
          group.points.length === 1 ? (
            <CircleMarker
              key={group.key}
              center={[group.latitude, group.longitude]}
              radius={10}
              pathOptions={{ color: "#fff", weight: 2, fillColor: TONE_COLORS[group.points[0].tone], fillOpacity: 0.95 }}
            >
              <Popup>
                <PointDetails point={group.points[0]} />
              </Popup>
            </CircleMarker>
          ) : (
            <Marker
              key={group.key}
              position={[group.latitude, group.longitude]}
              icon={countIcon(group.points.length, TONE_COLORS[group.points[0].tone])}
              title={`${group.points.length} ta xonadon bir joyda`}
            >
              <Popup>
                <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                  <p className="text-xs font-medium text-muted">{group.points.length} ta xonadon shu nuqtada</p>
                  {group.points.map((point) => (
                    <PointDetails key={point.id} point={point} />
                  ))}
                </div>
              </Popup>
            </Marker>
          ),
        )}
      </MapContainer>
    </div>
  );
}
