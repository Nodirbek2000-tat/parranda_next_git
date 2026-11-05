"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Bird, Bug, ClipboardCheck, Pencil, Stethoscope } from "lucide-react";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { DISEASE_STATUS, HEALTH_STATUS, VET_VISIT_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { DiseaseRecord, Paginated, VetVisit } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { MovementModal } from "../movements/movement-modal";
import { DiseaseDetailModal } from "./disease-detail";
import { DiseaseFormModal, VisitCompleteModal, VisitFormModal } from "./forms";
import { HouseholdLink, Info, PlannedDate, ReasonModal, TextBlock, useVetRole, vetName } from "./shared";

type Dialog = "complete" | "edit" | "cancel" | "death" | "disease" | null;

/** /vet/visits/[id] — plan, conclusion, cancel, deaths and diseases of one inspection (V3 §8.1, §8.6, §15.3). */
export function VisitDetail({ id }: { id: string }) {
  const { isVet, isAdmin } = useVetRole();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [diseaseId, setDiseaseId] = useState<number | null>(null);
  const visit = useApi<VetVisit>(`/vet/visits/${id}`);
  const diseases = useApi<Paginated<DiseaseRecord>>("/vet/diseases", { visit: id, page_size: 50 });
  const data = visit.data;

  if (!data) {
    if (visit.error) {
      return (
        <Card>
          {visit.error.status === 404 ? (
            <EmptyState
              icon={Stethoscope}
              title="Tekshiruv topilmadi"
              description="Tekshiruv mavjud emas yoki sizda uni ko‘rish huquqi yo‘q."
              action={<LinkButton href="/vet">Veterinariya</LinkButton>}
            />
          ) : (
            <ErrorState error={visit.error} onRetry={visit.reload} />
          )}
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const actions = data.allowed_actions;
  const canRecordDeath = isVet || isAdmin;

  return (
    <div className="flex flex-col gap-6">
      {visit.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={visit.error} onRetry={visit.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={[{ label: "Veterinariya", href: "/vet" }, { label: "Tekshiruvlar", href: "/vet?tab=visits" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.code}
            <StatusBadge map={VET_VISIT_STATUS} status={data.status} label={data.status_display} overdue={data.is_overdue} />
          </span>
        }
        description={`${data.household.name} · ${formatDate(data.planned_date)}`}
        actions={
          <>
            {actions.includes("complete") && (
              <Button icon={<ClipboardCheck className="size-4" aria-hidden />} onClick={() => setDialog("complete")}>
                Xulosa kiritish
              </Button>
            )}
            {actions.includes("update") && (
              <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setDialog("edit")}>
                Tahrirlash
              </Button>
            )}
            {canRecordDeath && (
              <Button variant="secondary" icon={<Bird className="size-4" aria-hidden />} onClick={() => setDialog("death")}>
                Nobud bo‘lishni qayd etish
              </Button>
            )}
            {canRecordDeath && (
              <Button variant="secondary" icon={<Bug className="size-4" aria-hidden />} onClick={() => setDialog("disease")}>
                Kasallik
              </Button>
            )}
            {actions.includes("cancel") && (
              <Button variant="ghost" icon={<Ban className="size-4" aria-hidden />} onClick={() => setDialog("cancel")}>
                Bekor qilish
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader title="Reja" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Info label="Xonadon" value={<HouseholdLink household={data.household} />} wide />
              <Info label="Reja sanasi" value={<PlannedDate date={data.planned_date} overdue={data.is_overdue} />} />
              <Info label="Veterinar" value={vetName(data.vet)} />
              <Info label="Partiya" value={data.batch?.code} />
              <Info label="Murojaat" value={data.request ? <Link className="text-accent hover:underline" href={`/vet/requests?open=${data.request.id}`}>{data.request.code}</Link> : null} />
              <Info label="Maqsad" value={data.purpose} wide />
              <Info label="Kiritgan" value={data.created_by ? `${data.created_by.full_name} · ${formatDateTime(data.created_at)}` : formatDateTime(data.created_at)} wide />
              {data.status === "CANCELLED" && <Info label="Bekor qilish sababi" value={data.cancel_reason} wide />}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Xulosa"
            description={data.status === "DONE" ? `O‘tkazildi: ${formatDateTime(data.done_at)}` : undefined}
            actions={
              data.health_status ? (
                <StatusBadge map={HEALTH_STATUS} status={data.health_status} label={data.health_status_display ?? undefined} />
              ) : undefined
            }
          />
          <CardBody>
            {data.status !== "DONE" ? (
              <EmptyState
                icon={ClipboardCheck}
                title={data.status === "CANCELLED" ? "Tekshiruv bekor qilingan" : "Xulosa hali kiritilmagan"}
                description={actions.includes("complete") ? "Tekshiruvdan so‘ng “Xulosa kiritish” tugmasini bosing." : undefined}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {data.birds_checked !== null && (
                  <p className="text-sm text-muted">
                    Tekshirildi: <span className="font-medium tabular-nums text-ink">{formatNumber(data.birds_checked)} bosh</span>
                  </p>
                )}
                <TextBlock title="Aniqlanganlar" text={data.findings} />
                <TextBlock title="Xulosa" text={data.conclusion} />
                <TextBlock title="Tavsiyalar" text={data.recommendations} />
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Fayllar</p>
                  <AttachmentList files={data.files} />
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Aniqlangan kasalliklar" description="Shu tekshiruv bo‘yicha qayd etilganlar; davolash kasallik ichida" />
        <div className="mt-3 border-t border-line">
          {!diseases.data && diseases.error ? (
            <ErrorState error={diseases.error} onRetry={diseases.reload} />
          ) : !diseases.data ? (
            <TableSkeleton rows={2} />
          ) : diseases.data.results.length === 0 ? (
            <EmptyState icon={Bug} title="Kasallik qayd etilmagan" />
          ) : (
            <ul className="divide-y divide-line">
              {diseases.data.results.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => setDiseaseId(row.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-subtle sm:px-6">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{row.disease_name}</span>
                      <span className="block text-xs tabular-nums text-muted">
                        {row.code} · {formatNumber(row.cases)} holat · nobud: {formatNumber(row.deaths_since_diagnosis)}
                      </span>
                    </span>
                    <StatusBadge map={DISEASE_STATUS} status={row.status} label={row.status_display} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {dialog === "complete" && <VisitCompleteModal visit={data} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog === "edit" && <VisitFormModal visit={data} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog === "cancel" && (
        <ReasonModal
          title="Tekshiruvni bekor qilish"
          description={`${data.code} · ${data.household.name}. Veterinar va xonadon egasiga xabar boradi.`}
          path={`/vet/visits/${data.id}/cancel`}
          success="Tekshiruv bekor qilindi"
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog === "death" && (
        <MovementModal
          household={data.household}
          batch={data.batch ?? undefined}
          types={["DEATH"]}
          initialNote={data.code}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog === "disease" && (
        <DiseaseFormModal
          household={data.household}
          visit={{ id: data.id, code: data.code, batch: data.batch }}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {diseaseId !== null && <DiseaseDetailModal id={diseaseId} onClose={() => setDiseaseId(null)} />}
    </div>
  );
}
