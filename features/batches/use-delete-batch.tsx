"use client";

import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

export interface BatchRef {
  id: number;
  code: string;
  center_stock?: number;
}

/**
 * `DELETE /api/batches/{id}` after TWO confirmations: the batch and its movements disappear from lists, search
 * and statistics, the rows stay as history. A 409 (birds of the batch are still in households) keeps the dialog
 * open with the server's `detail`. `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useDeleteBatch(onDeleted?: () => void): (batch: BatchRef) => void {
  const confirm = useConfirm();
  const toast = useToast();

  return (batch: BatchRef) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Partiyani o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{batch.code}</strong> partiyasini o‘chirmoqchimisiz?
            </p>
            {Boolean(batch.center_stock && batch.center_stock > 0) && (
              <p>
                Markazda hali <strong>{formatNumber(batch.center_stock ?? 0)} dona</strong> parranda bor — ular
                hisob-kitob va statistikadan yo‘qoladi.
              </p>
            )}
            <p className="text-[13px] text-muted">
              Partiya va uning harakatlari ro‘yxatlar, qidiruv va statistikadan yo‘qoladi. Tarix (kunlik hisobotlar,
              veterinariya yozuvlari, audit) saqlanib qoladi. Parrandalari hali xonadonlarda bo‘lgan partiyani
              o‘chirib bo‘lmaydi.
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
            <strong>{batch.code}</strong> partiyasi butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/batches/${batch.id}`, { silent: Boolean(onDeleted) });
          toast.success("Partiya o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };
}
