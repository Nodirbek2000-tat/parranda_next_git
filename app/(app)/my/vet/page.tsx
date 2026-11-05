import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MyVetPage } from "@/features/vet/my-vet";

/** /my/vet — the owner's vet page (API_CONTRACT_V3 §8.8, §15.3). */
export default function MyVetRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyVetPage />
    </Suspense>
  );
}