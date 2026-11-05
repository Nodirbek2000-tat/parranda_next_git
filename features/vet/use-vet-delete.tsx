"use client";

import { api } from "@/lib/api";
import type { UserRef } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useVetRole } from "./shared";

interface DeleteRequest {
  path: string;
  /** First dialog title, e.g. "Tekshiruvni o‘chirish". */
  title: string;
  name: string;
  details: string;
  success: string;
  /** Runs after success (close the modal / leave the detail page). */
  onDeleted?: () => void;
  /** Do not refetch open pages (the detail page is left right away; the list loads fresh). */
  silent?: boolean;
}

interface VetOwnedRecord {
  id: number;
  code: string;
  vet: UserRef | null;
  created_by: UserRef | null;
}

/**
 * Soft delete of vet records after TWO confirmations (`DELETE /api/vet/{visits|vaccinations|diseases|requests}/{id}`).
 * The record disappears from lists, its history/audit stays. A 400/403/409 keeps the dialog open with the
 * server's `detail`; lists, counts and the calendar refresh through the data revision.
 */
export function useVetDelete() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, isAdmin, isVet } = useVetRole();

  /** ADMIN: any record; VET: his own (assigned to him, or unassigned and created by him). The server decides finally. */
  const canDelete = (record: Pick<VetOwnedRecord, "vet" | "created_by">) =>
    isAdmin || (isVet && (record.vet ? record.vet.id === user.id : record.created_by?.id === user.id));

  const run = (request: DeleteRequest) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: request.title,
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{request.name}</strong> o‘chirilsinmi?
            </p>
            <p className="text-[13px] text-muted">{request.details}</p>
          </div>
        ),
        onConfirm: async () => {},
      });
      if (!first) return;
      // 2-so‘rov: haqiqiy o‘chirish.
      await confirm({
        title: "Rostdan ham o‘chirasizmi?",
        confirmLabel: "Ha, butunlay o‘chirish",
        tone: "danger",
        message: (
          <p>
            <strong>{request.name}</strong> butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(request.path, { silent: request.silent });
          toast.success(request.success);
          request.onDeleted?.();
        },
      });
    })();
  };

  const HISTORY = "Yozuv ro‘yxatlar, kalendar va hisoblagichlardan yo‘qoladi. Tarix va audit jurnali saqlanib qoladi.";

  return {
    canDelete,
    canDeleteRequest: isAdmin,
    deleteVisit: (visit: VetOwnedRecord, options: { onDeleted?: () => void; silent?: boolean } = {}) =>
      run({
        path: `/vet/visits/${visit.id}`,
        title: "Tekshiruvni o‘chirish",
        name: `Tekshiruv ${visit.code}`,
        details: HISTORY,
        success: "Tekshiruv o‘chirildi",
        ...options,
      }),
    deleteVaccination: (vaccination: VetOwnedRecord & { vaccine_name: string }, options: { onDeleted?: () => void } = {}) =>
      run({
        path: `/vet/vaccinations/${vaccination.id}`,
        title: "Emlashni o‘chirish",
        name: `${vaccination.code} · ${vaccination.vaccine_name}`,
        details: `${HISTORY} Ombordagi chiqim o‘zgarmaydi.`,
        success: "Emlash o‘chirildi",
        ...options,
      }),
    deleteDisease: (disease: VetOwnedRecord & { disease_name: string }, options: { onDeleted?: () => void } = {}) =>
      run({
        path: `/vet/diseases/${disease.id}`,
        title: "Kasallik yozuvini o‘chirish",
        name: `${disease.code} · ${disease.disease_name}`,
        details: HISTORY,
        success: "Kasallik yozuvi o‘chirildi",
        ...options,
      }),
    deleteRequest: (request: { id: number; code: string }, options: { onDeleted?: () => void } = {}) =>
      run({
        path: `/vet/requests/${request.id}`,
        title: "Murojaatni o‘chirish",
        name: `Murojaat ${request.code}`,
        details: "Murojaat ro‘yxatlar va hisoblagichlardan yo‘qoladi. Tarix va audit jurnali saqlanib qoladi.",
        success: "Murojaat o‘chirildi",
        ...options,
      }),
  };
}
