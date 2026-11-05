"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Eye, FileSpreadsheet, FileText, Info, Loader2 } from "lucide-react";
import { apiDownload, toApiError, type Query } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatFixed, formatNumber, formatPercent, POULTRY_TYPE_LABELS, entries } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useCurrentUser } from "@/lib/auth";
import type {
  RegionOption,
  ReportCell,
  ReportColumn,
  ReportDefinition,
  ReportFormat,
  ReportPreview,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { PeriodPicker, useUrlParams } from "@/components/stats/period-picker";
import { householdLabel, useHouseholdOptions } from "../options";

const FILTER_KEYS = ["region", "district", "household", "poultry_type"] as const;
const PLACE_ROLES: ReadonlySet<string> = new Set(["ADMIN", "WAREHOUSE", "VET"]);

/** Cell text in the preview (same rules as the PDF: `—` for empty, `Ha`/`Yo‘q`, DD.MM.YYYY). */
export function formatCell(column: ReportColumn, value: ReportCell | undefined): string {
  if (value === null || value === undefined || value === "") return column.type === "text" ? "" : "—";
  switch (column.type) {
    case "int":
      return formatNumber(Number(value));
    case "decimal":
      return formatFixed(Number(value), column.decimals ?? 2);
    case "percent":
      return formatPercent(Number(value), column.decimals ?? 1);
    case "date":
      return formatDate(String(value));
    case "datetime":
      return formatDateTime(String(value));
    case "bool":
      return value ? "Ha" : "Yo‘q";
    default:
      return String(value);
  }
}

function isNumeric(column: ReportColumn): boolean {
  return column.type === "int" || column.type === "decimal" || column.type === "percent";
}

export function ReportExportCenter() {
  const user = useCurrentUser();
  const params = useSearchParams();
  const setParams = useUrlParams();
  const list = useApi<ReportDefinition[]>("/reports");
  const key = params.get("key");
  const reports = list.data ?? [];
  const selected = reports.find((report) => report.key === key) ?? null;

  if (!list.data && list.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Hisobotlar" description="Excel va PDF hisobotlar" />
        <Card>
          <ErrorState error={list.error} onRetry={list.reload} />
        </Card>
      </div>
    );
  }

  if (selected) {
    return (
      <ReportView
        report={selected}
        onBack={() => setParams({ key: null, ...Object.fromEntries(FILTER_KEYS.map((name) => [name, null])) })}
        canPickPlaces={PLACE_ROLES.has(user.role)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hisobotlar"
        description="Hisobotni tanlang, filtrlarni belgilang va Excel yoki PDF faylini yuklab oling"
      />
      {!list.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState icon={FileSpreadsheet} title="Siz uchun hisobotlar yo‘q" />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Hisobotlar">
          {reports.map((report) => (
            <li key={report.key}>
              <button
                type="button"
                onClick={() => setParams({ key: report.key })}
                className="group flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition-colors hover:border-line-strong hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <FileSpreadsheet className="size-4 shrink-0 text-accent" aria-hidden />
                    {report.title}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Badge tone="success">Excel</Badge>
                    <Badge tone="danger">PDF</Badge>
                  </span>
                </span>
                <span className="text-[13px] text-muted">{report.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportView({
  report,
  onBack,
  canPickPlaces,
}: {
  report: ReportDefinition;
  onBack: () => void;
  canPickPlaces: boolean;
}) {
  const toast = useToast();
  const params = useSearchParams();
  const setParams = useUrlParams();
  const supports = (name: string) => (report.filters as readonly string[]).includes(name);
  const query: Query = useMemo(() => {
    const result: Query = {};
    for (const name of ["date_from", "date_to", ...FILTER_KEYS]) {
      const value = params.get(name);
      if (value && supports(name)) result[name] = value;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, report.key]);
  const preview = useApi<ReportPreview>(`/reports/${report.key}`, { format: "json", ...query });
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  // Region / district / household options come from endpoints only A, W and V may read (V3 §1.2): an owner is
  // forced to the own household and LOGISTICS cannot list households, so they get no place filters.
  const showPlaces = canPickPlaces && (supports("region") || supports("district") || supports("household"));
  const regions = useApi<RegionOption[]>(showPlaces ? "/households/regions" : null);
  const households = useHouseholdOptions(showPlaces && supports("household"));
  const region = params.get("region") ?? "";
  const district = params.get("district") ?? "";
  const districts = useMemo(() => {
    const all = regions.data ?? [];
    const pool = region ? all.filter((item) => item.region === region) : all;
    return Array.from(new Set(pool.flatMap((item) => item.districts))).sort((a, b) => a.localeCompare(b));
  }, [regions.data, region]);
  const householdRows = (households.data?.results ?? []).filter(
    (item) => (!region || item.region === region) && (!district || item.district === district),
  );

  const download = async (format: ReportFormat) => {
    setBusy(format);
    try {
      const name = await apiDownload(`/reports/${report.key}`, { ...query, format }, `${report.key}.${format}`);
      toast.success(`Yuklab olindi: ${name}`);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusy(null);
    }
  };

  const data = preview.data;
  const filterControls = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {showPlaces && supports("region") && (
        <FilterSelect
          id="report-region"
          label="Viloyat"
          value={region}
          onChange={(value) => setParams({ region: value, district: null, household: null })}
          options={(regions.data ?? []).map((item) => ({ value: item.region, label: item.region }))}
          placeholder="Barcha viloyatlar"
        />
      )}
      {showPlaces && supports("district") && (
        <FilterSelect
          id="report-district"
          label="Tuman"
          value={district}
          onChange={(value) => setParams({ district: value, household: null })}
          options={districts.map((item) => ({ value: item, label: item }))}
          placeholder="Barcha tumanlar"
        />
      )}
      {showPlaces && supports("household") && (
        <FilterSelect
          id="report-household"
          label="Xonadon"
          value={params.get("household") ?? ""}
          onChange={(value) => setParams({ household: value })}
          options={householdRows.map((item) => ({ value: String(item.id), label: householdLabel(item) }))}
          placeholder="Barcha xonadonlar"
        />
      )}
      {supports("poultry_type") && (
        <FilterSelect
          id="report-poultry"
          label="Parranda turi"
          value={params.get("poultry_type") ?? ""}
          onChange={(value) => setParams({ poultry_type: value })}
          options={entries(POULTRY_TYPE_LABELS)}
          placeholder="Barcha turlar"
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Hisobotlar", href: "/reports" }, { label: report.title }]}
        title={report.title}
        description={report.description}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onBack}>
              Barcha hisobotlar
            </Button>
            <Button
              variant="secondary"
              icon={busy === "xlsx" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4 text-accent" aria-hidden />}
              disabled={busy !== null}
              onClick={() => void download("xlsx")}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              icon={busy === "pdf" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4 text-danger" aria-hidden />}
              disabled={busy !== null}
              onClick={() => void download("pdf")}
            >
              PDF
            </Button>
          </>
        }
        toolbar={
          <PeriodPicker
            period={data?.period}
            error={preview.error}
            defaultOption={report.key === "monthly_production" ? { label: "Joriy yil" } : { days: 30 }}
          />
        }
      />

      {(showPlaces || supports("poultry_type")) && (
        <Card className="px-4 py-4 sm:px-6">
          {filterControls}
        </Card>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Eye className="size-4 text-muted" aria-hidden />
              Ko‘rish
            </span>
          }
          description={
            data
              ? `${formatNumber(data.row_count)} ta qator · ${formatDate(data.period.date_from)} – ${formatDate(data.period.date_to)}`
              : "Hisobot tayyorlanmoqda…"
          }
          actions={
            <Button variant="secondary" size="sm" onClick={preview.reload} disabled={preview.loading} loading={preview.loading && Boolean(data)}>
              Yangilash
            </Button>
          }
        />
        <div className="mt-3 border-t border-line">
          <StaleDataError error={data ? preview.error : null} onRetry={preview.reload} />
          {!data && preview.error ? (
            <ErrorState error={preview.error} onRetry={preview.reload} />
          ) : !data ? (
            <TableSkeleton rows={6} />
          ) : (
            <PreviewTable data={data} stale={preview.loading} />
          )}
        </div>
      </Card>

      {data && data.summary.length > 0 && (
        <Card>
          <CardHeader title="Xulosa" />
          <dl className="mt-3 grid gap-x-6 gap-y-3 border-t border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {data.summary.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-[13px] text-muted">{item.label}</dt>
                <dd className="break-words font-medium text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function PreviewTable({ data, stale }: { data: ReportPreview; stale: boolean }) {
  if (data.rows.length === 0) {
    return <EmptyState icon={FileSpreadsheet} title="Tanlangan davr va filtrlarda ma’lumot yo‘q" description="Davrni yoki filtrlarni o‘zgartiring." />;
  }
  const hasTotals = Object.keys(data.totals).length > 0;
  return (
    <div className={cn("transition-opacity", stale && "opacity-60")} aria-busy={stale || undefined}>
      {data.truncated && (
        <p className="flex items-center gap-2 border-b border-line bg-warning-soft px-4 py-2 text-[13px] text-warning-ink sm:px-6">
          <Info className="size-4 shrink-0" aria-hidden />
          Faqat birinchi {formatNumber(data.rows.length)} ta qator ko‘rsatildi — to‘liq hisobot Excel/PDF faylida.
        </p>
      )}
      <div className="max-h-[min(70vh,720px)] overflow-auto overscroll-contain">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">{data.title}</caption>
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-primary px-3 py-2 text-xs font-medium text-white first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6",
                    isNumeric(column) ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={index} className="even:bg-subtle">
                {data.columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "border-b border-line px-3 py-2 first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6",
                      isNumeric(column) ? "whitespace-nowrap text-right tabular-nums" : "max-w-[280px] truncate",
                    )}
                    title={column.type === "text" ? String(row[column.key] ?? "") : undefined}
                  >
                    {formatCell(column, row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasTotals && (
            <tfoot>
              <tr>
                {data.columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      "sticky bottom-0 border-t-2 border-primary bg-surface px-3 py-2 font-semibold first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6",
                      isNumeric(column) ? "whitespace-nowrap text-right tabular-nums" : "text-left",
                    )}
                  >
                    {column.key in data.totals ? formatCell(column, data.totals[column.key]) : index === 0 ? "Jami" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
