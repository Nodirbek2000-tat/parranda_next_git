import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ReportExportCenter } from "@/features/reports/export-center";

/** /reports — export center for every role (reports per role from `GET /api/reports`, API_CONTRACT_V3 §11, §15.3). */
export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportExportCenter />
    </Suspense>
  );
}
