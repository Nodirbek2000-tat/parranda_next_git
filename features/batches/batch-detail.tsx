"use client";

import { Suspense, useState } from "react";
import { ArrowRightLeft, Bird, House, Pencil } from "lucide-react";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { CHART_COLORS, DEFAULT_PRESETS, mortalityTone, POULTRY_COLORS } from "@/lib/stats";
import type { ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { BatchStats, Movement } from "@/lib/types";
import { Donut } from "@/components/charts/donut";
import { isEmptySeries, TimeChart } from "@/components/charts/time-chart";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Summary } from "@/components/ui/summary";
import { ChartCard, StatsPageSkeleton } from "@/components/stats/chart-card";
import { KpiCard } from "@/components/stats/kpi-card";
import { Loadable, NoData } from "@/components/stats/loadable";
import { PeriodPicker, usePeriodQuery } from "@/components/stats/period-picker";
import { movementColumns } from "../movements/movement-columns";
import { MovementModal } from "../movements/movement-modal";
import { PagedTableCard } from "../paged-table-card";
import { BatchEditModal } from "./batch-edit-modal";
import { BatchVaccinationHistory } from "../vet/household-vet-section";

type HouseholdRow = BatchStats["households"][number];

const HOUSEHOLD_COLUMNS: Column<HouseholdRow>[] = [
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
        <span className="text-xs font-normal tabular-nums text-muted">{row.household.code}</span>
      </span>
    ),
  },
  {
    key: "count",
    header: "Hozir",
    align: "right",
    cell: (row) => <span className="font-semibold">{formatNumber(row.count_now)}</span>,
  },
  { key: "distributed", header: "Tarqatilgan", align: "right", cell: (row) => formatNumber(row.distributed) },
  { key: "returned", header: "Qaytarilgan", align: "right", cell: (row) => formatNumber(row.returned) },
  {
    key: "deaths",
    header: "Nobud",
    align: "right",
    cell: (row) => <span className={row.deaths > 0 ? "text-danger" : undefined}>{formatNumber(row.deaths)}</span>,
  },
  { key: "out", header: "Chiqim", align: "right", hideOnMobile: true, cell: (row) => formatNumber(row.out) },
  { key: "mortality", header: "O‘lim", align: "right", cell: (row) => formatPercent(row.mortality_pct) },
];

const birds = (value: number) => `${formatNumber(value)} dona`;

/** "Butun davr" (default) already covers the batch's life, so the 1-year preset is left out. */
const BATCH_PRESETS = DEFAULT_PRESETS.filter((preset) => preset.days <= 90);

export function BatchDetail({ id }: { id: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BatchDetailInner id={id} />
    </Suspense>
  );
}

type Dialog = "edit" | "movement" | null;

