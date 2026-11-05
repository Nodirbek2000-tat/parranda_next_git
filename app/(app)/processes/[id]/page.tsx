import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ProcessDetail } from "@/features/processes/process-detail";

/** /processes/[id] — ADMIN; other roles open runs that contain a task of theirs (API_CONTRACT_V4 §3.3). */
export default function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <ProcessDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
