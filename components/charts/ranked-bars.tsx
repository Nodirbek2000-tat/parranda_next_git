import Link from "next/link";
import { cn } from "@/lib/cn";
import { CHART_COLORS } from "@/lib/stats";

export interface RankedBar {
  key: string | number;
  label: string;
  sublabel?: string;
  href?: string;
  value: number;
  /** Formatted value printed at the bar end (text colour, not the bar colour). */
  display: string;
  /** Muted extra after the value, e.g. a share "40.0%". */
  extra?: string;
  color?: string;
}

/**
 * Ranked horizontal bars (HBarChart): label + value on one line, a thin bar
 * below, largest first. Plain HTML so labels never collide or get clipped.
 */
export function RankedBars({
  rows,
  caption,
  color = CHART_COLORS.accent,
  className,
}: {
  rows: readonly RankedBar[];
  caption: string;
  color?: string;
  className?: string;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="sr-only">{caption}</figcaption>
      <ol className="flex flex-col gap-3.5">
        {rows.map((row) => {
          const share = max > 0 ? Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0) : 0;
          const label = (
            <span className="min-w-0 break-words">
              <span className="font-medium text-ink">{row.label}</span>
              {row.sublabel && <span className="ml-1.5 text-xs text-muted">{row.sublabel}</span>}
            </span>
          );
          return (
            <li key={row.key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="flex min-w-0 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <span className="shrink-0 tabular-nums">
                  <span className="font-medium text-ink">{row.display}</span>
                  {row.extra && <span className="ml-1.5 text-xs text-muted">{row.extra}</span>}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.04]" aria-hidden>
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${share}%`, backgroundColor: row.color ?? color }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
