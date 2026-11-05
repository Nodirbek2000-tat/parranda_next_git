"use client";

import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { Task } from "@/lib/builder-types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/**
 * `DELETE /api/tasks/{id}` (ADMIN) after TWO confirmations: the task disappears from lists and counters,
 * its history/audit stays. A 409 (the task belongs to a RUNNING process run) keeps the dialog open with
 * the server's `detail`. `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useTaskDelete(onDeleted?: () => void) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();

  const deleteTask = (task: Pick<Task, "id" | "code" | "title" | "process_run">) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Vazifani o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{task.code}</strong> “{task.title}” vazifasini o‘chirmoqchimisiz?
            </p>
            {task.process_run && (
              <p>
                Vazifa <strong>{task.process_run.code}</strong> jarayoniga tegishli. Jarayon davom etayotgan bo‘lsa, avval
                jarayonni bekor qiling yoki o‘chiring.
              </p>
            )}
            <p className="text-[13px] text-muted">
              Vazifa ro‘yxatlar va hisoblagichlardan yo‘qoladi. Topshirilgan ma’lumotlar tarixi va audit jurnali saqlanib
              qoladi.
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
            <strong>{task.code}</strong> butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          // silent on the detail page: it must not refetch (404) before we leave it; the list loads fresh.
          await api.delete(`/tasks/${task.id}`, { silent: Boolean(onDeleted) });
          toast.success("Vazifa o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };

  return { canDelete: user.role === "ADMIN", deleteTask };
}
