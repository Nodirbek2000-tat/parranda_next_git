"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, CheckCircle2, Hand, MessageSquareHeart, Paperclip } from "lucide-react";
import { api } from "@/lib/api";
import { collect, useForm } from "@/lib/form";
import { formatDateTime } from "@/lib/format";
import { VET_REQUEST_STATUS } from "@/lib/status";
import { useApi, usePagedApi } from "@/lib/use-api";
import type { VetRequest, VetSummary } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useUrlParams } from "@/components/stats/period-picker";
import { VisitFormModal } from "./forms";
import { HouseholdLink, Info, TextBlock, useVetRole, vetName } from "./shared";

const PAGE_SIZE = 20;
const TAB_KEYS = ["NEW", "IN_PROGRESS", "CLOSED", "ALL"] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** /vet/requests — owner requests “Veterinarga murojaat” for VET and ADMIN (V3 §8.5, §15.3). */
export function VetRequestsPage() {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const summary = useApi<VetSummary>("/vet/summary");
  const raw = params.get("status") ?? "NEW";
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(raw) ? (raw as TabKey) : "NEW";
  const openParam = Number(params.get("open") ?? "");
  const openId = Number.isInteger(openParam) && openParam > 0 ? openParam : null;
  const list = usePagedApi<VetRequest>("/vet/requests", { status: tab === "ALL" ? undefined : tab }, PAGE_SIZE);
  const data = list.data;
  const counts = summary.data?.requests;

  const columns: Column<VetRequest>[] = [
    {
      key: "household",
      header: "Xonadon",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.household.name}</span>
          <span className="text-xs font-normal tabular-nums text-muted">
            {row.code} · {formatDateTime(row.created_at)}
          </span>
        </span>
      ),
    },
    {
      key: "text",
      header: "Murojaat",
      className: "max-w-[420px]",
      cell: (row) => (
        <span className="flex items-start gap-1.5">
          <span className="line-clamp-2 text-[13px] text-ink">{row.text}</span>
          {row.files.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted" title="Rasmlar">
              <Paperclip className="size-3" aria-hidden />
              {row.files.length}
            </span>
          )}
        </span>
      ),
    },
    { key: "vet", header: "Veterinar", hideOnMobile: true, cell: (row) => (row.vet ? row.vet.full_name : "—") },
    { key: "status", header: "Holat", cell: (row) => <StatusBadge map={VET_REQUEST_STATUS} status={row.status} label={row.status_display} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Veterinariya", href: "/vet" }, { label: "Murojaatlar" }]}
        title="Murojaatlar"
        description="Xonadon egalarining veterinarga murojaatlari: ko‘rib chiqish, javob berish va tekshiruv rejalashtirish"
      />
      <Tabs
        items={[
          { key: "NEW", label: "Yangi", count: counts?.new },
          { key: "IN_PROGRESS", label: "Ko‘rib chiqilmoqda", count: counts?.in_progress },
          { key: "CLOSED", label: "Yopilgan" },
          { key: "ALL", label: "Barchasi" },
        ]}
        value={tab}
        onChange={(next) => {
          list.setPage(1);
          setParams({ status: next === "NEW" ? null : next });
        }}
        label="Murojaat holati"
      />
      <Card>
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState icon={MessageSquareHeart} title={tab === "NEW" ? "Yangi murojaat yo‘q" : "Murojaatlar yo‘q"} />
        ) : (
          <>
            <DataTable
              caption="Murojaatlar"
              rows={data.results}
              columns={columns}
              rowKey={(row) => row.id}
              rowHref={(row) => `/vet/requests?${new URLSearchParams({ ...(tab === "NEW" ? {} : { status: tab }), open: String(row.id) })}`}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </Card>
      {openId !== null && <RequestDetailModal id={openId} onClose={() => setParams({ open: null })} />}
    </div>
  );
}

type Step = "view" | "take" | "close" | "plan";

export function RequestDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useApi<VetRequest>(`/vet/requests/${id}`);
  const [step, setStep] = useState<Step>("view");
  const { isOwner } = useVetRole();
  const row = detail.data;

  if (row && step === "plan") {
    return (
      <VisitFormModal
        household={row.household}
        requestId={row.id}
        initialPurpose={`Murojaat ${row.code} bo‘yicha ko‘rik`}
        onClose={() => setStep("view")}
        onDone={() => setStep("view")}
      />
    );
  }
  if (row && (step === "take" || step === "close")) {
    return <ResponseModal request={row} mode={step} onClose={() => setStep("view")} onDone={() => setStep("view")} />;
  }

  const actions = row?.allowed_actions ?? [];
  return (
    <Modal
      title={row ? `Murojaat ${row.code}` : "Murojaat"}
      description={row ? formatDateTime(row.created_at) : undefined}
      onClose={onClose}
      size="lg"
      footer={
        row && actions.length > 0 && !isOwner ? (
          <>
            {actions.includes("plan_visit") && (
              <Button variant="secondary" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setStep("plan")}>
                Tekshiruv rejalashtirish
              </Button>
            )}
            {actions.includes("take") && (
              <Button variant="secondary" icon={<Hand className="size-4" aria-hidden />} onClick={() => setStep("take")}>
                Ko‘rib chiqish
              </Button>
            )}
            {actions.includes("close") && (
              <Button icon={<CheckCircle2 className="size-4" aria-hidden />} onClick={() => setStep("close")}>
                Javob berib yopish
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!row ? (
        detail.error ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : (
          <TableSkeleton rows={3} />
        )
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Info label="Xonadon" value={<HouseholdLink household={row.household} owner={isOwner} />} />
            <Info label="Holat" value={<StatusBadge map={VET_REQUEST_STATUS} status={row.status} label={row.status_display} />} />
            <Info label="Yuborgan" value={row.created_by?.full_name} />
            <Info label="Veterinar" value={row.vet ? vetName(row.vet) : "—"} />
            {row.closed_at && <Info label="Yopilgan" value={`${formatDateTime(row.closed_at)}${row.closed_by ? ` · ${row.closed_by.full_name}` : ""}`} wide />}
          </dl>
          <TextBlock title="Murojaat matni" text={row.text} />
          {row.files.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Rasmlar</p>
              <AttachmentList files={row.files} />
            </div>
          )}
          {row.response ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft/50 px-3 py-2.5">
              <TextBlock title="Javob" text={row.response} />
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function ResponseModal({ request, mode, onClose, onDone }: { request: VetRequest; mode: "take" | "close"; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const form = useForm({ response: request.response });
  const closing = mode === "close";
  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["response", closing && values.response.trim().length < 3 ? "Javobni yozing (kamida 3 ta belgi)" : values.response.length > 4000 ? "Ko‘pi bilan 4000 ta belgi" : undefined],
      ]),
    (values) => api.post<VetRequest>(`/vet/requests/${request.id}/${mode}`, { response: values.response.trim() }),
    () => {
      toast.success(closing ? "Murojaat yopildi, egasiga xabar yuborildi" : "Murojaat ko‘rib chiqilmoqda");
      onDone();
    },
  );
  return (
    <Modal
      title={closing ? "Javob berib yopish" : "Ko‘rib chiqishga olish"}
      description={`${request.code} · ${request.household.name}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            {closing ? "Yopish" : "Olish"}
          </Button>
        </>
      }
    >
      <Field label="Javob" required={closing} hint={closing ? "Xonadon egasiga yuboriladi" : "Ixtiyoriy: egasiga ko‘rinadi"} {...form.field("response")}>
        <Textarea {...form.control("response")} rows={5} maxLength={4000} autoFocus />
      </Field>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

