"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Bird, House, ListX, MapPinned } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS, formatKpiValue, POULTRY_COLORS } from "@/lib/stats";
import { useApi, useDebounced } from "@/lib/use-api";
import type {
  DistrictStat,
  HighMortalityItem,
  KpiKey,
  OverviewStats,
  PoultryTypeStat,
  RankedHousehold,
} from "@/lib/types";
import { ProgressRing, Donut } from "@/components/charts/donut";
import { RankedBars } from "@/components/charts/ranked-bars";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ChartCard, StatsPageSkeleton } from "@/components/stats/chart-card";
import { StatKpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { PeriodPicker, usePeriodQuery, useUrlParams } from "@/components/stats/period-picker";
import { WarehouseStatsSection } from "./warehouse-stats";

const KPI_ORDER: readonly KpiKey[] = [
  "eggs",
  "laying_rate_pct",
  "feed_kg",
  "feed_per_egg_g",
  "feed_per_bird_day_kg",
  "deaths",
  "mortality_pct",
  "report_discipline_pct",
];

/**
 * `mortality_threshold` rule of 8.2 (as amended): empty (API default 5) or a plain number 0…100 with at
 * most one decimal — the header echoes `threshold_pct` with one decimal, so "4.96" would read "5.0%".
 */
function isValidThreshold(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return true;
  // Plain decimal only ("0x10" or "1e1" are numbers to JS, not to a person).
  if (!/^\d{1,3}(\.\d)?$/.test(trimmed)) return false;
  return Number(trimmed) <= 100;
}

const count = (unit: string) => (value: number) => `${formatNumber(value)} ${unit}`;
const kg = (value: number) => `${formatNumber(value, 1)} kg`;

/** /stats (contract 6.3): company-wide analytics for ADMIN and WAREHOUSE. */
export function StatsOverview() {
  const period = usePeriodQuery();
  const params = useSearchParams();
  const setParams = useUrlParams();
  const thresholdParam = params.get("mortality_threshold") ?? "";
  const [threshold, setThreshold] = useState(thresholdParam);
  const thresholdError = isValidThreshold(threshold) ? null : "0 dan 100 gacha son kiriting.";
  const debouncedThreshold = useDebounced(thresholdError ? thresholdParam : threshold.trim(), 400);
  useEffect(() => {
    if (!thresholdError && debouncedThreshold !== thresholdParam) {
      setParams({ mortality_threshold: debouncedThreshold || null });
    }
  }, [debouncedThreshold, thresholdError, thresholdParam, setParams]);

  // A hand-edited invalid threshold in the URL is not sent (the API would answer 400 and
  // the whole page, including the input that could fix it, would turn into an error).
  const overview = useApi<OverviewStats>("/stats/overview", {
    ...period,
    mortality_threshold: isValidThreshold(thresholdParam) ? thresholdParam.trim() || undefined : undefined,
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Statistika"
        description="Xonadonlar, parranda va ombor ko‘rsatkichlari, oldingi davr bilan taqqoslab"
      />
      <PeriodPicker period={overview.data?.period} error={overview.error} sticky className="-mt-2 sm:-mt-3" />

      <Loadable resource={overview} skeleton={<StatsPageSkeleton />}>
        {(data) => (
          <OverviewBody data={data} threshold={threshold} thresholdError={thresholdError} onThreshold={setThreshold} />
        )}
      </Loadable>

      <WarehouseStatsSection />
    </div>
  );
}

function OverviewBody({
  data,
  threshold,
  thresholdError,
  onThreshold,
}: {
  data: OverviewStats;
  threshold: string;
  thresholdError: string | null;
  onThreshold: (value: string) => void;
}) {
  const { series, kpis } = data;
  const dates = series.map((point) => point.date);
  const pick = <K extends keyof (typeof series)[number]>(key: K) => series.map((point) => point[key]);
  const eggs = pick("eggs");
  const laying = pick("laying_rate_pct");
  const feed = pick("feed_kg");
  const deaths = pick("deaths");
  const reportedExpected = pick("reported_expected");
  const expected = pick("expected_reports");
  const distributed = pick("distributed");
  const returned = pick("returned");
  const days = data.period.days;
  // A day without any report row: eggs / feed are unknown there, not 0 (charts draw a hatched gap).
  const missing = series.map((point) => point.reports === 0);
  const gapped = (values: readonly number[]) => values.map((value, index) => (missing[index] ? null : value));
  const totalDeaths = (kpis.deaths.value ?? 0) + data.center.deaths;

  const trends: Partial<Record<KpiKey, readonly (number | null)[]>> = {
    eggs: gapped(eggs),
    laying_rate_pct: laying,
    feed_kg: gapped(feed),
    deaths,
  };
  const labels: Partial<Record<KpiKey, string>> = {
    feed_kg: "Yem sarfi (xonadon hisobotlari)",
    deaths: "Nobud (xonadonlarda)",
    mortality_pct: "O‘lim darajasi (xonadonlar)",
  };
  const notes: Partial<Record<KpiKey, string>> = {
    deaths: `markazda: ${formatNumber(data.center.deaths)} · jami: ${formatNumber(totalDeaths)}`,
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {KPI_ORDER.map((key) => (
          <StatKpiCard
            key={key}
            kpiKey={key}
            kpi={kpis[key]}
            period={data.period}
            label={labels[key]}
            note={notes[key]}
            trend={trends[key]}
          />
        ))}
      </div>
      <p className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <Bird className="size-4 text-accent" aria-hidden />
          Parranda (xonadonlarda):{" "}
          <span className="font-medium tabular-nums text-ink">{formatNumber(kpis.birds_end.value)}</span>
          <span className="tabular-nums" title={`Davrdagi o‘rtacha: ${formatNumber(kpis.birds_avg.value, 1)}`}>
            (o‘rtacha ≈ {formatNumber(kpis.birds_avg.value, 0)})
          </span>
        </span>
        <span className="tabular-nums">
          Markazda: <span className="font-medium text-ink">{formatNumber(data.center.birds_end)}</span>
          {data.center.deaths > 0 && <> · markazda nobud {formatNumber(data.center.deaths)}</>}
        </span>
      </p>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <ChartCard title="Tuxum" description={`dona / kun · ${days} kun`} summary={`Jami: ${formatNumber(kpis.eggs.value)}`}>
          {isEmptySeries([{ values: eggs }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "eggs", label: "Tuxum", color: CHART_COLORS.primary, values: eggs, kind: "area" }]}
              missing={missing}
              format={count("dona")}
              ariaLabel={`Kunlik tuxum, ${days} kun, jami ${formatNumber(kpis.eggs.value)} dona`}
            />
          )}
        </ChartCard>

        <ChartCard title="Tuxumdorlik" description={`kunlik, % · ${days} kun`} summary={formatPercent(kpis.laying_rate_pct.value)}>
          {laying.every((value) => value === null) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                { key: "laying", label: "Tuxumdorlik", color: CHART_COLORS.accent, values: laying, kind: "line" },
              ]}
              format={(value) => formatPercent(value)}
              axisFormat={(value) => `${formatNumber(value, 1)}%`}
              ariaLabel={`Kunlik tuxumdorlik, davr bo‘yicha ${formatPercent(kpis.laying_rate_pct.value)}`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Yem sarfi (xonadon hisobotlari)"
          description={`kg / kun · ${days} kun`}
          summary={`Jami: ${formatKpiValue("feed_kg", kpis.feed_kg.value)}`}
        >
          {isEmptySeries([{ values: feed }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "feed", label: "Yem", color: CHART_COLORS.accent, values: feed, kind: "bar" }]}
              missing={missing}
              format={kg}
              ariaLabel={`Kunlik yem sarfi, jami ${formatNumber(kpis.feed_kg.value, 1)} kg`}
            />
          )}
        </ChartCard>

        {(data.meat?.total_kg ?? 0) > 0 && (
          <ChartCard
            title="Go‘sht ishlab chiqarish"
            description={`kg / kun · ${days} kun`}
            summary={`Jami: ${formatNumber(data.meat?.total_kg ?? 0, 1)} kg${
              data.meat?.avg_weight_g ? ` · o‘rtacha vazn ${formatNumber(data.meat.avg_weight_g, 0)} g` : ""
            }`}
          >
            <TimeChart
              dates={dates}
              series={[
                {
                  key: "meat",
                  label: "Go‘sht",
                  color: CHART_COLORS.primary,
                  values: series.map((point) => point.meat_kg ?? 0),
                  kind: "bar",
                },
              ]}
              missing={missing}
              format={kg}
              ariaLabel={`Kunlik go‘sht, jami ${formatNumber(data.meat?.total_kg ?? 0, 1)} kg`}
            />
          </ChartCard>
        )}

        <ChartCard
          title="Nobud bo‘lish"
          description={`xonadonlarda, dona / kun · ${days} kun`}
          summary={`Jami: ${formatNumber(kpis.deaths.value)}`}
        >
          {isEmptySeries([{ values: deaths }]) ? (
            <NoData icon={Activity} title="Tanlangan davrda nobud qayd etilmagan" />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                {
                  key: "deaths",
                  label: "Nobud",
                  color: CHART_COLORS.danger,
                  values: deaths,
                  kind: "bar",
                  gapWhenMissing: false, // deaths come from movements, not from reports
                },
              ]}
              missing={missing}
              format={count("dona")}
              ariaLabel={`Kunlik nobud, jami ${formatNumber(kpis.deaths.value)} dona`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Hisobotlar"
          description={`kutilgan xonadonlardan kiritgani, kunlik · ${days} kun`}
          summary={`Barcha hisobotlar: ${formatNumber(kpis.reports.value)}`}
        >
          {isEmptySeries([{ values: reportedExpected }, { values: expected }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                {
                  key: "reports",
                  label: "Kiritilgan",
                  color: CHART_COLORS.accent,
                  values: reportedExpected,
                  kind: "line",
                },
                {
                  key: "expected",
                  label: "Kutilgan",
                  color: CHART_COLORS.other,
                  values: expected,
                  kind: "line",
                  dashed: true,
                },
              ]}
              format={count("ta")}
              ariaLabel="Kunlik hisobotlar: hisobot kutilgan xonadonlar va ulardan kiritganlar (bugun: hozirgacha)"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Tarqatilgan va qaytarilgan"
          description={`xonadonlar bo‘yicha, dona / kun · ${days} kun`}
          summary={`Tarqatildi: ${formatNumber(kpis.distributed.value)}`}
        >
          {isEmptySeries([{ values: distributed }, { values: returned }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                {
                  key: "distributed",
                  label: "Tarqatilgan",
                  color: CHART_COLORS.accent,
                  values: distributed,
                  kind: "bar",
                },
                { key: "returned", label: "Qaytarilgan", color: CHART_COLORS.warning, values: returned, kind: "bar" },
              ]}
              format={count("dona")}
              ariaLabel="Kunlik tarqatilgan va qaytarilgan parranda"
            />
          )}
        </ChartCard>
      </div>

      {/* Side by side only from xl / 2xl: narrower half-width cards made these tables scroll sideways. */}
      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <PoultryTypes items={data.by_poultry_type} />
        <DisciplineCard data={data} />
      </div>

      <Districts items={data.by_district} />

      <div className="grid min-w-0 gap-4 sm:gap-5 2xl:grid-cols-2">
        <RankingCard
          title="Eng yaxshi 5 xonadon"
          description="Tuxumdorlik bo‘yicha (kamida 3 ta hisobot)"
          rows={data.top_households}
        />
        <RankingCard
          title="Eng past 5 xonadon"
          description="Tuxumdorlik bo‘yicha (kamida 3 ta hisobot)"
          rows={data.bottom_households}
          emptyTitle={
            data.top_households.length > 0
              ? `Barcha mos xonadonlar (${formatNumber(data.top_households.length)} ta) yuqoridagi ro‘yxatda`
              : undefined
          }
        />
      </div>

      <HighMortality data={data} threshold={threshold} thresholdError={thresholdError} onThreshold={onThreshold} />
    </>
  );
}

