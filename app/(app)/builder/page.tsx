import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { BuilderPage } from "@/features/builder/builder-page";

/** /builder — Super Admin only (route guard in lib/nav.ts `superOnly`; the API answers 403 to others). */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuilderPage />
    </Suspense>
  );
}
