"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, CheckCheck, ClipboardList, Eye, Pencil, Pill, Stethoscope, Syringe, Bug, Trash2 } from "lucide-react";
import type { Query } from "@/lib/api";
import { formatDate, formatNumber, formatQuantity } from "@/lib/format";
import { DISEASE_STATUS, HEALTH_STATUS, VET_VISIT_STATUS } from "@/lib/status";
import { usePagedApi } from "@/lib/use-api";
import type { DiseaseRecord, Treatment, Vaccination, VetVisit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUrlParams } from "@/components/stats/period-picker";
import { DiseaseDetailModal } from "./disease-detail";
import { TreatmentUpdateModal, VaccinationCompleteModal, VaccinationFormModal } from "./forms";
import { HouseholdLink, PlannedDate, ReasonModal, useVetRole, vetName } from "./shared";
import { useVetDelete } from "./use-vet-delete";

const PAGE_SIZE = 20;

/* ------------------------------------------------------------ list shell */

interface ListShellProps<T> {
  path: string;
  query: Query;
  caption: string;
  columns: readonly Column<T>[];
  emptyTitle: string;
  emptyIcon: typeof Stethoscope;
  rowHref?: (row: T) => string;
  actions?: (row: T) => ReactNode;
  toolbar?: ReactNode;
  filtered: boolean;
}

function ListShell<T extends { id: number }>({
  path,
  query,
  caption,
  columns,
  emptyTitle,
  emptyIcon,
  rowHref,
  actions,
  toolbar,
  filtered,
}: ListShellProps<T>) {
  const list = usePagedApi<T>(path, query, PAGE_SIZE);
  const data = list.data;
  return (
    <Card>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">{toolbar}</div>}
      <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
      {!data && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : data.results.length === 0 ? (
        <EmptyState icon={emptyIcon} title={filtered ? "Hech narsa topilmadi" : emptyTitle} />
      ) : (
        <>
          <DataTable caption={caption} rows={data.results} columns={columns} rowKey={(row) => row.id} rowHref={rowHref} actions={actions} stale={list.loading} />
          <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
        </>
      )}
    </Card>
  );
}

