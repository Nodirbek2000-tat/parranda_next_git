import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { InventoryList } from "@/features/inventory/inventory-list";

/** /warehouse/inventory — ADMIN, WAREHOUSE (API_CONTRACT_V3 §15.3; access: lib/nav.ts). */
export default function InventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InventoryList />
    </Suspense>
  );
}
