"use client";

import { Suspense, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Package, Pencil, Users } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS } from "@/lib/stats";
import { useApi } from "@/lib/use-api";
import type { ProductStats, StockTransaction, StockType } from "@/lib/types";
import { RankedBars, type RankedBar } from "@/components/charts/ranked-bars";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ChartCard, StatsPageSkeleton } from "@/components/stats/chart-card";
import { KpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { PeriodPicker, usePeriodQuery } from "@/components/stats/period-picker";
import { coverView } from "../stats/warehouse-stats";
import { PagedTableCard } from "../paged-table-card";
import { ProductModal } from "./product-modal";
import { StockModal } from "./stock-modal";
import { ProductLotsCard } from "./lots";
import { transactionColumns } from "./transaction-columns";

type Dialog = { kind: "edit" } | { kind: "stock"; type: StockType } | null;

export function ProductDetail({ id }: { id: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductDetailInner id={id} />
    </Suspense>
  );
}

/** /warehouse/[id] (contract 6.5): product KPIs, balance and flows, top consumers, history. */
function ProductDetailInner({ id }: { id: string }) {
  const period = usePeriodQuery();
  const stats = useApi<ProductStats>(`/products/${id}/stats`, { ...period });
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = stats.data;

  if (!data && stats.error?.status === 404) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="Mahsulot topilmadi"
          description="Manzil noto‘g‘ri yoki mahsulot mavjud emas."
          action={<LinkButton href="/warehouse">Omborga qaytish</LinkButton>}
        />
      </Card>
    );
  }
  if (!data && stats.error && stats.error.status !== 400) {
    return (
      <Card>
        <ErrorState error={stats.error} onRetry={stats.reload} />
      </Card>
    );
  }
  if (!data && !stats.error) return <PageSkeleton />;

  const product = data?.product;
  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Ombor", href: "/warehouse" }, { label: product?.name ?? id }]}
        title={
          product ? (
            <span className="flex flex-wrap items-center gap-3">
              {product.name}
              {product.is_low && <Badge tone="danger">Kam</Badge>}
              {!product.is_active && <Badge>Nofaol</Badge>}
            </span>
          ) : (
            "Mahsulot"
          )
        }
        description={product ? `${product.category_display} · o‘lchov birligi: ${product.unit}` : undefined}
        actions={
          product && (
            <>
              <Button
                variant="secondary"
                icon={<ArrowDownToLine className="size-4" aria-hidden />}
                disabled={!product.is_active}
                onClick={() => setDialog({ kind: "stock", type: "IN" })}
              >
                Kirim
              </Button>
              <Button
                variant="secondary"
                icon={<ArrowUpFromLine className="size-4" aria-hidden />}
                disabled={!product.is_active || product.available <= 0}
                onClick={() => setDialog({ kind: "stock", type: "OUT" })}
              >
                Chiqim
              </Button>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setDialog({ kind: "edit" })}
              >
                Tahrirlash
              </Button>
            </>
          )
        }
        toolbar={<PeriodPicker period={data?.period} error={stats.error} />}
      />

      <Loadable resource={stats} skeleton={<StatsPageSkeleton charts={2} />}>
        {(loaded) => <ProductBody data={loaded} />}
      </Loadable>

      <ProductLotsCard productId={id} />

      <PagedTableCard<StockTransaction>
        title="Operatsiyalar tarixi"
        path="/stock-transactions"
        query={{ product: id }}
        columns={transactionColumns({ product: false })}
        rowKey={(row) => row.id}
        emptyTitle="Hali operatsiyalar yo‘q"
        emptyIcon={Package}
      />

      {dialog?.kind === "edit" && product && <ProductModal product={product} onClose={close} onDone={close} />}
      {dialog?.kind === "stock" && product && (
        <StockModal type={dialog.type} product={product} onClose={close} onDone={close} />
      )}
    </div>
  );
}

