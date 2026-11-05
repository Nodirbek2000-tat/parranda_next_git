"use client";

import { useState } from "react";
import { Beef, Bird, CircleCheck, ClipboardList, Egg, Package, Skull, Wheat } from "lucide-react";
import { formatDate, formatNumber, todayIso } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { HouseholdBatch, OwnerDashboard } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Summary } from "@/components/ui/summary";
import { HouseholdLocation } from "@/features/households/household-location";
import { HouseholdStatsSection } from "@/features/stats/household-stats";
import { MovementModal } from "@/features/movements/movement-modal";
import { OwnerBatchModal } from "@/features/batches/owner-batch-modal";
import { DailyReportModal } from "@/features/reports/daily-report-modal";
import { reportColumns } from "@/features/reports/report-columns";
import { transactionColumns } from "@/features/stock/transaction-columns";
import { OwnerServicesCard, type OwnerDashboardV3 } from "@/features/dashboard/owner-services";

function batchColumns(onOpen: (batchId: number) => void): Column<HouseholdBatch>[] {
  return [
    {
      key: "code",
      header: "Partiya",
      primary: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row.batch_id)}
          className="rounded-sm font-medium tabular-nums text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {row.batch_code}
        </button>
      ),
    },
    { key: "type", header: "Turi", cell: (row) => row.poultry_type_display },
    { key: "breed", header: "Zoti", cell: (row) => row.breed },
    {
      key: "received",
      header: "Qabul qilingan",
      cell: (row) => (row.first_received_date ? formatDate(row.first_received_date) : "—"),
    },
    { key: "count", header: "Soni", align: "right", cell: (row) => formatNumber(row.count) },
  ];
}

type Dialog = "report" | "death" | null;

export default function MyHouseholdPage() {
  const dashboard = useApi<OwnerDashboard & OwnerDashboardV3>("/dashboard/owner");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [openBatch, setOpenBatch] = useState<number | null>(null);
  const data = dashboard.data;

  if (!data) {
    return dashboard.error ? (
      <Card>
        <ErrorState error={dashboard.error} onRetry={dashboard.reload} />
      </Card>
    ) : (
      <PageSkeleton />
    );
  }

  const { household, today_report: today } = data;
  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-6">
      {dashboard.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={dashboard.error} onRetry={dashboard.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        title={household.name}
        description={`${household.code} · Bugun: ${formatDate(todayIso())}`}
        actions={
          <>
            <Button icon={<ClipboardList className="size-4" aria-hidden />} onClick={() => setDialog("report")}>
              Hisobot kiritish
            </Button>
            <Button
              variant="secondary"
              icon={<Skull className="size-4" aria-hidden />}
              onClick={() => setDialog("death")}
              disabled={data.batches.length === 0}
            >
              Nobudni qayd etish
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Parranda soni" icon={Bird} value={formatNumber(data.bird_count)} />
        {(data.meat_7d ?? 0) > 0 && (data.eggs_7d ?? 0) === 0 ? (
          <StatCard label="7 kunda go‘sht" icon={Beef} value={`${formatNumber(data.meat_7d ?? 0, 1)} kg`} />
        ) : (
          <StatCard
            label="7 kunda tuxum"
            icon={Egg}
            value={formatNumber(data.eggs_7d)}
            hint={(data.meat_7d ?? 0) > 0 ? `go‘sht: ${formatNumber(data.meat_7d ?? 0, 1)} kg` : undefined}
          />
        )}
        <StatCard label="7 kunda yem" icon={Wheat} value={`${formatNumber(data.feed_7d)} kg`} />
        <StatCard
          label="30 kunda nobud"
          icon={Skull}
          tone={data.deaths_30d > 0 ? "danger" : "default"}
          value={formatNumber(data.deaths_30d)}
        />
      </div>

      <OwnerServicesCard data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Bugungi hisobot"
            actions={today ? <Badge tone="success"><CircleCheck className="size-3" aria-hidden />Topshirildi</Badge> : <Badge tone="warning">Kiritilmagan</Badge>}
          />
          <CardBody>
            {today ? (
              <Summary
                items={[
                  ["Parranda", formatNumber(today.bird_count)],
                  ["Tuxum", `${formatNumber(today.eggs)} dona`],
                  ["Yem sarfi", `${formatNumber(today.feed_kg)} kg`],
                  ["Nobud", `${formatNumber(today.deaths)} dona`],
                ]}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <Alert tone="warning">Bugungi kunlik hisobot hali kiritilmagan.</Alert>
                <Button className="self-start" onClick={() => setDialog("report")}>
                  Hozir kiritish
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Xonadondagi partiyalar" />
          <div className="mt-3 border-t border-line">
            {data.batches.length === 0 ? (
              <EmptyState icon={Bird} title="Hozircha parranda yo‘q" />
            ) : (
              <DataTable
                caption="Xonadondagi partiyalar"
                rows={data.batches}
                columns={batchColumns(setOpenBatch)}
                rowKey={(row) => row.batch_id}
              />
            )}
          </div>
        </Card>
      </div>

      <HouseholdStatsSection path="/my/stats" owner />

      <Card>
        <CardHeader title="So‘nggi hisobotlar" description="Oxirgi 7 ta" />
        <div className="mt-3 border-t border-line">
          {data.recent_reports.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Hisobotlar yo‘q" />
          ) : (
            <DataTable caption="So‘nggi hisobotlar" rows={data.recent_reports} columns={reportColumns()} rowKey={(row) => row.id} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Olingan mahsulotlar" description="Ombordan berilgan, oxirgi 5 ta" />
          <div className="mt-3 border-t border-line">
            {data.received_products.length === 0 ? (
              <EmptyState icon={Package} title="Hali mahsulot berilmagan" />
            ) : (
              <DataTable
                caption="Olingan mahsulotlar"
                rows={data.received_products}
                columns={transactionColumns({ household: false, balance: false })}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </Card>
        <HouseholdLocation household={household} editable={false} />
      </div>

      {dialog === "report" && (
        <DailyReportModal household={household} batches={data.batches} sendHousehold={false} onClose={close} onDone={close} />
      )}
      {dialog === "death" && (
        <MovementModal household={household} types={["DEATH"]} onClose={close} onDone={close} />
      )}
      {openBatch !== null && (
        <OwnerBatchModal batchId={openBatch} onClose={() => setOpenBatch(null)} />
      )}
    </div>
  );
}
