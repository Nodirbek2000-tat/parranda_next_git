import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { OrderDetail } from "@/features/orders/order-detail";

/** /orders/[id] — ADMIN (actions), WAREHOUSE (read only), API_CONTRACT_V3 §6.3, §15.3. */
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <OrderDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}