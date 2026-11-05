"use client";

import { cn } from "@/lib/cn";

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** Optional counter shown next to the label. */
  count?: number;
}

/**
 * Segmented tabs (scrolls horizontally on phones). Controlled: keep the active key in the URL
 * (`?tab=`) so the view survives reloads and links (V3 §15.3 “Filters live in the URL”).
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1", className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active ? "bg-primary font-medium text-white" : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-md px-1.5 text-xs tabular-nums",
                  active ? "bg-white/15 text-white" : "bg-ink/5 text-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
