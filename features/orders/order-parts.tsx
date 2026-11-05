"use client";

import { Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { collect, useForm } from "@/lib/form";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/status";
import type { LogisticsTask, Order, OrderItem, OrderStatus, StatusLogEntry } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

/* ---------- Text helpers ---------- */

/** `Yem PK-1 — 200 kg; Vitamin C — 2 dona` (first `limit` items, then `… va yana N ta`). */
export function itemsSummary(items: readonly OrderItem[], limit = 2, approved = false): string {
  const parts = items.slice(0, limit).map((item) => {
    const quantity = approved && item.approved_qty !== null ? item.approved_qty : item.requested_qty;
    return `${item.product.name} — ${formatQuantity(quantity, item.product.unit)}`;
  });
  const rest = items.length - limit;
  return rest > 0 ? `${parts.join("; ")} … va yana ${rest} ta` : parts.join("; ");
}

/** Reason/note text shown under a final status (rejection or cancellation). */
export function finalNote(order: Order): { title: string; text: string } | null {
  if (order.status === "REJECTED") return { title: "Rad etish sababi", text: order.decision_note };
  if (order.status === "CANCELLED") return { title: "Bekor qilish sababi", text: order.cancel_reason };
  return null;
}

/* ---------- Status stepper (owner view) ---------- */

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "NEW", label: "Yangi" },
  { status: "APPROVED", label: "Tasdiqlandi" },
  { status: "IN_DELIVERY", label: "Yo‘lda" },
  { status: "DELIVERED", label: "Yetkazildi" },
  { status: "CONFIRMED", label: "Qabul qilindi" },
];

/** Yangi → Tasdiqlandi → Yo‘lda → Yetkazildi → Qabul qilindi; rejected / cancelled orders stop with a red step. */
export function OrderStepper({ order }: { order: Order }) {
  const stopped = order.status === "REJECTED" || order.status === "CANCELLED";
  const reached = (order.history ?? []).map((entry) => entry.to_status);
  const current = stopped
    ? Math.max(0, ...reached.map((status) => STEPS.findIndex((step) => step.status === status)))
    : STEPS.findIndex((step) => step.status === order.status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Buyurtma bosqichlari">
      {STEPS.map((step, index) => {
        const done = index < current || (index === current && !stopped && order.status === "CONFIRMED");
        const active = index === current;
        const failed = stopped && index === current + 1;
        return (
          <li key={step.status} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", index === 0 ? "bg-transparent" : index <= current ? "bg-primary" : "bg-line")} />
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  done && "border-primary bg-primary text-white",
                  active && !done && !stopped && "border-primary bg-surface text-primary ring-4 ring-primary/10",
                  active && stopped && "border-primary bg-primary text-white",
                  failed && "border-danger bg-danger text-white",
                  !done && !active && !failed && "border-line bg-surface text-muted",
                )}
                aria-current={active ? "step" : undefined}
              >
                {failed ? <X className="size-3.5" aria-hidden /> : done || (active && stopped) ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn("h-0.5 flex-1", index === STEPS.length - 1 ? "bg-transparent" : index < current ? "bg-primary" : "bg-line")}
              />
            </span>
            <span className={cn("text-[11px] leading-tight sm:text-xs", active || done ? "font-medium text-ink" : "text-muted", failed && "font-medium text-danger")}>
              {failed ? order.status_display : step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- History timeline ---------- */

export function OrderHistory({ history }: { history: readonly StatusLogEntry<OrderStatus>[] }) {
  if (history.length === 0) return <p className="text-sm text-muted">Tarix yo‘q.</p>;
  return (
    <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
      {[...history].reverse().map((entry, index) => (
        <li key={`${entry.created_at}-${index}`} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface",
              index === 0 ? "bg-primary" : "bg-line-strong",
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={ORDER_STATUS} status={entry.to_status} label={entry.to_status_display} />
            <span className="text-xs tabular-nums text-muted">{formatDateTime(entry.created_at)}</span>
          </div>
          <p className="mt-1 text-[13px] text-ink">{entry.actor.full_name}</p>
          {entry.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-muted">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ---------- Reason dialog (reject / cancel) ---------- */

export function ReasonModal({
  title,
  description,
  label,
  confirmLabel,
  required,
  tone = "danger",
  onSubmit,
  onClose,
  onDone,
}: {
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  /** Reason 3–500 characters (ADMIN); otherwise optional, ≤ 500. */
  required: boolean;
  tone?: "danger" | "primary";
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const form = useForm({ reason: "" });
  const submit = form.handleSubmit(
    (values) =>
      collect([
        ["reason", required && values.reason.trim().length < 3 ? "Sababni yozing (kamida 3 ta belgi)." : undefined],
        ["reason", values.reason.trim().length > 500 ? "Sabab 500 ta belgidan oshmasin." : undefined],
      ]),
    (values) => onSubmit(values.reason.trim()),
    onDone,
  );
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Yopish
          </Button>
          <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={form.pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={label} required={required} {...form.field("reason")} hint={required ? undefined : "Ixtiyoriy"}>
          <Textarea {...form.control("reason")} rows={3} maxLength={500} autoFocus />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- Receipt confirmation (owner, or admin on behalf of the owner) ---------- */

/**
 * `POST /api/logistics/tasks/{id}/confirm` (V3 §7.5). Owner: “Qabul qildim” (`received_ok=true`) or
 * “Muammo bor” (`received_ok=false` + issue 3–1000). ADMIN confirming for the owner must give the reason.
 */
export function ConfirmReceiptModal({
  taskId,
  problem,
  asAdmin,
  onClose,
  onDone,
}: {
  taskId: number;
  problem: boolean;
  asAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const form = useForm({ issue_note: "" });
  const needsNote = problem || asAdmin;
  const submit = form.handleSubmit(
    (values) =>
      collect([
        [
          "issue_note",
          needsNote && values.issue_note.trim().length < 3
            ? asAdmin && !problem
              ? "Egasi nomidan tasdiqlash sababini yozing."
              : "Muammoni qisqacha yozing."
            : undefined,
        ],
      ]),
    (values) =>
      api.post<LogisticsTask>(`/logistics/tasks/${taskId}/confirm`, {
        received_ok: !problem,
        issue_note: values.issue_note.trim(),
      }),
    onDone,
  );
  const title = problem ? "Muammo bilan qabul qilish" : asAdmin ? "Egasi nomidan qabulni tasdiqlash" : "Qabul qildim";
  return (
    <Modal
      title={title}
      description={
        problem
          ? "Mahsulot qabul qilinadi, muammo esa administrator va mas’ul xodimga yetkaziladi."
          : "Mahsulotlar to‘liq va sifatli qabul qilinganini tasdiqlang. Bu amalni qaytarib bo‘lmaydi."
      }
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Yopish
          </Button>
          <Button type="submit" variant={problem ? "danger" : "primary"} loading={form.pending}>
            {problem ? "Muammoni yuborish" : "Tasdiqlash"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {needsNote ? (
          <Field
            label={problem ? "Muammo nimada?" : "Sabab"}
            required
            {...form.field("issue_note")}
            hint={problem ? "Masalan: 2 qop yem ho‘l, 1 dona dori yetishmadi" : undefined}
          >
            <Textarea {...form.control("issue_note")} rows={3} maxLength={1000} autoFocus />
          </Field>
        ) : (
          <p className="text-sm text-ink">Buyurtmadagi barcha mahsulotlarni oldingizmi?</p>
        )}
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
