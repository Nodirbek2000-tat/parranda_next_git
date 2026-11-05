"use client";

import { api } from "@/lib/api";
import type { InventoryStatus } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/** A draft / cancelled count: ADMIN or WAREHOUSE (like cancel); an approved one: ADMIN only (like approve). */
export function canDeleteInventory(count: { status: InventoryStatus }, role: string | undefined): boolean {
  if (role === "ADMIN") return true;
  return role === "WAREHOUSE" && count.status !== "APPROVED";
}

/**
 * `DELETE /api/inventory-counts/{id}` after TWO confirmations: the count disappears from the list; an approved
 * count's stock adjustments stay posted (balances do not change). A 403/409 keeps the dialog open with the
 * server's `detail`. `onDeleted` runs after success (e.g. leave the sheet).
 */
export function useDeleteInventory(
  onDeleted?: () => void,
): (count: { id: number; code: string; status: InventoryStatus }) => void {
  const confirm = useConfirm();
  const toast = useToast();

  return (count) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Inventarizatsiyani o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{count.code}</strong> inventarizatsiyasini o‘chirmoqchimisiz?
            </p>
            <p className="text-[13px] text-muted">
              {count.status === "APPROVED"
                ? "Inventarizatsiya ro‘yxatdan yo‘qoladi. Tasdiqlashda o‘tkazilgan tuzatish operatsiyalari va ombor qoldiqlari o‘zgarmaydi, tarix va audit saqlanib qoladi."
                : "Inventarizatsiya ro‘yxatdan yo‘qoladi. Hali hech qanday tuzatish o‘tkazilmagan — ombor qoldiqlari o‘zgarmaydi. Audit saqlanib qoladi."}
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
            <strong>{count.code}</strong> inventarizatsiyasi butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/inventory-counts/${count.id}`, { silent: Boolean(onDeleted) });
          toast.success("Inventarizatsiya o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };
}