function ProductBody({ data }: { data: ProductStats }) {
  const { product, totals } = data;
  const unit = product.unit;
  const qty = (value: number) => `${formatNumber(value, 2)} ${unit}`;
  const cover = coverView(data.days_of_cover, data.stockout_date, data.generated_at);
  const signedNet = `${totals.net > 0 ? "+" : ""}${formatNumber(totals.net, 2)} ${unit}`;
  const dates = data.series.map((point) => point.date);
  const balance = data.series.map((point) => point.balance);
  const inQty = data.series.map((point) => point.in_qty);
  const outQty = data.series.map((point) => point.out_qty);
  const consumers: RankedBar[] = data.top_consumers.map((row) => ({
    key: row.household.id,
    label: row.household.name,
    sublabel: row.household.code,
    href: `/households/${row.household.id}`,
    value: row.quantity,
    display: qty(row.quantity),
    extra: formatPercent(row.share_pct),
  }));
  if (data.out_unassigned_qty > 0) {
    consumers.push({
      key: "unassigned",
      label: "Xonadonsiz chiqim",
      color: CHART_COLORS.other,
      value: data.out_unassigned_qty,
      display: qty(data.out_unassigned_qty),
      extra: totals.out_qty > 0 ? formatPercent((data.out_unassigned_qty / totals.out_qty) * 100) : "—",
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          label="Qoldiq"
          value={formatNumber(product.balance, 2)}
          unit={unit}
          tone={product.is_low ? "danger" : "default"}
          sub={
            product.reserved > 0
              ? `bo‘sh: ${formatNumber(product.available, 2)} · zaxirada: ${formatNumber(product.reserved, 2)}`
              : `minimal: ${formatNumber(product.min_stock, 2)} ${unit}`
          }
          hint="Zaxirada — faol logistika topshiriqlari uchun ajratilgan; bo‘sh = qoldiq − zaxira"
        />
        <KpiCard
          label="O‘rtacha kunlik chiqim"
          value={formatNumber(data.avg_daily_out, 1)}
          unit={`${unit}/kun`}
          sub={`${data.period.days} kunlik chiqim bo‘yicha`}
          hint="Davrdagi chiqim ÷ kunlar (yangi mahsulot uchun u mavjud bo‘lgan kunlar)"
        />
        <KpiCard
          label="Yetadi"
          value={cover.value}
          unit={cover.unit}
          tone={cover.tone}
          sub={cover.sub}
          hint="Joriy qoldiq ÷ o‘rtacha kunlik chiqim, butun kunlarda (tugash sanasi bilan bir xil)"
        />
        <KpiCard
          label="Kirim"
          value={formatNumber(totals.in_qty, 2)}
          unit={unit}
          sub={`${formatNumber(totals.in_count)} ta operatsiya`}
        />
        <KpiCard
          label="Chiqim"
          value={formatNumber(totals.out_qty, 2)}
          unit={unit}
          sub={`${formatNumber(totals.out_count)} ta operatsiya`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <ChartCard
          title="Qoldiq"
          description={`${unit}, kun oxirida`}
          summary={`Boshida ${formatNumber(totals.opening_balance, 2)} → oxirida ${qty(totals.closing_balance)}`}
        >
          <TimeChart
            dates={dates}
            series={[
              {
                key: "balance",
                label: "Qoldiq",
                color: CHART_COLORS.primary,
                values: balance,
                kind: "area",
                step: true,
              },
            ]}
            reference={
              product.min_stock > 0
                ? { value: product.min_stock, label: `Minimal: ${formatNumber(product.min_stock, 2)}` }
                : undefined
            }
            format={qty}
            ariaLabel={`${product.name}: kunlik qoldiq, davr oxirida ${qty(totals.closing_balance)}`}
          />
        </ChartCard>
        <ChartCard
          title="Kirim va chiqim"
          description={`${unit} / kun`}
          summary={`Sof o‘zgarish: ${signedNet}`}
        >
          {isEmptySeries([{ values: inQty }, { values: outQty }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                { key: "in", label: "Kirim", color: CHART_COLORS.accent, values: inQty, kind: "bar" },
                { key: "out", label: "Chiqim", color: CHART_COLORS.warning, values: outQty, kind: "bar" },
              ]}
              format={qty}
              ariaLabel={`${product.name}: kunlik kirim va chiqim`}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Eng ko‘p oluvchilar" description="Xonadonlarga chiqim, davr ichida (eng ko‘pi 10 ta)">
        {consumers.length === 0 ? (
          <NoData icon={Users} title="Tanlangan davrda chiqim bo‘lmagan" />
        ) : (
          <RankedBars caption="Eng ko‘p oluvchilar" rows={consumers} className="max-w-3xl" />
        )}
      </ChartCard>
    </>
  );
}
