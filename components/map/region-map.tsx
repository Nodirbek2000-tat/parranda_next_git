"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import type { GeoDistrict, GeoPoint } from "@/lib/reports";
import { useMapGeneration } from "./leaflet-map";
import { districtColor, TONE_COLORS, toneOf } from "./tones";

const NAVY = "#0F3A6B";
const CRITICAL = "#d03b3b";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** District bubble: the number of households inside, the district name under it. */
function districtIcon(d: GeoDistrict, selected: boolean, max: number) {
  const size = d.total === 0 ? 18 : Math.round(28 + 22 * Math.sqrt(d.total / Math.max(max, 1)));
  const { fill, ink } = districtColor(d.total, max);
  const ring = selected ? NAVY : "#FFFFFF";
  const short = d.name.replace(/ tumani$/, "").replace(/ shahri$/, " sh.");
  // a red dot marks a district with an overdue household (explained in the legend)
  const badge = d.overdue > 0
    ? `<span style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:9999px;background:${CRITICAL};border:2px solid #fff"></span>`
    : "";
  const html =
    `<div style="display:flex;flex-direction:column;align-items:center;width:120px;cursor:pointer">` +
    `<span style="position:relative;display:flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;border-radius:9999px;` +
    `background:${fill};border:${selected ? 4 : 2}px solid ${ring};color:${ink};font:700 ${size > 40 ? 15 : 13}px/1 system-ui,sans-serif;` +
    `box-shadow:0 2px 6px rgb(15 58 107/.3)">${d.total > 0 ? d.total : ""}${badge}</span>` +
    (d.total > 0 || selected
      ? `<span style="margin-top:2px;padding:0 4px;border-radius:6px;background:rgb(255 255 255/.85);` +
        `font:600 11px/1.35 system-ui,sans-serif;color:#15202D;white-space:nowrap">${escapeHtml(short)}</span>`
      : "") +
    `</div>`;
  return divIcon({ className: "", html, iconSize: [120, size + 18], iconAnchor: [60, size / 2] });
}

function FitView({ districts, points, selected }: { districts: GeoDistrict[]; points: GeoPoint[]; selected: string | null }) {
  const map = useMap();
  const signature = `${selected}|${points.map((p) => p.id).join(",")}`;
  useEffect(() => {
    const chosen = districts.find((d) => d.name === selected && d.latitude !== null);
    const coords: [number, number][] = selected
      ? [
          ...points.map((p) => [p.latitude, p.longitude] as [number, number]),
          ...(chosen ? [[chosen.latitude!, chosen.longitude!] as [number, number]] : []),
        ]
      : districts.filter((d) => d.latitude !== null).map((d) => [d.latitude!, d.longitude!] as [number, number]);
    if (coords.length === 0) return;
    if (coords.length === 1) map.setView(coords[0], 11);
    else {
      const pad = map.getSize().x < 500 ? 8 : 40; // phones: use the whole width
      map.fitBounds(latLngBounds(coords), { padding: [pad, pad], maxZoom: selected ? 13 : 10 });
    }
    // `signature` captures the inputs that matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

/** Samarqand viloyati: district bubbles (click = filter the report) and the households as dots. */
export default function RegionMap({
  districts,
  points,
  selected,
  onSelect,
  className,
}: {
  districts: GeoDistrict[];
  points: GeoPoint[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  className?: string;
}) {
  const generation = useMapGeneration();
  const placed = useMemo(() => districts.filter((d) => d.latitude !== null && d.longitude !== null), [districts]);
  const max = Math.max(0, ...placed.map((d) => d.total));

  if (generation === 0) return <div className={className} aria-hidden />;

  return (
    <div className={cn("relative isolate z-0", className)}>
      <MapContainer key={generation} center={[39.85, 66.5]} zoom={8} scrollWheelZoom className="size-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitView districts={placed} points={points} selected={selected} />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.latitude, p.longitude]}
            radius={6}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: TONE_COLORS[toneOf(p.status, p.currentStage, p.overdue)], fillOpacity: 0.95 }}
          >
            <Popup>
              <div className="min-w-44 text-ink">
                <p className="text-xs font-semibold text-accent">{p.code}</p>
                <p className="text-sm font-semibold">{p.owner || "—"}</p>
                <p className="text-xs text-muted">{[p.district, p.mfy].filter(Boolean).join(", ")}</p>
                <p className="mt-1 text-[13px]">
                  {p.status === "IN_PROGRESS" ? `${p.currentStage}. ${p.stageTitle}` : p.status === "DONE" ? "Yakunlangan" : "Rad etilgan"}
                </p>
                {(p.birds !== null || p.days !== null) && (
                  <p className="text-[13px]">
                    {p.birds !== null && <>🐔 {fmtNumber(p.birds)} bosh</>}
                    {p.days !== null && <span className="ml-2">📅 {p.days}-kun</span>}
                  </p>
                )}
                <Link href={`/cases/${p.id}`} className="mt-1.5 inline-block text-sm font-medium text-accent! hover:underline">
                  Xonadonni ochish →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {placed.map((d) => (
          <Marker
            key={d.name}
            position={[d.latitude!, d.longitude!]}
            icon={districtIcon(d, d.name === selected, max)}
            title={`${d.name}: ${d.total} ta xonadon`}
            zIndexOffset={d.name === selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(d.name === selected ? null : d.name) }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
