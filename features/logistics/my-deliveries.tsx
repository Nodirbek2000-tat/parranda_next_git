"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { useApi, usePagedApi } from "@/lib/use-api";
import type { LogisticsTask, Paginated } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PhoneLink } from "@/components/ui/phone-link";
import { TableSkeleton } from "@/components/ui/skeleton";
import { BOARD_STATUSES, DONE_STATUSES, plannedText, TaskStatusBadge } from "./shared";
import { ConfirmReceiptModal } from "./task-actions";

const ARCHIVE_PAGE = 10;

/** /my/deliveries — the owner's deliveries: active first (with confirm actions), then finished ones. */
export function MyDeliveries() {
  const active = useApi<Paginated<LogisticsTask>>("/logistics/tasks", { status: BOARD_STATUSES.join(","), page_size: 50 });
  const done = usePagedApi<LogisticsTask>("/logistics/tasks", { status: DONE_STATUSES.join(",") }, ARCHIVE_PAGE);
  const [confirming, setConfirming] = useState<{ task: LogisticsTask; problem: boolean } | null>(null);

  // Waiting for my confirmation first, then on the way, then the rest.
  const rank = (task: LogisticsTask) => (task.status === "DELIVERED" ? 0 : task.status === "IN_TRANSIT" ? 1 : 2);
  const activeRows = [...(active.data?.results ?? [])].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Yetkazib berishlar" description="Xonadoningizga yo‘lga chiqqan va yetkazilgan mahsulotlar" />

      <section aria-labelledby="active-deliveries" className="flex flex-col gap-3">
        <h2 id="active-deliveries" className="text-sm font-semibold text-ink">
          Jarayondagilar
        </h2>
        <StaleDataError error={active.data ? active.error : null} onRetry={active.reload} />
        {!active.data && active.error ? (
          <Card>
            <ErrorState error={active.error} onRetry={active.reload} />
          </Card>
        ) : !active.data ? (
          <Card>
            <TableSkeleton rows={3} />
          </Card>
        ) : activeRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={Truck}
              title="Hozircha yo‘ldagi yuk yo‘q"
              description="Buyurtmangiz tasdiqlanib, yo‘lga chiqarilganda shu yerda ko‘rinadi."
              action={
                <Link href="/my/orders" className="text-sm font-medium text-accent hover:underline">
                  Buyurtmalarim →
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {activeRows.map((task) => (
              <li key={task.id}>
                <DeliveryCard task={task} onConfirm={(problem) => setConfirming({ task, problem })} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="done-deliveries" className="flex flex-col gap-3">
        <h2 id="done-deliveries" className="text-sm font-semibold text-ink">
          Yakunlanganlar
        </h2>
        {!done.data && done.error ? (
          <Card>
            <ErrorState error={done.error} onRetry={done.reload} />
          </Card>
        ) : !done.data ? (
          <Card>
            <TableSkeleton rows={2} />
          </Card>
        ) : done.data.results.length === 0 ? (
          <p className="text-sm text-muted">Hali yakunlangan yetkazib berish yo‘q.</p>
        ) : (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">
              {done.data.results.map((task) => (
                <li key={task.id}>
                  <DeliveryCard task={task} />
                </li>
              ))}
            </ul>
            <Pagination page={done.page} count={done.data.count} pageSize={ARCHIVE_PAGE} onPageChange={done.setPage} disabled={done.loading} />
          </>
        )}
      </section>

      {confirming && (
        <ConfirmReceiptModal task={confirming.task} initialProblem={confirming.problem} onClose={() => setConfirming(null)} />
      )}
    </div>
  );
}

function DeliveryCard({ task, onConfirm }: { task: LogisticsTask; onConfirm?: (problem: boolean) => void }) {
  const canConfirm = Boolean(onConfirm) && task.allowed_actions.includes("confirm");
  return (
    <Card className={canConfirm ? "border-accent/50" : undefined}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-ink">{task.code}</span>
            {task.order && (
              <Link href={`/my/orders/${task.order.id}`} className="text-xs font-medium text-accent hover:underline">
                {task.order.code}
              </Link>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <TaskStatusBadge task={{ ...task, is_overdue: false }} />
            {task.received_ok === false && <Badge tone="warning">Muammo bilan</Badge>}
          </span>
        </div>

        <ul className="flex flex-col gap-1 text-sm text-ink">
          {task.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{item.product.name}</span>
              <span className="shrink-0 font-medium tabular-nums">{formatQuantity(item.quantity, item.product.unit)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            Reja: {plannedText(task)}
            {task.delivered_at && ` · yetkazildi: ${formatDateTime(task.delivered_at)}`}
          </span>
          {task.driver && (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <Truck className="size-3.5" aria-hidden />
              {task.driver.full_name}
              {task.vehicle && ` · ${task.vehicle.plate_number}`}
              {task.driver.phone && <PhoneLink phone={task.driver.phone} className="text-xs" />}
            </span>
          )}
        </div>

        {task.proof_files.length > 0 && <AttachmentList files={task.proof_files} />}
        {task.issue_note && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">{task.issue_note}</p>}

        {canConfirm && (
          <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
            <Button className="flex-1" icon={<CheckCircle2 className="size-4" aria-hidden />} onClick={() => onConfirm?.(false)}>
              Qabul qildim
            </Button>
            <Button variant="secondary" className="flex-1" icon={<AlertTriangle className="size-4" aria-hidden />} onClick={() => onConfirm?.(true)}>
              Muammo bor
            </Button>
          </div>
        )}
        {task.status === "CONFIRMED" && task.received_ok && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
            <PackageCheck className="size-3.5" aria-hidden />
            {formatDateTime(task.confirmed_at)} da qabul qilindi
          </p>
        )}
      </div>
    </Card>
  );
}
