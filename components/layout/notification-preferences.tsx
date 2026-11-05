"use client";

import { useState } from "react";
import { api, toApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { ErrorState } from "@/components/ui/error-state";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

/** `GET /api/my/notification-preferences` row. */
export interface NotificationPreference {
  event: string;
  display: string;
  description: string;
  enabled: boolean;
  telegram_enabled: boolean;
  global_enabled: boolean;
  global_telegram: boolean;
}

/**
 * The user's own notification switches (TZ §11.3): mute an event, or keep it in the inbox only (no Telegram).
 * The Super Admin's global settings still apply first (a globally disabled event cannot be turned on here).
 */
export function NotificationPreferencesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const prefs = useApi<NotificationPreference[]>("/my/notification-preferences");
  const [saving, setSaving] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationPreference[] | null>(null);
  const list = rows ?? prefs.data;

  const change = async (row: NotificationPreference, patch: Partial<Pick<NotificationPreference, "enabled" | "telegram_enabled">>) => {
    setSaving(row.event);
    try {
      const updated = await api.patch<NotificationPreference>(`/my/notification-preferences/${row.event}`, patch);
      setRows((list ?? []).map((item) => (item.event === updated.event ? updated : item)));
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      title="Bildirishnoma sozlamalari"
      description="Qaysi xabarlarni olishni o‘zingiz tanlang. “Telegram” o‘chirilsa, xabar faqat shu yerda (qo‘ng‘iroqchada) ko‘rinadi."
      onClose={onClose}
      size="lg"
    >
      {!list && prefs.error ? (
        <ErrorState error={prefs.error} onRetry={prefs.reload} />
      ) : !list ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {list.map((row) => {
            const busy = saving === row.event;
            const off = !row.global_enabled;
            return (
              <li key={row.event} className="flex items-start justify-between gap-4 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{row.display}</p>
                  <p className="text-[13px] leading-snug text-muted">
                    {off ? "Administrator tomonidan o‘chirilgan" : row.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <label className="flex flex-col items-center gap-1 text-[11px] text-muted">
                    <Switch
                      checked={row.enabled && !off}
                      disabled={busy || off}
                      label={`${row.display}: olish`}
                      onChange={(value) => change(row, { enabled: value })}
                    />
                    Olish
                  </label>
                  <label className="flex flex-col items-center gap-1 text-[11px] text-muted">
                    <Switch
                      checked={row.telegram_enabled && row.global_telegram && row.enabled && !off}
                      disabled={busy || off || !row.enabled || !row.global_telegram}
                      label={`${row.display}: Telegram`}
                      onChange={(value) => change(row, { telegram_enabled: value })}
                    />
                    Telegram
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
