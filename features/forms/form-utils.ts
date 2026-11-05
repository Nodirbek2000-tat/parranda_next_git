/**
 * Form values for builder forms (API_CONTRACT_V4 §1.2): editing drafts, client validation that
 * mirrors the server rules, the submit payload and server field errors.
 */

import type { ApiError } from "@/lib/api";
import type { FieldValue, FormField, FormValues, GeoValue, MeAccess, RoleRef } from "@/lib/builder-types";
import { formatDate, formatNumber, formatPhone } from "@/lib/format";
import type { Role } from "@/lib/types";
import { computeAll, numericValue } from "./formula";

/** Editing value of one field (strings while typing; converted by `buildPayload`). */
export type DraftValue = string | string[] | boolean | number | null | { lat: string; lng: string };
export type Draft = Record<string, DraftValue>;

/** File / photo metadata known on the client: attachment id → name (+ content type after an upload). */
export type FileMeta = Record<number, { name: string; content_type?: string }>;

export type FieldErrorMap = Record<string, string>;

/* ---------- Roles ---------- */

/** What role references are matched against: the user's role and optional role profile. */
export interface RoleSubject {
  role: Role;
  is_super_admin?: boolean;
  access?: MeAccess | null;
}

/** `true` when the user matches one of the role references (`"VET"`, `"profile:7"`). Empty list = everyone. */
export function matchesRoleRefs(user: RoleSubject, refs: readonly RoleRef[] | undefined): boolean {
  if (!refs || refs.length === 0) return true;
  const profile = user.access?.profile_id;
  return refs.some((ref) => ref === user.role || (profile != null && ref === `profile:${profile}`));
}

export function isEditable(field: FormField, user: RoleSubject): boolean {
  if (field.type === "computed") return false;
  return matchesRoleRefs(user, field.editable_roles);
}

/* ---------- Draft <-> data ---------- */

const PHONE_RE = /^\+998\d{9}$/;

function isGeo(value: unknown): value is GeoValue {
  return Boolean(value) && typeof value === "object" && "lat" in (value as object) && "lng" in (value as object);
}

/** Draft of one stored value. */
function toDraft(field: FormField, value: FieldValue | undefined): DraftValue {
  if (value === undefined || value === null) {
    if (field.type === "multiselect") return [];
    if (field.type === "geo") return { lat: "", lng: "" };
    if (field.type === "bool") return null;
    if (field.type === "file" || field.type === "photo") return null;
    return "";
  }
  switch (field.type) {
    case "number":
      return typeof value === "number" ? String(value) : String(value);
    case "phone": {
      const text = String(value).replace(/[^\d+]/g, "");
      return text.startsWith("+998") ? text.slice(4) : text.replace(/^998/, "");
    }
    case "multiselect":
      return Array.isArray(value) ? value.map(String) : [];
    case "file":
    case "photo":
      return typeof value === "number" ? value : numericValue(value);
    case "geo":
      return isGeo(value) ? { lat: String(value.lat), lng: String(value.lng) } : { lat: "", lng: "" };
    case "bool":
      return typeof value === "boolean" ? value : null;
    case "computed":
      return typeof value === "number" ? value : numericValue(value);
    default:
      return typeof value === "string" ? value : String(value);
  }
}

/** Initial draft for filling a form (optionally pre-filled from an earlier submission). */
export function initialDraft(fields: readonly FormField[], data?: FormValues | null): Draft {
  const draft: Draft = {};
  for (const field of fields) draft[field.key] = toDraft(field, data?.[field.key]);
  return draft;
}

/** File names of an earlier submission (`display[].file_id`), so pre-filled files show their names. */
export function fileMetaFromDisplay(display: readonly { file_id?: number; value: string }[] | undefined): FileMeta {
  const meta: FileMeta = {};
  for (const item of display ?? []) if (item.file_id) meta[item.file_id] = { name: item.value };
  return meta;
}

function isEmpty(value: DraftValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return value.lat.trim() === "" && value.lng.trim() === "";
  return false;
}

/** Live values of computed fields (client-side, same grammar as the server). */
export function computedValues(fields: readonly FormField[], draft: Draft): Record<string, number | null> {
  return computeAll(fields, draft);
}

/* ---------- Validation ---------- */

const MSG_REQUIRED = "Bu maydonni to‘ldiring.";

