"use client";

import { api } from "@/lib/api";
import type { LogisticsTask } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/**
 * ADMIN only (like cancel). Offered for NEW (cancelled first), CANCELLED, CONFIRMED and an order-less DELIVERED
 * task; while a driver works on it (ASSIGNED / ACCEPTED / IN_TRANSIT) or an order waits for the owner's
 * confirmation the server answers 409, so the button is not shown there.
 */
export function canDeleteTask(task: Pick<LogisticsTask, "status" | "order">, role: string): boolean {
  if (role !== "ADMIN") return false;
  if (task.status === "DELIVERED") return !task.order;
  return task.status === "NEW" || task.status === "CANCELLED" || task.status === "CONFIRMED";
}

/**
 * `DELETE /api/logistics/tasks/{id}` after TWO confirmations: the task disappears from the board, lists, search
 * and the bot; items, stock operations, status history and audit stay. A 409 keeps the dialog open with the
 * server's `detail`. `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useDeleteTask(onDeleted?: () => void): (task: Pick<LogisticsTask, "id" | "code" | "status">) => void {
  const confirm = useConfirm();
  const toast = useToast();

  return (task) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Topshiriqni o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{task.code}</strong> topshirig‘ini o‘chirmoqchimisiz?
            </p>
            {task.status === "NEW" && (
              <p>
                Topshiriq avval bekor qilinadi: zaxiralangan mahsulotlar bo‘shatiladi, buyurtma esa “Tasdiqlandi” holatiga
                qaytadi.
              </p>
            )}
            <p className="text-[13px] text-muted">
              Topshiriq doska, ro‘yxatlar, qidiruv va botdan yo‘qoladi. Ombor operatsiyalari, holatlar tarixi va audit
              saqlanib qoladi.
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
            <strong>{task.code}</strong> topshirig‘i butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/logistics/tasks/${task.id}`, { silent: Boolean(onDeleted) });
          toast.success("Topshiriq o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };
}
