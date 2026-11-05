import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TaskDetail } from "@/features/tasks/task-detail";

/** /tasks/[id] — executor, approver, ADMIN, OWNER of its household (API_CONTRACT_V4 §3.2). */
export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <TaskDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
