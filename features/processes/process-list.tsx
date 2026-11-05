"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Play, Workflow } from "lucide-react";
import { api, toApiError, type FieldErrors } from "@/lib/api";
import type { HouseholdRef, ProcessRun, ProcessRunStatus } from "@/lib/builder-types";
import { formatDateTime } from "@/lib/format";
import { usePagedApi } from "@/lib/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useUrlParams } from "@/components/stats/period-picker";
import { useUsableBlueprints } from "../work/blueprints";
import { HouseholdPicker } from "../work/pickers";
import { PROCESS_STATUS } from "../work/status";

const PAGE_SIZE = 30;
const STATUSES = Object.keys(PROCESS_STATUS) as ProcessRunStatus[];

function currentStage(row: ProcessRun): string {
  const stages = row.stages ?? [];
  if (stages.length === 0) return "—";
  if (row.status === "DONE") return `${stages.length}/${stages.length} · yakunlandi`;
  const stage = stages[row.current_index];
  return `${Math.min(row.current_index + 1, stages.length)}/${stages.length}${stage ? ` · ${stage.title}` : ""}`;
}

const COLUMNS: Column<ProcessRun>[] = [
  {
    key: "code",
    header: "Jarayon",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.process_name}</span>
          {row.is_test && <Badge tone="warning">Test</Badge>}
        </span>
        <span className="text-xs font-normal tabular-nums text-muted">{row.code}</span>
      </span>
    ),
  },
  {
    key: "household",
    header: "Xonadon",
    cell: (row) =>
      row.household ? (
        <span className="flex flex-col">
          <span>{row.household.name}</span>
          <span className="text-xs tabular-nums text-muted">{row.household.code}</span>
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  { key: "stage", header: "Bosqich", cell: currentStage },
  {
    key: "status",
    header: "Holat",
    cell: (row) => <StatusBadge map={PROCESS_STATUS} status={row.status} label={row.status_display} />,
  },
  {
    key: "started",
    header: "Boshlangan",
    align: "right",
    hideOnMobile: true,
    cell: (row) => <span className="tabular-nums text-muted">{formatDateTime(row.started_at)}</span>,
  },
];

/** /processes — process runs (ADMIN, API_CONTRACT_V4 §3.3). */
export function ProcessList() {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const [starting, setStarting] = useState(false);
  const statusParam = params.get("status") ?? "";
  const status = STATUSES.includes(statusParam as ProcessRunStatus) ? statusParam : "";
  const list = usePagedApi<ProcessRun>("/process-runs", { status }, PAGE_SIZE);
  const data = list.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jarayonlar"
        description="Bosqichma-bosqich ishlar: har bosqich vazifasi tasdiqlangach keyingisi boshlanadi"
        actions={
          <Button icon={<Play className="size-4" aria-hidden />} onClick={() => setStarting(true)}>
            Jarayonni boshlash
          </Button>
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <label htmlFor="process-status" className="sr-only">
            Holat
          </label>
          <Select
            id="process-status"
            className="sm:max-w-60"
            value={status}
            onChange={(event) => {
              list.setPage(1);
              setParams({ status: event.target.value || null });
            }}
          >
            <option value="">Barcha holatlar</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {PROCESS_STATUS[value].label}
              </option>
            ))}
          </Select>
        </div>
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={status ? "Bu holatda jarayon yo‘q" : "Jarayonlar hali boshlanmagan"}
            description={status ? undefined : "“Jarayonni boshlash” tugmasi bilan faol jarayon shablonini ishga tushiring."}
          />
        ) : (
          <>
            <DataTable
              caption="Jarayonlar"
              rows={data.results}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              rowHref={(row) => `/processes/${row.id}`}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </Card>

      {starting && <ProcessStartModal onClose={() => setStarting(false)} />}
    </div>
  );
}

/** “Jarayonni boshlash” (ADMIN): process blueprint + household → `POST /api/process-runs`. */
export function ProcessStartModal({ onClose, household: initialHousehold = null }: { onClose: () => void; household?: HouseholdRef | null }) {
  const router = useRouter();
  const toast = useToast();
  const prefix = useId();
  const processes = useUsableBlueprints("process");
  const [processId, setProcessId] = useState("");
  const [household, setHousehold] = useState<HouseholdRef | null>(initialHousehold);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = processes.items.find((item) => String(item.id) === processId);
  const noProcesses = !processes.loading && !processes.error && processes.items.length === 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!processId) {
      setErrors({ process_id: "Jarayon shablonini tanlang." });
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const run = await api.post<ProcessRun>("/process-runs", { process_id: Number(processId), household_id: household?.id ?? null });
      toast.success(`Jarayon boshlandi: ${run.code}`);
      onClose();
      router.push(`/processes/${run.id}`);
    } catch (caught) {
      const failure = toApiError(caught);
      setErrors(failure.fields);
      const shown = ["process_id", "household_id"].some((key) => key in failure.fields);
      setFormError(shown ? null : failure.message);
      setPending(false);
    }
  };

  return (
    <Modal
      title="Jarayonni boshlash"
      description="Birinchi bosqich vazifasi darhol yaratiladi va ijrochilarga xabar boradi."
      onClose={onClose}
      onSubmit={submit}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending} disabled={!!processes.error || noProcesses} icon={<Play className="size-4" aria-hidden />}>
            Boshlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {processes.error ? (
          <Alert tone={processes.error.status === 403 ? "warning" : "danger"}>
            {processes.error.status === 403
              ? "Jarayon shablonlarini ko‘rishga ruxsatingiz yo‘q. Shablonlar Super Admin tomonidan Konstruktorda sozlanadi."
              : processes.error.message}
          </Alert>
        ) : noProcesses ? (
          <Alert tone="info">Faol jarayon shablonlari yo‘q. Super Admin Konstruktorda jarayon yaratib, faollashtirishi kerak.</Alert>
        ) : null}
        <Field label="Jarayon" htmlFor={`${prefix}-process`} required error={errors.process_id}>
          <Select
            id={`${prefix}-process`}
            value={processId}
            invalid={Boolean(errors.process_id)}
            disabled={processes.loading || !!processes.error}
            onChange={(event) => {
              setProcessId(event.target.value);
              setErrors({});
            }}
          >
            <option value="">{processes.loading ? "Yuklanmoqda…" : "Jarayonni tanlang"}</option>
            {processes.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.status === "test" ? " (test)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {selected?.description && <p className="-mt-2 text-[13px] text-muted">{selected.description}</p>}
        {selected?.status === "test" && <p className="-mt-2 text-[13px] text-warning-ink">Test shablon: jarayon test sifatida yuritiladi.</p>}
        <Field
          label="Xonadon"
          htmlFor={`${prefix}-household`}
          error={errors.household_id}
          hint="Bosqich vazifalari xonadon talab qilsa, majburiy."
        >
          <HouseholdPicker
            id={`${prefix}-household`}
            value={household}
            invalid={Boolean(errors.household_id)}
            onChange={(value) => {
              setHousehold(value);
              setErrors({});
            }}
          />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}
