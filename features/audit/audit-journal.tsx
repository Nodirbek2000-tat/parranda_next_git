"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, FilterX, ScrollText, SlidersHorizontal } from "lucide-react";
import { AUDIT_ACTION_LABELS, AUDIT_MODULE_LABELS, AUDIT_SOURCE_LABELS, auditDiff, auditObjectHref } from "@/lib/audit";
import { cn } from "@/lib/cn";
import { entries, formatDateTime, formatNumber, ROLE_LABELS, todayIso } from "@/lib/format";
import { useAllPages, useDebounced, usePagedApi } from "@/lib/use-api";
import type { AuditLog, HouseholdShort, User } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useUrlParams } from "@/components/stats/period-picker";

const PAGE_SIZE = 50;
const FILTER_KEYS = [
  "module",
  "action",
  "actor",
  "source",
  "status",
  "household",
  "product",
  "date_from",
  "date_to",
  "search",
] as const;

const STATUS_OPTIONS = [
  { value: "SUCCESS", label: "Muvaffaqiyatli" },
  { value: "FAILED", label: "Rad etildi" },
];

const ACTION_TONES: Partial<Record<AuditLog["action"], BadgeTone>> = {
  create: "success",
  update: "neutral",
  login_failure: "danger",
  password_reset: "warning",
  unlink: "warning",
};