/** /batches/[id] (contract 6.4). */
function BatchDetailInner({ id }: { id: string }) {
  const period = usePeriodQuery();
  const stats = useApi<BatchStats>(`/batches/${id}/stats`, { ...period });
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = stats.data;

  if (!data) {
    if (stats.error?.status === 404) {
      return (
        <Card>
          <EmptyState
            icon={Bird}
            title="Partiya topilmadi"
            description="Manzil noto‘g‘ri yoki partiya mavjud emas."
            action={<LinkButton href="/batches">Partiyalar ro‘yxati</LinkButton>}
          />
        </Card>
      );
    }
    // A bad period in the URL (400) still shows the picker so it can be fixed.
    if (stats.error && stats.error.status !== 400) {
      return (
        <Card>
          <ErrorState error={stats.error} onRetry={stats.reload} />
        </Card>
      );
    }
    if (!stats.error) return <PageSkeleton />;
  }

  const batch = data?.batch;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Partiyalar", href: "/batches" }, { label: batch?.code ?? id }]}
        title={
          batch ? (
            <span className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums">{batch.code}</span>
              <Badge tone="neutral" className="gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: POULTRY_COLORS[batch.poultry_type] }}
                  aria-hidden
                />
                {batch.poultry_type_display}
              </Badge>
            </span>
          ) : (
            "Partiya"
          )
        }
        description={
          batch
            ? [
                batch.breed,
                batch.supplier,
                `kelgan sana ${formatDate(batch.arrived_at)}`,
                `holati: ${batch.health_status || "—"}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        actions={
          batch && (
            <>
              <Button icon={<ArrowRightLeft className="size-4" aria-hidden />} onClick={() => setDialog("movement")}>
                Amal
              </Button>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setDialog("edit")}
              >
                Tahrirlash
              </Button>
            </>
          )
        }
      />

      <Loadable resource={stats} skeleton={<StatsPageSkeleton charts={2} />}>
        {(loaded) => <BatchBody data={loaded} error={stats.error} />}
      </Loadable>

      {stats.error?.status === 400 && !data && (
        <PeriodPicker presets={BATCH_PRESETS} defaultOption={{ label: "Butun davr" }} error={stats.error} />
      )}

      <PagedTableCard<Movement>
        title="Partiya harakatlari"
        path="/movements"
        query={{ batch: id }}
        columns={movementColumns({ batch: false })}
        rowKey={(row) => row.id}
        emptyTitle="Harakatlar yo‘q"
        emptyIcon={ArrowRightLeft}
      />

      <BatchVaccinationHistory batchId={Number(id)} />

      {dialog === "edit" && batch && (
        <BatchEditModal batch={batch} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
      {dialog === "movement" && batch && (
        <MovementModal
          batch={{ id: batch.id, code: batch.code, center_stock: data?.totals.center_stock ?? batch.center_stock }}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function BatchBody({ data, error }: { data: BatchStats; error: ApiError | null }) {
  const { batch, totals, age } = data;
  const dates = data.series.map((point) => point.date);
  const center = data.series.map((point) => point.center_stock);
  const inHouseholds = data.series.map((point) => point.in_households);
  const deaths = data.series.map((point) => point.deaths);
  const flows = data.series.map((point) => point.distributed);
  const returned = data.series.map((point) => point.returned);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Boshlang‘ich soni"
          value={formatNumber(totals.initial_quantity)}
          unit="dona"
          sub={`kelgan: ${formatDate(batch.arrived_at)}`}
        />
        <KpiCard
          label="Markazda"
          value={formatNumber(totals.center_stock)}
          unit="dona"
          sub={`tirik jami: ${formatNumber(totals.alive)}`}
        />
        <KpiCard
          label="Xonadonlarda"
          value={formatNumber(totals.in_households)}
          unit="dona"
          sub={`${formatNumber(totals.households_now)} ta xonadonda`}
        />
        <KpiCard
          label="Nobud"
          value={formatNumber(totals.deaths_total)}
          unit="dona"
          tone={mortalityTone(totals.mortality_pct)}
          sub={`o‘lim darajasi ${formatPercent(totals.mortality_pct)}`}
          hint="Nobud ÷ boshlang‘ich soni"
        />
        <KpiCard
          label="Chiqim"
          value={formatNumber(totals.out_total)}
          unit="dona"
          sub={`markazdan ${formatNumber(totals.out_center)}`}
        />
        <KpiCard label="Kelganda yoshi" value={formatNumber(age.age_days_at_arrival)} unit="kun" />
        <KpiCard label="Kelganiga" value={formatNumber(age.days_since_arrival)} unit="kun" />
        <KpiCard label="Bugungi yoshi" value={formatNumber(age.age_days_today)} unit="kun" />
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ChartCard title="Tarkib" description="Boshlang‘ich soni qayerda: jami = boshlang‘ich">
          <Donut
            ariaLabel={`Partiya tarkibi: markazda ${totals.center_stock}, xonadonlarda ${totals.in_households}, nobud ${totals.deaths_total}, chiqim ${totals.out_total}`}
            centerValue={formatNumber(totals.initial_quantity)}
            centerLabel="boshlang‘ich"
            segments={[
              { key: "center", label: "Markazda", value: totals.center_stock, color: CHART_COLORS.primary },
              { key: "households", label: "Xonadonlarda", value: totals.in_households, color: CHART_COLORS.accentLight },
              { key: "deaths", label: "Nobud", value: totals.deaths_total, color: CHART_COLORS.danger },
              { key: "out", label: "Chiqim", value: totals.out_total, color: CHART_COLORS.warning },
            ]}
          />
        </ChartCard>
        <Card>
          <CardHeader title="Partiya ma’lumotlari" />
          <CardBody>
            <Summary
              items={[
                ["Zoti", batch.breed],
                ["Yetkazib beruvchi", batch.supplier || "—"],
                ["Sog‘lig‘i holati", batch.health_status || "—"],
                [
                  "Boshlang‘ich vazn",
                  batch.initial_weight_g === null ? "—" : `${formatNumber(batch.initial_weight_g)} g`,
                ],
                ["Tarqatilgan (yalpi)", `${formatNumber(totals.distributed)} dona`],
                ["Qaytarilgan", `${formatNumber(totals.returned)} dona`],
                ["Ro‘yxatga olingan", formatDateTime(batch.created_at)],
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="batch-timeline" className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <SectionTitle id="batch-timeline" title="Dinamika" description="Har kun oxiridagi soni va kunlik harakatlar" />
        <PeriodPicker presets={BATCH_PRESETS} defaultOption={{ label: "Butun davr" }} period={data.period} error={error} />
        <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
          <ChartCard title="Markazda va xonadonlarda" description="dona, kun oxirida" className="lg:col-span-2">
            {isEmptySeries([{ values: center }, { values: inHouseholds }]) ? (
              <NoData />
            ) : (
              <TimeChart
                dates={dates}
                height={240}
                series={[
                  {
                    key: "center",
                    label: "Markazda",
                    color: CHART_COLORS.primary,
                    values: center,
                    kind: "line",
                    step: true,
                  },
                  {
                    key: "households",
                    label: "Xonadonlarda",
                    color: CHART_COLORS.accentLight,
                    fill: CHART_COLORS.accentLight,
                    values: inHouseholds,
                    kind: "area",
                    step: true,
                  },
                ]}
                format={birds}
                ariaLabel="Partiya: markazda va xonadonlardagi parranda soni"
              />
            )}
          </ChartCard>
          <ChartCard
            title="Nobud bo‘lish"
            description="dona / kun"
            summary={`Davrda: ${formatNumber(deaths.reduce((a, b) => a + b, 0))}`}
          >
            {isEmptySeries([{ values: deaths }]) ? (
              <NoData title="Tanlangan davrda nobud qayd etilmagan" />
            ) : (
              <TimeChart
                dates={dates}
                series={[{ key: "deaths", label: "Nobud", color: CHART_COLORS.danger, values: deaths, kind: "bar" }]}
                format={birds}
                ariaLabel="Partiya: kunlik nobud"
              />
            )}
          </ChartCard>
          <ChartCard title="Tarqatish va qaytarish" description="dona / kun">
            {isEmptySeries([{ values: flows }, { values: returned }]) ? (
              <NoData />
            ) : (
              <TimeChart
                dates={dates}
                series={[
                  { key: "distributed", label: "Tarqatilgan", color: CHART_COLORS.accent, values: flows, kind: "bar" },
                  { key: "returned", label: "Qaytarilgan", color: CHART_COLORS.warning, values: returned, kind: "bar" },
                ]}
                format={birds}
                ariaLabel="Partiya: kunlik tarqatish va qaytarish"
              />
            )}
          </ChartCard>
        </div>
      </section>

      <Card>
        <CardHeader
          title="Xonadonlar bo‘yicha taqsimot"
          description="Partiyadan parranda olgan barcha xonadonlar, hozirgi soni bo‘yicha"
        />
        <div className="mt-3 border-t border-line">
          {data.households.length === 0 ? (
            <NoData icon={House} title="Partiyadan hali xonadonlarga tarqatilmagan" />
          ) : (
            <DataTable
              caption="Xonadonlar bo‘yicha taqsimot"
              rows={data.households}
              columns={HOUSEHOLD_COLUMNS}
              rowKey={(row) => row.household.id}
              mobileColumns={3}
              rowHref={(row) => `/households/${row.household.id}`}
            />
          )}
        </div>
      </Card>
    </>
  );
}
