"use client";

import { useState } from "react";
import { ArrowRightLeft, Bird, Plus } from "lucide-react";
import { entries, formatDate, formatNumber, MOVEMENT_TYPE_LABELS, POULTRY_TYPE_LABELS } from "@/lib/format";
import { useDebounced, usePagedApi } from "@/lib/use-api";
import type { Batch, Movement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { BatchModal } from "@/features/batches/batch-modal";
import { movementColumns } from "@/features/movements/movement-columns";
import { MovementModal } from "@/features/movements/movement-modal";

const PAGE_SIZE = 50;
const MOVEMENTS_PAGE_SIZE = 20;

const COLUMNS: Column<Batch>[] = [
  {
    key: "code",
    header: "Partiya",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium tabular-nums">{row.code}</span>
        <span className="text-xs font-normal text-muted">{row.breed}</span>
      </span>
    ),
  },
  { key: "type", header: "Turi", cell: (row) => row.poultry_type_display },
  { key: "initial", header: "Boshlang‘ich", align: "right", cell: (row) => formatNumber(row.initial_quantity) },
  {
    key: "center",
    header: "Markazda",
    align: "right",
    cell: (row) => <span className="font-medium">{formatNumber(row.center_stock)}</span>,
  },
  { key: "distributed", header: "Tarqatilgan", align: "right", cell: (row) => formatNumber(row.distributed_total) },
  {
    key: "deaths",
    header: "Nobud",
    align: "right",
    cell: (row) => (
      <span className={row.deaths_total > 0 ? "text-danger" : undefined}>{formatNumber(row.deaths_total)}</span>
    ),
  },
  { key: "arrived", header: "Kelgan sana", cell: (row) => <span className="tabular-nums">{formatDate(row.arrived_at)}</span> },
  { key: "supplier", header: "Yetkazib beruvchi", hideOnMobile: true, cell: (row) => row.supplier },
  { key: "health", header: "Holati", hideOnMobile: true, cell: (row) => row.health_status || "—" },
];

export default function BatchesPage() {
  const [search, setSearch] = useState("");
  const [poultryType, setPoultryType] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionBatch, setActionBatch] = useState<Batch | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  const batches = usePagedApi<Batch>(
    "/batches",
    {
      search: debouncedSearch,
      poultry_type: poultryType,
    },
    PAGE_SIZE,
  );
  const { page, setPage } = batches;
  const data = batches.data;
  const filtered = Boolean(debouncedSearch || poultryType);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Parranda partiyalari"
        description={data ? `Jami: ${formatNumber(data.count)}` : undefined}
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            Yangi partiya
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_220px] sm:px-6">
          <SearchInput
            id="batches-search"
            label="Qidirish"
            placeholder="Kod, zot yoki yetkazib beruvchi"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <div>
            <label htmlFor="batches-type" className="sr-only">
              Parranda turi
            </label>
            <Select
              id="batches-type"
              value={poultryType}
              onChange={(event) => {
                setPoultryType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha turlar</option>
              {entries(POULTRY_TYPE_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <StaleDataError error={data ? batches.error : null} onRetry={batches.reload} />
        {!data && batches.error ? (
          <ErrorState error={batches.error} onRetry={batches.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Bird}
            title={filtered ? "Hech narsa topilmadi" : "Hali partiyalar yo‘q"}
            description={filtered ? "Qidiruv shartlarini o‘zgartirib ko‘ring." : "Markazga kelgan birinchi partiyani qo‘shing."}
          />
        ) : (
          <>
            <DataTable
              caption="Parranda partiyalari"
              rows={data.results}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              rowHref={(row) => `/batches/${row.id}`}
              stale={batches.loading}
              actions={(row) => (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ArrowRightLeft className="size-3.5" aria-hidden />}
                  onClick={() => setActionBatch(row)}
                  aria-label={`${row.code}: tarqatish, qaytarish, nobud yoki chiqim`}
                >
                  Amal
                </Button>
              )}
            />
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={batches.loading} />
          </>
        )}
      </Card>

      <MovementsHistory />

      {creating && <BatchModal onClose={() => setCreating(false)} onDone={() => setCreating(false)} />}
      {actionBatch && (
        <MovementModal batch={actionBatch} onClose={() => setActionBatch(null)} onDone={() => setActionBatch(null)} />
      )}
    </div>
  );
}

function MovementsHistory() {
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const movements = usePagedApi<Movement>(
    "/movements",
    {
      type,
      date_from: dateFrom,
      date_to: dateTo,
    },
    MOVEMENTS_PAGE_SIZE,
  );
  const { page, setPage } = movements;
  const data = movements.data;
  const filtered = Boolean(type || dateFrom || dateTo);

  return (
    <Card>
      <CardHeader title="Harakatlar tarixi" description="Tarqatish, qaytarish, nobud va chiqim operatsiyalari" />
      <div className="mt-4 grid gap-3 border-y border-line px-4 py-4 sm:grid-cols-3 sm:px-6">
        <div>
          <label htmlFor="movements-type" className="mb-1.5 block text-[13px] text-muted">
            Turi
          </label>
          <Select
            id="movements-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Barchasi</option>
            {entries(MOVEMENT_TYPE_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="movements-from" className="mb-1.5 block text-[13px] text-muted">
            Sanadan
          </label>
          <Input
            id="movements-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor="movements-to" className="mb-1.5 block text-[13px] text-muted">
            Sanagacha
          </label>
          <Input
            id="movements-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <StaleDataError error={data ? movements.error : null} onRetry={movements.reload} />
      {!data && movements.error ? (
        <ErrorState error={movements.error} onRetry={movements.reload} />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : data.results.length === 0 ? (
        <EmptyState icon={ArrowRightLeft} title={filtered ? "Hech narsa topilmadi" : "Hali harakatlar yo‘q"} />
      ) : (
        <>
          <DataTable
            caption="Harakatlar tarixi"
            rows={data.results}
            columns={movementColumns()}
            rowKey={(row) => row.id}
            stale={movements.loading}
          />
          <Pagination
            page={page}
            count={data.count}
            pageSize={MOVEMENTS_PAGE_SIZE}
            onPageChange={setPage}
            disabled={movements.loading}
          />
        </>
      )}
    </Card>
  );
}
