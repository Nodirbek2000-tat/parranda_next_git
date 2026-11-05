import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SummaryItem = readonly [label: string, value: ReactNode];

/** Label / value list used in confirmations and profile cards. */
export function Summary({ items, className }: { items: readonly SummaryItem[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line rounded-lg border border-line text-sm", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
          <dt className="shrink-0 text-muted">{label}</dt>
          {/* Long values (contract notes, addresses) wrap inside the card instead of running past its edge. */}
          <dd className="min-w-0 max-w-[65%] text-right font-medium text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
