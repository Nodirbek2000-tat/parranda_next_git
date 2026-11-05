"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import { ORDER_KIND_LABELS, ORDER_STATUS } from "@/lib/status";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import type { Order, OrderKind, Paginated } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { itemsSummary } from "./order-parts";

const PAGE_SIZE = 30;

/** Status tabs of /orders (V3 §15.3). `all` is the last tab; the first one (`new`) is the default. */
const TABS = [
  { key: "new", label: "Yangi", status: "NEW" },
  { key: "approved", label: "Tasdiqlangan", status: "APPROVED" },
  { key: "delivery", label: "Yetkazilmoqda", status: "IN_DELIVERY" },
  { key: "delivered", label: "Yetkazildi", status: "DELIVERED" },
  { key: "done", label: "Yakunlangan", status: "CONFIRMED" },
  { key: "closed", label: "Rad/Bekor", status: "REJECTED,CANCELLED" },
  { key: "all", label: "Barchasi", status: "" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const KINDS = Object.keys(ORDER_KIND_LABELS) as OrderKind[];

/** One request per tab, `page_size=1`: only the `count` is used (6 tiny queries, no extra endpoint). */
function useTabCount(status: string, filters: Record<string, string>): number | undefined {
  const result = useApi<Paginated<Order>>("/orders", { ...filters, status, page_size: 1 });
  return result.data?.count;
}

/** /orders — orders and supply requests of all households for ADMIN / WAREHOUSE (V3 §6, §15.3). */
export function OrderList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tab = (TABS.find((item) => item.key === params.get("tab"))?.key ?? "new") as TabKey;
  const kind = KINDS.includes(params.get("kind") as OrderKind) ? (params.get("kind") as OrderKind) : "";
  const dateFrom = params.get("date_from") ?? "";
  const dateTo = params.get("date_to") ?? "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounced(search.trim());

  const common = { kind, date_from: dateFrom, date_to: dateTo, search: debouncedSearch };
  const status = TABS.find((item) => item.key === tab)?.status ?? "";
  const list = usePagedApi<Order>("/orders", { ...common, status }, PAGE_SIZE);
  const { setPage } = list;
  const counts: Partial<Record<TabKey, number | undefined>> = {
    new: useTabCount("NEW", common),
    approved: useTabCount("APPROVED", common),
    delivery: useTabCount("IN_DELIVERY", common),
    delivered: useTabCount("DELIVERED", common),
    done: useTabCount("CONFIRMED", common),
    closed: useTabCount("REJECTED,CANCELLED", common),
  };
  const filtered = Boolean(kind || dateFrom || dateTo || debouncedSearch);

  /** Filters live in the URL; every change starts again from page 1. */
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

  const columns: Column<Order>[] = [
    {
      key: "code",
      header: "Buyurtma",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{row.code}</span>
          <span className="text-xs font-normal text-muted">{ORDER_KIND_LABELS[row.kind] ?? row.kind_display}</span>
        </span>
      ),
    },
    {
      key: "household",
      header: "Xonadon",
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.household.name}</span>
          <span className="text-xs tabular-nums text-muted">{row.household.code}</span>
        </span>
      ),
    },
    {
      key: "items",
      header: "Mahsulotlar",
      className: "max-w-[280px]",
      cell: (row) => (
        <span className="block truncate" title={itemsSummary(row.items, row.items.length)}>
          {itemsSummary(row.items)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Holat",
      cell: (row) => <StatusBadge map={ORDER_STATUS} status={row.status} label={row.status_display} />,
    },
    {
      key: "desired",
      header: "Kerakli sana",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{formatDate(row.desired_date)}</span>,
    },
    {
      key: "created",
      header: "Yaratilgan",
      align: "right",
      cell: (row) => <span className="tabular-nums text-muted">{formatDateTime(row.created_at)}</span>,
    },
  ];

  const data = list.data;
  const activeLabel = TABS.find((item) => item.key === tab)?.label ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buyurtmalar"
        description="Xonadonlardan kelgan buyurtma va talablar: tasdiqlash, rad etish, yetkazishga topshirish"
      />

      <Tabs
        label="Buyurtma holati"
        value={tab}
        onChange={(key) => setParam({ tab: key === "new" ? "" : key })}
        items={TABS.map((item) => ({ key: item.key, label: item.label, count: counts[item.key] }))}
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-4 sm:px-6 lg:grid-cols-[1fr_220px_160px_160px]">
          <SearchInput
            id="orders-search"
            className="col-span-2 sm:col-span-1"
            label="Qidirish"
            placeholder="Buyurtma kodi, xonadon nomi yoki kodi"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="orders-kind" className="sr-only">
              Turi
            </label>
            <Select id="orders-kind" value={kind} onChange={(event) => setParam({ kind: event.target.value })}>
              <option value="">Barcha turlar</option>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {ORDER_KIND_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="orders-from" className="sr-only">
              Sanadan
            </label>
            <Input
              id="orders-from"
              type="date"
              value={dateFrom}
              max={dateTo || todayIso()}
              onChange={(event) => setParam({ date_from: event.target.value })}
              aria-label="Sanadan"
            />
          </div>
          <div>
            <label htmlFor="orders-to" className="sr-only">
              Sanagacha
            </label>
            <Input
              id="orders-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={todayIso()}
              onChange={(event) => setParam({ date_to: event.target.value })}
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
          <EmptyState
            icon={ShoppingCart}
            title={filtered ? "Hech narsa topilmadi" : tab === "all" ? "Buyurtmalar hali yo‘q" : `“${activeLabel}” buyurtmalar yo‘q`}
            description={
              filtered
                ? "Qidiruv yoki filtrlarni o‘zgartirib ko‘ring."
                : "Xonadon egalari Web App’dagi “Buyurtmalarim” bo‘limidan buyurtma yuboradi."
            }
          />
        ) : (
          <>
            <DataTable
              caption="Buyurtmalar"
              rows={data.results}
              columns={columns}
              rowKey={(row) => row.id}
              rowHref={(row) => `/orders/${row.id}`}
              stale={list.loading}
            />
            <Pagination
              page={list.page}
              count={data.count}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={list.loading}
            />
          </>
        )}
      </Card>
      <p className={cn("-mt-3 text-xs text-muted", !filtered && "hidden")}>
        Sonlar tanlangan filtrlar bo‘yicha hisoblangan.
      </p>
    </div>
  );
}
