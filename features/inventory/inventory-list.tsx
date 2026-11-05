"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck, ClipboardPlus } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, entries, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useForm } from "@/lib/form";
import { INVENTORY_STATUS } from "@/lib/status";
import { usePagedApi } from "@/lib/use-api";
import type { InventoryCount, InventoryCountShort, InventoryCreatePayload, InventoryStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirmedAction } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary } from "@/components/ui/summary";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;
type TabKey = "all" | InventoryStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "DRAFT", label: "Qoralama" },
  { key: "APPROVED", label: "Tasdiqlangan" },
  { key: "CANCELLED", label: "Bekor qilingan" },
];

function isTab(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="flex min-w-[96px] flex-col gap-1">
      <span className="text-[13px] tabular-nums">
        {formatNumber(done)} / {formatNumber(total)} sanaldi
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

const COLUMNS: Column<InventoryCountShort>[] = [
  {
    key: "code",
    header: "Inventarizatsiya",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium tabular-nums">{row.code}</span>
        {row.note && <span className="max-w-[260px] truncate text-xs font-normal text-muted">{row.note}</span>}
      </span>
    ),
  },
  {
    key: "status",
    header: "Holat",
    cell: (row) => <StatusBadge map={INVENTORY_STATUS} status={row.status} label={row.status_display} />,
  },
  {
    key: "progress",
    header: "Sanash",
    cell: (row) => <Progress done={row.lines_counted} total={row.lines_total} />,
  },
  {
    key: "diff",
    header: "Farqli",
    align: "right",
    cell: (row) =>
      row.lines_with_difference > 0 ? (
        <span className="font-medium text-warning-ink">{formatNumber(row.lines_with_difference)} ta</span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "created",
    header: "Yaratilgan",
    hideOnMobile: true,
    cell: (row) => (
      <span className="flex flex-col text-[13px]">
        <span className="tabular-nums">{formatDateTime(row.created_at)}</span>
        <span className="text-xs text-muted">{row.created_by?.full_name ?? "—"}</span>
      </span>
    ),
  },
  {
    key: "approved",
    header: "Tasdiqlangan",
    cell: (row) => <span className="tabular-nums">{row.approved_at ? formatDate(row.approved_at) : "—"}</span>,
  },
];

export function InventoryList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("status");
  const tab: TabKey = isTab(raw) ? raw : "all";
  const [creating, setCreating] = useState(false);
  const list = usePagedApi<InventoryCountShort>(
    "/inventory-counts",
    { status: tab === "all" ? undefined : tab },
    PAGE_SIZE,
  );
  const data = list.data;

  const changeTab = (key: TabKey) => {
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete("status");
    else next.set("status", key);
    const text = next.toString();
    list.setPage(1);
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Ombor", href: "/warehouse" }, { label: "Inventarizatsiya" }]}
        title="Inventarizatsiya"
        description="Ombor qoldiqlarini sanash; tasdiqlanganda farqlar avtomatik tuzatiladi"
        actions={
          <Button icon={<ClipboardPlus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            Yangi inventarizatsiya
          </Button>
        }
      />
      <Card>
        <div className="border-b border-line px-4 py-3 sm:px-6">
          <Tabs items={TABS} value={tab} onChange={changeTab} label="Holat bo‘yicha" />
        </div>
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={tab === "all" ? "Hali inventarizatsiya o‘tkazilmagan" : "Bu holatda inventarizatsiya yo‘q"}
            description={
              tab === "all" ? "Yangi inventarizatsiya yarating: barcha faol mahsulotlar sanash varag‘iga tushadi." : undefined
            }
            action={
              tab === "all" ? (
                <Button icon={<ClipboardPlus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
                  Yangi inventarizatsiya
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              caption="Inventarizatsiyalar"
              rows={data.results}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              rowHref={(row) => `/warehouse/inventory/${row.id}`}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </Card>
      {creating && (
        <CreateInventoryModal
          onClose={() => setCreating(false)}
          onDone={(count) => {
            setCreating(false);
            router.push(`/warehouse/inventory/${count.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateInventoryModal({ onClose, onDone }: { onClose: () => void; onDone: (count: InventoryCount) => void }) {
  const toast = useToast();
  const confirmAction = useConfirmedAction();
  const form = useForm({ category: "", note: "" });
  const onSubmit = form.handleSubmit(
    () => ({}),
    (values) => {
      const payload: InventoryCreatePayload = {};
      if (values.category) payload.category = values.category;
      if (values.note.trim()) payload.note = values.note.trim();
      return confirmAction(
        {
          title: "Inventarizatsiyani boshlash",
          confirmLabel: "Yaratish",
          message: (
            <div className="flex flex-col gap-3">
              <p className="text-muted">
                Sanash varag‘i hozirgi qoldiqlar bilan yaratiladi. Sanash davomida kirim va chiqim qilish mumkin —
                tasdiqlashda joriy qoldiq bilan solishtiriladi.
              </p>
              <Summary
                items={[
                  ["Mahsulotlar", values.category ? CATEGORY_LABELS[values.category as keyof typeof CATEGORY_LABELS] : "Barcha faol mahsulotlar"],
                  ["Izoh", values.note.trim() || "—"],
                ]}
              />
            </div>
          ),
        },
        () => api.post<InventoryCount>("/inventory-counts", payload),
      );
    },
    (count) => {
      if (!count) return;
      toast.success(`${count.code} yaratildi: ${formatNumber(count.lines.length)} ta mahsulot`);
      onDone(count);
    },
  );
  return (
    <Modal
      title="Yangi inventarizatsiya"
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Davom etish
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Mahsulotlar" hint="Faqat faol mahsulotlar sanaladi" {...form.field("category")}>
          <Select {...form.control("category")}>
            <option value="">Barcha toifalar</option>
            {entries(CATEGORY_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Izoh" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} maxLength={500} placeholder="Masalan: oy oxiri sanovi" />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
      <HiddenRoleNote />
    </Modal>
  );
}

/** Warehouse users create and count; only an administrator approves (V3 §5.3). */
function HiddenRoleNote() {
  const { user } = useAuth();
  if (user?.role !== "WAREHOUSE") return null;
  return (
    <p className="mt-4 text-[13px] text-muted">
      Sanab bo‘lgach, tasdiqlash uchun administratorga xabar bering — farqlarni faqat administrator tasdiqlaydi.
    </p>
  );
}
