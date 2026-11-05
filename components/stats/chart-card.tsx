import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Headline number at the top right ("Jami: 61 200 dona"). */
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Card for one chart or one stats table: title row, then the plot with even padding. */
export function ChartCard({
  title,
  description,
  summary,
  actions,
  children,
  className,
  bodyClassName,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {(summary || actions) && (
          <div className="flex shrink-0 items-center gap-2">
            {summary && <p className="text-[13px] tabular-nums text-muted">{summary}</p>}
            {actions}
          </div>
        )}
      </header>
      <div className={cn("min-w-0 flex-1 px-4 pb-4 pt-4 sm:px-6 sm:pb-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function KpiGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" role="status" aria-label="Yuklanmoqda">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6"
      role="status"
      aria-label="Yuklanmoqda"
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 w-full" style={{ height }} />
    </div>
  );
}

export function StatsPageSkeleton({ kpis = 8, charts = 4 }: { kpis?: number; charts?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <KpiGridSkeleton count={kpis} />
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        {Array.from({ length: charts }, (_, index) => (
          <ChartSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
