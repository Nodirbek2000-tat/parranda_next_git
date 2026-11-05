"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Browser, divIcon, latLngBounds, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { MapPoint, MapViewProps } from "./types";

/** Samarqand viloyati — used when there is nothing to fit the view to. */
const DEFAULT_CENTER: LatLngExpression = [39.654, 66.959];
const DEFAULT_ZOOM = 9;

const COLORS = {
  active: "#2F6B3F",
  inactive: "#5E7A69",
  pending: "#E8B04A",
  ring: "#FFFFFF",
};

/**
 * react-leaflet removes the Leaflet map in its effect cleanup. With Cache
 * Components, Next.js hides routes with <Activity> (effects cleaned up, state
 * kept), so the map must be re-created whenever effects re-run. A fresh key per
 * effect mount guarantees a live map after navigation back and in Strict Mode.
 */
function useMapGeneration(): number {
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
  const signature = points.map((point) => `${point.id}:${point.latitude}:${point.longitude}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
      return;
    }
    const bounds = latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // `signature` captures every change of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

function PickHandler({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Households at the same spot (coordinates equal to ~1 m) are one marker: a dot with the count, whose
 * popup lists every household there. Separate dots on top of each other hid households on /map.
 */
interface MarkerGroup {
  key: string;
  latitude: number;
  longitude: number;
  points: MapPoint[];
}

function groupByPosition(points: readonly MapPoint[]): MarkerGroup[] {
  const groups = new Map<string, MarkerGroup>();
  for (const point of points) {
    const key = `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.points.push(point);
    else groups.set(key, { key, latitude: point.latitude, longitude: point.longitude, points: [point] });
  }
  return [...groups.values()];
}

function countIcon(count: number, anyActive: boolean) {
  const fill = anyActive ? COLORS.active : COLORS.inactive;
  return divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
    html:
      `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;` +
      `border-radius:9999px;background:${fill};border:2px solid ${COLORS.ring};color:#fff;font:600 12px/1 ` +
      `'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 1px 4px rgb(18 55 42/.35)">${count}</span>`,
  });
}

function PointDetails({ point }: { point: MapPoint }) {
  return (
    <div className="min-w-44 text-ink">
      <p className="text-sm font-semibold leading-snug">{point.name}</p>
      <p className="mt-0.5 text-xs text-muted">
        {point.code}
        {point.ownerName ? ` · ${point.ownerName}` : ""}
      </p>
      {point.birdCount !== undefined && (
        <p className="mt-2 text-sm">
          Parranda: <span className="font-semibold tabular-nums">{formatNumber(point.birdCount)}</span>
        </p>
      )}
      {!point.active && <p className="mt-1 text-xs text-danger">Nofaol xonadon</p>}
      {point.href && (
        <Link href={point.href} className="mt-2 inline-block text-sm font-medium text-accent! hover:underline">
          Batafsil →
        </Link>
      )}
    </div>
  );
}

export default function LeafletMap({
  points,
  onPick,
  pending,
  className,
  fit = true,
  interactive = true,
}: MapViewProps) {
  const generation = useMapGeneration();
  const visible = useMemo(
    () => points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
    [points],
  );
  const groups = useMemo(() => groupByPosition(visible), [visible]);
  // Embedded maps never trap the page scroll: no wheel zoom, and on touch devices one finger scrolls
  // the page (pinch still zooms, the +/− buttons work). Only /map is fully interactive.
  const touch = Browser.mobile;
  const embeddedOnTouch = !interactive && touch;

  if (generation === 0) return <div className={className} aria-hidden />;

  return (
    <div className={cn("relative isolate z-0", className)}>
      <MapContainer
        key={generation}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={interactive}
        dragging={interactive || !touch}
        className="size-full"
        style={{ cursor: onPick ? "crosshair" : undefined }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {fit && <FitToPoints points={visible} />}
        {onPick && <PickHandler onPick={onPick} />}
        {groups.map((group) =>
          group.points.length === 1 ? (
            <CircleMarker
              key={group.key}
              center={[group.latitude, group.longitude]}
              radius={9}
              pathOptions={{
                color: COLORS.ring,
                weight: 2,
                fillColor: group.points[0].active ? COLORS.active : COLORS.inactive,
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <PointDetails point={group.points[0]} />
              </Popup>
            </CircleMarker>
          ) : (
            <Marker
              key={group.key}
              position={[group.latitude, group.longitude]}
              icon={countIcon(group.points.length, group.points.some((point) => point.active))}
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
        {pending && (
          <CircleMarker
            center={[pending.latitude, pending.longitude]}
            radius={10}
            pathOptions={{
              color: COLORS.pending,
              weight: 3,
              dashArray: "4 4",
              fillColor: COLORS.pending,
              fillOpacity: 0.35,
            }}
          />
        )}
      </MapContainer>
      {embeddedOnTouch && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-[1000] mx-auto w-fit max-w-[90%] rounded-md bg-surface/90 px-2 py-1 text-center text-[11px] text-muted shadow-sm">
          Xaritani ikki barmoq bilan kattalashtiring
        </p>
      )}
    </div>
  );
}
