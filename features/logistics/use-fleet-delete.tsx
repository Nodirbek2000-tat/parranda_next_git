"use client";

import { api } from "@/lib/api";
import type { Driver, Vehicle } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

interface DeleteRequest {
  path: string;
  /** First dialog title, e.g. "Transportni o‘chirish". */
  title: string;
  name: string;
  details: string;
  success: string;
}

/**
 * Soft delete of a vehicle / driver after TWO confirmations (`DELETE /api/logistics/{vehicles|drivers}/{id}`).
 * A 409 (on a not-finished task) keeps the dialog open with the server's `detail`; the list refreshes itself.
 */
export function useFleetDelete() {
  const confirm = useConfirm();
  const toast = useToast();

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
          await api.delete(request.path);
          toast.success(request.success);
        },
      });
    })();
  };

  return {
    deleteVehicle: (vehicle: Vehicle) =>
      run({
        path: `/logistics/vehicles/${vehicle.id}`,
        title: "Transportni o‘chirish",
        name: vehicle.plate_number,
        details:
          "Transport ro‘yxat va tanlash oynalaridan yo‘qoladi. Yakunlangan topshiriqlar tarixi saqlanib qoladi. " +
          "Davlat raqami bo‘shaydi — uni qayta ro‘yxatga olish mumkin.",
        success: "Transport o‘chirildi",
      }),
    deleteDriver: (driver: Driver) =>
      run({
        path: `/logistics/drivers/${driver.id}`,
        title: "Haydovchini o‘chirish",
        name: driver.full_name,
        details:
          "Haydovchi ro‘yxat va tanlash oynalaridan yo‘qoladi. Yakunlangan topshiriqlar tarixi saqlanib qoladi. " +
          "Bog‘langan logistika xodimi hisobi o‘chirilmaydi — uni boshqa haydovchiga bog‘lash mumkin.",
        success: "Haydovchi o‘chirildi",
      }),
  };
}
