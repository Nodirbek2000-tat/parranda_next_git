"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/format";
import { describeDelta, formatKpiValue, KPI_META, type DeltaView } from "@/lib/stats";
import type { Kpi, KpiKey, StatsPeriod } from "@/lib/types";
import { Sparkline } from "@/components/charts/sparkline";

const DELTA_TONES: Record<DeltaView["tone"], string> = {
  good: "bg-accent-soft text-accent",
  bad: "bg-danger-soft text-danger",
  neutral: "bg-ink/[0.05] text-muted",
};

/** `▲ 5.5%` chip: arrow + number + hidden words, colour only reinforces the arrow. */
export function DeltaChip({ delta, title }: { delta: DeltaView; title?: string }) {
  const quality = delta.tone === "good" ? ", yaxshi" : delta.tone === "bad" ? ", yomon" : "";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md px-1.5 text-xs font-medium tabular-nums",
        DELTA_TONES[delta.tone],
      )}
    >
      <span className="sr-only">
        {delta.trend === "none"
          ? "Oldingi davr bilan taqqoslab bo‘lmaydi"
          : `Oldingi davrga nisbatan ${delta.words} ${delta.text.replace(/^[▲▼]\s?/, "")}${quality}`}
      </span>
      <span aria-hidden>{delta.text}</span>
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: DeltaView;
  /** Muted line under the value, e.g. "oldingi: 58 000" or "28.11.2026 gacha". */
  sub?: ReactNode;
  /** Second muted line, e.g. "markazda: 7 · jami: 45". */
  note?: ReactNode;
  /** Native tooltip for the delta (contract text "Oldingi davr: … : 58 000"). */
  deltaTitle?: string;
  /** Formula in words (title on the label). */
  hint?: string;
  tone?: "default" | "warning" | "danger";
  trend?: readonly (number | null)[];
  className?: string;
}

/** KPI card: 13 px muted label, 26 px semibold tabular value + unit, delta chip, optional sparkline. */
export function KpiCard({
  label,
  value,
  unit,
  delta,
  sub,
  note,
  deltaTitle,
  hint,
  tone = "default",
  trend,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-surface p-4 sm:p-5",
        tone === "warning" ? "border-warning/60" : tone === "danger" ? "border-danger/40" : "border-line",
        className,
      )}
    >
      <p className="line-clamp-2 text-[13px] leading-snug text-muted" title={hint}>
        {label}
      </p>
      {/* Numbers are never cut off: a long value wraps (at its regular spaces) instead of truncating. */}
      <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1">
        <span
          className={cn(
            "min-w-0 text-[22px] font-semibold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-[26px]",
            tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-ink" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit && <span className="shrink-0 text-[13px] text-muted">{unit}</span>}
      </p>
      {(delta || sub) && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {delta && <DeltaChip delta={delta} title={deltaTitle} />}
          {sub && <span className="min-w-0 text-xs text-muted">{sub}</span>}
        </div>
      )}
      {note && <p className="mt-1 min-w-0 text-xs leading-snug text-muted">{note}</p>}
      {trend && (
        <div className="mt-auto pt-3">
          <Sparkline values={trend} />
        </div>
      )}
    </div>
  );
}

/** Splits "81.3%" / "61 200 dona" into value and unit for the card layout. */
function splitValue(key: KpiKey, value: number | null): { value: string; unit?: string } {
  const meta = KPI_META[key];
  if (value === null) return { value: "—" };
  if (meta.percent) return { value: formatKpiValue(key, value) };
  return { value: formatKpiValue(key, value, false), unit: meta.unit || undefined };
}

/**
 * "oldingi: 58 000" — a tap (touch has no hover) switches to the previous period's dates,
 * the same text as the tooltip: "06.09.2026 – 05.10.2026: 58 000".
 */
function PreviousNote({ text, range }: { text: string; range: string | null }) {
  const [open, setOpen] = useState(false);
  if (!range) return <span>{text}</span>;
  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      title={`Oldingi davr: ${range}`}
      aria-expanded={open}
      className="rounded-sm text-left underline decoration-dotted decoration-muted/50 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {open ? `${range}: ${text.replace(/^oldingi:\s*/, "")}` : text}
    </button>
  );
}

/** KPI object of the stats API (value / previous / delta) rendered by the direction table of 1.2. */
export function StatKpiCard({
  kpiKey,
  kpi,
  period,
  label,
  note,
  hint,
  tone,
  trend,
  className,
}: {
  kpiKey: KpiKey;
  kpi: Kpi;
  period?: StatsPeriod;
  label?: string;
  note?: ReactNode;
  hint?: string;
  tone?: KpiCardProps["tone"];
  trend?: readonly (number | null)[];
  className?: string;
}) {
  const meta = KPI_META[kpiKey];
  const shown = splitValue(kpiKey, kpi.value);
  const previous = formatKpiValue(kpiKey, kpi.previous);
  const range = period?.previous_from ? formatRange(period.previous_from, period.previous_to) : null;
  const comparable = kpi.delta !== null && kpi.delta !== undefined && Number.isFinite(kpi.delta);
  // No comparison: no grey "—" chip; say WHY in words instead.
  const noPrevious = kpi.previous === null || kpi.previous === 0;
  const sub = comparable || !noPrevious ? (
    <PreviousNote text={`oldingi: ${previous}`} range={range} />
  ) : (
    <span title={range ? `Oldingi davr: ${range}` : undefined}>oldingi davrda ma’lumot yo‘q</span>
  );
  return (
    <KpiCard
      label={label ?? meta.label}
      hint={hint ?? meta.hint}
      value={shown.value}
      unit={shown.unit}
      delta={comparable ? describeDelta(kpi, meta.direction) : undefined}
      deltaTitle={range ? `Oldingi davr: ${range}: ${previous}` : undefined}
      sub={sub}
      note={note}
      tone={tone}
      trend={trend}
      className={className}
    />
  );
}
