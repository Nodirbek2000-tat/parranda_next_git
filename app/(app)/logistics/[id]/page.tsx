import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TaskDetail } from "@/features/logistics/task-detail";

/** /logistics/[id] — task detail (A, W, L; the API answers 404 for other households' tasks). */
export default function LogisticsTaskPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <TaskDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
