import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { VetHome } from "@/features/vet/vet-home";

/** /vet — VET home and ADMIN overview (API_CONTRACT_V3 §15.3); access: lib/nav.ts. */
export default function VetPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VetHome />
    </Suspense>
  );
}