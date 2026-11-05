"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, isAbortError, toApiError } from "@/lib/api";
import type {
  Blueprint,
  BlueprintKind,
  BlueprintListItem,
  BlueprintStatus,
  BuilderMeta,
  DocumentData,
  FormData_,
  ProcessData,
  RoleData,
  RoleRef,
  TaskData,
} from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/format";
import { useAllPages, useApi } from "@/lib/use-api";
import type { Role } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/badge";

/** `GET /api/builder/meta` (API_CONTRACT_V4 §1.3). */
export function useBuilderMeta() {
  return useApi<BuilderMeta>("/builder/meta");
}

export const KIND_LABELS: Record<BlueprintKind, { one: string; many: string; empty: string }> = {
  role: { one: "Rol profili", many: "Rollar", empty: "Rol profillari yo‘q" },
  form: { one: "Forma", many: "Formalar", empty: "Formalar yo‘q" },
  task: { one: "Vazifa shabloni", many: "Vazifalar", empty: "Vazifa shablonlari yo‘q" },
  process: { one: "Jarayon", many: "Jarayonlar", empty: "Jarayonlar yo‘q" },
  document: { one: "Hujjat shabloni", many: "Hujjatlar", empty: "Hujjat shablonlari yo‘q" },
};

export const STATUS_LABELS: Record<BlueprintStatus, string> = {
  draft: "Qoralama",
  test: "Sinov",
  active: "Faol",
  archived: "Arxivda",
};

export const STATUS_TONES: Record<BlueprintStatus, BadgeTone> = {
  draft: "neutral",
  test: "info",
  active: "success",
  archived: "warning",
};

export const CONDITION_LABELS: Record<"approved" | "submitted", string> = {
  approved: "Tasdiqlanganda",
  submitted: "Topshirilganda",
};

export const SCOPE_LABELS: Record<DocumentData["scope"], string> = {
  task: "Vazifa dalolatnomasi",
  role: "Rol dalolatnomasi",
  general: "Umumiy dalolatnoma",
};

/** Label of a role reference (`"VET"`, `"profile:7"`) from meta, with sensible fallbacks. */
export function refLabel(meta: BuilderMeta | undefined, ref: RoleRef): string {
  if (!ref) return "—";
  const found = meta?.role_refs.find((option) => option.value === ref);
  if (found) return found.label;
  if (ref in ROLE_LABELS) return ROLE_LABELS[ref as Role];
  return ref.startsWith("profile:") ? `Profil #${ref.slice(8)}` : ref;
}

export function optionLabel(options: readonly { value: string; label: string }[] | undefined, value: string): string {
  return options?.find((option) => option.value === value)?.label ?? value;
}

/** Empty `data` for a new blueprint of each kind (valid shape, not necessarily valid content). */
export function emptyData(kind: BlueprintKind): Record<string, unknown> {
  switch (kind) {
    case "role":
      return { base_role: "WAREHOUSE", permissions: {} } satisfies RoleData;
    case "form":
      return { roles: [], fields: [] } satisfies FormData_;
    case "task":
      return {
        executor: "",
        approver: "ADMIN",
        form_id: null,
        document_id: null,
        duration_days: 3,
        start_date: null,
        end_date: null,
        requires_household: true,
        next_condition: "approved",
      } satisfies TaskData;
    case "process":
      return { stages: [] } satisfies ProcessData;
    case "document":
      return {
        scope: "task",
        role: "",
        title: "",
        body: "",
        signatures: [],
        include_photos: true,
        include_approvals: true,
        include_quantities: true,
      } satisfies DocumentData;
  }
}

/** Every blueprint of one kind (all statuses), for select boxes and name lookups. */
export function useBlueprintOptions(kind: BlueprintKind | null) {
  return useAllPages<BlueprintListItem>(kind ? "/builder/blueprints" : null, kind ? { kind } : undefined);
}

/**
 * Full blueprints (with `data`) for a set of ids — the list endpoint has no `data`, but e.g. the task editor
 * must know which document blueprints have scope "task". Small sets only.
 */
