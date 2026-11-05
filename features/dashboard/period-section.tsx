"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Beef, X } from "lucide-react";
import { formatNumber, POULTRY_TYPE_LABELS } from "@/lib/format";
import { CHART_COLORS } from "@/lib/stats";
import { useApi } from "@/lib/use-api";
import type { KpiKey, OverviewStats, PoultryType, ProductionMonth } from "@/lib/types";
import type { RegionOption } from "@/lib/types/reports";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { ChartCard, KpiGridSkeleton } from "@/components/stats/chart-card";
import { StatKpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { PeriodPicker, usePeriodQuery, useUrlParams } from "@/components/stats/period-picker";
import { MiniBarChart } from "./mini-bar-chart";

const PERIOD_KPIS: readonly KpiKey[] = ["eggs", "laying_rate_pct", "mortality_pct", "report_discipline_pct"];
const POULTRY_TYPES: readonly PoultryType[] = ["LAYER", "BROILER", "BREEDER"];

/**
 * TZ §4 "grafiklar, diagrammalar, filtrlar va davr tanlash": the dashboard's own period (URL
 * `date_from/date_to`), region and poultry type filters over `/api/stats/overview`.
 */
export function DashboardPeriodSection() {
  const period = usePeriodQuery();
  const params = useSearchParams();
  const setParams = useUrlParams();
  const region = params.get("region") ?? "";
  const rawType = params.get("poultry_type") ?? "";
  const poultryType = (POULTRY_TYPES as readonly string[]).includes(rawType) ? rawType : "";
  const excludeDemo = params.get("exclude_demo") === "1";
  const regions = useApi<RegionOption[]>("/households/regions");
  const overview = useApi<OverviewStats>("/stats/overview", {
    ...period,
    region: region || undefined,
    poultry_type: poultryType || undefined,
    exclude_demo: excludeDemo ? 1 : undefined,
  });
  const filtered = Boolean(region || poultryType || excludeDemo);

  return (
    <section aria-labelledby="period-kpis" className="flex flex-col gap-3">
      <SectionTitle
        id="period-kpis"
        title="Davr ko‘rsatkichlari"
        description="Oldingi shunday davr bilan taqqoslab"
        actions={
          <Link
            href="/stats"
            className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-accent hover:underline"
          >
            Batafsil
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <PeriodPicker period={overview.data?.period} error={overview.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))_auto_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="dashboard-region" className="mb-1.5 block text-[13px] text-muted">
            Viloyat
          </label>
          <Select id="dashboard-region" value={region} onChange={(event) => setParams({ region: event.target.value })}>
            <option value="">Barcha viloyatlar</option>
            {(regions.data ?? []).map((item) => (
              <option key={item.region} value={item.region}>
                {item.region}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor="dashboard-type" className="mb-1.5 block text-[13px] text-muted">
            Parranda turi
          </label>
          <Select
            id="dashboard-type"
            value={poultryType}
            onChange={(event) => setParams({ poultry_type: event.target.value })}
          >
            <option value="">Barcha turlar</option>
            {POULTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {POULTRY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm text-ink sm:self-end">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-accent,#2F6B3F)]"
            checked={excludeDemo}
            onChange={(event) => setParams({ exclude_demo: event.target.checked ? "1" : null })}
          />
          Demo ma’lumotsiz
        </label>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="size-4" aria-hidden />}
            onClick={() => setParams({ region: null, poultry_type: null, exclude_demo: null })}
            className="justify-self-start"
          >
            Filtrlarni tozalash
          </Button>
        )}
      </div>

      <Loadable resource={overview} skeleton={<KpiGridSkeleton count={4} />}>
        {(data) => <PeriodBody data={data} />}
      </Loadable>
    </section>
  );
}

function PeriodBody({ data }: { data: OverviewStats }) {
  const { series, kpis } = data;
  const dates = series.map((point) => point.date);
  const eggs = series.map((point) => point.eggs);
  const meat = series.map((point) => point.meat_kg ?? 0);
  const missing = series.map((point) => point.reports === 0);
  const meatTotal = data.meat?.total_kg ?? 0;
  const meatPrevious = data.meat?.previous_total_kg ?? 0;
  const days = data.period.days;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {PERIOD_KPIS.map((key) => (
          <StatKpiCard key={key} kpiKey={key} kpi={kpis[key]} period={data.period} />
        ))}
        <StatCard
          label="Go‘sht ishlab chiqarish"
          icon={Beef}
          value={`${formatNumber(meatTotal, 1)} kg`}
          hint={`oldingi davr: ${formatNumber(meatPrevious, 1)} kg${
            data.meat?.avg_weight_g ? ` · o‘rtacha vazn ${formatNumber(data.meat.avg_weight_g, 0)} g` : ""
          }`}
        />
      </div>
      <p className="-mt-1 text-[13px] text-muted">
        {formatNumber(data.households.total)} ta xonadon · parranda (xonadonlarda){" "}
        <span className="font-medium tabular-nums text-ink">{formatNumber(kpis.birds_end.value)}</span>
      </p>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="Tuxum" description={`dona / kun · ${days} kun`} summary={`Jami: ${formatNumber(kpis.eggs.value)}`}>
          {isEmptySeries([{ values: eggs }]) ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "eggs", label: "Tuxum", color: CHART_COLORS.primary, values: eggs, kind: "area" }]}
              missing={missing}
              format={(value) => `${formatNumber(value)} dona`}
              ariaLabel={`Kunlik tuxum, ${days} kun`}
            />
          )}
        </ChartCard>
        <ChartCard title="Go‘sht" description={`kg / kun · ${days} kun`} summary={`Jami: ${formatNumber(meatTotal, 1)} kg`}>
          {meatTotal <= 0 ? (
            <NoData title="Bu davrda go‘sht hisobotlari yo‘q" />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "meat", label: "Go‘sht", color: CHART_COLORS.accent, values: meat, kind: "area" }]}
              format={(value) => `${formatNumber(value, 1)} kg`}
              ariaLabel={`Kunlik go‘sht, ${days} kun, jami ${formatNumber(meatTotal, 1)} kg`}
            />
          )}
        </ChartCard>
      </div>
    </>
  );
}

