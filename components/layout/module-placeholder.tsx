import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, type Crumb } from "@/components/ui/page-header";

/**
 * Header + empty state for a V3 route whose module is not built yet (scaffold).
 * Module teams replace the page body; the route, guard and navigation entry already exist.
 * Shows no data and no buttons on purpose (nothing fake, nothing that does not work).
 */
export function ModulePlaceholder({
  title,
  description,
  icon,
  breadcrumbs,
  emptyTitle = "Bu bo‘lim tez orada ishga tushadi",
  emptyDescription = "Ma’lumotlar shu yerda ko‘rinadi.",
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  breadcrumbs?: readonly Crumb[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
      <Card>
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} className="py-14" />
      </Card>
    </div>
  );
}
