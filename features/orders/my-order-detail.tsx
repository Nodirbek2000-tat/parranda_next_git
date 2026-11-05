"use client";

import { useState } from "react";
import { AlertTriangle, Ban, PackageCheck, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format";
import { ORDER_KIND_LABELS, ORDER_STATUS, TASK_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { LogisticsTask, Order } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneLink } from "@/components/ui/phone-link";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { ConfirmReceiptModal, OrderHistory, OrderStepper, ReasonModal, finalNote } from "./order-parts";

type Dialog = "cancel" | "received" | "problem" | null;

/** /my/orders/[id] — the owner's order: stepper, items, delivery, cancel (NEW), receipt confirmation (V3 §15.3). */
export function MyOrderDetail({ id }: { id: string }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const order = useApi<Order>(`/orders/${id}`);
  const data = order.data;
  const task = useApi<LogisticsTask>(data?.task ? `/logistics/tasks/${data.task.id}` : null);

  if (!data) {
    if (order.error) {
      return (
        <Card>
          {order.error.status === 404 ? (
            <EmptyState
              title="Buyurtma topilmadi"
              description="Bu buyurtma mavjud emas yoki boshqa xonadonga tegishli."
              action={<LinkButton href="/my/orders">Buyurtmalarim</LinkButton>}
            />
          ) : (
            <ErrorState error={order.error} onRetry={order.reload} />
          )}
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const can = (action: Order["allowed_actions"][number]) => data.allowed_actions.includes(action);
  const close = () => setDialog(null);
  const done = (message: string) => () => {
    setDialog(null);
    toast.success(message);
  };
  const note = finalNote(data);
  const delivery = task.data;
  const decided = data.status !== "NEW" && data.status !== "CANCELLED" && data.status !== "REJECTED";

  return (
    <div className="flex flex-col gap-5">
      {order.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={order.error} onRetry={order.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={[{ label: "Buyurtmalarim", href: "/my/orders" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">{data.code}</span>
            <StatusBadge map={ORDER_STATUS} status={data.status} label={data.status_display} />
          </span>
        }
        description={`${ORDER_KIND_LABELS[data.kind] ?? data.kind_display} · ${formatDateTime(data.created_at)}`}
      />

      <Card>
        <CardBody className="py-5">
          <OrderStepper order={data} />
        </CardBody>
      </Card>

      {can("confirm_receipt") && data.task && (
        <Card className="border-accent/40">
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <PackageCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="font-medium text-ink">Mahsulotlar yetkazildi</p>
                <p className="text-[13px] text-muted">
                  Hammasini olgan bo‘lsangiz, qabulni tasdiqlang. Kamchilik bo‘lsa — “Muammo bor” tugmasini bosing.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button icon={<PackageCheck className="size-4" aria-hidden />} onClick={() => setDialog("received")}>
                Qabul qildim
              </Button>
              <Button variant="secondary" icon={<AlertTriangle className="size-4" aria-hidden />} onClick={() => setDialog("problem")}>
                Muammo bor
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {note && (
        <Alert tone="warning">
          <span className="font-medium">{note.title}:</span> {note.text || "ko‘rsatilmagan"}
        </Alert>
      )}

      <Card>
        <CardHeader title="Mahsulotlar" />
        <ul className="flex flex-col divide-y divide-line">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.product.name}</p>
                {item.note && <p className="text-xs text-muted">{item.note}</p>}
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                <p className={cn(decided && item.approved_qty !== null ? "text-muted" : "text-ink")}>
                  {decided && item.approved_qty !== null ? "So‘ralgan: " : ""}
                  {formatQuantity(item.requested_qty, item.product.unit)}
                </p>
                {decided && item.approved_qty !== null && (
                  <p className={cn("font-medium", item.approved_qty === 0 ? "text-danger" : "text-ink")}>
                    {item.approved_qty === 0 ? "Berilmaydi" : `Beriladi: ${formatQuantity(item.approved_qty, item.product.unit)}`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {data.task && (
        <Card>
          <CardHeader
            title="Yetkazib berish"
            actions={<StatusBadge map={TASK_STATUS} status={data.task.status} label={data.task.status_display} />}
          />
          <CardBody>
            {delivery ? (
              <div className="flex flex-col gap-3">
                <Summary
                  items={[
                    ["Topshiriq", data.task.code],
                    ["Reja sanasi", formatDate(delivery.planned_date)],
                    [
                      "Transport",
                      delivery.vehicle
                        ? `${delivery.vehicle.plate_number}${delivery.vehicle.model ? `, ${delivery.vehicle.model}` : ""}`
                        : "Hali biriktirilmagan",
                    ],
                    ["Haydovchi", delivery.driver ? delivery.driver.full_name : "Hali biriktirilmagan"],
                    ...(delivery.driver?.phone
                      ? ([["Telefon", <PhoneLink key="phone" phone={delivery.driver.phone} />]] as const)
                      : []),
                    ...(delivery.delivered_at ? ([["Yetkazilgan", formatDateTime(delivery.delivered_at)]] as const) : []),
                  ]}
                />
              </div>
            ) : task.error ? (
              <p className="text-sm text-muted">Yetkazib berish tafsilotlarini yuklab bo‘lmadi.</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Truck className="size-4" aria-hidden /> Yuklanmoqda…
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Ma’lumotlar" />
        <CardBody>
          <Summary
            items={[
              ["Xonadon", `${data.household.name} (${data.household.code})`],
              ["Kerakli sana", formatDate(data.desired_date)],
              ["Izoh", data.note || "—"],
              ...(data.decision_note && data.status !== "REJECTED" ? ([["Administrator izohi", data.decision_note]] as const) : []),
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Holatlar tarixi" />
        <CardBody>
          <OrderHistory history={data.history ?? []} />
        </CardBody>
      </Card>

      {can("cancel") && (
        <Button variant="secondary" icon={<Ban className="size-4" aria-hidden />} onClick={() => setDialog("cancel")} className="self-start">
          Buyurtmani bekor qilish
        </Button>
      )}

      {dialog === "cancel" && (
        <ReasonModal
          title={`${data.code} — bekor qilish`}
          description="Buyurtma bekor qilinadi va administratorga xabar yuboriladi. Bu amalni qaytarib bo‘lmaydi."
          label="Sabab"
          confirmLabel="Bekor qilish"
          required={false}
          onSubmit={(reason) => api.post<Order>(`/orders/${data.id}/cancel`, { reason })}
          onClose={close}
          onDone={done("Buyurtma bekor qilindi")}
        />
      )}
      {(dialog === "received" || dialog === "problem") && data.task && (
        <ConfirmReceiptModal
          taskId={data.task.id}
          problem={dialog === "problem"}
          asAdmin={false}
          onClose={close}
          onDone={done(dialog === "problem" ? "Muammo qayd etildi" : "Qabul tasdiqlandi. Rahmat!")}
        />
      )}
    </div>
  );
}
