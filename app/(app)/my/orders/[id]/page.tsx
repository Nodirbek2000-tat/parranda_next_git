import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MyOrderDetail } from "@/features/orders/my-order-detail";

/** /my/orders/[id] — OWNER, own household only (API_CONTRACT_V3 §6.3, §15.3). */
export default function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <MyOrderDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}