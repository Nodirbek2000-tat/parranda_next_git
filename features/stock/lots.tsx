"use client";

import Link from "next/link";
import { CalendarClock, Layers } from "lucide-react";
import { diffDays, formatDate, formatNumber, todayIso } from "@/lib/format";
import { LOT_STATUS } from "@/lib/status";
import { usePagedApi } from "@/lib/use-api";
import { useCompanySettings } from "@/lib/use-settings";
import type { StockLot } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

/** Default of `SystemSettings.expiry_reminder_days` until the settings are loaded. */
export const DEFAULT_SOON_DAYS = 30;

export function useSoonDays(): number {
  return useCompanySettings()?.expiry_reminder_days ?? DEFAULT_SOON_DAYS;
}

export function expiryText(days: number | null): string {
  if (days === null) return "Muddatsiz";
  if (days < 0) return `${formatNumber(-days)} kun oldin o‘tgan`;
  if (days === 0) return "Bugun tugaydi";
  return `${formatNumber(days)} kun qoldi`;
}

/** Badge for a product's `nearest_expiry` (nothing when the date is far or absent). */
export function ExpiryBadge({ date, soonDays }: { date: string | null; soonDays: number }) {
  if (!date) return null;
  const days = diffDays(todayIso(), date);
  if (days < 0) {
    return (
      <Badge tone="danger" className="whitespace-nowrap">
        Muddati o‘tgan
      </Badge>
    );
  }
  if (days > soonDays) return null;
  return (
    <Badge tone="warning" className="whitespace-nowrap">
      <span title={`Eng yaqin yaroqlilik muddati: ${formatDate(date)}`}>{formatDate(date)} gacha</span>
    </Badge>
  );
}

function lotColumns(withProduct: boolean): Column<StockLot>[] {
  const columns: Column<StockLot>[] = [];
  if (withProduct) {
    columns.push({
      key: "product",
      header: "Mahsulot",
      primary: true,
      cell: (row) => (
        <Link href={`/warehouse/${row.product.id}`} className="font-medium text-ink hover:text-accent hover:underline">
          {row.product.name}
        </Link>
      ),
    });
  }
  columns.push(
    {
      key: "lot",
      header: "Partiya",
      primary: !withProduct,
      cell: (row) => <span className="font-medium tabular-nums">{row.lot_no || `#${row.id}`}</span>,
    },
    {
      key: "expiry",
      header: "Yaroqlilik muddati",
      cell: (row) =>
        row.expiry_date ? (
          <span className="flex flex-col">
            <span className="tabular-nums">{formatDate(row.expiry_date)}</span>
            <span
              className={
                row.status === "EXPIRED" ? "text-xs text-danger" : row.status === "EXPIRING" ? "text-xs text-warning-ink" : "text-xs text-muted"
              }
            >
              {expiryText(row.days_to_expiry)}
            </span>
          </span>
        ) : (
          <span className="text-muted">Muddatsiz</span>
        ),
    },
    {
      key: "remaining",
      header: "Qoldiq",
      align: "right",
      cell: (row) => (
        <span className="flex flex-col items-end">
          <span className="font-semibold tabular-nums">
            {formatNumber(row.remaining_qty)} {row.product.unit}
          </span>
          <span className="text-xs text-muted">qabul: {formatNumber(row.received_qty)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Holat",
      cell: (row) => <StatusBadge map={LOT_STATUS} status={row.status} label={row.status_display} />,
    },
    {
      key: "received",
      header: "Kirim",
      hideOnMobile: true,
      cell: (row) => (
        <span className="flex flex-col text-[13px]">
          <span className="tabular-nums">{formatDate(row.received_at)}</span>
          <span className="text-xs text-muted tabular-nums">{row.in_transaction.op_id}</span>
        </span>
      ),
    },
  );
  return columns;
}

/** Card “Muddati yaqin partiyalar” on /warehouse: open lots expired or expiring within the reminder window. */
export function ExpiringLotsCard() {
  const soonDays = useSoonDays();
  const list = usePagedApi<StockLot>("/stock-lots", { expiring_within: soonDays }, 5);
  const data = list.data;
  if (data && data.count === 0) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4 text-warning-ink" aria-hidden />
            Muddati yaqin partiyalar
          </span>
        }
        description={
          data
            ? `${formatNumber(data.count)} ta partiya — muddati o‘tgan yoki ${soonDays} kun ichida tugaydi`
            : `Muddati ${soonDays} kun ichida tugaydigan partiyalar`
        }
      />
      <div className="mt-3 border-t border-line">
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : (
          <>
            <DataTable
              caption="Muddati yaqin partiyalar"
              rows={data.results}
              columns={lotColumns(true)}
              rowKey={(row) => row.id}
              rowHref={(row) => `/warehouse/${row.product.id}`}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={5} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </div>
    </Card>
  );
}

/** Lots of one product (/warehouse/[id]), newest expiry first; empty lots hidden unless asked. */
export function ProductLotsCard({ productId }: { productId: number | string }) {
  const list = usePagedApi<StockLot>(`/products/${productId}/lots`, { has_remaining: 1 }, 10);
  const data = list.data;
  return (
    <Card>
      <CardHeader
        title="Partiyalar"
        description="Qoldig‘i bor partiyalar; chiqim avval eng yaqin muddatlisidan olinadi (FEFO)"
      />
      <div className="mt-3 border-t border-line">
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton rows={3} />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Qoldig‘i bor partiya yo‘q"
            description="Kirimda partiya raqami va yaroqlilik muddatini ko‘rsating."
          />
        ) : (
          <>
            <DataTable
              caption="Mahsulot partiyalari"
              rows={data.results}
              columns={lotColumns(false)}
              rowKey={(row) => row.id}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={10} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </div>
    </Card>
  );
}
