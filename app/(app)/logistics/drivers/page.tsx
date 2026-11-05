import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { DriversPage } from "@/features/logistics/drivers-page";

/** /logistics/drivers — A, L (W read-only via the API). */
export default function LogisticsDriversPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DriversPage />
    </Suspense>
  );
}
