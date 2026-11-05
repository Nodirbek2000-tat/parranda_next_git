"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Ban, CheckCircle2, ClipboardCheck, ExternalLink, PackageCheck, Truck, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { collect, useForm } from "@/lib/form";
import { formatDate, formatDateTime, formatNumber, formatQuantity, todayIso } from "@/lib/format";
import { ORDER_KIND_LABELS, ORDER_STATUS, TASK_STATUS } from "@/lib/status";
import { useAllPages, useApi } from "@/lib/use-api";
import type { LogisticsTask, Order, OrderApprovePayload, OrderItem, Product } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirmedAction } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary } from "@/components/ui/summary";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ConfirmReceiptModal, OrderHistory, ReasonModal, finalNote } from "./order-parts";
import {
  EMPTY_TASK_FIELDS,
  TaskFields,
  taskPayload,
  useFleet,
  validateTaskFields,
  type TaskFieldValues,
} from "./order-task-fields";

type Dialog = "approve" | "reject" | "cancel" | "task" | "receipt" | null;

/** Product with the V3 warehouse additions (`reserved`, `available`), when the warehouse API provides them. */
type StockProduct = Product & { reserved?: number; available?: number };

/** The requested date pre-fills the task plan only while it is not in the past (empty = server default). */
function defaultPlanDate(desired: string | null | undefined): string {
  return desired && desired >= todayIso() ? desired : "";
}

function availableOf(product: StockProduct | undefined): number | null {
  if (!product) return null;
  if (typeof product.available === "number") return product.available;
  return product.balance - (product.reserved ?? 0);
}

const ITEM_COLUMNS: Column<OrderItem>[] = [
  {
    key: "product",
    header: "Mahsulot",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.product.name}</span>
        {row.note && <span className="text-xs font-normal text-muted">{row.note}</span>}
      </span>
    ),
  },
  {
    key: "requested",
    header: "So‘ralgan",
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatQuantity(row.requested_qty, row.product.unit)}</span>,
  },
  {
    key: "approved",
    header: "Tasdiqlangan",
    align: "right",
    cell: (row) =>
      row.approved_qty === null ? (
        <span className="text-muted">—</span>
      ) : (
        <span className={cn("tabular-nums", row.approved_qty < row.requested_qty && "text-warning-ink")}>
          {formatQuantity(row.approved_qty, row.product.unit)}
        </span>
      ),
  },
];

