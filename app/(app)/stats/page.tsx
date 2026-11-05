import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatsOverview } from "@/features/stats/stats-overview";

/** /stats — ADMIN, WAREHOUSE (route guard in lib/nav.ts). Period lives in the URL. */
export default function StatsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsOverview />
    </Suspense>
  );
}
