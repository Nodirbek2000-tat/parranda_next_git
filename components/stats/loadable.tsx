"use client";

import type { ReactNode } from "react";
import { ChartNoAxesColumn, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ApiResource } from "@/lib/use-api";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";

export const NO_DATA_TEXT = "Tanlangan davrda ma’lumot yo‘q";

/**
 * Loading / error / stale states of one API resource (6.2: every section has a
 * skeleton, an empty state and an error state with retry). While a new period
 * loads, the previous numbers stay on screen, dimmed.
 */
export function Loadable<T>({
  resource,
  skeleton,
  children,
  className,
}: {
  resource: ApiResource<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
  className?: string;
}) {
  if (!resource.data) {
    if (resource.error) {
      return (
        <Card className={className}>
          {/* A 400 is a bad period or filter: retrying the same request cannot help. */}
          <ErrorState error={resource.error} onRetry={resource.error.status === 400 ? undefined : resource.reload} />
        </Card>
      );
    }
    return <>{skeleton}</>;
  }
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 sm:gap-5", className)}>
      {resource.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={resource.error} onRetry={resource.reload} className="border-b-0" />
        </Card>
      )}
      <div
        className={cn("flex min-w-0 flex-col gap-4 transition-opacity sm:gap-5", resource.loading && "opacity-60")}
        aria-busy={resource.loading || undefined}
      >
        {children(resource.data)}
      </div>
    </div>
  );
}

/** Empty chart / table body: icon + one line. */
export function NoData({ icon = ChartNoAxesColumn, title = NO_DATA_TEXT }: { icon?: LucideIcon; title?: string }) {
  return <EmptyState icon={icon} title={title} className="py-8" />;
}
