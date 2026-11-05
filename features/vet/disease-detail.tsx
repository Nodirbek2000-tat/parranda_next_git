"use client";

import { useState } from "react";
import { Pencil, Pill } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { DISEASE_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { DiseaseRecord } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { DiseaseUpdateModal, TreatmentFormModal } from "./forms";
import { HouseholdLink, Info, TextBlock, vetName } from "./shared";

/** Disease record with its treatments (`GET /api/vet/diseases/{id}`), “Holatni o‘zgartirish” and “Davolash”. */
export function DiseaseDetailModal({ id, onClose, owner = false }: { id: number; onClose: () => void; owner?: boolean }) {
  const detail = useApi<DiseaseRecord>(`/vet/diseases/${id}`);
  const [dialog, setDialog] = useState<"update" | "treat" | null>(null);
  const row = detail.data;

  if (dialog === "update" && row) {
    return <DiseaseUpdateModal disease={row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />;
  }
  if (dialog === "treat" && row) {
    return <TreatmentFormModal disease={row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />;
  }

  return (
    <Modal
      title={row ? row.disease_name : "Kasallik"}
      description={row ? `${row.code} · aniqlangan ${formatDate(row.diagnosed_date)}` : undefined}
      onClose={onClose}
      size="lg"
      footer={
        row && row.allowed_actions.length > 0 ? (
          <>
            {row.allowed_actions.includes("update") && (
              <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setDialog("update")}>
                Holatni o‘zgartirish
              </Button>
            )}
            {row.allowed_actions.includes("treat") && (
              <Button icon={<Pill className="size-4" aria-hidden />} onClick={() => setDialog("treat")}>
                Davolash buyurish
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
          <TableSkeleton rows={4} />
        )
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Info label="Xonadon" value={<HouseholdLink household={row.household} owner={owner} />} />
            <Info label="Holat" value={<StatusBadge map={DISEASE_STATUS} status={row.status} label={row.status_display} />} />
            <Info label="Holatlar soni" value={formatNumber(row.cases)} />
            <Info
              label="Nobud bo‘lgan (aniqlangandan beri)"
              value={<span className={row.deaths_since_diagnosis > 0 ? "font-medium text-danger" : undefined}>{formatNumber(row.deaths_since_diagnosis)}</span>}
            />
            <Info label="Partiya" value={row.batch?.code} />
            <Info label="Veterinar" value={vetName(row.vet)} />
            {row.resolved_date && <Info label="Tuzalgan sana" value={formatDate(row.resolved_date)} />}
            {row.visit && <Info label="Tekshiruv" value={row.visit.code} />}
          </dl>
          <TextBlock title="Belgilar" text={row.symptoms} />
          <TextBlock title="Izoh" text={row.notes} />
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Davolash</p>
            {(row.treatments ?? []).length === 0 ? (
              <p className="text-sm text-muted">Davolash hali buyurilmagan.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(row.treatments ?? []).map((treatment) => (
                  <li key={treatment.id} className="rounded-lg border border-line px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {treatment.drug_name}
                        {treatment.dosage && <span className="font-normal text-muted"> · {treatment.dosage}</span>}
                      </span>
                      {treatment.is_active ? <Badge tone="warning">Davom etmoqda</Badge> : <Badge>Tugagan</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">
                      {treatment.code} · {formatDate(treatment.start_date)}
                      {treatment.end_date ? ` – ${formatDate(treatment.end_date)}` : ""} · {vetName(treatment.vet)}
                    </p>
                    {treatment.instructions && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink">{treatment.instructions}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {row.files.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Fayllar</p>
              <AttachmentList files={row.files} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