/** /audit (contract 6.6): filterable, paginated journal; a row expands to the before / after diff. */
export function AuditJournal() {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as Record<
    (typeof FILTER_KEYS)[number],
    string
  >;
  const [search, setSearch] = useState(filters.search);
  const debouncedSearch = useDebounced(search.trim(), 300);
  useEffect(() => {
    if (debouncedSearch !== filters.search) setParams({ search: debouncedSearch || null });
  }, [debouncedSearch, filters.search, setParams]);

  const users = useAllPages<User>("/users");
  const households = useAllPages<HouseholdShort>("/households");
  const products = useAllPages<{ id: number; name: string }>("/products");
  const dateError =
    filters.date_from && filters.date_to && filters.date_from > filters.date_to
      ? "Boshlanish sanasi tugash sanasidan keyin bo‘lishi mumkin emas."
      : null;

  const logs = usePagedApi<AuditLog>(
    "/audit-logs",
    dateError ? { ...filters, date_from: "", date_to: "" } : filters,
    PAGE_SIZE,
  );
  const { page, setPage } = logs;
  const data = logs.data;
  const filtered = FILTER_KEYS.some((key) => filters[key]);
  const [open, setOpen] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = FILTER_KEYS.filter((key) => key !== "search" && filters[key]).length;

  const update = (key: (typeof FILTER_KEYS)[number]) => (value: string) => {
    setParams({ [key]: value || null });
    setPage(1);
  };

  const reset = () => {
    setSearch("");
    setParams(Object.fromEntries(FILTER_KEYS.map((key) => [key, null])));
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Audit jurnali"
        description={
          data
            ? `Tizimdagi barcha o‘zgarishlar va kirishlar · ${formatNumber(data.count)} ta yozuv`
            : "Tizimdagi barcha o‘zgarishlar va kirishlar"
        }
        actions={
          filtered && (
            <Button variant="secondary" icon={<FilterX className="size-4" aria-hidden />} onClick={reset}>
              Filtrlarni tozalash
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="audit-search" className="mb-1 block text-xs text-muted">
              Qidirish
            </label>
            <SearchInput
              id="audit-search"
              label="Qidirish"
              placeholder="Foydalanuvchi, obyekt, ID yoki IP"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            aria-controls="audit-filters"
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line text-sm text-ink transition-colors hover:bg-subtle sm:hidden"
          >
            <SlidersHorizontal className="size-4 text-muted" aria-hidden />
            Filtrlar
            {activeFilters > 0 && (
              <span className="rounded-md bg-accent-soft px-1.5 text-xs font-medium tabular-nums text-accent">
                {activeFilters}
              </span>
            )}
          </button>
          <div id="audit-filters" className={cn(filtersOpen ? "contents" : "hidden", "sm:contents")}>
            <FilterSelect
              id="audit-module"
              label="Bo‘lim"
              value={filters.module}
              onChange={update("module")}
              options={entries(AUDIT_MODULE_LABELS)}
              all="Barcha bo‘limlar"
            />
            <FilterSelect
              id="audit-action"
              label="Amal"
              value={filters.action}
              onChange={update("action")}
              options={entries(AUDIT_ACTION_LABELS)}
              all="Barcha amallar"
            />
            <FilterSelect
              id="audit-actor"
              label="Foydalanuvchi"
              value={filters.actor}
              onChange={update("actor")}
              options={(users.data?.results ?? []).map((user) => ({
                value: String(user.id),
                label: `${user.full_name} (${user.username})`,
              }))}
              all="Barcha foydalanuvchilar"
            />
            <FilterSelect
              id="audit-source"
              label="Manba"
              value={filters.source}
              onChange={update("source")}
              options={entries(AUDIT_SOURCE_LABELS)}
              all="Barcha manbalar"
            />
            <FilterSelect
              id="audit-status"
              label="Holati"
              value={filters.status}
              onChange={update("status")}
              options={STATUS_OPTIONS}
              all="Barcha holatlar"
            />
            <FilterSelect
              id="audit-household"
              label="Xonadon"
              value={filters.household}
              onChange={update("household")}
              options={(households.data?.results ?? []).map((item) => ({
                value: String(item.id),
                label: `${item.code} · ${item.name}`,
              }))}
              all="Barcha xonadonlar"
            />
            <FilterSelect
              id="audit-product"
              label="Mahsulot"
              value={filters.product}
              onChange={update("product")}
              options={(products.data?.results ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
              all="Barcha mahsulotlar"
            />
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
                Sanadan
                <Input
                  type="date"
                  value={filters.date_from}
                  max={filters.date_to || todayIso()}
                  onChange={(event) => update("date_from")(event.target.value)}
                  invalid={Boolean(dateError)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
                Sanagacha
                <Input
                  type="date"
                  value={filters.date_to}
                  min={filters.date_from || undefined}
                  max={todayIso()}
                  onChange={(event) => update("date_to")(event.target.value)}
                />
              </label>
            </div>
          </div>

          {dateError && (
            <p className="text-[13px] text-danger sm:col-span-2 lg:col-span-4" role="alert">
              {dateError}
            </p>
          )}
        </div>

        <StaleDataError error={data ? logs.error : null} onRetry={logs.reload} />
        {!data && logs.error ? (
          <ErrorState error={logs.error} onRetry={logs.reload} />
        ) : !data ? (
          <TableSkeleton rows={8} />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={filtered ? "Filtrlarga mos yozuv topilmadi" : "Jurnalda hali yozuv yo‘q"}
          />
        ) : (
          <div className={cn("transition-opacity", logs.loading && "opacity-60")} aria-busy={logs.loading || undefined}>
            <AuditTable
              rows={data.results}
              open={open}
              onToggle={(id) => setOpen((current) => (current === id ? null : id))}
            />
            <Pagination
              page={page}
              count={data.count}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={logs.loading}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  all,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  all: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ActorCell({ row }: { row: AuditLog }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-ink">{row.actor?.full_name ?? (row.actor_name || "—")}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {row.role ? ROLE_LABELS[row.role] : "Noma’lum"}
      </span>
    </span>
  );
}

function ObjectCell({ row }: { row: AuditLog }) {
  const href = auditObjectHref(row.object_type, row.object_id);
  const text = row.object_repr || row.object_type || "—";
  return (
    <span className="flex min-w-0 flex-col">
      {href ? (
        <Link href={href} className="break-words text-ink hover:text-accent hover:underline xl:truncate">
          {text}
        </Link>
      ) : (
        <span className="break-words text-ink xl:truncate">{text}</span>
      )}
      {row.op_id && <span className="text-xs tabular-nums text-muted">{row.op_id}</span>}
    </span>
  );
}

function ActionBadge({ row }: { row: AuditLog }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={ACTION_TONES[row.action] ?? "neutral"}>{row.action_display || AUDIT_ACTION_LABELS[row.action]}</Badge>
      {row.status === "FAILED" && row.action !== "login_failure" && (
        <Badge tone="danger">{row.status_display || "Rad etildi"}</Badge>
      )}
    </span>
  );
}

function AuditTable({
  rows,
  open,
  onToggle,
}: {
  rows: AuditLog[];
  open: number | null;
  onToggle: (id: number) => void;
}) {
  return (
    <>
      {/* Table from 1280 px (the sidebar takes 256 px); narrower screens get the card list. */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Audit jurnali</caption>
          <thead>
            <tr>
              {/* The expand toggle comes first so it is reachable even if the table scrolls sideways. */}
              <th scope="col" className="sticky top-0 z-[1] h-10 w-12 border-b border-line bg-surface pl-4">
                <span className="sr-only">O‘zgarishlar</span>
              </th>
              {["Vaqt", "Foydalanuvchi", "Manba", "Bo‘lim", "Amal", "Obyekt", "IP"].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-line bg-surface px-3 text-left text-xs font-medium text-muted last:pr-6"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = open === row.id;
              const cell = cn(
                "border-b border-line px-3 py-2.5 align-middle last:pr-6",
                expanded && "border-b-0 bg-subtle",
              );
              return (
                <Fragment key={row.id}>
                  <tr className="transition-colors hover:bg-subtle">
                    <td className={cn(cell, "w-12 pl-4 pr-0")}>
                      <ExpandButton expanded={expanded} onClick={() => onToggle(row.id)} controls={`audit-diff-${row.id}`} />
                    </td>
                    <td className={cn(cell, "whitespace-nowrap tabular-nums")}>{formatDateTime(row.created_at)}</td>
                    <td className={cn(cell, "max-w-48")}>
                      <ActorCell row={row} />
                    </td>
                    <td className={cn(cell, "whitespace-nowrap text-muted")}>
                      {AUDIT_SOURCE_LABELS[row.source] ?? row.source}
                    </td>
                    <td className={cell}>
                      {row.module_display || AUDIT_MODULE_LABELS[row.module]}
                    </td>
                    <td className={cell}>
                      <ActionBadge row={row} />
                    </td>
                    <td className={cn(cell, "max-w-60")}>
                      <ObjectCell row={row} />
                    </td>
                    <td className={cn(cell, "whitespace-nowrap tabular-nums text-muted")}>{row.ip ?? "—"}</td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={8} className="border-b border-line bg-subtle px-6 pb-4 pt-1">
                        <DiffView row={row} domId={`audit-diff-${row.id}`} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line xl:hidden" aria-label="Audit jurnali">
        {rows.map((row) => {
          const expanded = open === row.id;
          return (
            <li key={row.id} className={cn("px-4 py-3", expanded && "bg-subtle")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge row={row} />
                    <span className="text-[13px] text-muted">
                      {row.module_display || AUDIT_MODULE_LABELS[row.module]}
                    </span>
                  </div>
                  <ObjectCell row={row} />
                  <p className="text-xs text-muted">
                    <span className="tabular-nums">{formatDateTime(row.created_at)}</span> ·{" "}
                    {row.actor?.full_name ?? (row.actor_name || "—")} · {AUDIT_SOURCE_LABELS[row.source] ?? row.source}
                    {row.ip && <span className="tabular-nums"> · {row.ip}</span>}
                  </p>
                </div>
                <ExpandButton expanded={expanded} onClick={() => onToggle(row.id)} controls={`audit-diff-m-${row.id}`} />
              </div>
              {expanded && (
                <div className="mt-3">
                  <DiffView row={row} domId={`audit-diff-m-${row.id}`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ExpandButton({ expanded, onClick, controls }: { expanded: boolean; onClick: () => void; controls: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? "O‘zgarishlarni yopish" : "O‘zgarishlarni ko‘rish"}
      aria-controls={expanded ? controls : undefined}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink"
    >
      <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
    </button>
  );
}

/** "Maydon | Oldin | Keyin"; a create shows only "Keyin". */
/** The table (md+) and the card list (phones) each render it, so each passes its own DOM id. */
function DiffView({ row, domId }: { row: AuditLog; domId: string }) {
  const diff = auditDiff(row.before, row.after);
  const onlyAfter = row.before === null;
  if (diff.length === 0) {
    return (
      <p id={domId} className="text-[13px] text-muted">
        Qo‘shimcha ma’lumot yo‘q.
      </p>
    );
  }
  return (
    <div id={domId} className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-[13px]">
        <caption className="sr-only">O‘zgarishlar: {row.object_repr}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-3 py-2 font-medium">
              Maydon
            </th>
            {!onlyAfter && (
              <th scope="col" className="px-3 py-2 font-medium">
                Oldin
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-medium">
              Keyin
            </th>
          </tr>
        </thead>
        <tbody>
          {diff.map((item) => (
            <tr key={item.key} className="border-b border-line last:border-b-0 align-top">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal text-muted">
                {item.label}
              </th>
              {!onlyAfter && (
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "break-words",
                      item.changed && "rounded bg-danger-soft px-1 text-danger line-through decoration-danger/40",
                    )}
                  >
                    {item.before}
                  </span>
                </td>
              )}
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "break-words text-ink",
                    item.changed && !onlyAfter && "rounded bg-accent-soft px-1 text-accent",
                  )}
                >
                  {item.after}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
