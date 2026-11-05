"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Plus, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { ORDER_KIND_LABELS, ORDER_STATUS } from "@/lib/status";
import { usePagedApi } from "@/lib/use-api";
import type { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { NewOrderModal } from "./new-order-modal";
import { itemsSummary } from "./order-parts";

const PAGE_SIZE = 20;
const TABS = [
  { key: "open", label: "Faol", status: "NEW,APPROVED,IN_DELIVERY,DELIVERED" },
  { key: "done", label: "Yakunlangan", status: "CONFIRMED,REJECTED,CANCELLED" },
  { key: "all", label: "Barchasi", status: "" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** /my/orders — the owner's orders and supply requests (V3 §6, §15.3). `?new=1` opens the “Yangi buyurtma” sheet. */
export function MyOrders() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const tab = (TABS.find((item) => item.key === params.get("tab"))?.key ?? "open") as TabKey;
  const openedFromLink = params.get("new") === "1";
  const [creating, setCreating] = useState(openedFromLink);
  const status = TABS.find((item) => item.key === tab)?.status ?? "";
  const list = usePagedApi<Order>("/orders", { status }, PAGE_SIZE);
  const { setPage } = list;
  const data = list.data;

  const setTab = (key: TabKey) => {
    setPage(1);
    router.replace(key === "open" ? pathname : `${pathname}?tab=${key}`, { scroll: false });
  };

  const newButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
      Yangi buyurtma
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Buyurtmalarim"
        description="Yem va mahsulot buyurtmalaringiz hamda ularning holati"
        actions={newButton}
      />
      <Tabs label="Buyurtmalar" value={tab} onChange={setTab} items={TABS.map(({ key, label }) => ({ key, label }))} />

      <StaleDataError error={data ? list.error : null} onRetry={list.reload} className="rounded-xl border" />
      {!data && list.error ? (
        <Card>
          <ErrorState error={list.error} onRetry={list.reload} />
        </Card>
      ) : !data ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title={tab === "open" ? "Faol buyurtmalar yo‘q" : "Buyurtmalar yo‘q"}
            description="Yem, dori yoki boshqa mahsulot kerak bo‘lsa, buyurtma yuboring — holatini shu yerda kuzatasiz."
            action={newButton}
          />
        </Card>
      ) : (
        <>
          <ul className={cn("flex flex-col gap-3 transition-opacity", list.loading && "opacity-60")}>
            {data.results.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/my/orders/${order.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors",
                    "hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums text-ink">{order.code}</span>
                      <StatusBadge map={ORDER_STATUS} status={order.status} label={order.status_display} />
                    </div>
                    <p className="mt-1 truncate text-sm text-ink">{itemsSummary(order.items, 2, order.status !== "NEW")}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {ORDER_KIND_LABELS[order.kind] ?? order.kind_display} · {formatDateTime(order.created_at)}
                      {order.desired_date ? ` · kerak: ${formatDate(order.desired_date)}` : ""}
                    </p>
                    {order.allowed_actions.includes("confirm_receipt") && (
                      <p className="mt-1.5 text-xs font-medium text-accent">Yetkazildi — qabul qilganingizni tasdiqlang</p>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {data.count > PAGE_SIZE && (
            <Card>
              <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={list.loading} />
            </Card>
          )}
        </>
      )}

      {creating && (
        <NewOrderModal
          onClose={() => {
            setCreating(false);
            // `?new=1` (link from /my) must not reopen the sheet on reload or “Back”.
            if (openedFromLink) {
              const query = new URLSearchParams(params.toString());
              query.delete("new");
              const text = query.toString();
              router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
            }
          }}
          onCreated={(order) => {
            setCreating(false);
            toast.success(`${order.code} yuborildi`);
            if (openedFromLink) router.replace(`/my/orders/${order.id}`);
            else router.push(`/my/orders/${order.id}`);
          }}
        />
      )}
    </div>
  );
}
