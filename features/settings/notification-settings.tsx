"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, ROLE_LABELS } from "@/lib/format";
import type { NotificationSettingPatch, NotificationSettingRow, StaffRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { NotificationRuleEditor, ruleSummary } from "./notification-rule-editor";

const ROLE_ORDER: readonly StaffRole[] = ["ADMIN", "WAREHOUSE", "LOGISTICS", "VET"];

const CONTEXTUAL_LABELS: Record<string, string> = {
  household_owner: "Xonadon egasi",
  assigned_vet: "Biriktirilgan veterinar",
  driver_user: "Haydovchi",
  responsible: "Mas’ul logist",
  subject_user: "Yangi foydalanuvchi",
  other_party: "Ikkinchi tomon",
};

function sameRoles(a: readonly StaffRole[], b: readonly StaffRole[]): boolean {
  return a.length === b.length && a.every((role) => b.includes(role));
}

/**
 * Bildirishnomalar tab of /settings and /builder (V3 §9.3, V4 §4): per-event switches, recipient roles and the
 * notification constructor (custom text, delay, extra recipients, versions).
 * Every change is saved immediately (`PATCH /api/notification-settings/{event}`, Super Admin).
 */
export function NotificationSettingsTable({ rows: initialRows }: { rows: NotificationSettingRow[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const save = async (row: NotificationSettingRow, patch: NotificationSettingPatch) => {
    setSaving(row.event);
    // Optimistic update; reverted when the server refuses.
    setRows((list) =>
      list.map((item) =>
        item.event === row.event
          ? {
              ...item,
              ...patch,
              roles: patch.roles === null ? item.default_roles : (patch.roles ?? item.roles),
              roles_overridden: patch.roles === undefined ? item.roles_overridden : patch.roles !== null,
            }
          : item,
      ),
    );
    try {
      const updated = await api.patch<NotificationSettingRow>(`/notification-settings/${row.event}`, patch, { silent: true });
      setRows((list) => list.map((item) => (item.event === row.event ? updated : item)));
    } catch (error) {
      setRows((list) => list.map((item) => (item.event === row.event ? row : item)));
      toast.error(toApiError(error).message);
    } finally {
      setSaving(null);
    }
  };

  const toggleRole = (row: NotificationSettingRow, role: StaffRole) => {
    const next = row.roles.includes(role) ? row.roles.filter((item) => item !== role) : [...row.roles, role];
    const ordered = ROLE_ORDER.filter((item) => next.includes(item));
    void save(row, { roles: sameRoles(ordered, row.default_roles) ? null : ordered });
  };

  return (
    <Card>
      <CardHeader
        title="Hodisalar"
        description="O‘chirilgan hodisa uchun xabar yaratilmaydi; Telegram o‘chirilsa xabar faqat ilovadagi qo‘ng‘iroqchada ko‘rinadi."
      />
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {rows.map((row) => {
          const busy = saving === row.event;
          return (
            <li key={row.event} className={cn("px-4 py-4 transition-opacity sm:px-6", !row.enabled && "bg-subtle/60")}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 lg:max-w-md">
                  <p className={cn("text-sm font-medium", row.enabled ? "text-ink" : "text-muted")}>{row.display}</p>
                  <p className="text-[13px] text-muted">{row.description}</p>
                  {row.contextual.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      Kontekst bo‘yicha: {row.contextual.map((name) => CONTEXTUAL_LABELS[name] ?? name).join(", ")}
                    </p>
                  )}
                  {row.updated_by && (
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(row.updated_at)} · {row.updated_by.full_name}
                    </p>
                  )}
                  {ruleSummary(row) && <p className="mt-1 text-xs text-accent">{ruleSummary(row)}</p>}
                </div>
                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <SwitchLabel
                      label="Yoqilgan"
                      checked={row.enabled}
                      disabled={busy}
                      onChange={(value) => save(row, { enabled: value })}
                    />
                    <SwitchLabel
                      label="Telegram"
                      checked={row.telegram_enabled}
                      disabled={busy || !row.enabled}
                      onChange={(value) => save(row, { telegram_enabled: value })}
                    />
                    <SwitchLabel
                      label="Kontekst"
                      checked={row.contextual_enabled}
                      disabled={busy || !row.enabled || row.contextual.length === 0}
                      onChange={(value) => save(row, { contextual_enabled: value })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${row.display}: rollar`}>
                    {ROLE_ORDER.map((role) => {
                      const on = row.roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={on}
                          disabled={busy || !row.enabled}
                          onClick={() => toggleRole(row, role)}
                          className={cn(
                            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
                            on ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30" : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink",
                          )}
                        >
                          {ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                    {row.roles_overridden ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        icon={<RotateCcw className="size-3.5" aria-hidden />}
                        onClick={() => save(row, { roles: null })}
                      >
                        Standart
                      </Button>
                    ) : (
                      <Badge className="ml-1">Standart</Badge>
                    )}
                  </div>
                  <Button
                    variant={open === row.event ? "secondary" : "ghost"}
                    size="sm"
                    aria-expanded={open === row.event}
                    icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
                    onClick={() => setOpen(open === row.event ? null : row.event)}
                  >
                    Matn, vaqt va qabul qiluvchilar
                  </Button>
                </div>
              </div>
              {open === row.event && (
                <NotificationRuleEditor
                  row={row}
                  onSaved={(updated) => setRows((list) => list.map((item) => (item.event === updated.event ? updated : item)))}
                  onReverted={(list) => setRows(list)}
                  onClose={() => setOpen(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SwitchLabel({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-ink">
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
      {label}
    </span>
  );
}
