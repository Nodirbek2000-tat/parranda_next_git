"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatCompact, formatDate, formatDayMonth } from "@/lib/format";
import { CHART_COLORS } from "@/lib/stats";
import { columnPath, labelIndices, niceTicks } from "./scale";
import { useElementWidth } from "./use-width";
import { ChartLegend, type LegendItem } from "./legend";

export interface TimeSeries {
  key: string;
  label: string;
  color: string;
  /** One value per date; `null` breaks a line (no data that day). */
  values: readonly (number | null)[];
  kind?: "line" | "area" | "bar";
  /** Draw the line as steps (counts that change at day boundaries). */
  step?: boolean;
  dashed?: boolean;
  /** Area wash colour (default: accent at 12 %, contract 6.2). */
  fill?: string;
  /**
   * Values of report-based sums (meat, feed) mean nothing on a day without reports: with `missing`
   * set on the chart they become gaps (default). `false` keeps the value (e.g. deaths from movements).
   */
  gapWhenMissing?: boolean;
}

export interface ReferenceLine {
  value: number;
  label: string;
  color?: string;
}

interface TimeChartProps {
  /** `YYYY-MM-DD`, oldest first (contract series order). */
  dates: readonly string[];
  series: readonly TimeSeries[];
  /** Tooltip / table value formatter (with unit). */
  format: (value: number) => string;
  /** Y axis tick formatter (compact). */
  axisFormat?: (value: number) => string;
  height?: number;
  reference?: ReferenceLine;
  /** Accessible summary, e.g. "Go‘sht, 30 kun, jami 1 250 kg". */
  ariaLabel: string;
  /** Force a legend (default: shown for two or more series). */
  legend?: boolean;
  /**
   * Per date: true = no report that day (“ma’lumot yo‘q”). Such days get a hatched band, report-based
   * series are not drawn there (a gap, never a fake 0) and the tooltip says “Hisobot kiritilmagan”.
   */
  missing?: readonly boolean[];
  /** Tooltip / legend text for `missing` days. */
  missingLabel?: string;
  className?: string;
}

const MARGIN = { top: 10, right: 10, bottom: 26 };
/** Approximate width of an 11 px tabular digit in IBM Plex Sans. */
const CHAR_WIDTH = 6.4;
const BAR_MAX = 24;
const BAR_GAP = 2;

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True when the chart would show nothing but a flat zero line. */
export function isEmptySeries(series: readonly Pick<TimeSeries, "values">[]): boolean {
  return series.every((item) => item.values.every((value) => !isNumber(value) || value === 0));
}

/**
 * Daily time-series chart in plain SVG: area, line (optionally stepped) and
 * column series on one shared y axis. 3–4 "nice" y ticks, ≤ 6 `DD.MM` x labels,
 * crosshair + tooltip on hover / tap / arrow keys, `null` points break lines.
 * Responsive: drawn at the container's pixel width (ResizeObserver).
 */
