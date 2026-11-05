import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { HouseholdDetail } from "@/features/households/household-detail";

export default function HouseholdPage({ params }: PageProps<"/households/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <HouseholdDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