/** Status / overdue / “mine” filters kept in the URL (V3 §15.3). `embedded` lists (household page) skip them. */
function useListFilters(embedded: boolean) {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const status = embedded ? "" : (params.get("status") ?? "");
  const overdue = !embedded && params.get("overdue") === "1";
  const mine = !embedded && params.get("mine") === "1";
  return { status, overdue, mine, setParams, filtered: Boolean(status || overdue || mine) };
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "inline-flex h-8 items-center rounded-full px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
        (active ? "bg-primary text-white" : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function StatusFilter({ value, options, onChange, id }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; id: string }) {
  return (
    <div className="w-full sm:w-48">
      <label htmlFor={id} className="sr-only">
        Holat
      </label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 text-[13px]">
        <option value="">Barcha holatlar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

const PLAN_STATUS_OPTIONS = [
  { value: "PLANNED", label: "Rejalashtirilgan" },
  { value: "DONE", label: "O‘tkazildi" },
  { value: "CANCELLED", label: "Bekor qilindi" },
];

/* ---------------------------------------------------------------- visits */

export function VisitList({ householdId, embedded = false }: { householdId?: number; embedded?: boolean }) {
  const { isVet } = useVetRole();
  const { canDelete, deleteVisit } = useVetDelete();
  const filters = useListFilters(embedded);
  const query: Query = {
    household: householdId,
    status: filters.status || undefined,
    overdue: filters.overdue ? 1 : undefined,
    vet: filters.mine ? "me" : undefined,
  };
  const columns: Column<VetVisit>[] = [
    {
      key: "code",
      header: "Tekshiruv",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{row.code}</span>
          <span className="line-clamp-1 text-xs font-normal text-muted">{row.purpose}</span>
        </span>
      ),
    },
    ...(householdId ? [] : [{ key: "household", header: "Xonadon", cell: (row: VetVisit) => <HouseholdLink household={row.household} /> }]),
    { key: "date", header: "Sana", cell: (row) => <PlannedDate date={row.planned_date} overdue={row.is_overdue} /> },
    { key: "vet", header: "Veterinar", hideOnMobile: true, cell: (row) => vetName(row.vet) },
    {
      key: "status",
      header: "Holat",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge map={VET_VISIT_STATUS} status={row.status} label={row.status_display} />
          {row.health_status && <StatusBadge map={HEALTH_STATUS} status={row.health_status} label={row.health_status_display ?? undefined} />}
        </span>
      ),
    },
  ];
  return (
    <ListShell<VetVisit>
      path="/vet/visits"
      query={query}
      caption="Tekshiruvlar"
      columns={columns}
      emptyTitle="Tekshiruvlar hali rejalashtirilmagan"
      emptyIcon={Stethoscope}
      rowHref={(row) => `/vet/visits/${row.id}`}
      actions={(row) =>
        canDelete(row) ? (
          <IconButton label={`${row.code}: o‘chirish`} tone="quiet-danger" onClick={() => deleteVisit(row)}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        ) : null
      }
      filtered={filters.filtered}
      toolbar={
        embedded ? undefined : (
          <>
            <StatusFilter id="visit-status" value={filters.status} options={PLAN_STATUS_OPTIONS} onChange={(value) => filters.setParams({ status: value })} />
            <FilterChip active={filters.overdue} onClick={() => filters.setParams({ overdue: filters.overdue ? null : "1" })}>
              Muddati o‘tgan
            </FilterChip>
            {isVet && (
              <FilterChip active={filters.mine} onClick={() => filters.setParams({ mine: filters.mine ? null : "1" })}>
                Faqat meniki
              </FilterChip>
            )}
          </>
        )
      }
    />
  );
}

/* ---------------------------------------------------------- vaccinations */

type VaccinationDialog = { kind: "complete" | "edit" | "cancel"; row: Vaccination } | null;

export function VaccinationList({ householdId, batchId, embedded = false }: { householdId?: number; batchId?: number; embedded?: boolean }) {
  const { isVet } = useVetRole();
  const { canDelete, deleteVaccination } = useVetDelete();
  const filters = useListFilters(embedded);
  const params = useSearchParams();
  const [dialog, setDialog] = useState<VaccinationDialog>(null);
  const day = embedded ? "" : (params.get("day") ?? "");
  const query: Query = {
    household: householdId,
    batch: batchId,
    status: filters.status || undefined,
    overdue: filters.overdue ? 1 : undefined,
    vet: filters.mine ? "me" : undefined,
    date_from: day || undefined,
    date_to: day || undefined,
  };
  const columns: Column<Vaccination>[] = [
    {
      key: "vaccine",
      header: "Emlash",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.vaccine_name}</span>
          <span className="text-xs font-normal tabular-nums text-muted">
            {row.code}
            {row.dose ? ` · ${row.dose}` : ""}
          </span>
        </span>
      ),
    },
    ...(householdId ? [] : [{ key: "household", header: "Xonadon", cell: (row: Vaccination) => <HouseholdLink household={row.household} /> }]),
    { key: "date", header: "Reja", cell: (row) => <PlannedDate date={row.planned_date} overdue={row.is_overdue} /> },
    {
      key: "birds",
      header: "Parranda",
      align: "right",
      cell: (row) =>
        row.status === "DONE"
          ? `${formatNumber(row.birds_vaccinated)} emlandi`
          : row.birds_planned
            ? formatNumber(row.birds_planned)
            : "—",
    },
    {
      key: "used",
      header: "Sarf",
      hideOnMobile: true,
      cell: (row) =>
        row.quantity_used !== null && row.product ? (
          <span className="tabular-nums">
            {formatQuantity(row.quantity_used, row.product.unit)}
            {row.stock_op_id && <span className="ml-1 text-xs text-muted">{row.stock_op_id}</span>}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Holat",
      cell: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge map={VET_VISIT_STATUS} status={row.status} label={row.status_display} />
          {row.done_date && <span className="text-xs text-muted">{formatDate(row.done_date)}</span>}
        </span>
      ),
    },
  ];
  return (
    <>
      <ListShell<Vaccination>
        path="/vet/vaccinations"
        query={query}
        caption="Emlashlar"
        columns={columns}
        emptyTitle="Emlashlar hali rejalashtirilmagan"
        emptyIcon={Syringe}
        filtered={filters.filtered || Boolean(day)}
        actions={(row) => (
          <>
            {row.allowed_actions.includes("complete") && (
              <IconButton label={`${row.code}: natijani kiritish`} onClick={() => setDialog({ kind: "complete", row })}>
                <CheckCheck className="size-4" aria-hidden />
              </IconButton>
            )}
            {row.allowed_actions.includes("update") && (
              <IconButton label={`${row.code}: tahrirlash`} onClick={() => setDialog({ kind: "edit", row })}>
                <Pencil className="size-4" aria-hidden />
              </IconButton>
            )}
            {row.allowed_actions.includes("cancel") && (
              <IconButton label={`${row.code}: bekor qilish`} tone="quiet-danger" onClick={() => setDialog({ kind: "cancel", row })}>
                <Ban className="size-4" aria-hidden />
              </IconButton>
            )}
            {canDelete(row) && (
              <IconButton label={`${row.code}: o‘chirish`} tone="quiet-danger" onClick={() => deleteVaccination(row)}>
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            )}
          </>
        )}
        toolbar={
          embedded ? undefined : (
            <>
              <StatusFilter id="vaccination-status" value={filters.status} options={PLAN_STATUS_OPTIONS} onChange={(value) => filters.setParams({ status: value })} />
              <FilterChip active={filters.overdue} onClick={() => filters.setParams({ overdue: filters.overdue ? null : "1" })}>
                Muddati o‘tgan
              </FilterChip>
              {isVet && (
                <FilterChip active={filters.mine} onClick={() => filters.setParams({ mine: filters.mine ? null : "1" })}>
                  Faqat meniki
                </FilterChip>
              )}
              {day && (
                <FilterChip active onClick={() => filters.setParams({ day: null })}>
                  {formatDate(day)} ✕
                </FilterChip>
              )}
            </>
          )
        }
      />
      {dialog?.kind === "complete" && <VaccinationCompleteModal vaccination={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <VaccinationFormModal vaccination={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog?.kind === "cancel" && (
        <ReasonModal
          title="Emlashni bekor qilish"
          description={`${dialog.row.code} · ${dialog.row.vaccine_name} · ${dialog.row.household.name}. Veterinar va xonadon egasiga xabar boradi.`}
          path={`/vet/vaccinations/${dialog.row.id}/cancel`}
          success="Emlash bekor qilindi"
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- diseases */

const DISEASE_STATUS_OPTIONS = [
  { value: "OPEN", label: "Aniqlangan" },
  { value: "TREATMENT", label: "Davolanmoqda" },
  { value: "RESOLVED", label: "Tuzaldi" },
];

export function DiseaseList({ householdId, embedded = false }: { householdId?: number; embedded?: boolean }) {
  const filters = useListFilters(embedded);
  const { canDelete, deleteDisease } = useVetDelete();
  const params = useSearchParams();
  const active = !embedded && params.get("active") === "1";
  const [openId, setOpenId] = useState<number | null>(null);
  const query: Query = { household: householdId, status: filters.status || undefined, active: active ? 1 : undefined };
  const columns: Column<DiseaseRecord>[] = [
    {
      key: "name",
      header: "Kasallik",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.disease_name}</span>
          <span className="text-xs font-normal tabular-nums text-muted">
            {row.code} · {formatDate(row.diagnosed_date)}
          </span>
        </span>
      ),
    },
    ...(householdId ? [] : [{ key: "household", header: "Xonadon", cell: (row: DiseaseRecord) => <HouseholdLink household={row.household} /> }]),
    { key: "cases", header: "Holatlar", align: "right", cell: (row) => formatNumber(row.cases) },
    {
      key: "deaths",
      header: "Nobud (shundan beri)",
      align: "right",
      cell: (row) => <span className={row.deaths_since_diagnosis > 0 ? "font-medium text-danger" : undefined}>{formatNumber(row.deaths_since_diagnosis)}</span>,
    },
    { key: "status", header: "Holat", cell: (row) => <StatusBadge map={DISEASE_STATUS} status={row.status} label={row.status_display} /> },
  ];
  return (
    <>
      <ListShell<DiseaseRecord>
        path="/vet/diseases"
        query={query}
        caption="Kasalliklar"
        columns={columns}
        emptyTitle="Kasallik qayd etilmagan"
        emptyIcon={Bug}
        filtered={filters.filtered || active}
        actions={(row) => (
          <>
            <IconButton label={`${row.code}: batafsil va davolash`} onClick={() => setOpenId(row.id)}>
              <Eye className="size-4" aria-hidden />
            </IconButton>
            {canDelete(row) && (
              <IconButton label={`${row.code}: o‘chirish`} tone="quiet-danger" onClick={() => deleteDisease(row)}>
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            )}
          </>
        )}
        toolbar={
          embedded ? undefined : (
            <>
              <StatusFilter id="disease-status" value={filters.status} options={DISEASE_STATUS_OPTIONS} onChange={(value) => filters.setParams({ status: value, active: null })} />
              <FilterChip active={active} onClick={() => filters.setParams({ active: active ? null : "1", status: null })}>
                Faqat ochiqlar
              </FilterChip>
            </>
          )
        }
      />
      {openId !== null && <DiseaseDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ----------------------------------------------------------- treatments */

export function TreatmentList({ householdId, embedded = false }: { householdId?: number; embedded?: boolean }) {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const active = !embedded && params.get("active") === "1";
  const [editing, setEditing] = useState<Treatment | null>(null);
  const query: Query = { household: householdId, active: active ? 1 : undefined };
  const columns: Column<Treatment>[] = [
    {
      key: "drug",
      header: "Preparat",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.drug_name}</span>
          <span className="text-xs font-normal text-muted">
            {row.code}
            {row.dosage ? ` · ${row.dosage}` : ""}
          </span>
        </span>
      ),
    },
    ...(householdId ? [] : [{ key: "household", header: "Xonadon", cell: (row: Treatment) => <HouseholdLink household={row.household} /> }]),
    { key: "disease", header: "Kasallik", hideOnMobile: true, cell: (row) => row.disease?.disease_name ?? "Profilaktika" },
    {
      key: "period",
      header: "Muddat",
      cell: (row) => (
        <span className="tabular-nums">
          {formatDate(row.start_date)}
          {row.end_date ? ` – ${formatDate(row.end_date)}` : ""}
        </span>
      ),
    },
    {
      key: "state",
      header: "Holat",
      cell: (row) => (row.is_active ? <Badge tone="warning">Davom etmoqda</Badge> : <Badge>Tugagan</Badge>),
    },
  ];
  return (
    <>
      <ListShell<Treatment>
        path="/vet/treatments"
        query={query}
        caption="Davolash"
        columns={columns}
        emptyTitle="Davolash yozuvlari yo‘q"
        emptyIcon={Pill}
        filtered={active}
        actions={(row) =>
          row.allowed_actions.includes("update") ? (
            <IconButton label={`${row.code}: tahrirlash`} onClick={() => setEditing(row)}>
              <Pencil className="size-4" aria-hidden />
            </IconButton>
          ) : null
        }
        toolbar={
          embedded ? undefined : (
            <FilterChip active={active} onClick={() => setParams({ active: active ? null : "1" })}>
              Faqat davom etayotganlar
            </FilterChip>
          )
        }
      />
      {editing && <TreatmentUpdateModal treatment={editing} onClose={() => setEditing(null)} onDone={() => setEditing(null)} />}
    </>
  );
}

export const LIST_ICONS = { visits: Stethoscope, vaccinations: Syringe, diseases: Bug, treatments: ClipboardList } as const;