export function TimeChart({
  dates,
  series: rawSeries,
  format,
  axisFormat = formatCompact,
  height = 200,
  reference,
  ariaLabel,
  legend,
  missing,
  missingLabel = "Hisobot kiritilmagan",
  className,
}: TimeChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  // Measured tooltip width: the box is kept inside the chart (at 360 px a 14rem box placed beside a
  // point in the middle used to stick out of the card and scroll the whole page sideways).
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  useLayoutEffect(() => {
    const next = tooltipRef.current?.offsetWidth ?? 0;
    setTooltipWidth((current) => (current === next ? current : next));
  }, [active, width]);
  const clipId = useId();
  const hatchId = useId();
  const count = dates.length;
  const isMissing = (index: number) => Boolean(missing?.[index]);
  const anyMissing = Boolean(missing?.some(Boolean));
  // Report-based sums become gaps on days without reports (a fake 0 would read as “no meat”).
  const series: readonly TimeSeries[] = missing
    ? rawSeries.map((item) =>
        item.gapWhenMissing === false
          ? item
          : { ...item, values: item.values.map((value, index) => (isMissing(index) ? null : value)) },
      )
    : rawSeries;

  const all = series.flatMap((item) => item.values.filter(isNumber));
  if (reference) all.push(reference.value);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 3);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const tickLabels = ticks.map(axisFormat);
  const left = Math.ceil(Math.max(...tickLabels.map((label) => label.length)) * CHAR_WIDTH) + 10;
  const plotWidth = Math.max(width - left - MARGIN.right, 10);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const bars = series.filter((item) => item.kind === "bar");
  const banded = bars.length > 0;
  const slot = count > 0 ? plotWidth / count : plotWidth;

  const x = (index: number) =>
    banded ? left + slot * (index + 0.5) : left + (count <= 1 ? plotWidth / 2 : (plotWidth * index) / (count - 1));
  const y = (value: number) => MARGIN.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const baseline = y(Math.max(yMin, 0));

  // Bars: ≤ 24 px, 2 px surface gap between neighbours, the rest of the band stays air.
  // Grouped bars (2 series) on narrow slots (e.g. 41 days at 390 px) keep less air and drop the inner
  // gap once a bar would be thinner than 3 px; otherwise they were drawn 1.3 px wide (a hairline).
  const grouped = bars.length > 1;
  const air = slot >= 6 ? Math.max(2, slot * (grouped ? 0.15 : 0.28)) : slot >= 3 ? 1 : 0;
  const baseGap = slot >= 6 ? BAR_GAP : 0;
  const groupWidth = Math.max(1, Math.min(slot - air, bars.length * BAR_MAX + (bars.length - 1) * baseGap));
  const gap =
    grouped && (groupWidth - (bars.length - 1) * baseGap) / bars.length < 3 ? 0 : baseGap;
  const barWidth = Math.max(1, (groupWidth - (bars.length - 1) * gap) / Math.max(bars.length, 1));

  const maxLabels = Math.max(2, Math.min(6, Math.floor(plotWidth / 52)));
  const xLabels = labelIndices(count, maxLabels);

  const indexAt = (clientX: number, target: Element) => {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left - left;
    const raw = banded ? Math.floor(px / slot) : count <= 1 ? 0 : Math.round(px / (plotWidth / (count - 1)));
    return Math.min(count - 1, Math.max(0, raw));
  };

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (count === 0) return;
    setActive(indexAt(event.clientX, event.currentTarget));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + (current === null ? 0 : delta))));
    } else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(count - 1);
    else if (event.key === "Escape") setActive(null);
  };

  const legendItems: LegendItem[] = series.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    shape: item.kind === "bar" || item.kind === "area" ? "square" : item.dashed ? "dashed" : "line",
  }));
  if (anyMissing) {
    legendItems.push({ key: "__missing", label: missingLabel.toLowerCase(), color: CHART_COLORS.axis, shape: "hatch" });
  }
  const showLegend = legend ?? (series.length > 1 || anyMissing);
  const activeX = active !== null ? x(active) : 0;
  // Beside the point (right half: to its left), then clamped to the chart box.
  const tooltipLeft = Math.max(
    0,
    Math.min(
      Math.max(width - tooltipWidth, 0),
      activeX > width / 2 ? activeX - 10 - tooltipWidth : activeX + 10,
    ),
  );

  // Contiguous runs of missing days → one hatched band each.
  const missingRuns: [number, number][] = [];
  if (anyMissing) {
    let start: number | null = null;
    for (let index = 0; index <= count; index += 1) {
      if (index < count && isMissing(index)) {
        if (start === null) start = index;
      } else if (start !== null) {
        missingRuns.push([start, index - 1]);
        start = null;
      }
    }
  }
  const step = banded ? slot : count > 1 ? plotWidth / (count - 1) : plotWidth;
  const bandStart = (index: number) => (banded ? left + slot * index : Math.max(left, x(index) - step / 2));
  const bandEnd = (index: number) =>
    banded ? left + slot * (index + 1) : Math.min(left + plotWidth, x(index) + step / 2);

  return (
    <figure className={cn("min-w-0", className)}>
      {showLegend && <ChartLegend items={legendItems} className="mb-3" />}
      <div
        ref={containerRef}
        className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        style={{ height }}
        tabIndex={count > 0 ? 0 : undefined}
        role="group"
        aria-label={`${ariaLabel}. Kunlarni ko‘rish uchun chap va o‘ng strelkalardan foydalaning.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? (count > 0 ? count - 1 : null))}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={ariaLabel}
            className="block touch-pan-y select-none"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setActive(null);
            }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={left} y={MARGIN.top - 4} width={plotWidth} height={plotHeight + 4} />
              </clipPath>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={CHART_COLORS.axis} strokeWidth="1" strokeOpacity="0.22" />
              </pattern>
            </defs>

            {missingRuns.map(([from, to]) => (
              <rect
                key={`m${from}`}
                x={bandStart(from)}
                y={MARGIN.top}
                width={Math.max(bandEnd(to) - bandStart(from), 1)}
                height={plotHeight}
                fill={`url(#${hatchId})`}
              />
            ))}

            {ticks.map((tick, index) => (
              <g key={tick}>
                <line
                  x1={left}
                  x2={left + plotWidth}
                  y1={Math.round(y(tick)) + 0.5}
                  y2={Math.round(y(tick)) + 0.5}
                  stroke={tick === 0 ? "#D3DCD1" : CHART_COLORS.grid}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={left - 8}
                  y={y(tick) + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  fill={CHART_COLORS.axis}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tickLabels[index]}
                </text>
              </g>
            ))}

            {active !== null && banded && (
              <rect
                x={left + slot * active}
                y={MARGIN.top}
                width={slot}
                height={plotHeight}
                fill="#12372A"
                opacity={0.04}
              />
            )}

            {/* Columns */}
            {bars.map((item, barIndex) => (
              <g key={item.key} fill={item.color}>
                {item.values.map((value, index) => {
                  if (!isNumber(value) || value <= 0) return null;
                  const bx = x(index) - groupWidth / 2 + barIndex * (barWidth + gap);
                  const top = y(value);
                  return (
                    <path
                      key={dates[index]}
                      d={columnPath(bx, top, barWidth, Math.max(baseline - top, 1), 2)}
                      opacity={active === null || active === index ? 1 : 0.55}
                    />
                  );
                })}
              </g>
            ))}

            {/* Areas and lines */}
            <g clipPath={`url(#${clipId})`}>
              {series
                .filter((item) => item.kind !== "bar")
                .map((item) => (
                  <LineSeries key={item.key} item={item} x={x} y={y} baseline={baseline} />
                ))}
            </g>

            {reference && (
              <g>
                <line
                  x1={left}
                  x2={left + plotWidth}
                  y1={y(reference.value)}
                  y2={y(reference.value)}
                  stroke={reference.color ?? CHART_COLORS.danger}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                <text
                  x={left + plotWidth}
                  // At the top of the plot the label goes under the line (above it would be clipped).
                  y={y(reference.value) - 6 - 11 < 0 ? y(reference.value) + 15 : y(reference.value) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fill={CHART_COLORS.axis}
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {reference.label}
                </text>
              </g>
            )}

            {xLabels.map((index) => {
              const half = 17;
              const tx = Math.min(left + plotWidth - half, Math.max(left + half, x(index)));
              return (
                <text
                  key={dates[index]}
                  x={tx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill={CHART_COLORS.axis}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatDayMonth(dates[index])}
                </text>
              );
            })}

            {active !== null && (
              <g pointerEvents="none">
                {!banded && (
                  <line
                    x1={activeX}
                    x2={activeX}
                    y1={MARGIN.top}
                    y2={MARGIN.top + plotHeight}
                    stroke={CHART_COLORS.primary}
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                )}
                {series
                  .filter((item) => item.kind !== "bar")
                  .map((item) => {
                    const value = item.values[active];
                    if (!isNumber(value)) return null;
                    return (
                      <circle
                        key={item.key}
                        cx={activeX}
                        cy={y(value)}
                        r={4}
                        fill={item.color}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    );
                  })}
              </g>
            )}
          </svg>
        )}

        {active !== null && width > 0 && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute top-0 z-10 w-max min-w-36 max-w-[min(14rem,100%)] rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-[0_4px_16px_rgb(18_55_42/0.12)] backdrop-blur"
            style={{ left: tooltipLeft, visibility: tooltipWidth > 0 ? undefined : "hidden" }}
          >
            <p className="font-medium tabular-nums text-ink">{formatDate(dates[active])}</p>
            {isMissing(active) && <p className="mt-0.5 text-muted">{missingLabel}</p>}
            <ul className="mt-1 flex flex-col gap-0.5">
              {series.map((item) => {
                const value = item.values[active];
                if (isMissing(active) && item.gapWhenMissing !== false) return null;
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted">
                      <span
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-ink">
                      {isNumber(value) ? format(value) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {active !== null
          ? `${formatDate(dates[active])}: ${series
              .map(
                (item) =>
                  `${item.label} ${isNumber(item.values[active]) ? format(item.values[active] as number) : "ma’lumot yo‘q"}`,
              )
              .join(", ")}${isMissing(active) ? `. ${missingLabel}` : ""}`
          : ""}
      </p>
      <ChartDataTable caption={ariaLabel} dates={dates} series={series} format={format} />
    </figure>
  );
}

function LineSeries({
  item,
  x,
  y,
  baseline,
}: {
  item: TimeSeries;
  x: (index: number) => number;
  y: (value: number) => number;
  baseline: number;
}) {
  const segments: [number, number][] = [];
  let start: number | null = null;
  item.values.forEach((value, index) => {
    if (isNumber(value)) {
      if (start === null) start = index;
    } else if (start !== null) {
      segments.push([start, index - 1]);
      start = null;
    }
  });
  if (start !== null) segments.push([start, item.values.length - 1]);

  const path = ([from, to]: [number, number]) => {
    let d = `M${x(from)},${y(item.values[from] as number)}`;
    for (let index = from + 1; index <= to; index += 1) {
      const value = item.values[index] as number;
      d += item.step ? `H${x(index)}V${y(value)}` : `L${x(index)},${y(value)}`;
    }
    return d;
  };

  return (
    <g>
      {item.kind === "area" &&
        segments.map((segment) => (
          <path
            key={`a${segment[0]}`}
            d={`${path(segment)}L${x(segment[1])},${baseline}L${x(segment[0])},${baseline}Z`}
            fill={item.fill ?? CHART_COLORS.accent}
            fillOpacity={0.12}
          />
        ))}
      {segments.map((segment) =>
        segment[0] === segment[1] ? (
          <circle
            key={`p${segment[0]}`}
            cx={x(segment[0])}
            cy={y(item.values[segment[0]] as number)}
            r={3}
            fill={item.color}
          />
        ) : (
          <path
            key={`l${segment[0]}`}
            d={path(segment)}
            fill="none"
            stroke={item.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={item.dashed ? "4 4" : undefined}
          />
        ),
      )}
    </g>
  );
}

/** Visually hidden table: the same numbers for screen readers. */
export function ChartDataTable({
  caption,
  dates,
  series,
  format,
}: {
  caption: string;
  dates: readonly string[];
  series: readonly Pick<TimeSeries, "key" | "label" | "values">[];
  format: (value: number) => string;
}) {
  // The wrapper is the 1 px clipped box: a <table> itself cannot be narrower than its cells, so a
  // `table.sr-only` spilled its columns past the screen and widened the page to ~580 px at 360 px.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Sana</th>
            {series.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, index) => (
            <tr key={date}>
              <th scope="row">{formatDate(date)}</th>
              {series.map((item) => {
                const value = item.values[index];
                return <td key={item.key}>{isNumber(value) ? format(value) : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
