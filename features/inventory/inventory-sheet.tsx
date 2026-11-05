"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Ban, CheckCheck, CircleAlert, ClipboardCheck, Loader2, Search, Trash2 } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { INVENTORY_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { InventoryCount, InventoryCountLine } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { Progress } from "./inventory-list";
import { canDeleteInventory, useDeleteInventory } from "./use-delete-inventory";

const SAVE_DELAY_MS = 800;
const WHOLE_UNITS = new Set(["dona", "qop"]);
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type Filter = "all" | "uncounted" | "diff";

function parseQuantity(raw: string): number | null | undefined {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function lineError(line: InventoryCountLine, raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = parseQuantity(raw);
  if (value === undefined) return "Son kiriting";
  if (value === null) return null;
  if (value < 0) return "Manfiy bo‘lishi mumkin emas";
  if (value > 9_999_999_999.99) return "Juda katta son";
  if (WHOLE_UNITS.has(line.product.unit) && !Number.isInteger(value)) return `“${line.product.unit}” uchun butun son`;
  return null;
}

function signed(value: number, unit: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value))} ${unit}`;
}

export function InventorySheet({ id }: { id: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { user } = useAuth();
  // silent delete: this page must not refetch (404) before we leave it; the list loads fresh.
  const deleteCount = useDeleteInventory(() => router.replace("/warehouse/inventory"));
  const resource = useApi<InventoryCount>(`/inventory-counts/${id}`);
  const [local, setLocal] = useState<{ source: InventoryCount | undefined; value: InventoryCount } | null>(null);
  const count = local && local.source === resource.data ? local.value : resource.data;
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cancelling, setCancelling] = useState(false);
  const timer = useRef<number | null>(null);
  const draftsRef = useRef(drafts);
  const sourceRef = useRef(resource.data);
  useEffect(() => {
    draftsRef.current = drafts;
    sourceRef.current = resource.data;
  });
  const inFlight = useRef<Promise<boolean> | null>(null);

  const editable = Boolean(count && count.status === "DRAFT" && count.allowed_actions.includes("count"));

  /** Sends every changed, valid line in one PATCH (silent: other pages need no refetch). */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    const current = count;
    if (!current) return true;
    const pending = draftsRef.current;
    const lines = current.lines.filter((line) => pending[line.product.id] !== undefined);
    const valid = lines.filter((line) => lineError(line, pending[line.product.id]) === null);
    if (valid.length === 0) {
      setSaveState(lines.length > 0 ? "error" : "idle");
      return lines.length === 0;
    }
    const sent = Object.fromEntries(valid.map((line) => [line.product.id, pending[line.product.id]]));
    setSaveState("saving");
    setSaveError(null);
    const run = api
      .patch<InventoryCount>(
        `/inventory-counts/${current.id}/lines`,
        { lines: valid.map((line) => ({ product: line.product.id, counted_qty: parseQuantity(sent[line.product.id]) })) },
        { silent: true },
      )
      .then((updated) => {
        setLocal({ source: sourceRef.current, value: updated });
        setDrafts((now) => {
          const next = { ...now };
          for (const [key, value] of Object.entries(sent)) {
            if (next[Number(key)] === value) delete next[Number(key)];
          }
          return next;
        });
        setSaveState(valid.length === lines.length ? "saved" : "error");
        return valid.length === lines.length;
      })
      .catch((error: unknown) => {
        const apiError = toApiError(error);
        setSaveState("error");
        setSaveError(apiError.fields.lines ?? apiError.detail ?? apiError.message);
        if (apiError.status === 409) resource.reload();
        return false;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = run;
    return run;
  }, [count, resource]);

  const schedule = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setSaveState("pending");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flush();
    }, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const setDraft = (line: InventoryCountLine, value: string) => {
    setDrafts((now) => ({ ...now, [line.product.id]: value }));
    schedule();
  };

  const rows = useMemo(() => {
    if (!count) return [];
    const text = query.trim().toLowerCase();
    return count.lines.filter((line) => {
      if (text && !line.product.name.toLowerCase().includes(text)) return false;
      const raw = drafts[line.product.id];
      const counted = raw !== undefined ? parseQuantity(raw) : line.counted_qty;
      if (filter === "uncounted") return counted === null || counted === undefined;
      if (filter === "diff") {
        if (count.status === "APPROVED") return (line.difference ?? 0) !== 0;
        return typeof counted === "number" && counted !== line.current_balance;
      }
      return true;
    });
  }, [count, drafts, filter, query]);

  if (!count && resource.error?.status === 404) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title="Inventarizatsiya topilmadi"
          action={<LinkButton href="/warehouse/inventory">Ro‘yxatga qaytish</LinkButton>}
        />
      </Card>
    );
  }
  if (!count && resource.error) {
    return (
      <Card>
        <ErrorState error={resource.error} onRetry={resource.reload} />
      </Card>
    );
  }
  if (!count) return <PageSkeleton />;

  const countedNow = count.lines.filter((line) => {
    const raw = drafts[line.product.id];
    const value = raw !== undefined ? parseQuantity(raw) : line.counted_qty;
    return typeof value === "number";
  }).length;
  const total = count.lines.length;

  const approve = async () => {
    const ok = await flush();
    if (!ok) {
      toast.error("Avval xato qatorlarni tuzating");
      return;
    }
    const fresh = await api.get<InventoryCount>(`/inventory-counts/${count.id}`);
    const uncounted = fresh.lines.filter((line) => line.counted_qty === null).length;
    if (uncounted > 0) {
      toast.error(`${uncounted} ta mahsulot sanalmagan`);
      setFilter("uncounted");
      return;
    }
    const changes = fresh.lines
      .map((line) => ({ line, diff: (line.counted_qty ?? 0) - line.current_balance }))
      .filter((item) => item.diff !== 0);
    const surplus = changes.filter((item) => item.diff > 0).length;
    void confirm({
      title: `Inventarizatsiyani tasdiqlash: ${fresh.code}`,
      confirmLabel: "Tasdiqlash",
      message: (
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            Farqlar ombor qoldig‘iga tuzatish operatsiyasi sifatida yoziladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
          <Summary
            items={[
              ["Mahsulotlar", formatNumber(fresh.lines.length)],
              ["Ortiqcha (kirim)", `${surplus} ta`],
              ["Kamomad (chiqim)", `${changes.length - surplus} ta`],
              ["Farqsiz", `${fresh.lines.length - changes.length} ta`],
            ]}
          />
          {changes.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-line text-[13px]">
              {changes.map(({ line, diff }) => (
                <li key={line.id} className="flex justify-between gap-3 border-b border-line px-3 py-1.5 last:border-b-0">
                  <span className="truncate">{line.product.name}</span>
                  <span className={cn("shrink-0 tabular-nums", diff > 0 ? "text-accent" : "text-danger")}>
                    {signed(diff, line.product.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
      onConfirm: async () => {
        const updated = await api.post<InventoryCount>(`/inventory-counts/${count.id}/approve`);
        setLocal({ source: sourceRef.current, value: updated });
        toast.success(`${updated.code} tasdiqlandi`);
      },
    });
  };

  const saveLabel: Record<SaveState, ReactNode> = {
    idle: null,
    pending: <span className="text-muted">O‘zgarishlar saqlanadi…</span>,
    saving: (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saqlanmoqda…
      </span>
    ),
    saved: (
      <span className="inline-flex items-center gap-1.5 text-accent">
        <CheckCheck className="size-3.5" aria-hidden /> Saqlandi
      </span>
    ),
    error: (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <CircleAlert className="size-3.5" aria-hidden /> Saqlanmadi
      </span>
    ),
  };

  const approved = count.status === "APPROVED";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Ombor", href: "/warehouse" },
          { label: "Inventarizatsiya", href: "/warehouse/inventory" },
          { label: count.code },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {count.code}
            <StatusBadge map={INVENTORY_STATUS} status={count.status} label={count.status_display} />
          </span>
        }
        description={
          <>
            {formatDateTime(count.created_at)} · {count.created_by?.full_name ?? "—"}
            {count.note ? ` · ${count.note}` : ""}
          </>
        }
        actions={
          <>
            {count.allowed_actions.includes("cancel") && (
              <Button variant="secondary" icon={<Ban className="size-4" aria-hidden />} onClick={() => setCancelling(true)}>
                Bekor qilish
              </Button>
            )}
            {count.allowed_actions.includes("approve") && (
              <Button icon={<ClipboardCheck className="size-4" aria-hidden />} onClick={() => void approve()}>
                Tasdiqlash
              </Button>
            )}
            {canDeleteInventory(count, user?.role) && (
              <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => deleteCount(count)}>
                O‘chirish
              </Button>
            )}
          </>
        }
      />

      {count.status === "CANCELLED" && (
        <Alert tone="warning">
          Bekor qilingan{count.cancelled_at ? ` (${formatDateTime(count.cancelled_at)})` : ""}: {count.cancel_reason}
        </Alert>
      )}
      {approved && (
        <Alert tone="info">
          {formatDateTime(count.approved_at)} da {count.approved_by?.full_name ?? "administrator"} tasdiqladi. Farqlar
          tuzatish operatsiyalari bilan qoldiqqa yozildi.
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Progress done={approved ? total : countedNow} total={total} />
            <div className="text-[13px]" aria-live="polite">
              {editable && saveLabel[saveState]}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Mahsulot qidirish</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mahsulot nomi" className="pl-9" />
            </label>
            <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Qatorlar filtri">
              {(
                [
                  ["all", "Barchasi"],
                  ["uncounted", "Sanalmagan"],
                  ["diff", "Farqli"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "h-10 whitespace-nowrap rounded-lg border px-3 text-[13px] transition-colors",
                    filter === key ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:bg-subtle",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {saveError && <Alert>{saveError}</Alert>}
        </div>

        <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_168px_1fr] gap-4 border-b border-line px-6 py-2 text-xs font-medium text-muted md:grid">
          <span>Mahsulot</span>
          <span className="text-right">Kutilgan</span>
          <span className="text-right">{approved ? "Tasdiqlashda" : "Joriy qoldiq"}</span>
          <span className="text-right">Sanalgan</span>
          <span className="text-right">Farq</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Mos mahsulot yo‘q" description="Filtr yoki qidiruvni o‘zgartiring." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((line) => (
              <SheetRow
                key={line.id}
                line={line}
                approved={approved}
                editable={editable}
                draft={drafts[line.product.id]}
                onChange={(value) => setDraft(line, value)}
                onBlur={() => {
                  if (drafts[line.product.id] !== undefined) void flush();
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      {cancelling && <CancelModal count={count} onClose={() => setCancelling(false)} onDone={(updated) => {
        setCancelling(false);
        setLocal({ source: sourceRef.current, value: updated });
      }} />}
    </div>
  );
}

function SheetRow({
  line,
  approved,
  editable,
  draft,
  onChange,
  onBlur,
}: {
  line: InventoryCountLine;
  approved: boolean;
  editable: boolean;
  draft: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const unit = line.product.unit;
  const value = draft ?? (line.counted_qty === null ? "" : String(line.counted_qty));
  const parsed = draft !== undefined ? parseQuantity(draft) : line.counted_qty;
  const error = lineError(line, draft);
  const reference = approved ? (line.balance_at_approval ?? line.current_balance) : line.current_balance;
  const diff = approved ? line.difference : typeof parsed === "number" ? parsed - reference : null;
  const inputId = `count-${line.id}`;
  const belowReserved = !approved && typeof parsed === "number" && parsed < line.reserved;

  return (
    <li className="grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,2fr)_1fr_1fr_168px_1fr]">
      <div className="col-span-2 min-w-0 md:col-span-1">
        <Link href={`/warehouse/${line.product.id}`} className="font-medium text-ink hover:text-accent hover:underline">
          {line.product.name}
        </Link>
        <p className="text-xs text-muted">
          {unit}
          {line.reserved > 0 ? ` · zaxirada ${formatNumber(line.reserved)}` : ""}
        </p>
      </div>
      <div className="text-[13px] md:text-right">
        <span className="text-muted md:hidden">Kutilgan: </span>
        <span className="tabular-nums">{formatNumber(line.expected_qty)}</span>
      </div>
      <div className="text-right text-[13px]">
        <span className="text-muted md:hidden">{approved ? "Tasdiqlashda: " : "Joriy: "}</span>
        <span className={cn("tabular-nums", reference !== line.expected_qty && "font-medium text-warning-ink")}>
          {formatNumber(reference)}
        </span>
      </div>
      <div className="md:text-right">
        {editable ? (
          <Field label={`${line.product.name}: sanalgan (${unit})`} htmlFor={inputId} error={error ?? (belowReserved ? "Zaxiradan kam" : undefined)} className="[&>label]:sr-only">
            <Input
              id={inputId}
              aria-label={`${line.product.name}: sanalgan (${unit})`}
              type="number"
              inputMode="decimal"
              min={0}
              step={WHOLE_UNITS.has(unit) ? 1 : "any"}
              value={value}
              invalid={Boolean(error)}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              placeholder="—"
              className="text-right tabular-nums"
            />
          </Field>
        ) : (
          <span className="text-[13px]">
            <span className="text-muted md:hidden">Sanalgan: </span>
            <span className="font-medium tabular-nums">{line.counted_qty === null ? "—" : formatNumber(line.counted_qty)}</span>
          </span>
        )}
      </div>
      <div className="text-right text-[13px]">
        {diff === null || diff === undefined ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="inline-flex flex-col items-end">
            <span
              className={cn(
                "font-semibold tabular-nums",
                diff > 0 ? "text-accent" : diff < 0 ? "text-danger" : "text-muted",
              )}
            >
              {diff === 0 ? "Farqsiz" : signed(diff, unit)}
            </span>
            {line.adjustment && <span className="text-xs text-muted tabular-nums">{line.adjustment.op_id}</span>}
          </span>
        )}
      </div>
    </li>
  );
}

function CancelModal({
  count,
  onClose,
  onDone,
}: {
  count: InventoryCount;
  onClose: () => void;
  onDone: (count: InventoryCount) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 3) {
      setError("Kamida 3 ta belgi kiriting");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await api.post<InventoryCount>(`/inventory-counts/${count.id}/cancel`, { reason: text });
      toast.success(`${updated.code} bekor qilindi`);
      onDone(updated);
    } catch (caught) {
      const apiError = toApiError(caught);
      setError(apiError.fields.reason ?? apiError.detail ?? apiError.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      title={`Inventarizatsiyani bekor qilish: ${count.code}`}
      description="Sanalgan miqdorlar qoldiqqa yozilmaydi. Bu amalni qaytarib bo‘lmaydi."
      onClose={onClose}
      busy={pending}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Orqaga
          </Button>
          <Button type="submit" variant="danger" loading={pending}>
            Bekor qilish
          </Button>
        </>
      }
    >
      <Field label="Sabab" htmlFor="inventory-cancel-reason" required error={error ?? undefined}>
        <Textarea
          id="inventory-cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          invalid={Boolean(error)}
        />
      </Field>
    </Modal>
  );
}
