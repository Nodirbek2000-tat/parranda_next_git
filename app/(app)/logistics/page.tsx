import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TaskBoard } from "@/features/logistics/task-board";

/** /logistics — A, W, L (route guard in lib/nav.ts). Filters live in the URL, hence the Suspense boundary. */
export default function LogisticsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TaskBoard />
    </Suspense>
  );
}
