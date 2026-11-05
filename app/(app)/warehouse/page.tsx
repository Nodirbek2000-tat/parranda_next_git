"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Package, PackagePlus, Pencil, Power } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, entries, formatNumber, STOCK_TYPE_LABELS } from "@/lib/format";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import type { Product, StockTransaction, StockType, WarehouseStats, WarehouseStatsItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useProductOptions } from "@/features/options";
import { ProductModal } from "@/features/stock/product-modal";
import { StockModal } from "@/features/stock/stock-modal";
import { CenterBirdsCard } from "@/features/stock/center-birds-card";
import { ExpiringLotsCard, ExpiryBadge, useSoonDays } from "@/features/stock/lots";
import { transactionColumns } from "@/features/stock/transaction-columns";
import { coverText, coverView, WarehouseHeaderStats } from "@/features/stats/warehouse-stats";

const PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 20;

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; product: Product }
  | { kind: "stock"; type: StockType; product?: Product }
  | null;

function productColumns(
  cover: ReadonlyMap<number, WarehouseStatsItem>,
  generatedAt: string,
  soonDays: number,
): Column<Product>[] {
  return [
    {
      key: "name",
      header: "Mahsulot",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {row.name}
            {!row.is_active && <Badge>Nofaol</Badge>}
            <ExpiryBadge date={row.nearest_expiry} soonDays={soonDays} />
          </span>
          <span className="text-xs font-normal text-muted">{row.category_display}</span>
        </span>
      ),
    },
    ...BASE_COLUMNS,
    {
      key: "reserved",
      header: "Zaxirada",
      align: "right",
      hideOnMobile: true,
      cell: (row) =>
        row.reserved > 0 ? (
          <span className="text-warning-ink" title="Faol logistika topshiriqlari uchun zaxiralangan">
            {formatNumber(row.reserved)} {row.unit}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "available",
      header: "Bo‘sh",
      align: "right",
      cell: (row) => (
        <span className={row.available <= 0 ? "font-medium text-danger" : "font-medium"}>
          {formatNumber(row.available)} {row.unit}
        </span>
      ),
    },
    {
      key: "cover",
      header: "Yetadi",
      align: "right",
      cell: (row) => {
        const item = cover.get(row.id);
        if (!item || item.days_of_cover === null) return <span className="text-muted">—</span>;
        const view = coverView(item.days_of_cover, item.stockout_date, generatedAt);
        return (
          <span
            className={view.tone === "default" ? undefined : "font-medium text-warning-ink"}
            title={`Ombordan 30 kunlik o‘rtacha chiqim bo‘yicha · ${view.sub}`}
          >
            {coverText(view)}
          </span>
        );
      },
    },
  ];
}

const BASE_COLUMNS: Column<Product>[] = [
  {
    key: "balance",
    header: "Qoldiq",
    align: "right",
    cell: (row) => (
      <span className="inline-flex items-center gap-2">
        {row.is_low && <Badge tone="danger">Kam</Badge>}
        <span className={row.is_low ? "font-semibold text-danger" : "font-semibold"}>
          {formatNumber(row.balance)} {row.unit}
        </span>
      </span>
    ),
  },
  {
    key: "min",
    header: "Minimal zaxira",
    align: "right",
    hideOnMobile: true,
    cell: (row) => (
      <span className="text-muted">
        {formatNumber(row.min_stock)} {row.unit}
      </span>
    ),
  },
];

