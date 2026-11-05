import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TaskList } from "@/features/tasks/task-list";

/** /tasks — builder tasks of every role (API_CONTRACT_V4 §3.2). Filters live in the URL, hence the Suspense. */
export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TaskList />
    </Suspense>
  );
}
