"use client";

import { useState } from "react";
import { formatDate, formatDayMonth, formatNumber } from "@/lib/format";

export interface BarDatum {
  date: string;
  value: number;
}

interface MiniBarChartProps {
  title: string;
  unit: string;
  data: readonly BarDatum[];
  /** Decimals of the values (feed / meat 1, counts 0). */
  digits?: number;
  /**
   * The last bar is today, which is not over yet: drawn lighter with a dashed outline and this note
   * (e.g. "bugun, 4 / 5 hisobot"), so a partial day never reads as a sudden drop.
   */
  partialLast?: string;
  /** Window caption before the total (default "14 kun"). */
  windowLabel?: string;
  /** Full label of a bar (default DD.MM.YYYY) and the axis ticks (default DD.MM). */
  formatLabel?: (key: string) => string;
  formatTick?: (key: string) => string;
}

const WIDTH = 280;
const HEIGHT = 112;
const GAP = 4;
const RADIUS = 3;

/** Bar with rounded data end and a flat baseline. */
function barPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return "";
  const r = Math.min(RADIUS, width / 2, height);
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${bottom}`,
    "Z",
  ].join(" ");
}

/** Single-series daily bar chart (plain SVG, one axis, hover read-out). */
export function MiniBarChart({
  title,
  unit,
  data,
  digits = 0,
  partialLast,
  windowLabel = "14 kun",
  formatLabel = formatDate,
  formatTick = formatDayMonth,
}: MiniBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((item) => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const slot = data.length > 0 ? WIDTH / data.length : WIDTH;
  const barWidth = Math.max(2, slot - GAP);
  const activeIndex = hovered ?? data.length - 1;
  const active = data[activeIndex];
  const last = data.length - 1;
  const fmt = (value: number) => formatNumber(value, digits);

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{title}</span>
        <span className="text-[13px] tabular-nums text-muted">
          {windowLabel}: <span className="font-medium text-ink">{fmt(total)}</span> {unit}
        </span>
      </figcaption>

      <p className="mt-2 h-7 text-lg font-semibold tabular-nums text-ink" aria-live="polite">
        {active ? (
          <>
            {fmt(active.value)} <span className="text-sm font-normal text-muted">{unit}</span>
            <span className="ml-2 text-[13px] font-normal text-muted">
              {formatLabel(active.date)}
              {partialLast && activeIndex === last ? ` · ${partialLast}` : ""}
            </span>
          </>
        ) : (
          "—"
        )}
      </p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-2 h-28 w-full"
        role="img"
        aria-label={`${title}: so‘nggi ${windowLabel}, jami ${fmt(total)} ${unit}${partialLast ? `; oxirgi kun: ${partialLast}` : ""}`}
        onMouseLeave={() => setHovered(null)}
      >
        <line x1="0" x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke="#DCE3DA" strokeWidth="1" />
        {data.map((item, index) => {
          const height = max > 0 ? (item.value / max) * (HEIGHT - 4) : 0;
          const x = index * slot + GAP / 2;
          const isActive = hovered === null ? index === data.length - 1 : hovered === index;
          const partial = Boolean(partialLast) && index === last;
          return (
            <g key={item.date}>
              <path
                d={barPath(x, HEIGHT - height, barWidth, height)}
                fill="#2F6B3F"
                fillOpacity={partial ? 0.28 : isActive ? 1 : 0.55}
                stroke={partial ? "#2F6B3F" : undefined}
                strokeDasharray={partial ? "3 2" : undefined}
                strokeWidth={partial ? 1 : undefined}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={index * slot}
                y={0}
                width={slot}
                height={HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onTouchStart={() => setHovered(index)}
              >
                <title>{`${formatLabel(item.date)}: ${fmt(item.value)} ${unit}${partialLast && index === last ? ` (${partialLast})` : ""}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {data.length > 0 && (
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted" aria-hidden>
          <span>{formatTick(data[0].date)}</span>
          <span>{formatTick(data[data.length - 1].date)}</span>
        </div>
      )}

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Sana</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.date}>
              <td>{formatLabel(item.date)}</td>
              <td>{fmt(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
