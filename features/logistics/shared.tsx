"use client";

import { formatDate, formatNumber, formatQuantity } from "@/lib/format";
import { TASK_STATUS } from "@/lib/status";
import type { LogisticsTask, TaskStatus } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";

/** Board columns (V3 §15.3): the five working statuses. */
export const BOARD_STATUSES = ["NEW", "ASSIGNED", "ACCEPTED", "IN_TRANSIT", "DELIVERED"] as const satisfies readonly TaskStatus[];
export type BoardStatus = (typeof BOARD_STATUSES)[number];
export const DONE_STATUSES = ["CONFIRMED", "CANCELLED"] as const satisfies readonly TaskStatus[];

export function TaskStatusBadge({ task, className }: { task: Pick<LogisticsTask, "status" | "status_display" | "is_overdue">; className?: string }) {
  return (
    <StatusBadge
      map={TASK_STATUS}
      status={task.status}
      label={task.status_display}
      overdue={task.is_overdue}
      className={className}
    />
  );
}

/** `Yem PK-1 — 150 kg; Vitamin — 2 dona` (first `limit` items, then `… +2`). */
export function itemsSummary(task: Pick<LogisticsTask, "items">, limit = 2): string {
  const parts = task.items.slice(0, limit).map((item) => `${item.product.name} — ${formatQuantity(item.quantity, item.product.unit)}`);
  const rest = task.items.length - limit;
  return rest > 0 ? `${parts.join("; ")} … +${rest}` : parts.join("; ");
}

export function plannedText(task: Pick<LogisticsTask, "planned_date">): string {
  return task.planned_date ? formatDate(task.planned_date) : "Sana belgilanmagan";
}

export function totalKgText(task: Pick<LogisticsTask, "total_kg">): string | null {
  return task.total_kg > 0 ? `${formatNumber(task.total_kg)} kg` : null;
}

/** Google Maps directions link to the delivery point (V3 §15.3). */
export function directionsHref(latitude: number | null, longitude: number | null): string | null {
  if (latitude === null || longitude === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export const SOURCE_LABELS = { API: "Web", BOT: "Telegram bot" } as const;
