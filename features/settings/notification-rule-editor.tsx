"use client";

import { useRef, useState } from "react";
import { History, Plus, RotateCcw, X } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { ConfigVersion } from "@/lib/builder-types";
import { formatDateTime, formatNumber, ROLE_LABELS } from "@/lib/format";
import { useAllPages, useApi, useDebounced } from "@/lib/use-api";
import type { NotificationSettingRow, Paginated, User } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const PLACEHOLDERS = [
  { value: "{title}", label: "Sarlavha" },
  { value: "{code}", label: "Raqam" },
  { value: "{household}", label: "Xonadon" },
  { value: "{due}", label: "Muddat" },
  { value: "{role}", label: "Rol" },
  { value: "{text}", label: "Standart matn" },
] as const;

const MAX_DELAY = 10080;
const DELAY_PRESETS = [15, 60, 180, 720, 1440] as const;

export function delayText(minutes: number | undefined): string {
  if (!minutes) return "Darhol";
  if (minutes % 1440 === 0) return `${minutes / 1440} kundan keyin`;
  if (minutes % 60 === 0) return `${minutes / 60} soatdan keyin`;
  return `${minutes} daqiqadan keyin`;
}

/** One line under the event: what the constructor changed (empty when nothing). */
export function ruleSummary(row: NotificationSettingRow): string {
  const parts: string[] = [];
  if (row.custom_text?.trim()) parts.push("Maxsus matn");
  if (row.delay_minutes) parts.push(delayText(row.delay_minutes));
  if (row.extra_user_ids?.length) parts.push(`+${row.extra_user_ids.length} foydalanuvchi`);
  return parts.join(" · ");
}

/** Users by id for chips (every page of /api/users; staff lists are small). */
function useUserNames(enabled: boolean) {
  const users = useAllPages<User>(enabled ? "/users" : null);
  return (id: number) => users.data?.results.find((user) => user.id === id);
}

/**
 * Notification constructor of one event (API_CONTRACT_V4 §4): custom text with placeholders, delay
 * ("Qachon yuborish") and extra Telegram recipients, plus the versions history with revert.
 */