export default function WarehousePage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("true");
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const debouncedSearch = useDebounced(search.trim());
  const stats = useApi<WarehouseStats>("/warehouse/stats");
  const cover = new Map((stats.data?.items ?? []).map((item) => [item.id, item]));
  const soonDays = useSoonDays();

  const products = usePagedApi<Product>(
    "/products",
    {
      search: debouncedSearch,
      category,
      is_active: status,
      low: lowOnly ? 1 : undefined,
    },
    PAGE_SIZE,
  );
  const { page, setPage } = products;
  const data = products.data;
  const filtered = Boolean(debouncedSearch || category || lowOnly || status !== "true");

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const toggleActive = (product: Product) => {
    const activate = !product.is_active;
    void confirm({
      title: activate ? "Mahsulotni faollashtirish" : "Mahsulotni nofaol qilish",
      confirmLabel: activate ? "Faollashtirish" : "Nofaol qilish",
      tone: activate ? "primary" : "danger",
      message: activate ? (
        <p>
          <strong>{product.name}</strong> bilan yana kirim va chiqim qilish mumkin bo‘ladi.
        </p>
      ) : (
        <p>
          <strong>{product.name}</strong> bilan kirim va chiqim qilib bo‘lmaydi. Qoldiq va tarix saqlanib qoladi.
        </p>
      ),
      onConfirm: async () => {
        await api.patch<Product>(`/products/${product.id}`, { is_active: activate });
        toast.success(activate ? "Mahsulot faollashtirildi" : "Mahsulot nofaol qilindi");
      },
    });
  };

  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ombor"
        description="Yem, veterinariya preparatlari, vaksinalar va jihozlar"
        actions={
          <>
            <LinkButton href="/warehouse/inventory" icon={<ClipboardCheck className="size-4" aria-hidden />}>
              Inventarizatsiya
            </LinkButton>
            <Button
              variant="secondary"
              icon={<ArrowDownToLine className="size-4" aria-hidden />}
              onClick={() => setDialog({ kind: "stock", type: "IN" })}
            >
              Kirim
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowUpFromLine className="size-4" aria-hidden />}
              onClick={() => setDialog({ kind: "stock", type: "OUT" })}
            >
              Chiqim
            </Button>
            <Button icon={<PackagePlus className="size-4" aria-hidden />} onClick={() => setDialog({ kind: "create" })}>
              Yangi mahsulot
            </Button>
          </>
        }
      />

      <WarehouseHeaderStats stats={stats} />

      <ExpiringLotsCard />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_200px_160px_auto]">
          <SearchInput
            id="products-search"
            label="Qidirish"
            placeholder="Mahsulot nomi"
            value={search}
            onChange={resetPage(setSearch)}
          />
          <div>
            <label htmlFor="products-category" className="sr-only">
              Toifa
            </label>
            <Select id="products-category" value={category} onChange={(event) => resetPage(setCategory)(event.target.value)}>
              <option value="">Barcha toifalar</option>
              {entries(CATEGORY_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="products-status" className="sr-only">
              Holati
            </label>
            <Select id="products-status" value={status} onChange={(event) => resetPage(setStatus)(event.target.value)}>
              <option value="true">Faol</option>
              <option value="false">Nofaol</option>
              <option value="">Barchasi</option>
            </Select>
          </div>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(event) => resetPage(setLowOnly)(event.target.checked)}
              className="size-4 rounded border-line accent-accent"
            />
            Faqat kam qolganlar
          </label>
        </div>

        <StaleDataError error={data ? products.error : null} onRetry={products.reload} />
        {!data && products.error ? (
          <ErrorState error={products.error} onRetry={products.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filtered ? "Hech narsa topilmadi" : "Hali mahsulotlar yo‘q"}
            description={filtered ? "Filtrlarni o‘zgartirib ko‘ring." : "Birinchi mahsulotni qo‘shing, so‘ng kirim qiling."}
          />
        ) : (
          <>
            <DataTable
              caption="Ombordagi mahsulotlar"
              rows={data.results}
              columns={productColumns(cover, stats.data?.generated_at ?? "", soonDays)}
              rowKey={(row) => row.id}
              rowHref={(row) => `/warehouse/${row.id}`}
              stale={products.loading}
              actions={(row) => (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!row.is_active}
                    onClick={() => setDialog({ kind: "stock", type: "IN", product: row })}
                    aria-label={`${row.name}: kirim`}
                  >
                    Kirim
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!row.is_active || row.available <= 0}
                    onClick={() => setDialog({ kind: "stock", type: "OUT", product: row })}
                    aria-label={`${row.name}: chiqim`}
                  >
                    Chiqim
                  </Button>
                  <IconButton label={`${row.name}: tahrirlash`} onClick={() => setDialog({ kind: "edit", product: row })}>
                    <Pencil className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={row.is_active ? `${row.name}: nofaol qilish` : `${row.name}: faollashtirish`}
                    tone={row.is_active ? "quiet-danger" : "default"}
                    onClick={() => toggleActive(row)}
                  >
                    <Power className="size-4" aria-hidden />
                  </IconButton>
                </>
              )}
            />
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={products.loading} />
          </>
        )}
      </Card>

      <CenterBirdsCard />

      <TransactionsHistory />

      {dialog?.kind === "create" && <ProductModal onClose={close} onDone={close} />}
      {dialog?.kind === "edit" && <ProductModal product={dialog.product} onClose={close} onDone={close} />}
      {dialog?.kind === "stock" && (
        <StockModal type={dialog.type} product={dialog.product} onClose={close} onDone={close} />
      )}
    </div>
  );
}