export function useBlueprintDetails<D>(ids: readonly number[]): { data: Blueprint<D>[] | undefined; error: ApiError | null } {
  const key = [...ids].sort((a, b) => a - b).join(",");
  const [state, setState] = useState<{ key: string; data?: Blueprint<D>[]; error: ApiError | null }>({ key: "", error: null });
  useEffect(() => {
    const list = key ? key.split(",").map(Number) : [];
    const controller = new AbortController();
    Promise.all(list.map((id) => api.get<Blueprint<D>>(`/builder/blueprints/${id}`, undefined, controller.signal)))
      .then((data) => setState({ key, data, error: null }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setState({ key, error: toApiError(error) });
      });
    return () => controller.abort();
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: undefined, error: null };
}

/** `Maydon (m²)` → `maydon_m2`: a valid form field key (`^[a-z][a-z0-9_]{0,39}$`). */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function slugify(label: string): string {
  const latin = label
    .toLowerCase()
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .split("")
    .map((char) => CYRILLIC[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʻʼ'`]/g, "");
  let slug = latin.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (slug && !/^[a-z]/.test(slug)) slug = `f_${slug}`;
  return slug.slice(0, 40).replace(/_+$/, "");
}

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * Server validation errors of a blueprint save (§1.2): `{"data": ["…"]}` → general messages,
 * `{"data": {"<key>": ["…"]}}` → per-key messages; `name` / `description` errors are kept apart.
 */
export interface BlueprintErrors {
  name?: string;
  description?: string;
  general: string[];
  byKey: Record<string, string>;
}

function flatten(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
  return [];
}

export function parseBlueprintErrors(caught: unknown): BlueprintErrors {
  const error = toApiError(caught);
  const result: BlueprintErrors = { general: [], byKey: {} };
  const body = error.body && typeof error.body === "object" && !Array.isArray(error.body) ? (error.body as Record<string, unknown>) : null;
  if (!body) {
    result.general.push(error.message);
    return result;
  }
  for (const [key, value] of Object.entries(body)) {
    if (key === "name") result.name = flatten(value).join(" ");
    else if (key === "description") result.description = flatten(value).join(" ");
    else if (key === "data" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, messages] of Object.entries(value as Record<string, unknown>)) {
        const text = flatten(messages).join(" ");
        if (text) result.byKey[inner] = text;
      }
    } else {
      result.general.push(...flatten(value));
    }
  }
  if (!result.name && !result.description && result.general.length === 0 && Object.keys(result.byKey).length === 0) {
    result.general.push(error.message);
  }
  return result;
}

/** Toggle chips for a list of role references (empty selection has a meaning: see `emptyHint`). */
export function RoleRefChips({
  options,
  value,
  onChange,
  label,
  emptyHint,
  disabled,
}: {
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  label: string;
  emptyHint?: string;
  disabled?: boolean;
}) {
  // Keep refs that are no longer offered (e.g. an archived profile) visible so they can be removed.
  const extra = value.filter((ref) => !options.some((option) => option.value === ref));
  const all = [...options, ...extra.map((ref) => ({ value: ref, label: ref }))];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {all.map((option) => {
          const on = value.includes(option.value);
          return (
            <ToggleChip
              key={option.value}
              on={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((item) => item !== option.value) : [...value, option.value])}
            >
              {option.label}
            </ToggleChip>
          );
        })}
      </div>
      {emptyHint && value.length === 0 && <p className="text-xs text-muted">{emptyHint}</p>}
    </div>
  );
}

export function ToggleChip({
  on,
  onClick,
  disabled,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
        on ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30" : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Small clickable chip that inserts a token (formula keys, placeholders). */
export function InsertChip({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-7 rounded-md bg-ink/5 px-2 font-mono text-xs text-ink transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

/** Insert `token` into a text control at the cursor and return the new value + cursor position. */
export function insertAt(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
): { value: string; cursor: number } {
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  return { value: next, cursor: start + token.length };
}

/** Restore focus and caret after a programmatic insert. */
export function focusAt(element: HTMLInputElement | HTMLTextAreaElement | null, cursor: number) {
  if (!element) return;
  window.requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(cursor, cursor);
  });
}

/** `[a, b, c]`, move index `from` by `delta` (−1 up, +1 down). */
export function move<T>(list: readonly T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function usageText(usage: BlueprintListItem["usage"] | undefined): string {
  if (!usage) return "—";
  const parts: string[] = [];
  if (usage.users) parts.push(`${usage.users} foydalanuvchi`);
  if (usage.tasks) parts.push(`${usage.tasks} vazifa`);
  if (usage.submissions) parts.push(`${usage.submissions} topshiruv`);
  if (usage.runs) parts.push(`${usage.runs} jarayon`);
  if (usage.referenced_by.length) parts.push(`${usage.referenced_by.length} ta bog‘liq`);
  return parts.length ? parts.join(" · ") : "Ishlatilmagan";
}
