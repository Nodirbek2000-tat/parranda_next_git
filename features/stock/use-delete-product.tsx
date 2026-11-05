"use client";

import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

export interface ProductRef {
  id: number;
  name: string;
  balance: number;
  unit: string;
}

/**
 * `DELETE /api/products/{id}` after TWO confirmations: the product disappears from lists, pickers and
 * search, its stock history stays. A 409 (stock reserved / open orders or tasks) keeps the dialog open
 * with the server's `detail`. `onDeleted` runs after success (e.g. leave the detail page).
 */
export function useDeleteProduct(onDeleted?: () => void): (product: ProductRef) => void {
  const confirm = useConfirm();
  const toast = useToast();

  return (product: ProductRef) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Mahsulotni o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{product.name}</strong> mahsulotini o‘chirmoqchimisiz?
            </p>
            {product.balance > 0 && (
              <p>
                Omborda hali{" "}
                <strong>
                  {formatNumber(product.balance)} {product.unit}
                </strong>{" "}
                qoldiq bor — u ro‘yxatlar va hisob-kitoblardan yo‘qoladi.
              </p>
            )}
            <p className="text-[13px] text-muted">
              Mahsulot ombor ro‘yxati, tanlash oynalari va qidiruvdan yo‘qoladi. Kirim-chiqim operatsiyalari tarixi
              saqlanib qoladi. Nomi bo‘shaydi — xuddi shu nomli yangi mahsulot qo‘shish mumkin.
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
            <strong>{product.name}</strong> butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/products/${product.id}`, { silent: Boolean(onDeleted) });
          toast.success("Mahsulot o‘chirildi");
          onDeleted?.();
        },
      });
    })();
  };
}
