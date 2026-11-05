"use client";

import { Syringe } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { VET_VISIT_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { PoultryType, VetVisitStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary } from "@/components/ui/summary";

/** `GET /api/my/batches/{id}` (owner, own household only). */
export interface OwnerBatch {
  id: number;
  code: string;
  poultry_type: PoultryType;
  poultry_type_display: string;
  breed: string;
  supplier: string;
  arrived_at: string;
  age_days_at_arrival: number;
  age_days: number;
  health_status: string;
  count: number;
  first_received_date: string | null;
  vaccinations: {
    id: number;
    code: string;
    vaccine_name: string;
    status: VetVisitStatus;
    status_display: string;
    planned_date: string;
    done_date: string | null;
    dose: string;
  }[];
}

/** Owner's batch card (TZ §2 ROLE 6, §6): age, supplier, health status, vaccination history. */
export function OwnerBatchModal({ batchId, onClose }: { batchId: number; onClose: () => void }) {
  const batch = useApi<OwnerBatch>(`/my/batches/${batchId}`);
  const data = batch.data;
  return (
    <Modal title={data ? `Partiya ${data.code}` : "Partiya"} description={data?.breed} onClose={onClose} size="lg">
      {batch.error && !data ? (
        <ErrorState error={batch.error} onRetry={batch.reload} />
      ) : !data ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <div className="flex flex-col gap-5">
          <Summary
            items={[
              ["Turi", data.poultry_type_display],
              ["Zoti", data.breed],
              ["Xonadondagi soni", `${formatNumber(data.count)} dona`],
              ["Qabul qilingan sana", data.first_received_date ? formatDate(data.first_received_date) : "—"],
              ["Yoshi", `${formatNumber(data.age_days)} kun`],
              ["Markazga kelgan sana", `${formatDate(data.arrived_at)} (${formatNumber(data.age_days_at_arrival)} kunlik)`],
              ["Yetkazib beruvchi", data.supplier || "—"],
              ["Sog‘lig‘i", data.health_status || "—"],
            ]}
          />
          <section aria-labelledby="owner-batch-vaccinations">
            <h3 id="owner-batch-vaccinations" className="mb-2 text-sm font-semibold text-ink">
              Emlash tarixi
            </h3>
            {data.vaccinations.length === 0 ? (
              <EmptyState icon={Syringe} title="Bu partiya uchun emlash yozuvlari yo‘q" className="py-6" />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {data.vaccinations.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{row.vaccine_name}</p>
                      <p className="text-[13px] text-muted">
                        {row.code} · {row.done_date ? `o‘tkazildi ${formatDate(row.done_date)}` : `reja ${formatDate(row.planned_date)}`}
                        {row.dose ? ` · ${row.dose}` : ""}
                      </p>
                    </div>
                    <StatusBadge map={VET_VISIT_STATUS} status={row.status} label={row.status_display} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
