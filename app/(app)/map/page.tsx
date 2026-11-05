"use client";

import { MapPin } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { HouseholdMapPoint } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { MapView, toMapPoint } from "@/components/map/map-view";

export default function MapPage() {
  const map = useApi<HouseholdMapPoint[]>("/households/map");
  const points = map.data ?? [];
  const birds = points.reduce((sum, point) => sum + point.bird_count, 0);
  const inactive = points.filter((point) => !point.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Xarita"
        description={
          map.data
            ? `${formatNumber(points.length)} ta xonadon · ${formatNumber(birds)} parranda`
            : "Joylashuvi belgilangan xonadonlar"
        }
        actions={
          <div className="flex items-center gap-4 text-[13px] text-muted" aria-label="Belgilar">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-accent ring-2 ring-white" aria-hidden />
              Faol
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-muted ring-2 ring-white" aria-hidden />
              Nofaol{inactive > 0 ? ` (${formatNumber(inactive)})` : ""}
            </span>
          </div>
        }
      />
      <Card className="overflow-hidden">
        {map.error && !map.data ? (
          <ErrorState error={map.error} onRetry={map.reload} />
        ) : (
          <div className="relative h-[calc(var(--app-height)_-_15rem)] min-h-96 lg:h-[calc(var(--app-height)_-_13rem)]">
            <MapView points={points.map(toMapPoint)} className="size-full" />
            {map.data && points.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
                <p className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted shadow-sm">
                  <MapPin className="size-4 text-accent" aria-hidden />
                  Hali birorta xonadon joylashuvi belgilanmagan
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
