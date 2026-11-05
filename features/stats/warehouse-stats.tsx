"use client";

import Link from "next/link";
import { ArrowRight, Info, PackageCheck, Users } from "lucide-react";
import { diffDays, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS } from "@/lib/stats";
import { useApi, type ApiResource } from "@/lib/use-api";
import type { WarehouseStats } from "@/lib/types";
import { RankedBars } from "@/components/charts/ranked-bars";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ChartCard, KpiGridSkeleton, StatsPageSkeleton } from "@/components/stats/chart-card";
import { KpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { usePeriodQuery } from "@/components/stats/period-picker";

/** Days of cover below this many days are highlighted (6.5). */
export const LOW_COVER_DAYS = 7;

/** One wording for "low stock" everywhere (dashboard, /stats, /warehouse): balance ≤ min_stock. */
export const LOW_STOCK_WORDING = "qoldig‘i minimal zaxiradan oshmagan";

/**
 * "Yetadi" in WHOLE days, the same floor rule as `stockout_date = today + floor(days_of_cover)`
 * (contract 1.2): 23.96 days → "23 kun", "27.11.2026 gacha" (04.11 + 23), never "24.0 kun" next to a
 * date that is 23 days away. The whole number is read from the date itself, so both always agree.
 */
export interface CoverView {
  value: string;
  unit?: string;
  sub: string;
  tone: "default" | "warning" | "danger";
  /** Whole days (null: no outflow or longer than 10 years). */
  whole: number | null;
}

export function coverView(
  daysOfCover: number | null,
  stockoutDate: string | null,
  generatedAt: string,
  noOut = "chiqim yo‘q",
): CoverView {
  if (daysOfCover === null) return { value: "—", sub: noOut, tone: "default", whole: null };
  // stockout_date is null also when the cover is longer than 3650 days (not the same as "no outflow").
  if (!stockoutDate) return { value: "> 3 650", unit: "kun", sub: "10 yildan ortiq", tone: "default", whole: null };
  const whole = Math.max(0, diffDays(generatedAt.slice(0, 10), stockoutDate));
  return {
    value: whole < 1 ? "< 1" : formatNumber(whole, 0),
    unit: "kun",
    sub: `${formatDate(stockoutDate)} gacha`,
    tone: whole < 1 ? "danger" : whole < LOW_COVER_DAYS ? "warning" : "default",
    whole,
  };
}

/** Table cell text: "23 kun" / "< 1 kun" / "> 3 650 kun" / "—". */
export function coverText(view: CoverView): string {
  return view.unit ? `${view.value} ${view.unit}` : view.value;
}

/** kg sums and rates: at most 1 decimal, trailing zeros dropped ("5 082.5 kg", "0 kg"). */
const kgFormat = (value: number) => `${formatNumber(value, 1)} kg`;

const COVER_HINT =
  "Joriy qoldiq ÷ ombordan o‘rtacha kunlik chiqim (mahsulot mavjud bo‘lgan kunlar bo‘yicha). " +
  "Xonadon hisobotlaridagi yem sarfi emas.";

type LowStockRow = WarehouseStats["low_stock"][number];

function lowColumns(generatedAt: string): Column<LowStockRow>[] {
  return [
    { key: "name", header: "Mahsulot", primary: true, cell: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "balance",
      header: "Qoldiq",
      align: "right",
      cell: (row) => (
        <span>
          <span className="font-semibold text-danger">{formatNumber(row.balance, 1)}</span>
          <span className="text-muted">
            {" "}
            / {formatNumber(row.min_stock, 1)} {row.unit}
          </span>
        </span>
      ),
    },
    {
      key: "out",
      header: "Kunlik chiqim",
      align: "right",
      cell: (row) => `${formatNumber(row.avg_daily_out, 1)} ${row.unit}`,
    },
    {
      key: "cover",
      header: "Yetadi",
      align: "right",
      cell: (row) => {
        const view = coverView(row.days_of_cover, row.stockout_date, generatedAt);
        return (
          <span className={view.tone === "default" ? undefined : "font-medium text-warning-ink"}>
            {coverText(view)}
          </span>
        );
      },
    },
  ];
}

/** "Ombor" block of /stats (6.3 item 9) from GET /api/warehouse/stats. */
export function WarehouseStatsSection() {
  const period = usePeriodQuery();
  const stats = useApi<WarehouseStats>("/warehouse/stats", { ...period });

  return (
    <section aria-labelledby="warehouse-stats-title" className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <SectionTitle
        id="warehouse-stats-title"
        title="Ombor"
        description="Yem (kg) zaxirasi, ombordan chiqim va eng ko‘p oluvchilar"
        actions={
          <Link
            href="/warehouse"
            className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-accent hover:underline"
          >
            Omborga
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <Loadable resource={stats} skeleton={<StatsPageSkeleton kpis={4} charts={2} />}>
        {(data) => <WarehouseBody data={data} />}
      </Loadable>
    </section>
  );
}

function WarehouseBody({ data }: { data: WarehouseStats }) {
  const dates = data.series.map((point) => point.date);
  const feedIn = data.series.map((point) => point.feed_in_kg);
  const feedOut = data.series.map((point) => point.feed_out_kg);
  const { feed } = data;
  return (
    <>
      <FeedKpis data={data} />
      <p className="-mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>
          Bu bo‘lim <strong className="font-medium text-ink">ombordan chiqim</strong> (xonadonlarga berilgan yem)
          bo‘yicha. Yuqoridagi «Yem sarfi (xonadon hisobotlari)» esa xonadonlar kunlik hisobotlarida yozgan sarf:
          yem oldindan olinadi va hisobotsiz kunlar bo‘ladi, shuning uchun ikki son farq qiladi.
        </span>
      </p>
      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <ChartCard
          title="Ombor: yem kirimi va chiqimi"
          description="kg / kun"
          summary={`Ombordan chiqim: ${kgFormat(feed.out_kg)}`}
        >
          {isEmptySeries([{ values: feedIn }, { values: feedOut }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                { key: "in", label: "Kirim", color: CHART_COLORS.accent, values: feedIn, kind: "bar" },
                { key: "out", label: "Chiqim", color: CHART_COLORS.warning, values: feedOut, kind: "bar" },
              ]}
              format={kgFormat}
              ariaLabel={`Ombor: yem kirimi va chiqimi, ${data.period.days} kun`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Ombordan eng ko‘p yem olgan xonadonlar"
          description="Davr ichida, kg"
          summary={`${formatNumber(data.top_consumers.length)} ta`}
        >
          {data.top_consumers.length === 0 ? (
            <NoData icon={Users} title="Tanlangan davrda xonadonlarga yem berilmagan" />
          ) : (
            <RankedBars
              caption="Ombordan eng ko‘p yem olgan xonadonlar"
              rows={data.top_consumers.map((row) => ({
                key: row.household.id,
                label: row.household.name,
                sublabel: row.household.code,
                href: `/households/${row.household.id}`,
                value: row.feed_kg,
                display: kgFormat(row.feed_kg),
                extra: formatPercent(row.share_pct),
              }))}
            />
          )}
        </ChartCard>
      </div>

      <Card>
        <CardHeader
          title="Kam qolgan mahsulotlar"
          description="Qoldig‘i minimal zaxiradan oshmagan faol mahsulotlar, tez tugaydiganlari birinchi"
        />
        <div className="mt-3 border-t border-line">
          {data.low_stock.length === 0 ? (
            <NoData icon={PackageCheck} title="Barcha mahsulotlar yetarli" />
          ) : (
            <DataTable
              caption="Kam qolgan mahsulotlar"
              rows={data.low_stock}
              columns={lowColumns(data.generated_at)}
              rowKey={(row) => row.id}
              rowHref={(row) => `/warehouse/${row.id}`}
            />
          )}
        </div>
      </Card>
    </>
  );
}

/** Four feed cards: balance, average daily out, days of cover, in / out (all from WAREHOUSE flows). */
export function FeedKpis({ data }: { data: WarehouseStats }) {
  const { feed } = data;
  const cover = coverView(feed.days_of_cover, feed.stockout_date, data.generated_at);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard label="Yem qoldig‘i" value={formatNumber(feed.balance_kg, 1)} unit="kg" sub="faol yem mahsulotlari" />
      <KpiCard
        label="Ombordan o‘rtacha chiqim"
        value={formatNumber(feed.avg_daily_out_kg, 1)}
        unit="kg/kun"
        sub={`${data.period.days} kunlik chiqim bo‘yicha`}
        hint="Davrdagi ombordan chiqim ÷ kunlar (yangi mahsulot uchun u mavjud bo‘lgan kunlar)"
      />
      <KpiCard
        label="Yem yetadi (ombordan chiqim bo‘yicha)"
        value={cover.value}
        unit={cover.unit}
        tone={cover.tone}
        sub={cover.sub}
        hint={COVER_HINT}
      />
      <KpiCard
        label="Ombor: kirim / chiqim"
        value={`${formatNumber(feed.in_kg, 1)} / ${formatNumber(feed.out_kg, 1)}`}
        unit="kg"
        sub="tanlangan davrda"
      />
    </div>
  );
}

/** Header cards of /warehouse (default period: 30 days). */
export function WarehouseHeaderStats({ stats }: { stats: ApiResource<WarehouseStats> }) {
  if (!stats.data) return stats.error ? null : <KpiGridSkeleton count={4} />;
  const data = stats.data;
  const { feed, products } = data;
  const cover = coverView(feed.days_of_cover, feed.stockout_date, data.generated_at, "30 kunda chiqim yo‘q");
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        label="Mahsulotlar"
        value={formatNumber(products.active)}
        sub={`faol · jami ${formatNumber(products.total)}`}
      />
      <KpiCard
        label="Kam qolgan"
        value={formatNumber(products.low)}
        tone={products.low > 0 ? "danger" : "default"}
        sub={products.low > 0 ? LOW_STOCK_WORDING : "hammasi yetarli"}
      />
      <KpiCard
        label="Yem qoldig‘i"
        value={formatNumber(feed.balance_kg, 1)}
        unit="kg"
        sub={`ombordan kuniga ~${formatNumber(feed.avg_daily_out_kg, 1)} kg`}
      />
      <KpiCard
        label="Yem yetadi (ombordan chiqim bo‘yicha)"
        value={cover.value}
        unit={cover.unit}
        tone={cover.tone}
        sub={cover.sub}
        hint={COVER_HINT}
      />
    </div>
  );
}
