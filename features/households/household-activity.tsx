"use client";

import { History, ShoppingCart, Truck } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/status";
import type { AuditLog, LogisticsTask, Order } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import type { Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { itemsSummary as orderItems } from "../orders/order-parts";
import { itemsSummary as taskItems, plannedText, TaskStatusBadge } from "../logistics/shared";
import { PagedTableCard } from "../paged-table-card";

const ORDER_COLUMNS: Column<Order>[] = [
  {
    key: "code",
    header: "Buyurtma",
    primary: true,
    cell: (row) => <span className="font-medium tabular-nums">{row.code}</span>,
  },
  { key: "items", header: "Mahsulotlar", className: "max-w-[260px]", cell: (row) => <span className="block truncate">{orderItems(row.items)}</span> },
  { key: "status", header: "Holat", cell: (row) => <StatusBadge map={ORDER_STATUS} status={row.status} label={row.status_display} /> },
  { key: "created", header: "Yaratilgan", hideOnMobile: true, cell: (row) => <span className="tabular-nums">{formatDate(row.created_at)}</span> },
];

const TASK_COLUMNS: Column<LogisticsTask>[] = [
  {
    key: "code",
    header: "Topshiriq",
    primary: true,
    cell: (task) => <span className="font-medium tabular-nums">{task.code}</span>,
  },
  { key: "items", header: "Yuk", className: "max-w-[260px]", cell: (task) => <span className="block truncate">{taskItems(task)}</span> },
  { key: "plan", header: "Reja", hideOnMobile: true, cell: (task) => <span className="tabular-nums">{plannedText(task)}</span> },
  {
    key: "status",
    header: "Holat",
    cell: (task) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <TaskStatusBadge task={task} />
        {task.received_ok === false && <Badge tone="warning">Muammo bilan</Badge>}
      </span>
    ),
  },
];

const TIMELINE_COLUMNS: Column<AuditLog>[] = [
  {
    key: "when",
    header: "Vaqt",
    primary: true,
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.created_at)}</span>,
  },
  {
    key: "what",
    header: "Amal",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="text-ink">
          {row.module_display} · {row.action_display}
        </span>
        <span className="text-xs text-muted">{row.object_repr || row.op_id}</span>
      </span>
    ),
  },
  {
    key: "who",
    header: "Kim",
    hideOnMobile: true,
    cell: (row) => row.actor?.full_name ?? (row.actor_name || "—"),
  },
];

/** TZ §5 "Har bir xonadonning alohida faoliyat tarixi": orders of the household (A, W). */
export function HouseholdOrders({ householdId }: { householdId: number }) {
  return (
    <PagedTableCard<Order>
      title="Buyurtmalar"
      path="/orders"
      query={{ household: householdId }}
      columns={ORDER_COLUMNS}
      rowKey={(row) => row.id}
      rowHref={(row) => `/orders/${row.id}`}
      emptyTitle="Buyurtmalar yo‘q"
      emptyIcon={ShoppingCart}
      pageSize={10}
    />
  );
}

/** Deliveries (logistics tasks) to the household (A, W). */
export function HouseholdDeliveries({ householdId }: { householdId: number }) {
  return (
    <PagedTableCard<LogisticsTask>
      title="Yetkazib berishlar"
      path="/logistics/tasks"
      query={{ household: householdId }}
      columns={TASK_COLUMNS}
      rowKey={(row) => row.id}
      rowHref={(row) => `/logistics/${row.id}`}
      emptyTitle="Yetkazib berishlar yo‘q"
      emptyIcon={Truck}
      pageSize={10}
    />
  );
}

/** Every audited change that belongs to the household (ADMIN: `/api/audit-logs?household=`). */
export function HouseholdTimeline({ householdId }: { householdId: number }) {
  return (
    <PagedTableCard<AuditLog>
      title="Faoliyat tarixi"
      path="/audit-logs"
      query={{ household: householdId }}
      columns={TIMELINE_COLUMNS}
      rowKey={(row) => row.id}
      rowHref={() => `/audit?household=${householdId}`}
      emptyTitle="Hali yozuvlar yo‘q"
      emptyIcon={History}
      pageSize={15}
    />
  );
}
