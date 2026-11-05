import { cn } from "@/lib/cn";

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  shape?: "square" | "line" | "dashed" | "hatch";
  /** Optional value printed after the label (muted). */
  value?: string;
}

/** Legend in text colours; the coloured key beside the label carries identity. */
export function ChartLegend({ items, className }: { items: readonly LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <LegendKey color={item.color} shape={item.shape} />
          <span className="text-ink/80">{item.label}</span>
          {item.value && <span className="tabular-nums text-muted">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function LegendKey({ color, shape = "square" }: { color: string; shape?: LegendItem["shape"] }) {
  if (shape === "hatch")
    return (
      <span
        className="size-2.5 shrink-0 rounded-[3px] border border-line"
        style={{ backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1px, transparent 1px 4px)` }}
        aria-hidden
      />
    );
  if (shape === "square")
    return <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden />;
  return (
    <svg width="14" height="4" viewBox="0 0 14 4" className="shrink-0" aria-hidden>
      <line
        x1="1"
        x2="13"
        y1="2"
        y2="2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={shape === "dashed" ? "3 3" : undefined}
      />
    </svg>
  );
}
