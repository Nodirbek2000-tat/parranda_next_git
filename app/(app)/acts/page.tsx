import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ActsPage } from "@/features/acts/acts-page";

/** /acts — dalolatnomalar of every role (API_CONTRACT_V4 §6). Prefill comes from the URL, hence the Suspense. */
export default function DalolatnomalarPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ActsPage />
    </Suspense>
  );
}
