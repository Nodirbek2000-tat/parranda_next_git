import { cn } from "@/lib/cn";
import { OVERDUE_CLASS, statusMeta, type StatusMeta } from "@/lib/status";
import { Badge } from "./badge";

/**
 * Status badge with the fixed V3 colours (`lib/status.ts`):
 * `<StatusBadge map={ORDER_STATUS} status={order.status} />`. `overdue` adds the danger outline.
 */
export function StatusBadge<S extends string>({
  map,
  status,
  label,
  overdue = false,
  className,
}: {
  map: Record<S, StatusMeta>;
  status: string;
  /** Server-provided `status_display` (preferred when present). */
  label?: string;
  overdue?: boolean;
  className?: string;
}) {
  const meta = statusMeta(map, status);
  return (
    <Badge tone={meta.tone} className={cn(overdue && OVERDUE_CLASS, className)}>
      {label || meta.label}
    </Badge>
  );
}