/** Client checks mirroring the field rules. Only editable fields are checked (the server ignores the rest). */
export function validateDraft(fields: readonly FormField[], draft: Draft, user: RoleSubject): FieldErrorMap {
  const errors: FieldErrorMap = {};
  for (const field of fields) {
    if (!isEditable(field, user)) continue;
    const value = draft[field.key];
    if (isEmpty(value)) {
      if (field.required) errors[field.key] = field.type === "bool" ? "Ha yoki Yo‘q ni tanlang." : MSG_REQUIRED;
      continue;
    }
    const rules = field.validation ?? {};
    switch (field.type) {
      case "number": {
        const number = numericValue(value);
        if (number === null) errors[field.key] = "Raqam kiriting.";
        else if (rules.min != null && number < rules.min) errors[field.key] = `Qiymat ${formatNumber(rules.min)} dan kam bo‘lmasin.`;
        else if (rules.max != null && number > rules.max) errors[field.key] = `Qiymat ${formatNumber(rules.max)} dan oshmasin.`;
        break;
      }
      case "text": {
        const text = String(value).trim();
        if (rules.min_length != null && text.length < rules.min_length)
          errors[field.key] = `Kamida ${rules.min_length} ta belgi kiriting.`;
        else if (rules.max_length != null && text.length > rules.max_length)
          errors[field.key] = `Ko‘pi bilan ${rules.max_length} ta belgi kiritish mumkin.`;
        else if (rules.pattern) {
          try {
            if (!new RegExp(rules.pattern).test(text)) errors[field.key] = "Qiymat talab qilingan formatga mos emas.";
          } catch {
            // An invalid pattern is the server's business.
          }
        }
        break;
      }
      case "phone":
        if (!PHONE_RE.test(`+998${String(value)}`)) errors[field.key] = "Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin.";
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) errors[field.key] = "Sanani tanlang.";
        break;
      case "time":
        if (!/^\d{2}:\d{2}$/.test(String(value))) errors[field.key] = "Vaqtni SS:DD ko‘rinishida kiriting.";
        break;
      case "select":
        if (field.options && !field.options.includes(String(value))) errors[field.key] = "Ro‘yxatdan tanlang.";
        break;
      case "multiselect": {
        const list = value as string[];
        if (field.options && list.some((item) => !field.options?.includes(item))) errors[field.key] = "Ro‘yxatdan tanlang.";
        break;
      }
      case "geo": {
        const geo = value as { lat: string; lng: string };
        const lat = numericValue(geo.lat);
        const lng = numericValue(geo.lng);
        if (lat === null || lng === null) errors[field.key] = "Kenglik va uzunlikni kiriting.";
        else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) errors[field.key] = "Koordinatalar noto‘g‘ri.";
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

/* ---------- Payload ---------- */

function toValue(field: FormField, value: DraftValue): FieldValue {
  if (isEmpty(value)) return field.type === "multiselect" ? [] : null;
  switch (field.type) {
    case "number":
      return numericValue(value);
    case "phone":
      return `+998${String(value)}`;
    case "text":
      return String(value).trim();
    case "multiselect":
      return value as string[];
    case "file":
    case "photo":
      return typeof value === "number" ? value : null;
    case "geo": {
      const geo = value as { lat: string; lng: string };
      const lat = numericValue(geo.lat);
      const lng = numericValue(geo.lng);
      return lat === null || lng === null ? null : { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
    case "bool":
      return value as boolean;
    default:
      return String(value);
  }
}

/** `data` for submit: editable fields only (computed values are calculated by the server). */
export function buildPayload(fields: readonly FormField[], draft: Draft, user: RoleSubject): FormValues {
  const data: FormValues = {};
  for (const field of fields) {
    if (!isEditable(field, user)) continue;
    data[field.key] = toValue(field, draft[field.key]);
  }
  return data;
}

/* ---------- Server errors ---------- */

function messages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(messages);
  if (value && typeof value === "object") return Object.values(value).flatMap(messages);
  return [];
}

/**
 * Splits a 400 answer into per-field messages (`{"data": {"<key>": ["…"]}}`) and a general message
 * (`{"data": ["…"]}`, `detail`, other keys).
 */
export function serverFieldErrors(error: ApiError, keys: readonly string[]): { fields: FieldErrorMap; general: string | null } {
  const fields: FieldErrorMap = {};
  const general: string[] = [];
  const body = error.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [name, value] of Object.entries(body as Record<string, unknown>)) {
      if (name === "data" && value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
          const list = messages(text);
          if (list.length === 0) continue;
          if (keys.includes(key)) fields[key] = list.join(" ");
          else general.push(...list);
        }
      } else {
        general.push(...messages(value));
      }
    }
  }
  if (Object.keys(fields).length === 0 && general.length === 0) general.push(error.message);
  return { fields, general: general.length > 0 ? general.join(" ") : null };
}

/* ---------- Display ---------- */

/** Human text of a stored value (read-only fields). */
export function displayValue(field: FormField, value: DraftValue | undefined, files: FileMeta): string {
  if (isEmpty(value)) return "—";
  switch (field.type) {
    case "number":
    case "computed": {
      const number = numericValue(value);
      return number === null ? "—" : formatNumber(number);
    }
    case "phone":
      return formatPhone(`+998${String(value)}`);
    case "date":
      return formatDate(String(value));
    case "multiselect":
      return (value as string[]).join(", ");
    case "bool":
      return value ? "Ha" : "Yo‘q";
    case "geo": {
      const geo = value as { lat: string; lng: string };
      return `${geo.lat}, ${geo.lng}`;
    }
    case "file":
    case "photo":
      return typeof value === "number" ? (files[value]?.name ?? `Fayl #${value}`) : "—";
    default:
      return String(value);
  }
}
