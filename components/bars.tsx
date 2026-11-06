import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Small CSS bar charts for reports (no chart library). Thin rounded bars on a light track,
 * values as text beside the bar (identity never by colour alone), native hover titles.
 */

export interface BarDatum {
  key: string;
  label: ReactNode;
  value: number;
  /** text shown at the right; default is the value */
  display?: ReactNode;
  /** hover text */
  title?: string;
  tone?: "accent" | "danger" | "muted" | "primary";
  href?: string;
}

const TONES = { accent: "bg-accent", danger: "bg-danger", muted: "bg-line-strong", primary: "bg-primary" } as const;

export function BarList({ data, max, empty = "Ma’lumot yo‘q." }: { data: BarDatum[]; max?: number; empty?: string }) {
  if (!data.length) return <p className="text-sm text-muted">{empty}</p>;
  const top = Math.max(1, max ?? Math.max(...data.map((d) => Math.abs(d.value))));
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.key} title={d.title} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{d.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">{d.display ?? d.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
            <div
              className={cn("h-full rounded-full transition-[width] group-hover:opacity-80", TONES[d.tone ?? "accent"])}
              style={{ width: `${d.value > 0 ? Math.max(2, (Math.abs(d.value) / top) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One stacked bar split in two (e.g. on time vs late), with a labelled legend and percentages. */
export function SplitBar({
  left,
  right,
}: {
  left: { label: string; value: number; tone?: keyof typeof TONES };
  right: { label: string; value: number; tone?: keyof typeof TONES };
}) {
  const total = left.value + right.value;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${left.label}: ${left.value}, ${right.label}: ${right.value}`}>
        {left.value > 0 && (
          <div title={`${left.label}: ${left.value} (${pct(left.value)}%)`} className={cn("h-full", TONES[left.tone ?? "accent"])} style={{ width: `${(left.value / total) * 100}%` }} />
        )}
        {right.value > 0 && (
          <div title={`${right.label}: ${right.value} (${pct(right.value)}%)`} className={cn("h-full", TONES[right.tone ?? "danger"])} style={{ width: `${(right.value / total) * 100}%` }} />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
        <LegendItem tone={left.tone ?? "accent"} label={left.label} value={`${left.value} (${pct(left.value)}%)`} />
        <LegendItem tone={right.tone ?? "danger"} label={right.label} value={`${right.value} (${pct(right.value)}%)`} />
      </div>
    </div>
  );
}

function LegendItem({ tone, label, value }: { tone: keyof typeof TONES; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", TONES[tone])} aria-hidden />
      <span className="text-muted">{label}:</span>
      <b className="tabular-nums">{value}</b>
    </span>
  );
}
