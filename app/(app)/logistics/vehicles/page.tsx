import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { VehiclesPage } from "@/features/logistics/vehicles-page";

/** /logistics/vehicles — A, L (W read-only via the API). */
export default function LogisticsVehiclesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VehiclesPage />
    </Suspense>
  );
}
