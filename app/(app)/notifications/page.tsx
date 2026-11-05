import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NotificationMonitor } from "@/features/notifications/notification-monitor";

/** /notifications — ADMIN only (route guard in lib/nav.ts; the API answers 403 to others). */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationMonitor />
    </Suspense>
  );
}
