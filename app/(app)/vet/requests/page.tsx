import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { VetRequestsPage } from "@/features/vet/requests-page";

/** /vet/requests — owner requests for VET and ADMIN (API_CONTRACT_V3 §8.5, §15.3). */
export default function VetRequestsRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VetRequestsPage />
    </Suspense>
  );
}