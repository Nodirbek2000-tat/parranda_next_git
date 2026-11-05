"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Activity, Beef, Bird, ClipboardList, Egg, House, Package, Truck, Warehouse } from "lucide-react";
import { mortalityTone } from "@/lib/stats";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, todayIso } from "@/lib/format";
import type { AdminDashboard, AdminDashboardV3, HouseholdMapPoint, OverviewStats } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, StatsSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { MapView, toMapPoint } from "@/components/map/map-view";
import { MiniBarChart } from "@/features/dashboard/mini-bar-chart";
import { DashboardPeriodSection, MonthlyProductionCard, PeriodSectionSkeleton } from "@/features/dashboard/period-section";
import { DashboardExpiringLots, OperationsRow, ProblemHouseholdsCard } from "@/features/dashboard/operations";
import { movementColumns } from "@/features/movements/movement-columns";

export default function DashboardPage() {
  const dashboard = useApi<AdminDashboard & AdminDashboardV3>("/dashboard/admin");
  const map = useApi<HouseholdMapPoint[]>("/households/map");
  const overview = useApi<OverviewStats>("/stats/overview");
  const data = dashboard.data;
  // Same 30 days as the tile: red only above the /stats “Yuqori o‘lim” threshold (no alarm fatigue).
  const deathTone = mortalityTone(overview.data?.kpis.mortality_pct.value);
  const today = data?.production_14d.at(-1);
  // The API lists at most 10 households; the total comes from the counters
  // (reports_today counts active households only, like households_active).
  const withoutReport = data ? Math.max(data.households_active - data.reports_today, 0) : 0;
  const notListed = data ? Math.max(withoutReport - data.households_without_report_today.length, 0) : 0;
  // Today's bar is a day in progress (some households report in the evening).
  const partialToday =
    data && today && today.date === todayIso()
      ? `bugun, ${formatNumber(data.reports_today)} / ${formatNumber(data.households_active)} hisobot`
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Boshqaruv paneli" description={`Bugun: ${formatDate(todayIso())}`} />

      {data && dashboard.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={dashboard.error} onRetry={dashboard.reload} className="border-b-0" />
        </Card>
      )}
      {!data && dashboard.error ? (
        <Card>
          <ErrorState error={dashboard.error} onRetry={dashboard.reload} />
        </Card>
      ) : !data ? (
        <>
          <StatsSkeleton count={8} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Faol xonadonlar"
              icon={House}
              value={formatNumber(data.households_active)}
              hint={`jami ${formatNumber(data.households_total)} · nofaol ${formatNumber(
                data.households_total - data.households_active,
              )}`}
            />
            <StatCard
              label="Jami parranda"
              icon={Bird}
              value={formatNumber(data.birds_total ?? data.birds_in_households + data.birds_in_center)}
              hint={`xonadonlarda ${formatNumber(data.birds_in_households)} · markazda ${formatNumber(data.birds_in_center)}`}
            />
            <StatCard label="30 kunda tarqatildi" icon={Truck} value={formatNumber(data.distributed_30d)} />
            <StatCard
              label="30 kunda nobud (jami)"
              icon={Activity}
              tone={deathTone}
              value={formatNumber(data.deaths_30d)}
              hint={`xonadonlarda ${formatNumber(data.deaths_30d_households)} · markazda ${formatNumber(
                data.deaths_30d_center,
              )}`}
            />
            <Link
              href="/warehouse"
              className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Ombor qoldig‘i — ombor sahifasi"
            >
              <StatCard
                label="Ombor qoldig‘i"
                icon={Package}
                tone={data.warehouse_summary && data.warehouse_summary.out_of_stock + data.warehouse_summary.low_stock > 0 ? "warning" : "default"}
                value={`${formatNumber(data.feed_stock_kg, 1)} kg yem`}
                hint={
                  data.warehouse_summary
                    ? `${formatNumber(data.warehouse_summary.active_products)} mahsulot · kam ${formatNumber(
                        data.warehouse_summary.low_stock,
                      )} · tugagan ${formatNumber(data.warehouse_summary.out_of_stock)}`
                    : undefined
                }
              />
            </Link>
            <StatCard
              label="Bugungi tuxum"
              icon={Egg}
              value={`${formatNumber(data.eggs_today)} dona`}
              hint="bugun kiritilgan hisobotlar bo‘yicha"
            />
            <StatCard
              label="Bugungi go‘sht"
              icon={Beef}
              value={`${formatNumber(data.meat_today ?? 0, 1)} kg`}
              hint="broyler hisobotlari bo‘yicha"
            />
            <StatCard
              label="Bugungi hisobotlar"
              icon={ClipboardList}
              value={`${formatNumber(data.reports_today)} / ${formatNumber(data.households_active)}`}
              hint={`faol xonadonlardan · yem sarfi ${formatNumber(data.feed_used_today, 1)} kg`}
            />
          </div>

          <OperationsRow data={data} />

          <Suspense fallback={<PeriodSectionSkeleton />}>
            <DashboardPeriodSection />
          </Suspense>

          {(data.problem_households || data.expiring_lots) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ProblemHouseholdsCard data={data} />
              <DashboardExpiringLots data={data} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Kunlik ishlab chiqarish" description="So‘nggi 14 kun" />
              <CardBody className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <MiniBarChart
                  title="Tuxum"
                  unit="dona"
                  data={data.production_14d.map((item) => ({ date: item.date, value: item.eggs }))}
                  partialLast={partialToday}
                />
                <MiniBarChart
                  title="Yem sarfi"
                  unit="kg"
                  data={data.production_14d.map((item) => ({ date: item.date, value: item.feed_kg }))}
                  digits={1}
                  partialLast={partialToday}
                />
                {data.production_14d.some((item) => (item.meat_kg ?? 0) > 0) && (
                  <MiniBarChart
                    title="Go‘sht"
                    unit="kg"
                    data={data.production_14d.map((item) => ({ date: item.date, value: item.meat_kg ?? 0 }))}
                    digits={1}
                    partialLast={partialToday}
                  />
                )}
              </CardBody>
            </Card>

            <Card className="flex flex-col overflow-hidden">
              <CardHeader
                title="Xonadonlar xaritasi"
                description={map.data ? `${formatNumber(map.data.length)} ta xonadon belgilangan` : undefined}
                actions={
                  <LinkButton href="/map" size="sm">
                    To‘liq xarita
                  </LinkButton>
                }
              />
              <div className="relative mt-4 min-h-80 flex-1 border-t border-line">
                {map.error && !map.data ? (
                  <ErrorState error={map.error} onRetry={map.reload} />
                ) : (
                  <div className="absolute inset-0">
                    <MapView points={(map.data ?? []).map(toMapPoint)} className="size-full" interactive={false} />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {data.production_12m && data.production_12m.length > 0 && <MonthlyProductionCard months={data.production_12m} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Bugun hisobot bermaganlar"
                description="Faol xonadonlar"
                actions={
                  withoutReport > 0 ? <Badge tone="warning">{formatNumber(withoutReport)}</Badge> : undefined
                }
              />
              {data.households_without_report_today.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Barcha xonadonlar hisobot topshirgan" />
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {data.households_without_report_today.map((household) => (
                    <li key={household.id}>
                      <Link
                        href={`/households/${household.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-6"
                      >
                        <span className="min-w-0 truncate font-medium text-ink">{household.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">{household.code}</span>
                      </Link>
                    </li>
                  ))}
                  {notListed > 0 && (
                    <li className="px-4 py-3 text-sm text-muted sm:px-6">
                      va yana {formatNumber(notListed)} ta xonadon hisobot bermagan
                    </li>
                  )}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Kam qolgan mahsulotlar"
                description="Qoldig‘i minimal zaxiradan oshmagan"
                actions={
                  <LinkButton href="/warehouse" size="sm">
                    Ombor
                  </LinkButton>
                }
              />
              {data.low_stock.length === 0 ? (
                <EmptyState icon={Warehouse} title="Barcha mahsulotlar yetarli" />
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {data.low_stock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
                      <span className="min-w-0 truncate font-medium text-ink">{item.name}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-medium text-danger">
                          {formatNumber(item.balance)} {item.unit}
                        </span>
                        <span className="text-muted">
                          {" "}
                          / min {formatNumber(item.min_stock)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="So‘nggi harakatlar"
              actions={
                <LinkButton href="/batches" size="sm">
                  Partiyalar
                </LinkButton>
              }
            />
            <div className="mt-3 border-t border-line">
              {data.recent_movements.length === 0 ? (
                <EmptyState icon={Bird} title="Hali harakatlar yo‘q" />
              ) : (
                <DataTable
                  caption="So‘nggi parranda harakatlari"
                  rows={data.recent_movements}
                  columns={movementColumns()}
                  rowKey={(row) => row.id}
                />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
