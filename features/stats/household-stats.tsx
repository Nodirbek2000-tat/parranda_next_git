"use client";

import { Suspense } from "react";
import { CalendarX2, ChartLine } from "lucide-react";
import { formatDate, formatFixed, formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS, DEFAULT_PRESETS, formatKpiValue, POULTRY_COLORS, type PeriodPreset } from "@/lib/stats";
import { useApi } from "@/lib/use-api";
import type { HouseholdStats, KpiKey } from "@/lib/types";
import { CalendarStrip, type CalendarDay } from "@/components/charts/calendar-strip";
import { ProgressRing } from "@/components/charts/donut";
import { LegendKey } from "@/components/charts/legend";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { SectionTitle } from "@/components/ui/card";
import { ChartCard, StatsPageSkeleton } from "@/components/stats/chart-card";
import { StatKpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { PeriodPicker, usePeriodQuery } from "@/components/stats/period-picker";

const KPI_ORDER: readonly KpiKey[] = [
  "birds_end",
  "meat_kg",
  "fcr",
  "avg_weight_g",
  "feed_kg",
  "deaths",
  "mortality_pct",
  "report_discipline_pct",
];

const OWNER_PRESETS: readonly PeriodPreset[] = DEFAULT_PRESETS.filter((preset) => preset.days <= 90);

const gramsFormat = (value: number) => `${formatNumber(value, 0)} g`;
const kgFormat = (value: number) => `${formatNumber(value, 1)} kg`;
const birdsFormat = (value: number) => `${formatNumber(value)} dona`;

/**
 * "Statistika" section of /households/[id] and /my (contract 6.7): period
 * picker, KPI cards with deltas, bird count step line, meat + average weight,
 * feed bars and the reported / missing days calendar.
 */
export function HouseholdStatsSection(props: { path: string; owner?: boolean }) {
  // The period lives in the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<StatsPageSkeleton charts={2} />}>
      <HouseholdStatsInner {...props} />
    </Suspense>
  );
}

function HouseholdStatsInner({ path, owner = false }: { path: string; owner?: boolean }) {
  const period = usePeriodQuery();
  const stats = useApi<HouseholdStats>(path, { ...period });

  return (
    <section aria-labelledby="household-stats-title" className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <SectionTitle
        id="household-stats-title"
        title="Statistika"
        description="Hisobotlar va parranda harakatlari asosida hisoblanadi"
      />
      <PeriodPicker
        presets={owner ? OWNER_PRESETS : DEFAULT_PRESETS}
        period={stats.data?.period}
        error={stats.error}
        sticky
      />
      <Loadable resource={stats} skeleton={<StatsPageSkeleton charts={2} />}>
        {(data) => <HouseholdStatsBody data={data} owner={owner} />}
      </Loadable>
    </section>
  );
}