/* ---------- Poultry types ---------- */

const TYPE_COLUMNS: Column<PoultryTypeStat>[] = [
  {
    key: "type",
    header: "Turi",
    primary: true,
    cell: (row) => (
      <span className="flex items-center gap-2 whitespace-normal">
        <span
          className="size-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: POULTRY_COLORS[row.poultry_type] }}
          aria-hidden
        />
        {row.poultry_type_display}
      </span>
    ),
  },
  { key: "households", header: "Xonadon", align: "right", cell: (row) => formatNumber(row.households ?? 0) },
  { key: "birds", header: "Parranda", align: "right", cell: (row) => formatNumber(row.birds_end) },
  { key: "deaths", header: "Nobud", align: "right", cell: (row) => formatNumber(row.deaths) },
  { key: "mortality", header: "O‘lim", align: "right", cell: (row) => formatPercent(row.mortality_pct) },
];

function PoultryTypes({ items }: { items: PoultryTypeStat[] }) {
  const total = items.reduce((sum, item) => sum + item.birds_end, 0);
  // All-zero categories ("Naslli 0 · 0 · 0 · —") are left out of the ring / legend.
  const shown = items.filter((item) => item.birds_end > 0 || item.deaths > 0);
  return (
    <Card className="flex flex-col">
      <CardHeader title="Parranda turlari" description="Davr oxiridagi parranda soni bo‘yicha" />
      <div className="px-4 py-5 sm:px-6">
        {total === 0 ? (
          <NoData icon={Bird} title="Xonadonlarda parranda yo‘q" />
        ) : (
          <Donut
            ariaLabel={`Parranda turlari: ${shown.map((item) => `${item.poultry_type_display} ${formatNumber(item.birds_end)}`).join(", ")}`}
            centerLabel="parranda"
            segments={shown.map((item) => ({
              key: item.poultry_type,
              label: item.poultry_type_display,
              value: item.birds_end,
              color: POULTRY_COLORS[item.poultry_type],
              // On phones this line replaces the table below (same numbers, no repetition).
              detail: `${formatNumber(item.households ?? 0)} xonadon · nobud ${formatNumber(item.deaths)} · o‘lim ${formatPercent(item.mortality_pct)}`,
            }))}
          />
        )}
      </div>
      <div className="mt-auto hidden border-t border-line sm:block">
        <DataTable
          caption="Parranda turlari"
          rows={items}
          columns={TYPE_COLUMNS}
          rowKey={(row) => row.poultry_type}
          mobileColumns={3}
        />
      </div>
    </Card>
  );
}

