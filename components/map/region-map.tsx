"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { divIcon, geoJSON, type Layer, type PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, useMap } from "react-leaflet";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import boundaries from "@/lib/geo/samarqand-tumanlar.json";
import type { GeoDistrict, GeoPoint } from "@/lib/reports";
import { useMapGeneration } from "./leaflet-map";
import { districtColor, TONE_COLORS, toneOf } from "./tones";

type DistrictProps = { name: string; label: [number, number] };
type DistrictFeature = Feature<Geometry, DistrictProps>;

/** The 16 districts of Samarqand viloyati (geoBoundaries / OCHA ROCCA 2020, CC BY 3.0 IGO). */
const DISTRICTS = boundaries as unknown as FeatureCollection<Geometry, DistrictProps> & { attribution: string };

const NAVY = "#0F3A6B";
const CRITICAL = "#d03b3b";
const EMPTY = "#E4EAF1";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** District name + number on the polygon (not clickable: the click goes to the district under it). */
function labelIcon(name: string, d: GeoDistrict | undefined, max: number) {
  const total = d?.total ?? 0;
  const dark = total > 0 && districtColor(total, max).ink === "#ffffff";
  const ink = dark ? "#ffffff" : "#15202D";
  const halo = dark ? "0 1px 2px rgb(0 0 0/.45)" : "0 0 3px rgb(255 255 255/.9)";
  const short = name.replace(/ tumani$/, "").replace(/ shahri$/, " sh.");
  const badge =
    d && d.overdue > 0
      ? `<span title="Muddati o‘tgan" style="display:inline-block;margin-left:4px;width:9px;height:9px;border-radius:9999px;background:${CRITICAL};border:1.5px solid #fff;vertical-align:1px"></span>`
      : "";
  const html =
    `<div style="width:130px;text-align:center;color:${ink};text-shadow:${halo};font-family:system-ui,sans-serif;line-height:1.15;pointer-events:none">` +
    `<div style="font-weight:600;font-size:11.5px;white-space:nowrap">${escapeHtml(short)}</div>` +
    (total > 0 ? `<div style="font-weight:800;font-size:15px">${total}${badge}</div>` : "") +
    `</div>`;
  return divIcon({ className: "", html, iconSize: [130, 34], iconAnchor: [65, 17] });
}

function FitView({ selected }: { selected: string | null }) {
  const map = useMap();
  useEffect(() => {
    const features = selected ? DISTRICTS.features.filter((f) => f.properties.name === selected) : DISTRICTS.features;
    if (features.length === 0) return;
    const pad = map.getSize().x < 500 ? 6 : 20;
    map.fitBounds(geoJSON({ type: "FeatureCollection", features } as FeatureCollection).getBounds(), { padding: [pad, pad] });
  }, [map, selected]);
  return null;
}

/** Samarqand viloyati: every district cut out on the map and shaded by its number of households (click = filter). */
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
  const byName = useMemo(() => new Map(districts.map((d) => [d.name, d])), [districts]);
  const max = Math.max(0, ...districts.filter((d) => d.latitude !== null).map((d) => d.total));
  // the GeoJSON layer does not restyle on prop changes: remount it when the numbers or the selection change
  const signature = `${selected}|${districts.map((d) => `${d.name}:${d.total}:${d.overdue}`).join(",")}`;

  if (generation === 0) return <div className={className} aria-hidden />;

  const styleFor = (feature?: DistrictFeature): PathOptions => {
    const name = feature?.properties.name ?? "";
    const total = byName.get(name)?.total ?? 0;
    const isSelected = name === selected;
    return {
      fillColor: total > 0 ? districtColor(total, max).fill : EMPTY,
      fillOpacity: selected && !isSelected ? 0.45 : 0.86,
      color: isSelected ? NAVY : "#ffffff",
      weight: isSelected ? 3.5 : 1.5,
    };
  };

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const name = feature.properties.name;
    const d = byName.get(name);
    layer.bindTooltip(
      `<b>${escapeHtml(name)}</b><br/>Xonadonlar: <b>${d?.total ?? 0}</b> · jarayonda ${d?.inProgress ?? 0}` +
        (d && d.overdue > 0 ? `<br/><span style="color:${CRITICAL}">Muddati o‘tgan: ${d.overdue}</span>` : ""),
      { sticky: true, direction: "top", opacity: 0.95 },
    );
    layer.on({
      click: () => onSelect(name === selected ? null : name),
      mouseover: (e) => e.target.setStyle({ weight: 3, color: NAVY }),
      mouseout: (e) => e.target.setStyle(styleFor(feature)),
    });
  };

  return (
    <div className={cn("relative isolate z-0", className)}>
      <MapContainer key={generation} center={[39.85, 66.5]} zoom={8} zoomSnap={0.25} zoomDelta={0.5} scrollWheelZoom className="size-full">
        <TileLayer
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ${DISTRICTS.attribution}`}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitView selected={selected} />
        <Pane name="districts" style={{ zIndex: 350 }}>
          <GeoJSON key={signature} data={DISTRICTS} style={(f) => styleFor(f as DistrictFeature)} onEachFeature={onEachFeature} />
        </Pane>
        {DISTRICTS.features.map((f) => (
          <Marker
            key={`${f.properties.name}|${signature}`}
            position={f.properties.label}
            icon={labelIcon(f.properties.name, byName.get(f.properties.name), max)}
            interactive={false}
            keyboard={false}
          />
        ))}
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.latitude, p.longitude]}
            radius={selected ? 6 : 4}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: TONE_COLORS[toneOf(p.status, p.currentStage, p.overdue)], fillOpacity: 1 }}
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
      </MapContainer>
    </div>
  );
}
