import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { OrderList } from "@/features/orders/order-list";

/** /orders — ADMIN, WAREHOUSE (API_CONTRACT_V3 §6, §15.3). Filters live in the URL, hence the Suspense. */
export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderList />
    </Suspense>
  );
}