/* ---------- Discipline ---------- */

function DisciplineCard({ data }: { data: OverviewStats }) {
  const value = data.kpis.report_discipline_pct.value;
  const blocks: [string, number][] = [
    ["Jami xonadon", data.households.total],
    ["Faol", data.households.active],
    ["Parrandasi bor", data.households.with_birds],
    ["Hisobot bergan", data.households.reporting],
  ];
  return (
    <ChartCard title="Hisobot intizomi" description="Kiritilgan hisobotlar ÷ kutilgan hisobot kunlari">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ProgressRing
          value={value}
          label="intizom"
          size={148}
          tone={value === null || value >= 90 ? "accent" : value >= 70 ? "warning" : "danger"}
        />
        <dl className="grid w-full grid-cols-2 gap-3">
          {blocks.map(([label, amount]) => (
            <div key={label} className="rounded-lg bg-subtle px-3 py-2.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatNumber(amount)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ChartCard>
  );
}

/* ---------- Districts ---------- */

const DISTRICT_COLUMNS: Column<DistrictStat>[] = [
  {
    key: "district",
    header: "Tuman",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.district || "—"}</span>
        <span className="text-xs font-normal text-muted">{row.region}</span>
      </span>
    ),
  },
  {
    key: "households",
    header: "Xonadon",
    align: "right",
    cell: (row) => `${formatNumber(row.households_active)} / ${formatNumber(row.households)}`,
  },
  { key: "birds", header: "Parranda", align: "right", cell: (row) => formatNumber(row.birds_end) },
  { key: "eggs", header: "Tuxum", align: "right", cell: (row) => formatNumber(row.eggs) },
  { key: "laying", header: "Tuxumdorlik", align: "right", cell: (row) => formatPercent(row.laying_rate_pct) },
  { key: "mortality", header: "O‘lim", align: "right", cell: (row) => formatPercent(row.mortality_pct) },
  { key: "discipline", header: "Intizom", align: "right", cell: (row) => formatPercent(row.report_discipline_pct) },
];

function Districts({ items }: { items: DistrictStat[] }) {
  return (
    <Card>
      <CardHeader title="Tumanlar" description="Parranda soni bo‘yicha, ko‘pidan kamiga" />
      {items.length === 0 ? (
        <NoData icon={MapPinned} title="Xonadonlar yo‘q" />
      ) : (
        <div className="grid min-w-0 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="px-4 py-5 sm:px-6">
            <RankedBars
              caption="Tumanlar parranda soni bo‘yicha"
              rows={items.slice(0, 10).map((item) => ({
                key: `${item.region}|${item.district}`,
                label: item.district || "—",
                sublabel: item.region,
                value: item.birds_end,
                display: formatNumber(item.birds_end),
              }))}
            />
            {items.length > 10 && (
              <p className="mt-3 text-xs text-muted">Grafikda birinchi 10 tasi; to‘liq ro‘yxat jadvalda.</p>
            )}
          </div>
          <div className="min-w-0 border-t border-line 2xl:border-l 2xl:border-t-0">
            <DataTable
              caption="Tumanlar bo‘yicha ko‘rsatkichlar"
              rows={items}
              columns={DISTRICT_COLUMNS}
              rowKey={(row) => `${row.region}|${row.district}`}
              mobileColumns={3}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Top / bottom ---------- */

const RANK_COLUMNS: Column<RankedHousehold>[] = [
  {
    key: "household",
    header: "Xonadon",
    primary: true,
    // Wraps (the table cells are nowrap): in a half-width card the code · district line otherwise
    // pushed the table ~16 px past the card at 1440 px and a scrollbar appeared.
    cell: (row) => (
      <span className="flex min-w-[8rem] flex-col whitespace-normal">
        <span className="font-medium">{row.household.name}</span>
        <span className="text-xs font-normal tabular-nums text-muted">
          {row.household.code} · {row.district}
        </span>
      </span>
    ),
  },
  {
    key: "laying",
    header: "Tuxumdorlik",
    align: "right",
    cell: (row) => <span className="font-medium">{formatPercent(row.laying_rate_pct)}</span>,
  },
  { key: "eggs", header: "Tuxum", align: "right", cell: (row) => formatNumber(row.eggs) },
  { key: "reports", header: "Hisobot", align: "right", cell: (row) => formatNumber(row.reports) },
  {
    key: "layers",
    header: "O‘rt. parranda",
    align: "right",
    hideOnMobile: true,
    cell: (row) => formatNumber(row.layer_birds_avg, 1),
  },
];

function RankingCard({
  title,
  description,
  rows,
  emptyTitle = "Kamida 3 ta hisobotli, tuxum yo‘nalishidagi xonadon yo‘q",
}: {
  title: string;
  description: string;
  rows: RankedHousehold[];
  emptyTitle?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="mt-3 border-t border-line">
        {rows.length === 0 ? (
          <NoData icon={ListX} title={emptyTitle} />
        ) : (
          <DataTable
            caption={title}
            rows={rows}
            columns={RANK_COLUMNS}
            rowKey={(row) => row.household.id}
            mobileColumns={3}
            rowHref={(row) => `/households/${row.household.id}`}
          />
        )}
      </div>
    </Card>
  );
}

/* ---------- High mortality ---------- */

const MORTALITY_COLUMNS: Column<HighMortalityItem>[] = [
  {
    key: "household",
    header: "Xonadon",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex items-center gap-2 font-medium">
          {row.household.name}
          {!row.is_active && <Badge>Nofaol</Badge>}
        </span>
        <span className="text-xs font-normal tabular-nums text-muted">
          {row.household.code} · {row.district}
        </span>
      </span>
    ),
  },
  { key: "birds", header: "O‘rt. parranda", align: "right", cell: (row) => formatNumber(row.birds_avg, 1) },
  { key: "deaths", header: "Nobud", align: "right", cell: (row) => formatNumber(row.deaths) },
  {
    key: "mortality",
    header: "O‘lim",
    align: "right",
    cell: (row) => <span className="font-semibold text-danger">{formatPercent(row.mortality_pct)}</span>,
  },
];

function HighMortality({
  data,
  threshold,
  thresholdError,
  onThreshold,
}: {
  data: OverviewStats;
  threshold: string;
  thresholdError: string | null;
  onThreshold: (value: string) => void;
}) {
  const { high_mortality: high } = data;
  return (
    <Card>
      <CardHeader
        title="Yuqori o‘lim"
        description={`O‘lim darajasi ${formatPercent(high.threshold_pct)} dan yuqori xonadonlar: ${formatNumber(high.count)} ta`}
        actions={
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            <span className="whitespace-nowrap">Chegara (%)</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="5"
              maxLength={5}
              value={threshold}
              onChange={(event) => onThreshold(event.target.value.replace(",", "."))}
              invalid={Boolean(thresholdError)}
              className="h-9 w-20 text-right tabular-nums"
              aria-describedby={thresholdError ? "mortality-threshold-error" : undefined}
            />
          </label>
        }
      />
      {thresholdError && (
        <p id="mortality-threshold-error" className="px-4 pt-2 text-[13px] text-danger sm:px-6" role="alert">
          {thresholdError}
        </p>
      )}
      <div className="mt-3 border-t border-line">
        {high.items.length === 0 ? (
          <NoData icon={House} title="Chegaradan yuqori o‘lim qayd etilmagan" />
        ) : (
          <>
            <DataTable
              caption="Yuqori o‘lim darajasidagi xonadonlar"
              rows={high.items}
              columns={MORTALITY_COLUMNS}
              rowKey={(row) => row.household.id}
              mobileColumns={3}
              rowHref={(row) => `/households/${row.household.id}`}
            />
            {high.count > high.items.length && (
              <p className="border-t border-line px-4 py-3 text-[13px] text-muted sm:px-6">
                Birinchi {formatNumber(high.items.length)} tasi ko‘rsatildi, jami {formatNumber(high.count)} ta.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