/** /orders/[id] — order detail for ADMIN (actions) and WAREHOUSE (read only), V3 §6, §15.3. */
export function OrderDetail({ id }: { id: string }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const order = useApi<Order>(`/orders/${id}`);
  const data = order.data;
  const taskId = data?.task?.id ?? null;
  const task = useApi<LogisticsTask>(taskId !== null ? `/logistics/tasks/${taskId}` : null);

  if (!data) {
    if (order.error) {
      return (
        <Card>
          {order.error.status === 404 ? (
            <EmptyState
              title="Buyurtma topilmadi"
              description="Buyurtma mavjud emas yoki sizda uni ko‘rish huquqi yo‘q."
              action={<LinkButton href="/orders">Buyurtmalar ro‘yxati</LinkButton>}
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

  const actions = (
    <>
      {can("approve") && (
        <Button icon={<CheckCircle2 className="size-4" aria-hidden />} onClick={() => setDialog("approve")}>
          Tasdiqlash
        </Button>
      )}
      {can("create_task") && (
        <Button icon={<Truck className="size-4" aria-hidden />} onClick={() => setDialog("task")}>
          Topshiriq yaratish
        </Button>
      )}
      {can("confirm_receipt") && (
        <Button
          variant="secondary"
          icon={<PackageCheck className="size-4" aria-hidden />}
          onClick={() => setDialog("receipt")}
        >
          Egasi nomidan qabul qilish
        </Button>
      )}
      {can("reject") && (
        <Button variant="secondary" icon={<XCircle className="size-4" aria-hidden />} onClick={() => setDialog("reject")}>
          Rad etish
        </Button>
      )}
      {can("cancel") && (
        <Button variant="secondary" icon={<Ban className="size-4" aria-hidden />} onClick={() => setDialog("cancel")}>
          Bekor qilish
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {order.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={order.error} onRetry={order.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={[{ label: "Buyurtmalar", href: "/orders" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">{data.code}</span>
            <StatusBadge map={ORDER_STATUS} status={data.status} label={data.status_display} />
          </span>
        }
        description={
          <span>
            {ORDER_KIND_LABELS[data.kind] ?? data.kind_display} ·{" "}
            <Link href={`/households/${data.household.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
              {data.household.name} ({data.household.code})
            </Link>
          </span>
        }
        actions={data.allowed_actions.length > 0 ? actions : undefined}
      />

      {note && (
        <Alert tone="warning">
          <span className="font-medium">{note.title}:</span> {note.text || "ko‘rsatilmagan"}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Mahsulotlar" description={`${data.items.length} ta mahsulot`} />
            <DataTable caption="Buyurtma mahsulotlari" rows={data.items} columns={ITEM_COLUMNS} rowKey={(row) => row.id} />
          </Card>

          <TaskCard order={data} task={task.data} loadingError={task.error !== null} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Ma’lumotlar" />
            <CardBody>
              <Summary
                items={[
                  ["Yaratgan", data.created_by.full_name],
                  ["Yaratilgan", formatDateTime(data.created_at)],
                  ["Kerakli sana", formatDate(data.desired_date)],
                  ["Izoh", data.note || "—"],
                  ...(data.decided_by
                    ? ([
                        [data.status === "REJECTED" ? "Rad etgan" : "Tasdiqlagan", data.decided_by.full_name],
                        ["Qaror vaqti", formatDateTime(data.decided_at)],
                      ] as const)
                    : []),
                  ...(data.decision_note && data.status !== "REJECTED" ? ([["Qaror izohi", data.decision_note]] as const) : []),
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
        </div>
      </div>

      {dialog === "approve" && <ApproveModal order={data} onClose={close} onDone={done("Buyurtma tasdiqlandi")} />}
      {dialog === "task" && <CreateTaskModal order={data} onClose={close} onDone={done("Logistika topshirig‘i yaratildi")} />}
      {dialog === "reject" && (
        <ReasonModal
          title={`${data.code} — rad etish`}
          description="Xonadon egasiga sabab bilan xabar yuboriladi. Bu amalni qaytarib bo‘lmaydi."
          label="Rad etish sababi"
          confirmLabel="Rad etish"
          required
          onSubmit={(reason) => api.post<Order>(`/orders/${data.id}/reject`, { reason })}
          onClose={close}
          onDone={done("Buyurtma rad etildi")}
        />
      )}
      {dialog === "cancel" && (
        <ReasonModal
          title={`${data.code} — bekor qilish`}
          description={
            data.task
              ? "Bog‘langan logistika topshirig‘i ham bekor qilinadi va zaxiralangan mahsulotlar omborga bo‘shatiladi."
              : "Xonadon egasiga sabab bilan xabar yuboriladi. Bu amalni qaytarib bo‘lmaydi."
          }
          label="Bekor qilish sababi"
          confirmLabel="Bekor qilish"
          required
          onSubmit={(reason) => api.post<Order>(`/orders/${data.id}/cancel`, { reason })}
          onClose={close}
          onDone={done("Buyurtma bekor qilindi")}
        />
      )}
      {dialog === "receipt" && data.task && (
        <ConfirmReceiptModal
          taskId={data.task.id}
          problem={false}
          asAdmin
          onClose={close}
          onDone={done("Qabul tasdiqlandi")}
        />
      )}
    </div>
  );
}

function TaskCard({ order, task, loadingError }: { order: Order; task: LogisticsTask | undefined; loadingError: boolean }) {
  const ref = order.task;
  if (!ref) {
    const hint =
      order.status === "NEW"
        ? "Buyurtma tasdiqlanganda logistika topshirig‘i yaratiladi."
        : order.status === "APPROVED"
          ? "Topshiriq hali yaratilmagan yoki bekor qilingan."
          : "Bog‘langan faol topshiriq yo‘q.";
    return (
      <Card>
        <CardHeader title="Yetkazib berish" />
        <CardBody>
          <p className="text-sm text-muted">{hint}</p>
        </CardBody>
      </Card>
    );
  }
  const items: [string, ReactNode][] = [
    ["Topshiriq", <span key="c" className="tabular-nums">{ref.code}</span>],
    ["Holat", <StatusBadge key="s" map={TASK_STATUS} status={ref.status} label={ref.status_display} overdue={task?.is_overdue} />],
  ];
  if (task) {
    items.push(["Reja sanasi", formatDate(task.planned_date)]);
    items.push(["Transport", task.vehicle ? `${task.vehicle.plate_number}${task.vehicle.model ? `, ${task.vehicle.model}` : ""}` : "Biriktirilmagan"]);
    items.push(["Haydovchi", task.driver ? `${task.driver.full_name}` : "Biriktirilmagan"]);
    if (task.responsible) items.push(["Mas’ul", task.responsible.full_name]);
    if (task.total_kg) items.push(["Yuk", `${formatNumber(task.total_kg)} kg`]);
    if (task.delivered_at) items.push(["Yetkazilgan", formatDateTime(task.delivered_at)]);
    if (task.recipient_name) items.push(["Qabul qilgan", task.recipient_name]);
    if (task.received_ok === false && task.issue_note) items.push(["Muammo", task.issue_note]);
  }
  return (
    <Card>
      <CardHeader
        title="Yetkazib berish"
        actions={
          <LinkButton href={`/logistics/${ref.id}`} size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
            Topshiriqni ochish
          </LinkButton>
        }
      />
      <CardBody>
        <Summary items={items} />
        {loadingError && !task && (
          <p className="mt-3 text-xs text-muted">Topshiriq tafsilotlarini yuklab bo‘lmadi.</p>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------- Approve ---------- */

function ApproveModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const confirmed = useConfirmedAction();
  const fleet = useFleet();
  const products = useAllPages<StockProduct>("/products");
  const stock = useMemo(() => {
    const map = new Map<number, StockProduct>();
    for (const product of products.data?.results ?? []) map.set(product.id, product);
    return map;
  }, [products.data]);

  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, String(item.requested_qty)])),
  );
  const [createTask, setCreateTask] = useState(true);
  const withTask = createTask && !fleet.failed;
  const form = useForm<TaskFieldValues & { decision_note: string }>({
    ...EMPTY_TASK_FIELDS,
    planned_date: defaultPlanDate(order.desired_date),
    decision_note: "",
  });

  const parsed = order.items.map((item) => {
    const raw = (quantities[item.id] ?? "").replace(",", ".").trim();
    const value = raw === "" ? NaN : Number(raw);
    const whole = item.product.unit === "dona" || item.product.unit === "qop";
    let error: string | undefined;
    if (!Number.isFinite(value)) error = "Son kiriting";
    else if (value < 0) error = "Manfiy bo‘lishi mumkin emas";
    else if (whole && !Number.isInteger(value)) error = "Butun son kiriting";
    const available = availableOf(stock.get(item.product.id));
    const short = withTask && Number.isFinite(value) && available !== null && value > available;
    return { item, value, error, available, short };
  });
  const anyPositive = parsed.some((row) => !row.error && row.value > 0);

  const submit = form.handleSubmit(
    (values) =>
      collect([
        ["decision_note", values.decision_note.length > 500 ? "Izoh 500 ta belgidan oshmasin." : undefined],
        ...(withTask ? validateTaskFields(values) : []),
        ["items", parsed.some((row) => row.error) ? "Miqdorlarni tekshiring." : !anyPositive ? "Kamida bitta mahsulot miqdori 0 dan katta bo‘lsin." : undefined],
      ]),
    async (values) => {
      const payload: OrderApprovePayload = {
        items: parsed.map((row) => ({ id: row.item.id, approved_qty: row.value })),
        decision_note: values.decision_note.trim(),
        create_task: withTask,
        task: withTask ? taskPayload(values) : null,
      };
      return confirmed(
        {
          title: `${order.code} — tasdiqlash`,
          confirmLabel: "Tasdiqlash",
          message: (
            <p>
              {parsed.filter((row) => row.value > 0).length} ta mahsulot tasdiqlanadi
              {withTask ? " va logistika topshirig‘i yaratiladi (mahsulotlar omborda zaxiralanadi)" : ""}. Xonadon egasiga
              xabar yuboriladi.
            </p>
          ),
        },
        () => api.post<Order>(`/orders/${order.id}/approve`, payload),
      );
    },
    (result) => {
      if (result) onDone();
    },
  );

  return (
    <Modal
      title={`${order.code} — tasdiqlash`}
      description="Har bir mahsulot uchun beriladigan miqdorni kiriting (0 — berilmaydi)."
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Yopish
          </Button>
          <Button type="submit" loading={form.pending} icon={<ClipboardCheck className="size-4" aria-hidden />}>
            Tasdiqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {parsed.map(({ item, error, available, short }) => (
            <li key={item.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{item.product.name}</p>
                <p className="text-xs text-muted">
                  So‘ralgan: <span className="tabular-nums">{formatQuantity(item.requested_qty, item.product.unit)}</span>
                  {" · "}
                  {available === null ? (
                    products.error ? "qoldiq noma’lum" : "qoldiq yuklanmoqda…"
                  ) : (
                    <span className={cn("tabular-nums", short && "font-medium text-danger")}>
                      Bo‘sh qoldiq: {formatQuantity(available, item.product.unit)}
                    </span>
                  )}
                </p>
                {item.note && <p className="text-xs text-muted">Izoh: {item.note}</p>}
              </div>
              <div className="flex w-full items-center gap-2 sm:w-40">
                <label htmlFor={`approve-${item.id}`} className="sr-only">
                  {item.product.name}: tasdiqlangan miqdor
                </label>
                <Input
                  id={`approve-${item.id}`}
                  inputMode="decimal"
                  value={quantities[item.id] ?? ""}
                  invalid={Boolean(error) || short}
                  onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                  className="text-right tabular-nums"
                />
                <span className="w-9 shrink-0 text-sm text-muted">{item.product.unit}</span>
              </div>
              {error && <p className="text-xs text-danger sm:hidden">{error}</p>}
            </li>
          ))}
        </ul>
        {form.errors.items && <Alert>{form.errors.items}</Alert>}

        <Field label="Qaror izohi" {...form.field("decision_note")} hint="Ixtiyoriy, xonadon egasi ko‘radi">
          <Textarea rows={2} maxLength={500} {...form.control("decision_note")} />
        </Field>

        <div className="flex flex-col gap-4 rounded-lg border border-line bg-subtle/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="approve-create-task" className="min-w-0">
              <span className="block text-sm font-medium text-ink">Logistika topshirig‘ini yaratish</span>
              <span className="block text-xs text-muted">Mahsulotlar omborda zaxiralanadi va logistika xodimlariga xabar boradi</span>
            </label>
            <Switch
              id="approve-create-task"
              checked={withTask}
              onChange={setCreateTask}
              disabled={fleet.failed}
              label="Logistika topshirig‘ini yaratish"
            />
          </div>
          {fleet.failed ? (
            <p className="text-xs text-muted">Logistika moduli hali ishga tushirilmagan — buyurtma topshiriqsiz tasdiqlanadi.</p>
          ) : withTask ? (
            <TaskFields control={form.control} field={form.field} fleet={fleet} />
          ) : (
            <p className="text-xs text-muted">Topshiriqni keyinroq buyurtma sahifasidan yaratish mumkin.</p>
          )}
        </div>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- Create task later ---------- */

function CreateTaskModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const confirmed = useConfirmedAction();
  const fleet = useFleet();
  const form = useForm<TaskFieldValues>({ ...EMPTY_TASK_FIELDS, planned_date: defaultPlanDate(order.desired_date) });
  const submit = form.handleSubmit(
    (values) => collect(validateTaskFields(values)),
    (values) =>
      confirmed(
        {
          title: "Logistika topshirig‘i",
          confirmLabel: "Yaratish",
          message: <p>{order.code} bo‘yicha tasdiqlangan mahsulotlar omborda zaxiralanadi va topshiriq yaratiladi.</p>,
        },
        () => api.post<LogisticsTask>(`/orders/${order.id}/create-task`, taskPayload(values)),
      ),
    (result) => {
      if (result) onDone();
    },
  );
  return (
    <Modal
      title={`${order.code} — topshiriq yaratish`}
      description="Transport va haydovchini hozir yoki keyinroq logistika bo‘limida biriktirish mumkin."
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Yopish
          </Button>
          <Button type="submit" loading={form.pending} disabled={fleet.failed}>
            Yaratish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {fleet.failed && <Alert tone="warning">Logistika moduli hali ishga tushirilmagan.</Alert>}
        <TaskFields control={form.control} field={form.field} fleet={fleet} />
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
