import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MyOrders } from "@/features/orders/my-orders";

/** /my/orders — OWNER (API_CONTRACT_V3 §6, §15.3). */
export default function MyOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyOrders />
    </Suspense>
  );
}