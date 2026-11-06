"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Card, PageHeader, Select, Spinner } from "@/components/ui";
import { TONE_COLORS, type MapPoint, type PointTone } from "@/components/map/leaflet-map";
import { listOf } from "@/lib/api";
import { SAMARQAND_DISTRICTS } from "@/lib/districts";
import { fmtNumber } from "@/lib/format";
import { STAGES } from "@/lib/stages";
import type { CaseSummary, Paged } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Leaflet touches `window`, so the map itself is client-only. */
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => <Spinner label="Xarita yuklanmoqda…" />,
});

const LEGEND: { tone: PointTone; label: string }[] = [
  { tone: "growing", label: "Parvarishda" },
  { tone: "progress", label: "Jarayonda" },
  { tone: "overdue", label: "Muddati o‘tgan" },
  { tone: "done", label: "Yakunlangan" },
  { tone: "rejected", label: "Rad etilgan" },
];

type CaseWithCoords = CaseSummary;

function toneOf(item: CaseWithCoords): PointTone {
  if (item.status === "DONE") return "done";
  if (item.status === "REJECTED") return "rejected";
  if (item.is_overdue) return "overdue";
  return item.current_stage === 10 ? "growing" : "progress";
}

function toPoint(item: CaseWithCoords): MapPoint | null {
  const lat = Number(item.latitude);
  const lng = Number(item.longitude);
  if (item.latitude === null || item.latitude === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const stage = STAGES.find((s) => s.number === item.current_stage);
  const summary = item.summary;
  return {
    id: item.id,
    latitude: lat,
    longitude: lng,
    code: item.code,
    title: item.owner_full_name || item.name || "—",
    place: [item.district, item.mfy].filter(Boolean).join(", "),
    stage:
      item.status === "IN_PROGRESS"
        ? `${item.current_stage}. ${item.current_stage_title || stage?.title || ""}`
        : item.status_display,
    birds: summary?.birds ?? null,
    days:
      summary && summary.days_since_delivery !== null
        ? `${summary.days_since_delivery}-kun / ${summary.growing_days}`
        : null,
    tone: toneOf(item),
    href: `/cases/${item.id}`,
  };
}

/** /map — Super Admin: every household with a location on the real map. */
export default function MapPage() {
  const [district, setDistrict] = useState("");
  const resource = useApi<Paged<CaseSummary>>("/cases", { district });
  const items = resource.data ? (listOf(resource.data) as CaseWithCoords[]) : [];
  const points = items.map(toPoint).filter((p): p is MapPoint => p !== null);
  const birds = points.reduce((sum, p) => sum + (p.birds ?? 0), 0);
  const missing = items.length - points.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Xarita"
        subtitle={
          resource.data
            ? `${fmtNumber(points.length)} ta xonadon · ${fmtNumber(birds)} bosh parranda` +
              (missing > 0 ? ` · ${missing} tasining joylashuvi yo‘q` : "")
            : "Xonadonlar joylashuvi"
        }
        actions={
          <Select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Tuman yoki shahar" className="w-56">
            <option value="">Barcha tumanlar</option>
            {SAMARQAND_DISTRICTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted" aria-label="Belgilar">
        {LEGEND.map((entry) => (
          <span key={entry.tone} className="flex items-center gap-1.5">
            <span className="size-3 rounded-full ring-2 ring-white" style={{ background: TONE_COLORS[entry.tone] }} aria-hidden />
            {entry.label}
          </span>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        {resource.error && !resource.data ? (
          <p className="p-6 text-sm text-danger">{resource.error}</p>
        ) : (
          <div className="relative h-[calc(100dvh-15rem)] min-h-96">
            <LeafletMap points={points} className="size-full" />
            {resource.data && points.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4">
                <p className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted shadow-sm">
                  <MapPin className="size-4 text-accent" aria-hidden />
                  Joylashuvi belgilangan xonadon yo‘q
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
