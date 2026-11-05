"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ExternalLink, MapPinned, Navigation, Route, Trash2, Truck, UserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format";
import { TASK_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { LogisticsTask } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { MapView } from "@/components/map/map-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneLink } from "@/components/ui/phone-link";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Summary } from "@/components/ui/summary";
import { directionsHref, plannedText, SOURCE_LABELS, TaskStatusBadge, totalKgText } from "./shared";
import { TaskActions } from "./task-actions";
import { canDeleteTask, useDeleteTask } from "./use-delete-task";

const STEPS = ["NEW", "ASSIGNED", "ACCEPTED", "IN_TRANSIT", "DELIVERED", "CONFIRMED"] as const;

/** /logistics/[id] — delivery card with map, items and stock operations, staff, proof, history, actions. */
export function TaskDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const router = useRouter();
  // silent delete: this page must not refetch (404) before we leave it; the board loads fresh.
  const deleteTask = useDeleteTask(() => router.replace("/logistics"));
  const resource = useApi<LogisticsTask>(`/logistics/tasks/${id}`);
  const task = resource.data;

  if (!task) {
    if (resource.error) {
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title="Topshiriq" breadcrumbs={[{ label: "Logistika", href: "/logistics" }, { label: "Topshiriq" }]} />
          <ErrorState error={resource.error} onRetry={resource.error.status === 404 ? undefined : resource.reload} />
        </div>
      );
    }
    return <PageSkeleton />;
  }

  const staff = user.role !== "OWNER";
  const directions = directionsHref(task.delivery.latitude, task.delivery.longitude);
  const hasPoint = task.delivery.latitude !== null && task.delivery.longitude !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Logistika", href: staff ? "/logistics" : "/my/deliveries" }, { label: task.code }]}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="tabular-nums">{task.code}</span>
            <TaskStatusBadge task={task} />
            {task.is_overdue && <Badge tone="danger">Muddati o‘tgan</Badge>}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              Reja: {plannedText(task)}
            </span>
            {task.order && (
              <Link href={staff ? `/orders/${task.order.id}` : `/my/orders/${task.order.id}`} className="font-medium text-accent hover:underline">
                Buyurtma {task.order.code}
              </Link>
            )}
          </span>
        }
        actions={
          canDeleteTask(task, user.role) ? (
            <>
              <TaskActions task={task} />
              <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => deleteTask(task)}>
                O‘chirish
              </Button>
            </>
          ) : (
            <TaskActions task={task} />
          )
        }
      />
      <StaleDataError error={resource.error} onRetry={resource.reload} />

      {task.status === "CANCELLED" && (
        <Alert tone="warning">
          Bekor qilingan ({formatDateTime(task.cancelled_at)}){task.cancel_reason ? `: ${task.cancel_reason}` : ""}
        </Alert>
      )}
      {task.status === "CONFIRMED" && task.received_ok === false && (
        <Alert tone="warning">Muammo bilan qabul qilindi: {task.issue_note}</Alert>
      )}

      <Stepper task={task} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Yetkazib berish manzili"
              description={`${task.household.name} (${task.household.code})`}
              actions={
                directions ? (
                  <a href={directions} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
                    <Navigation className="size-4" aria-hidden />
                    Yo‘nalish
                  </a>
                ) : undefined
              }
            />
            <CardBody className="flex flex-col gap-4">
              <Summary
                items={[
                  ["Manzil", task.delivery.address || "—"],
                  ["Qabul qiluvchi", task.delivery.contact_name || "—"],
                  ["Telefon", task.delivery.contact_phone ? <PhoneLink phone={task.delivery.contact_phone} /> : "—"],
                ]}
              />
              {hasPoint ? (
                <div className="h-56 overflow-hidden rounded-lg border border-line sm:h-72">
                  <MapView
                    className="size-full"
                    interactive={false}
                    points={[
                      {
                        id: task.household.id,
                        latitude: task.delivery.latitude as number,
                        longitude: task.delivery.longitude as number,
                        name: task.household.name,
                        code: task.household.code,
                        ownerName: task.delivery.contact_name,
                        active: true,
                      },
                    ]}
                  />
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-[13px] text-muted">
                  <MapPinned className="size-4" aria-hidden />
                  Xonadon lokatsiyasi kiritilmagan.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Yuk" description={totalKgText(task) ? `Jami: ${totalKgText(task)}` : undefined} />
            <ul className="divide-y divide-line border-t border-line">
              {task.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{item.product.name}</span>
                    <span className="text-xs text-muted">
                      {item.reserved_qty > 0 && `Zaxirada: ${formatQuantity(item.reserved_qty, item.product.unit)}`}
                      {item.stock_transaction && (
                        <>
                          Chiqim:{" "}
                          {staff ? (
                            <Link href={`/warehouse/${item.product.id}`} className="font-medium text-accent hover:underline">
                              {item.stock_transaction.op_id}
                            </Link>
                          ) : (
                            item.stock_transaction.op_id
                          )}
                        </>
                      )}
                      {item.return_transaction && ` · qaytarildi: ${item.return_transaction.op_id}`}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{formatQuantity(item.quantity, item.product.unit)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {(task.proof_files.length > 0 || ["DELIVERED", "CONFIRMED"].includes(task.status)) && (
            <Card>
              <CardHeader
                title="Yetkazib berish dalili"
                description={
                  task.delivered_at
                    ? `${formatDateTime(task.delivered_at)}${task.recipient_name ? ` · qabul qildi: ${task.recipient_name}` : ""}`
                    : undefined
                }
              />
              <CardBody className="flex flex-col gap-3">
                <AttachmentList files={task.proof_files} emptyText="Dalil biriktirilmagan" />
                {task.delivery_note && <p className="text-sm text-ink">{task.delivery_note}</p>}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Transport va mas’ul" />
            <CardBody>
              {task.vehicle || task.driver ? (
                <Summary
                  items={[
                    [
                      "Transport",
                      task.vehicle ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Truck className="size-3.5 text-muted" aria-hidden />
                          {task.vehicle.plate_number}
                          {task.vehicle.model ? `, ${task.vehicle.model}` : ""}
                        </span>
                      ) : (
                        "—"
                      ),
                    ],
                    ["Haydovchi", task.driver ? task.driver.full_name : "—"],
                    ["Telefon", task.driver?.phone ? <PhoneLink phone={task.driver.phone} /> : "—"],
                    ...(task.responsible !== undefined
                      ? ([["Mas’ul", task.responsible ? task.responsible.full_name : "—"]] as const)
                      : []),
                  ]}
                />
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <UserRound className="size-4" aria-hidden />
                  Hali biriktirilmagan
                </p>
              )}
            </CardBody>
          </Card>

          {(task.note || task.created_by) && (
            <Card>
              <CardHeader title="Ma’lumot" />
              <CardBody>
                <Summary
                  items={[
                    ...(task.created_by ? ([["Yaratgan", task.created_by.full_name]] as const) : []),
                    ["Yaratilgan", formatDateTime(task.created_at)],
                    ...(task.note ? ([["Izoh", task.note]] as const) : []),
                  ]}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Holatlar tarixi" />
            <CardBody>
              <History task={task} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stepper({ task }: { task: LogisticsTask }) {
  const current = task.status === "CANCELLED" ? -1 : STEPS.indexOf(task.status as (typeof STEPS)[number]);
  return (
    <ol className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-2 shadow-card" aria-label="Topshiriq bosqichlari">
      {STEPS.map((step, index) => {
        const done = current >= index;
        const active = current === index;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-[96px] flex-1 flex-col gap-1 rounded-lg px-2.5 py-2 text-xs",
              active ? "bg-accent-soft" : "",
            )}
          >
            <span className={cn("h-1 rounded-full", done ? (task.status === "CONFIRMED" ? "bg-primary" : "bg-accent") : "bg-line")} />
            <span className={cn("font-medium", done ? "text-ink" : "text-muted")}>{TASK_STATUS[step].label}</span>
            <span className="tabular-nums text-muted">{formatDate(stepTime(task, step))}</span>
          </li>
        );
      })}
    </ol>
  );
}

function stepTime(task: LogisticsTask, step: (typeof STEPS)[number]): string | null {
  switch (step) {
    case "NEW":
      return task.created_at;
    case "ASSIGNED":
      return task.assigned_at;
    case "ACCEPTED":
      return task.accepted_at;
    case "IN_TRANSIT":
      return task.started_at;
    case "DELIVERED":
      return task.delivered_at;
    case "CONFIRMED":
      return task.confirmed_at;
  }
}

function History({ task }: { task: LogisticsTask }) {
  const rows = [...(task.history ?? [])].reverse();
  if (rows.length === 0) return <p className="text-sm text-muted">Tarix bo‘sh</p>;
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {rows.map((row, index) => (
        <li key={`${row.created_at}-${index}`} className="relative pl-6">
          <span
            className={cn(
              "absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface",
              index === 0 ? "bg-accent" : "bg-line-strong",
            )}
            aria-hidden
          />
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
            {row.from_status === row.to_status ? `${row.to_status_display} (qayta)` : row.to_status_display}
            {row.source === "BOT" && <Badge tone="info">{SOURCE_LABELS.BOT}</Badge>}
          </p>
          <p className="text-xs text-muted">
            {formatDateTime(row.created_at)} · {row.actor.full_name || "—"}
          </p>
          {row.note && <p className="mt-1 text-[13px] text-ink/80 [overflow-wrap:anywhere]">{row.note}</p>}
          {row.latitude !== null && row.longitude !== null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Route className="size-3.5" aria-hidden />
              Joylashuv
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

