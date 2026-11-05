import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AuditJournal } from "@/features/audit/audit-journal";

/** /audit — ADMIN only (route guard in lib/nav.ts; the API answers 403 to others). */
export default function AuditPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuditJournal />
    </Suspense>
  );
}
