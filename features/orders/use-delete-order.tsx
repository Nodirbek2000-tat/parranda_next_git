"use client";

import { api } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/** Order statuses the UI offers "O‘chirish" for (the server re-checks: 409 with the reason otherwise). */
const ADMIN_DELETABLE: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["NEW", "APPROVED", "REJECTED", "CONFIRMED", "CANCELLED"]);

/**
 * ADMIN: any order that is not on the way / awaiting confirmation (a not-finished logistics task → 409).
 * OWNER: own NEW order only (like cancel).
 */
export function canDeleteOrder(order: Pick<Order, "status">, role: string): boolean {
  if (role === "ADMIN") return ADMIN_DELETABLE.has(order.status);
  if (role === "OWNER") return order.status === "NEW";
  return false;
}

/**
 * `DELETE /api/orders/{id}` after TWO confirmations: the order disappears from lists, search and dashboards,
 * its status history, tasks and audit stay. A 409 keeps the dialog open with the server's `detail`.
 * `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useDeleteOrder(onDeleted?: () => void): (order: Pick<Order, "id" | "code">) => void {
  const confirm = useConfirm();
  const toast = useToast();

  return (order) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Buyurtmani o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{order.code}</strong> buyurtmasini o‘chirmoqchimisiz?
            </p>
            <p className="text-[13px] text-muted">
              Buyurtma ro‘yxatlar, qidiruv va bosh sahifadan yo‘qoladi. Holatlar tarixi, logistika topshiriqlari va
              audit saqlanib qoladi. Yetkazilayotgan yoki yakunlanmagan topshirig‘i bor buyurtmani o‘chirib bo‘lmaydi.
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
            <strong>{order.code}</strong> buyurtmasi butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/orders/${order.id}`, { silent: Boolean(onDeleted) });
          toast.success("Buyurtma o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };
}
