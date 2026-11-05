import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { BatchDetail } from "@/features/batches/batch-detail";

export default function BatchPage({ params }: PageProps<"/batches/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <BatchDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
