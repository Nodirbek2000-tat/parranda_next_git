import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ProductDetail } from "@/features/stock/product-detail";

export default function ProductPage({ params }: PageProps<"/warehouse/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <ProductDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
