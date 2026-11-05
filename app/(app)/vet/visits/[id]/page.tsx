import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { VisitDetail } from "@/features/vet/visit-detail";

/** /vet/visits/[id] — one inspection (API_CONTRACT_V3 §8.1, §15.3). */
export default function VetVisitPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <VisitDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}