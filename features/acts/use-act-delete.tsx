"use client";

import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { Act } from "@/lib/builder-types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/**
 * `DELETE /api/acts/{id}` (ADMIN) after TWO confirmations: the act disappears from the list, the audit
 * journal keeps it. A 400/403/409 keeps the dialog open with the server's `detail`; the list refreshes itself.
 */
export function useActDelete() {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();

  const deleteAct = (act: Pick<Act, "id" | "code">) => {
    void (async () => {
      // 1-so‘rov: faqat tasdiq (hech narsa o‘chmaydi).
      const first = await confirm({
        title: "Dalolatnomani o‘chirish",
        confirmLabel: "Ha, o‘chirish",
        tone: "danger",
        message: (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{act.code}</strong> dalolatnomasini o‘chirmoqchimisiz?
            </p>
            <p className="text-[13px] text-muted">
              Dalolatnoma ro‘yxatdan yo‘qoladi va PDF’ini qayta yuklab bo‘lmaydi. Asosidagi vazifalar, hisobotlar va
              audit jurnali saqlanib qoladi — kerak bo‘lsa, dalolatnomani qayta shakllantirish mumkin.
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
            <strong>{act.code}</strong> butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
          </p>
        ),
        onConfirm: async () => {
          await api.delete(`/acts/${act.id}`);
          toast.success("Dalolatnoma o‘chirildi");
        },
      });
    })();
  };

  return { canDelete: user.role === "ADMIN", deleteAct };
}
