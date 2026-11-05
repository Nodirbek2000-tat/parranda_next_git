"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS } from "@/lib/stats";
import { LegendKey } from "./legend";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Muted second line under the label (e.g. "4 xonadon · nobud 24 · o‘lim 1.6%"). */
  detail?: string;
}

interface DonutProps {
  segments: readonly DonutSegment[];
  /** Big label in the centre when nothing is hovered (default: the total). */
  centerValue?: string;
  centerLabel?: string;
  /** Formatter for values in the legend and centre. */
  format?: (value: number) => string;
  ariaLabel: string;
  size?: number;
  className?: string;
}

const STROKE = 16;
/** Surface gap between segments, in px along the ring. */
const SEGMENT_GAP = 2;

/** Shares of a whole: ring with 2 px gaps, legend with value and share. */
export function Donut({
  segments,
  centerValue,
  centerLabel = "Jami",
  format = (value) => formatNumber(value),
  ariaLabel,
  size = 148,
  className,
}: DonutProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? SEGMENT_GAP : 0;
  const active = segments.find((segment) => segment.key === hovered);

  const arcs: { segment: DonutSegment; dash: number; start: number }[] = [];
  let offset = 0;
  for (const segment of visible) {
    const length = (segment.value / total) * circumference;
    arcs.push({ segment, dash: Math.max(length - gap, 0.5), start: offset });
    offset += length;
  }

  return (
    <div className={cn("@container min-w-0", className)}>
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={ariaLabel}
            className="-rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={CHART_COLORS.track}
              strokeWidth={STROKE}
            />
            {arcs.map(({ segment, dash, start }) => (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-start}
                opacity={hovered === null || hovered === segment.key ? 1 : 0.35}
                className="transition-opacity"
                onPointerEnter={() => setHovered(segment.key)}
                onPointerLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <span className="text-lg font-semibold leading-tight tracking-tight text-ink">
              {active ? format(active.value) : (centerValue ?? format(total))}
            </span>
            <span className="mt-0.5 max-w-full truncate text-[11px] text-muted">
              {active ? active.label : centerLabel}
            </span>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1 text-[13px]">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors",
                hovered === segment.key && "bg-subtle",
              )}
              onPointerEnter={() => setHovered(segment.key)}
              onPointerLeave={() => setHovered(null)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <LegendKey color={segment.color} />
                {/* Wraps (whole words) instead of truncating: "Xonadonlarda" was cut to "Xonadonla…" in the batch "Tarkib"
                    card; the ring and legend now sit side by side only from a 28rem container. */}
                <span className="flex min-w-0 flex-col leading-snug">
                  <span className="text-ink">{segment.label}</span>
                  {segment.detail && <span className="text-xs tabular-nums text-muted">{segment.detail}</span>}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-ink">{format(segment.value)}</span>
                <span className="ml-2 inline-block w-12 text-right text-xs text-muted">
                  {total > 0 ? formatPercent((segment.value / total) * 100) : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Single share 0–100 % (report discipline): ring + centred value. */
export function ProgressRing({
  value,
  label,
  size = 132,
  tone = "accent",
  className,
}: {
  value: number | null;
  label: string;
  size?: number;
  tone?: "accent" | "warning" | "danger";
  className?: string;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value === null ? 0 : Math.min(Math.max(value, 0), 100);
  const color =
    tone === "danger" ? CHART_COLORS.danger : tone === "warning" ? CHART_COLORS.warning : CHART_COLORS.accent;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${value === null ? "ma’lumot yo‘q" : formatPercent(value)}`}
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={CHART_COLORS.track} strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          />
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-semibold tracking-tight text-ink">{formatPercent(value)}</span>
        <span className="mt-0.5 text-[11px] text-muted">{label}</span>
      </div>
    </div>
  );
}