export function NotificationRuleEditor({
  row,
  onSaved,
  onReverted,
  onClose,
}: {
  row: NotificationSettingRow;
  onSaved: (row: NotificationSettingRow) => void;
  onReverted: (rows: NotificationSettingRow[]) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(row.custom_text ?? "");
  const [delayed, setDelayed] = useState(Boolean(row.delay_minutes));
  const [delay, setDelay] = useState(row.delay_minutes ? String(row.delay_minutes) : "60");
  const [extra, setExtra] = useState<number[]>(row.extra_user_ids ?? []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [versionsOpen, setVersionsOpen] = useState(false);
  const debounced = useDebounced(search.trim());
  const found = useApi<Paginated<User>>(debounced ? "/users" : null, { search: debounced, page_size: 10, is_active: true });
  const userById = useUserNames(true);
  const id = `rule-${row.event}`;

  const minutes = delayed ? Number(delay) : 0;
  const delayError =
    delayed && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_DELAY) ? `1 dan ${formatNumber(MAX_DELAY)} gacha daqiqa` : undefined;

  const insert = (token: string) => {
    const element = textRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (delayError) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const updated = await api.patch<NotificationSettingRow>(
        `/notification-settings/${row.event}`,
        { custom_text: text.trim(), delay_minutes: minutes, extra_user_ids: extra },
        { silent: true },
      );
      onSaved(updated);
      toast.success("Bildirishnoma qoidasi saqlandi");
    } catch (caught) {
      const apiError = toApiError(caught);
      setFieldErrors(apiError.fields);
      setError(apiError.detail ?? (Object.keys(apiError.fields).length ? null : apiError.message));
    } finally {
      setSaving(false);
    }
  };

  const preview = text.trim()
    ? text
        .replaceAll("{title}", row.display)
        .replaceAll("{code}", "VZ-000005")
        .replaceAll("{household}", "XN-0001 Aliyevlar")
        .replaceAll("{due}", "08.11.2026")
        .replaceAll("{role}", ROLE_LABELS.VET)
        .replaceAll("{text}", "(standart matn)")
    : "";

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-lg border border-line bg-subtle/60 px-3 py-4 sm:px-4">
      <Field
        label="Xabar matni"
        htmlFor={`${id}-text`}
        error={fieldErrors.custom_text}
        hint="Bo‘sh qolsa standart matn yuboriladi. {text} — standart matnni qo‘shadi."
      >
        <Textarea
          ref={textRef}
          id={`${id}-text`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="{title}: {household} uchun {code} vazifasi. Muddat: {due}"
        />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {PLACEHOLDERS.map((item) => (
          <button
            key={item.value}
            type="button"
            title={item.value}
            onClick={() => insert(item.value)}
            className="h-7 rounded-md bg-surface px-2 text-xs text-ink ring-1 ring-inset ring-line transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="font-mono">{item.value}</span> <span className="text-muted">{item.label}</span>
          </button>
        ))}
      </div>
      {preview && (
        <p className="rounded-md bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-inset ring-line">
          <span className="text-muted">Namuna: </span>
          {preview}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qachon yuborish" htmlFor={`${id}-delay-mode`}>
          <Select id={`${id}-delay-mode`} value={delayed ? "later" : "now"} onChange={(event) => setDelayed(event.target.value === "later")}>
            <option value="now">Darhol</option>
            <option value="later">Kechiktirib</option>
          </Select>
        </Field>
        {delayed && (
          <Field label="Necha daqiqadan keyin" htmlFor={`${id}-delay`} error={delayError ?? fieldErrors.delay_minutes} hint={delayText(minutes)}>
            <Input
              id={`${id}-delay`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DELAY}
              step={1}
              value={delay}
              invalid={Boolean(delayError)}
              onChange={(event) => setDelay(event.target.value)}
            />
          </Field>
        )}
        {delayed && (
          <div className="flex flex-wrap gap-1.5 sm:col-span-2">
            {DELAY_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={minutes === value}
                onClick={() => setDelay(String(value))}
                className="h-7 rounded-md bg-surface px-2.5 text-xs text-muted ring-1 ring-inset ring-line hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent"
              >
                {delayText(value).replace(" keyin", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink">Qo‘shimcha qabul qiluvchilar</span>
        {extra.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {extra.map((userId) => {
              const user = userById(userId);
              return (
                <span key={userId} className="inline-flex h-7 items-center gap-1 rounded-md bg-accent-soft pl-2.5 text-xs font-medium text-accent">
                  {user ? user.full_name : `#${userId}`}
                  {user && !user.telegram_linked && <span className="font-normal text-warning-ink">(Telegram yo‘q)</span>}
                  <button
                    type="button"
                    aria-label="Olib tashlash"
                    onClick={() => setExtra(extra.filter((item) => item !== userId))}
                    className="flex size-7 items-center justify-center rounded-md hover:bg-accent/10"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <SearchInput id={`${id}-user-search`} label="Foydalanuvchi qidirish" placeholder="Ism, login yoki telefon" value={search} onChange={setSearch} />
        {debounced && (
          <div className="rounded-lg border border-line bg-surface">
            {found.error ? (
              <p className="px-3 py-2 text-[13px] text-danger">{found.error.message}</p>
            ) : !found.data ? (
              <p className="px-3 py-2 text-[13px] text-muted">Qidirilmoqda…</p>
            ) : found.data.results.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-muted">Topilmadi</p>
            ) : (
              <ul className="divide-y divide-line">
                {found.data.results.map((user) => {
                  const added = extra.includes(user.id);
                  return (
                    <li key={user.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{user.full_name}</span>
                        <span className="text-muted"> · {user.is_super_admin ? "Super Admin" : ROLE_LABELS[user.role]}</span>
                        {!user.telegram_linked && <span className="text-warning-ink"> · Telegram yo‘q</span>}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={added}
                        icon={<Plus className="size-3.5" aria-hidden />}
                        onClick={() => setExtra([...extra, user.id])}
                      >
                        {added ? "Qo‘shilgan" : "Qo‘shish"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {fieldErrors.extra_user_ids ? (
          <p className="text-[13px] text-danger">{fieldErrors.extra_user_ids}</p>
        ) : (
          <p className="text-xs text-muted">Rollardan tashqari shu foydalanuvchilarga ham yuboriladi.</p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" icon={<History className="size-4" aria-hidden />} onClick={() => setVersionsOpen(true)} className="sm:mr-auto">
          Versiyalar
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Yopish
        </Button>
        <Button loading={saving} onClick={save} disabled={Boolean(delayError)}>
          Saqlash
        </Button>
      </div>
      {versionsOpen && (
        <NotificationVersionsModal
          row={row}
          onClose={() => setVersionsOpen(false)}
          onReverted={(rows) => {
            setVersionsOpen(false);
            onReverted(rows);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function versionSummary(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.enabled === false) parts.push("o‘chirilgan");
  if (data.telegram_enabled === false) parts.push("Telegramsiz");
  if (Array.isArray(data.roles)) {
    parts.push(`rollar: ${(data.roles as string[]).map((role) => ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role).join(", ") || "yo‘q"}`);
  }
  if (typeof data.custom_text === "string" && data.custom_text.trim()) parts.push("maxsus matn");
  if (typeof data.delay_minutes === "number") parts.push(delayText(data.delay_minutes).toLowerCase());
  if (Array.isArray(data.extra_user_ids) && data.extra_user_ids.length) parts.push(`+${data.extra_user_ids.length} foydalanuvchi`);
  return parts.join(" · ");
}

function NotificationVersionsModal({
  row,
  onClose,
  onReverted,
}: {
  row: NotificationSettingRow;
  onClose: () => void;
  onReverted: (rows: NotificationSettingRow[]) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const versions = useApi<ConfigVersion[]>(`/notification-settings/${row.event}/versions`);
  const list = versions.data;

  const revert = (version: ConfigVersion) =>
    void confirm({
      title: "Shu versiyaga qaytarish",
      confirmLabel: "Qaytarish",
      message: (
        <p>
          “{row.display}” sozlamasi {version.version}-versiya holatiga qaytariladi. Bu ham yangi versiya sifatida
          yoziladi.
        </p>
      ),
      onConfirm: async () => {
        await api.post(`/notification-settings/${row.event}/revert`, { version: version.version });
        const rows = await api.get<NotificationSettingRow[]>("/notification-settings");
        toast.success("Sozlama qaytarildi");
        onReverted(rows);
      },
    });

  return (
    <Modal
      title="Versiyalar tarixi"
      description={row.display}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      {!list && versions.error ? (
        <ErrorState error={versions.error} onRetry={versions.reload} />
      ) : !list ? (
        <TableSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyState icon={History} title="Hali o‘zgarishlar yo‘q" />
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((version, index) => (
            <li key={version.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line px-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {version.version}-versiya
                  {index === 0 && <Badge tone="success">Hozirgi</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateTime(version.created_at)}
                  {version.created_by_name ? ` · ${version.created_by_name}` : ""}
                </p>
                {versionSummary(version.data) && <p className="mt-1 text-[13px] text-ink">{versionSummary(version.data)}</p>}
                {version.comment && <p className="mt-1 text-[13px] text-muted">{version.comment}</p>}
              </div>
              {index > 0 && (
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => revert(version)}>
                  Shu versiyaga qaytarish
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
