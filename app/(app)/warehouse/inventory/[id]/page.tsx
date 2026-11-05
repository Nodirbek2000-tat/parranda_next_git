import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { InventorySheet } from "@/features/inventory/inventory-sheet";

/** /warehouse/inventory/[id] — count sheet (API_CONTRACT_V3 §15.3): autosave, differences, approve (A). */
export default function InventoryCountPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <InventorySheet key={id} id={id} />
      ))}
    </Suspense>
  );
}
