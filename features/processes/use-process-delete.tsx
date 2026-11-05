"use client";

import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { ProcessRun } from "@/lib/builder-types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/** Shown instead of deleting while a run is RUNNING (the server answers 409 until it is cancelled). */
export const PROCESS_DELETE_HINT = "Avval jarayonni bekor qiling";

/**
 * `DELETE /api/process-runs/{id}` (ADMIN) after TWO confirmations: the run and all its tasks disappear from
 * lists, history/audit stays. A 409 (still RUNNING / not-finished tasks) keeps the dialog open with the
 * server's `detail`. `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useProcessDelete(onDeleted?: () => void) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();

  const deleteRun = (run: Pick<ProcessRun, "id" | "code" | "process_name">) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Jarayonni o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{run.code}</strong> “{run.process_name}” jarayonini o‘chirmoqchimisiz?
            </p>
            <p>Jarayonning barcha bosqich vazifalari ham ro‘yxatlardan yashiriladi.</p>
            <p className="text-[13px] text-muted">
              Jarayon ro‘yxatlardan yo‘qoladi. Topshirilgan ma’lumotlar tarixi va audit jurnali saqlanib qoladi.
            </p>
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
            <strong>{run.code}</strong> va uning vazifalari butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          // silent on the detail page: it must not refetch (404) before we leave it; the list loads fresh.
          await api.delete(`/process-runs/${run.id}`, { silent: Boolean(onDeleted) });
          toast.success("Jarayon o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };

  return { canDelete: user.role === "ADMIN", deleteRun };
}