function HouseholdStatsBody({ data, owner }: { data: HouseholdStats; owner: boolean }) {
  const dates = data.series.map((point) => point.date);
  const birds = data.series.map((point) => point.birds);
  const meat = data.series.map((point) => point.meat_kg);
  const weight = data.series.map((point) => point.avg_weight_g);
  const feed = data.series.map((point) => point.feed_kg);
  // No report that day: meat / feed are unknown (hatched gap in the charts), not 0.
  const missing = data.series.map((point) => !point.reported);
  const span = `${data.period.days} kun`;
  const pendingToday = data.series.some((point) => point.pending);
  const totals = {
    meat: data.kpis.meat_kg.value ?? 0,
    feed: data.kpis.feed_kg.value ?? 0,
  };
  const noReports = (data.kpis.reports.value ?? 0) === 0;

  const days: CalendarDay[] = data.series.map((point) => ({
    date: point.date,
    state: point.reported ? "reported" : point.pending ? "pending" : point.expected ? "missing" : "none",
    detail: point.reported
      ? `Go‘sht: ${formatNumber(point.meat_kg, 1)} kg · Yem: ${formatNumber(point.feed_kg, 1)} kg`
      : `Parranda: ${formatNumber(point.birds)} dona`,
  }));
  const discipline = data.kpis.report_discipline_pct.value;
  // Same sparklines as /stats: report-based sums are gaps on days without a report.
  const gapped = (values: readonly number[]) => values.map((value, index) => (missing[index] ? null : value));
  const trends: Partial<Record<KpiKey, readonly (number | null)[]>> = {
    birds_end: birds,
    meat_kg: gapped(meat),
    avg_weight_g: weight,
    fcr: data.series.map((point) => point.fcr),
    feed_kg: gapped(feed),
    deaths: data.series.map((point) => point.deaths),
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {KPI_ORDER.map((key) => (
          <StatKpiCard key={key} kpiKey={key} kpi={data.kpis[key]} period={data.period} trend={trends[key]} />
        ))}
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <ChartCard
          title="Parranda soni"
          description={`Har kun oxiridagi soni · ${span}`}
          summary={`${formatNumber(birds.at(-1) ?? 0)} dona`}
        >
          {isEmptySeries([{ values: birds }]) ? (
            <NoData icon={ChartLine} title="Tanlangan davrda xonadonda parranda bo‘lmagan" />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                {
                  key: "birds",
                  label: "Parranda",
                  color: CHART_COLORS.primary,
                  values: birds,
                  kind: "line",
                  step: true,
                },
              ]}
              format={birdsFormat}
              ariaLabel={`Parranda soni, ${data.period.days} kun`}
            />
          )}
          {data.by_poultry_type.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-[13px]">
              {data.by_poultry_type.map((type) => (
                <li key={type.poultry_type} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <LegendKey color={POULTRY_COLORS[type.poultry_type]} />
                    <span className="truncate">{type.poultry_type_display}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    <span className="font-medium text-ink">{formatNumber(type.birds_end)}</span> dona · nobud{" "}
                    {formatNumber(type.deaths)} · {formatPercent(type.mortality_pct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Go‘sht"
          description="kg / kun, hisobot kiritilgan kunlar"
          summary={`Jami: ${formatNumber(totals.meat, 1)} kg · FCR ${formatKpiValue("fcr", data.kpis.fcr.value)}`}
        >
          {noReports || isEmptySeries([{ values: meat }]) ? (
            <NoData title={noReports ? undefined : "Bu davrda go‘sht kiritilmagan"} />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "meat", label: "Go‘sht", color: CHART_COLORS.primary, values: meat, kind: "area" }]}
              missing={missing}
              format={kgFormat}
              ariaLabel={`Kunlik go‘sht, jami ${formatNumber(totals.meat, 1)} kg`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="O‘rtacha vazn"
          description="g, hisobotlarda kiritilgan kunlar"
          summary={formatKpiValue("avg_weight_g", data.kpis.avg_weight_g.value)}
        >
          {weight.every((value) => value === null) ? (
            <NoData title="Bu davrda vazn kiritilmagan" />
          ) : (
            <TimeChart
              dates={dates}
              series={[
                { key: "weight", label: "O‘rtacha vazn", color: CHART_COLORS.accent, values: weight, kind: "line" },
              ]}
              missing={missing}
              format={gramsFormat}
              ariaLabel={`Kunlik o‘rtacha vazn, davr bo‘yicha ${formatKpiValue("avg_weight_g", data.kpis.avg_weight_g.value)}`}
            />
          )}
        </ChartCard>

        <ChartCard title="Yem sarfi" description={`kg / kun · ${span}`} summary={`Jami: ${formatKpiValue("feed_kg", data.kpis.feed_kg.value)}`}>
          {noReports ? (
            <NoData />
          ) : (
            <TimeChart
              dates={dates}
              series={[{ key: "feed", label: "Yem", color: CHART_COLORS.accent, values: feed, kind: "bar" }]}
              missing={missing}
              format={kgFormat}
              ariaLabel={`Kunlik yem sarfi, jami ${formatNumber(totals.feed, 1)} kg`}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Hisobot intizomi"
        description={
          data.household.is_active
            ? "Faol xonadon parrandasi bor har bir kun uchun hisobot kutiladi"
            : "Nofaol xonadondan hisobot kutilmaydi"
        }
      >
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div className="flex items-center gap-4 md:flex-col md:items-start">
            <ProgressRing
              value={discipline}
              label="intizom"
              tone={discipline === null || discipline >= 90 ? "accent" : discipline >= 70 ? "warning" : "danger"}
            />
            <dl className="grid grid-cols-3 gap-3 text-center text-[13px] md:text-left">
              <div>
                <dt className="text-muted">Kutilgan</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatNumber(data.discipline.expected)}</dd>
              </div>
              <div>
                <dt className="text-muted">Kiritilgan</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatNumber(data.discipline.reported)}</dd>
              </div>
              <div>
                <dt className="text-muted">Yo‘q</dt>
                <dd
                  className={
                    data.discipline.missing > 0
                      ? "font-semibold tabular-nums text-danger"
                      : "font-semibold tabular-nums text-ink"
                  }
                >
                  {formatNumber(data.discipline.missing)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="min-w-0">
            <CalendarStrip days={days} caption="Hisobot kunlari" />
            {pendingToday && (
              <p className="mt-2 text-xs text-muted">
                Bugungi hisobot kutilmoqda: kun tugamagani uchun u hali “kiritilmagan” hisoblanmaydi.
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">
              {owner ? "Hisobot kiritilmagan kunlar" : "Hisobotsiz kunlar"}
              <span className="ml-1.5 font-normal tabular-nums text-muted">
                {formatNumber(data.missing_days.length)}
              </span>
            </p>
            {data.missing_days.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
                <CalendarX2 className="size-4 text-accent" aria-hidden />
                Hisobotsiz kun yo‘q
              </p>
            ) : (
              <ul className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {data.missing_days.map((day) => (
                  <li key={day} className="rounded-md bg-danger-soft px-2 py-0.5 text-xs tabular-nums text-danger">
                    {formatDate(day)}
                  </li>
                ))}
              </ul>
            )}
            {owner && data.missing_days.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                O‘tgan kun uchun hisobotni “Hisobot kiritish” tugmasi orqali sanani tanlab kiriting.
              </p>
            )}
          </div>
        </div>
        <p className="sr-only">
          {discipline === null
            ? "Hisobot intizomi hisoblanmaydi: tanlangan davrda hisobot kutilmagan."
            : `Hisobot intizomi ${formatFixed(discipline, 1)} foiz, ${formatNumber(data.discipline.missing)} kun hisobotsiz.`}
        </p>
      </ChartCard>
    </>
  );
}