export function PeriodSectionSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

const monthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return `${month}.${year}`;
};

/** TZ §4 "Oylik ishlab chiqarish dinamikasi": 12 months of eggs, meat and feed from the daily reports. */
export function MonthlyProductionCard({ months }: { months: readonly ProductionMonth[] }) {
  const data = (pick: (month: ProductionMonth) => number) => months.map((month) => ({ date: month.month, value: pick(month) }));
  const hasMeat = months.some((month) => month.meat_kg > 0);
  return (
    <Card>
      <CardHeader title="Oylik ishlab chiqarish" description="So‘nggi 12 oy, kunlik hisobotlar bo‘yicha" />
      <CardBody className={`grid gap-8 sm:grid-cols-2 ${hasMeat ? "xl:grid-cols-3" : ""}`}>
        <MiniBarChart
          title="Tuxum"
          unit="dona"
          data={data((month) => month.eggs)}
          windowLabel="12 oy"
          formatLabel={monthLabel}
          formatTick={monthLabel}
        />
        {hasMeat && (
          <MiniBarChart
            title="Go‘sht"
            unit="kg"
            digits={1}
            data={data((month) => month.meat_kg)}
            windowLabel="12 oy"
            formatLabel={monthLabel}
            formatTick={monthLabel}
          />
        )}
        <MiniBarChart
          title="Yem sarfi"
          unit="kg"
          digits={1}
          data={data((month) => month.feed_kg)}
          windowLabel="12 oy"
          formatLabel={monthLabel}
          formatTick={monthLabel}
        />
      </CardBody>
    </Card>
  );
}
