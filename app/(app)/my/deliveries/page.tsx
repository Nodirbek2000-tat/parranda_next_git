import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MyDeliveries } from "@/features/logistics/my-deliveries";

/** /my/deliveries — OWNER: own deliveries, confirm receipt (V3 §15.3). */
export default function MyDeliveriesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyDeliveries />
    </Suspense>
  );
}