function TransactionsHistory() {
  const [type, setType] = useState("");
  const [product, setProduct] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const productOptions = useProductOptions({ activeOnly: false });
  const transactions = usePagedApi<StockTransaction>(
    "/stock-transactions",
    {
      type,
      product,
      date_from: dateFrom,
      date_to: dateTo,
    },
    HISTORY_PAGE_SIZE,
  );
  const { page, setPage } = transactions;
  const data = transactions.data;
  const filtered = Boolean(type || product || dateFrom || dateTo);

  const update = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader title="Operatsiyalar tarixi" description="Kirim va chiqimlar, eng yangilari birinchi" />
      <div className="mt-4 grid gap-3 border-y border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <label htmlFor="tx-type" className="mb-1.5 block text-[13px] text-muted">
            Turi
          </label>
          <Select id="tx-type" value={type} onChange={(event) => update(setType)(event.target.value)}>
            <option value="">Barchasi</option>
            {entries(STOCK_TYPE_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="ADJUST_IN">Inventarizatsiya: ortiqcha</option>
            <option value="ADJUST_OUT">Inventarizatsiya: kamomad</option>
          </Select>
        </div>
        <div>
          <label htmlFor="tx-product" className="mb-1.5 block text-[13px] text-muted">
            Mahsulot
          </label>
          <Select id="tx-product" value={product} onChange={(event) => update(setProduct)(event.target.value)}>
            <option value="">Barchasi</option>
            {(productOptions.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="tx-from" className="mb-1.5 block text-[13px] text-muted">
            Sanadan
          </label>
          <Input
            id="tx-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => update(setDateFrom)(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tx-to" className="mb-1.5 block text-[13px] text-muted">
            Sanagacha
          </label>
          <Input
            id="tx-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => update(setDateTo)(event.target.value)}
          />
        </div>
      </div>
      <StaleDataError error={data ? transactions.error : null} onRetry={transactions.reload} />
      {!data && transactions.error ? (
        <ErrorState error={transactions.error} onRetry={transactions.reload} />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : data.results.length === 0 ? (
        <EmptyState icon={Package} title={filtered ? "Hech narsa topilmadi" : "Hali operatsiyalar yo‘q"} />
      ) : (
        <>
          <DataTable
            caption="Ombor operatsiyalari"
            rows={data.results}
            columns={transactionColumns()}
            rowKey={(row) => row.id}
            stale={transactions.loading}
          />
          <Pagination
            page={page}
            count={data.count}
            pageSize={HISTORY_PAGE_SIZE}
            onPageChange={setPage}
            disabled={transactions.loading}
          />
        </>
      )}
    </Card>
  );
}
