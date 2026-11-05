import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ProcessList } from "@/features/processes/process-list";

/** /processes — process runs (ADMIN, API_CONTRACT_V4 §3.3). Filters live in the URL, hence the Suspense. */
export default function ProcessesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProcessList />
    </Suspense>
  );
}
