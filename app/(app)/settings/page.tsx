import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SettingsPage } from "@/features/settings/settings-page";

/** /settings — Super Admin only (route guard in lib/nav.ts; the API answers 403 to plain admins on PATCH). */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPage />
    </Suspense>
  );
}
