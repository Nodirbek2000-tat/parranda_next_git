"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BellRing, Eye, RotateCcw, Send } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, ROLE_LABELS, todayIso } from "@/lib/format";
import { NOTIFICATION_STATUS } from "@/lib/status";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import type {
  NotificationDetail,
  NotificationRow,
  NotificationSettingRow,
  NotificationStats,
  NotificationStatus,
  RetryFailedResult,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 50;
const STATUSES: readonly NotificationStatus[] = ["FAILED", "PENDING", "SENT", "SKIPPED"];

function isStatus(value: string | null): value is NotificationStatus {
  return value !== null && (STATUSES as readonly string[]).includes(value);
}

/** /notifications — delivery monitor for ADMIN (API_CONTRACT_V3 §9.5). */
export function NotificationMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [detailId, setDetailId] = useState<number | null>(null);

  const status = isStatus(params.get("status")) ? (params.get("status") as NotificationStatus) : "";
  const event = params.get("event") ?? "";
  const dateFrom = params.get("date_from") ?? "";
  const dateTo = params.get("date_to") ?? "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounced(search.trim());

  const filters = { status, event, date_from: dateFrom, date_to: dateTo, search: debouncedSearch };
  const list = usePagedApi<NotificationRow>("/notifications", filters, PAGE_SIZE);
  const stats = useApi<NotificationStats>("/notifications/stats", { date_from: dateFrom, date_to: dateTo });
  const events = useApi<NotificationSettingRow[]>("/notification-settings");
  const { setPage } = list;
  const data = list.data;
  const filtered = Boolean(status || event || dateFrom || dateTo || debouncedSearch);

  /** Filters live in the URL (V3 §15.3); every change starts again from page 1. */
  const setParam = (updates: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const text = query.toString();
    setPage(1);
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const retry = (row: NotificationRow) => {
    void confirm({
      title: "Qayta yuborish",
      confirmLabel: "Qayta yuborish",
      message: (
        <p>
          <strong>{row.recipient.full_name}</strong> uchun “{row.event_display}” xabari Telegram navbatiga qayta
          qo‘yiladi.
        </p>
      ),
      onConfirm: async () => {
        await api.post<NotificationRow>(`/notifications/${row.id}/retry`);
        toast.success("Xabar navbatga qo‘yildi");
      },
    });
  };

  const retryAll = () => {
    void confirm({
      title: "Barcha xatolarni qayta yuborish",
      confirmLabel: "Qayta yuborish",
      message: (
        <p>
          Tanlangan {event ? "hodisa va " : ""}davrdagi yuborilmagan (FAILED) xabarlar Telegram navbatiga qayta qo‘yiladi
          (bir martada ko‘pi bilan 500 ta). Telegramga bog‘lanmagan foydalanuvchilar o‘tkazib yuboriladi.
        </p>
      ),
      onConfirm: async () => {
        const result = await api.post<RetryFailedResult>("/notifications/retry-failed", {
          event: event || undefined,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        });
        toast.success(`Qayta yuborildi: ${result.retried} ta · o‘tkazib yuborildi: ${result.skipped} ta`);
      },
    });
  };

  const columns: Column<NotificationRow>[] = [
    {
      key: "event",
      header: "Hodisa",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.event_display}</span>
          <span className="text-xs font-normal tabular-nums text-muted">{formatDateTime(row.created_at)}</span>
        </span>
      ),
    },
    {
      key: "recipient",
      header: "Qabul qiluvchi",
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.recipient.full_name}</span>
          <span className="text-xs text-muted">
            {ROLE_LABELS[row.recipient.role]}
            {!row.telegram_linked && " · Telegram yo‘q"}
          </span>
        </span>
      ),
    },
    { key: "op", header: "Operatsiya", cell: (row) => <span className="tabular-nums">{row.related_op || "—"}</span> },
    {
      key: "status",
      header: "Holat",
      cell: (row) => <StatusBadge map={NOTIFICATION_STATUS} status={row.status} label={row.status_display} />,
    },
    {
      key: "attempts",
      header: "Urinish",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatNumber(row.attempts),
    },
    {
      key: "error",
      header: "Oxirgi xato",
      hideOnMobile: true,
      className: "max-w-[220px]",
      cell: (row) =>
        row.last_error ? (
          <span className="block truncate text-xs text-danger" title={row.last_error}>
            {row.last_error}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bildirishnomalar"
        description="Telegram xabarlari yetkazilishi: navbat, xatolar va qayta yuborish"
        actions={
          <Button
            variant="secondary"
            icon={<RotateCcw className="size-4" aria-hidden />}
            onClick={retryAll}
            disabled={!stats.data || stats.data.FAILED === 0}
          >
            Barcha xatolarni qayta yuborish
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Holat bo‘yicha filtr">
        {STATUSES.map((value) => {
          const meta = NOTIFICATION_STATUS[value];
          const active = status === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setParam({ status: active ? "" : value })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border bg-surface p-4 text-left shadow-card transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong",
              )}
            >
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {stats.data ? (
                <span className="text-2xl font-semibold tabular-nums text-ink">{formatNumber(stats.data[value])}</span>
              ) : (
                <Skeleton className="h-7 w-14" />
              )}
            </button>
          );
        })}
      </div>
      <p className="-mt-3 text-xs text-muted">
        {dateFrom || dateTo ? "Tanlangan davr" : "Oxirgi 30 kun"} bo‘yicha. Kartani bosib ro‘yxatni filtrlang.
      </p>

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_220px_160px_160px]">
          <SearchInput
            id="notif-search"
            label="Qidirish"
            placeholder="Operatsiya ID yoki qabul qiluvchi"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <div>
            <label htmlFor="notif-event" className="sr-only">
              Hodisa
            </label>
            <Select id="notif-event" value={event} onChange={(e) => setParam({ event: e.target.value })}>
              <option value="">Barcha hodisalar</option>
              {(events.data ?? []).map((item) => (
                <option key={item.event} value={item.event}>
                  {item.display}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="notif-from" className="sr-only">
              Sanadan
            </label>
            <Input
              id="notif-from"
              type="date"
              value={dateFrom}
              max={dateTo || todayIso()}
              onChange={(e) => setParam({ date_from: e.target.value })}
              aria-label="Sanadan"
            />
          </div>
          <div>
            <label htmlFor="notif-to" className="sr-only">
              Sanagacha
            </label>
            <Input
              id="notif-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={todayIso()}
              onChange={(e) => setParam({ date_to: e.target.value })}
              aria-label="Sanagacha"
            />
          </div>
        </div>

        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.error.status === 400 ? undefined : list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState icon={BellRing} title={filtered ? "Hech narsa topilmadi" : "Bildirishnomalar hali yo‘q"} />
        ) : (
          <>
            <DataTable
              caption="Bildirishnomalar"
              rows={data.results}
              columns={columns}
              rowKey={(row) => row.id}
              stale={list.loading}
              actions={(row) => (
                <>
                  <IconButton label="Batafsil" onClick={() => setDetailId(row.id)}>
                    <Eye className="size-4" aria-hidden />
                  </IconButton>
                  {row.status === "FAILED" && (
                    <IconButton label={`${row.recipient.full_name}: qayta yuborish`} onClick={() => retry(row)}>
                      <Send className="size-4" aria-hidden />
                    </IconButton>
                  )}
                </>
              )}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={list.loading} />
          </>
        )}
      </Card>

      {detailId !== null && <NotificationDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function NotificationDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useApi<NotificationDetail>(`/notifications/${id}`);
  const row = detail.data;
  return (
    <Modal title={row ? row.event_display : "Bildirishnoma"} description={row?.title} onClose={onClose} size="lg">
      {!row ? (
        detail.error ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : (
          <TableSkeleton rows={4} />
        )
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info label="Qabul qiluvchi" value={`${row.recipient.full_name} · ${ROLE_LABELS[row.recipient.role]}`} />
            <Info label="Holat" value={<StatusBadge map={NOTIFICATION_STATUS} status={row.status} label={row.status_display} />} />
            <Info label="Yaratilgan" value={formatDateTime(row.created_at)} />
            <Info label="Yuborilgan" value={formatDateTime(row.sent_at)} />
            <Info label="O‘qilgan (ilovada)" value={formatDateTime(row.read_at)} />
            <Info label="Urinishlar" value={formatNumber(row.attempts)} />
            <Info label="Operatsiya" value={row.related_op || "—"} />
            <Info label="Havola" value={row.button_path || "—"} />
          </dl>
          {row.last_error && (
            <div className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              {row.last_error}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Xabar matni</p>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-line bg-subtle px-3 py-2.5 font-sans text-[13px] text-ink">
              {row.title}
              {"\n\n"}
              {row.body}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}
