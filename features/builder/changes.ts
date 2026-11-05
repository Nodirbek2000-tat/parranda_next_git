import type {
  BlueprintKind,
  BuilderMeta,
  DocumentData,
  FormData_,
  FormField,
  ProcessData,
  RoleData,
  TaskData,
} from "@/lib/builder-types";
import { formatDate } from "@/lib/format";
import { CONDITION_LABELS, optionLabel, refLabel, SCOPE_LABELS } from "./shared";

/** What a blueprint version consists of (`Blueprint`, `pending`, `ConfigVersion`). */
export interface Snapshot {
  name: string;
  description: string;
  data: Record<string, unknown>;
}

/** id → name of other blueprints (forms, documents, task templates) for readable references. */
export type NameLookup = (id: number | null | undefined) => string;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function quote(value: string): string {
  return value ? `“${value}”` : "bo‘sh";
}

function refs(meta: BuilderMeta | undefined, list: readonly string[] | undefined): string {
  return list && list.length ? list.map((ref) => refLabel(meta, ref)).join(", ") : "hammasi";
}

function roleChanges(before: RoleData, after: RoleData, meta: BuilderMeta | undefined): string[] {
  const lines: string[] = [];
  if (before.base_role !== after.base_role) {
    lines.push(
      `Asosiy rol: ${optionLabel(meta?.system_roles, before.base_role)} → ${optionLabel(meta?.system_roles, after.base_role)}`,
    );
  }
  const modules = new Set([...Object.keys(before.permissions ?? {}), ...Object.keys(after.permissions ?? {})]);
  for (const mod of modules) {
    const was = before.permissions?.[mod] ?? [];
    const now = after.permissions?.[mod] ?? [];
    const added = now.filter((action) => !was.includes(action)).map((action) => optionLabel(meta?.actions, action));
    const removed = was.filter((action) => !now.includes(action)).map((action) => optionLabel(meta?.actions, action));
    if (!added.length && !removed.length) continue;
    const parts = [...added.map((label) => `+${label}`), ...removed.map((label) => `−${label}`)];
    lines.push(`${optionLabel(meta?.modules, mod)}: ${parts.join(", ")}`);
  }
  return lines;
}

const FIELD_PROPS: [keyof FormField, string][] = [
  ["label", "nomi"],
  ["key", "kaliti"],
  ["type", "turi"],
  ["required", "majburiyligi"],
  ["help", "izohi"],
  ["options", "variantlari"],
  ["validation", "cheklovlari"],
  ["formula", "formulasi"],
  ["visible_roles", "kim ko‘radi"],
  ["editable_roles", "kim tahrirlaydi"],
];

function formChanges(before: FormData_, after: FormData_, meta: BuilderMeta | undefined): string[] {
  const lines: string[] = [];
  if (!same(before.roles, after.roles)) lines.push(`Kim to‘ldiradi: ${refs(meta, before.roles)} → ${refs(meta, after.roles)}`);
  const was = before.fields ?? [];
  const now = after.fields ?? [];
  const wasKeys = was.map((field) => field.key);
  const nowKeys = now.map((field) => field.key);
  const added = now.filter((field) => !wasKeys.includes(field.key));
  const removed = was.filter((field) => !nowKeys.includes(field.key));
  if (added.length) lines.push(`Qo‘shilgan maydonlar: ${added.map((field) => field.label || field.key).join(", ")}`);
  if (removed.length) lines.push(`O‘chirilgan maydonlar: ${removed.map((field) => field.label || field.key).join(", ")}`);
  for (const field of now) {
    const old = was.find((item) => item.key === field.key);
    if (!old) continue;
    const changed = FIELD_PROPS.filter(([prop]) => !same(old[prop] ?? emptyProp(prop), field[prop] ?? emptyProp(prop))).map(
      ([, label]) => label,
    );
    if (changed.length) lines.push(`“${field.label || field.key}” maydoni: ${changed.join(", ")} o‘zgargan`);
  }
  const commonWas = wasKeys.filter((key) => nowKeys.includes(key));
  const commonNow = nowKeys.filter((key) => wasKeys.includes(key));
  if (!same(commonWas, commonNow)) lines.push("Maydonlar tartibi o‘zgargan");
  return lines;
}

function emptyProp(prop: keyof FormField): unknown {
  if (prop === "options" || prop === "visible_roles" || prop === "editable_roles") return [];
  if (prop === "help" || prop === "formula") return "";
  return null;
}

function taskChanges(before: TaskData, after: TaskData, meta: BuilderMeta | undefined, names: NameLookup): string[] {
  const lines: string[] = [];
  const approver = (value: string) => (value ? refLabel(meta, value) : "Tasdiqlash shart emas");
  const days = (value: number | null) => (value === null || value === undefined ? "belgilanmagan" : `${value} kun`);
  const date = (value: string | null) => (value ? formatDate(value) : "—");
  if (before.executor !== after.executor) lines.push(`Ijrochi: ${refLabel(meta, before.executor)} → ${refLabel(meta, after.executor)}`);
  if (before.approver !== after.approver) lines.push(`Tasdiqlovchi: ${approver(before.approver)} → ${approver(after.approver)}`);
  if (before.form_id !== after.form_id) lines.push(`Forma: ${names(before.form_id)} → ${names(after.form_id)}`);
  if (before.document_id !== after.document_id) lines.push(`Hujjat: ${names(before.document_id)} → ${names(after.document_id)}`);
  if (before.duration_days !== after.duration_days) lines.push(`Muddat: ${days(before.duration_days)} → ${days(after.duration_days)}`);
  if (before.start_date !== after.start_date || before.end_date !== after.end_date) {
    lines.push(`Sana oralig‘i: ${date(before.start_date)} – ${date(before.end_date)} → ${date(after.start_date)} – ${date(after.end_date)}`);
  }
  if (before.requires_household !== after.requires_household) {
    lines.push(after.requires_household ? "Endi xonadon tanlash shart" : "Endi xonadon tanlash shart emas");
  }
  if (before.next_condition !== after.next_condition) {
    lines.push(`Keyingi bosqich sharti: ${CONDITION_LABELS[before.next_condition] ?? before.next_condition} → ${CONDITION_LABELS[after.next_condition] ?? after.next_condition}`);
  }
  return lines;
}

function processChanges(before: ProcessData, after: ProcessData, meta: BuilderMeta | undefined, names: NameLookup): string[] {
  const lines: string[] = [];
  const was = before.stages ?? [];
  const now = after.stages ?? [];
  if (was.length !== now.length) lines.push(`Bosqichlar soni: ${was.length} → ${now.length}`);
  now.forEach((stage, index) => {
    const old = was[index];
    if (!old) {
      lines.push(`${index + 1}-bosqich qo‘shilgan: ${stage.title || names(stage.task_id)}`);
      return;
    }
    const parts: string[] = [];
    if (old.title !== stage.title) parts.push(`nomi ${quote(old.title)} → ${quote(stage.title)}`);
    if (old.task_id !== stage.task_id) parts.push(`vazifa ${names(old.task_id)} → ${names(stage.task_id)}`);
    if (!same(old.notify_roles, stage.notify_roles)) parts.push(`xabar oluvchilar: ${refs(meta, stage.notify_roles)}`);
    if (old.condition !== stage.condition) parts.push(`shart: ${CONDITION_LABELS[stage.condition] ?? stage.condition}`);
    if (parts.length) lines.push(`${index + 1}-bosqich: ${parts.join("; ")}`);
  });
  was.slice(now.length).forEach((stage, offset) => {
    lines.push(`${now.length + offset + 1}-bosqich olib tashlangan: ${stage.title || names(stage.task_id)}`);
  });
  return lines;
}

function documentChanges(before: DocumentData, after: DocumentData, meta: BuilderMeta | undefined): string[] {
  const lines: string[] = [];
  if (before.scope !== after.scope) lines.push(`Turi: ${SCOPE_LABELS[before.scope] ?? before.scope} → ${SCOPE_LABELS[after.scope] ?? after.scope}`);
  if ((before.role ?? "") !== (after.role ?? "")) {
    lines.push(`Rol: ${optionLabel(meta?.system_roles, before.role ?? "") || "—"} → ${optionLabel(meta?.system_roles, after.role ?? "") || "—"}`);
  }
  if (before.title !== after.title) lines.push(`Sarlavha: ${quote(before.title)} → ${quote(after.title)}`);
  if (before.body !== after.body) lines.push("Hujjat matni o‘zgargan");
  if (!same(before.signatures, after.signatures)) lines.push(`Imzolar: ${(after.signatures ?? []).join(", ") || "yo‘q"}`);
  const toggles: [keyof DocumentData, string][] = [
    ["include_photos", "Rasmlar"],
    ["include_approvals", "Tasdiqlar"],
    ["include_quantities", "Miqdorlar"],
  ];
  for (const [key, label] of toggles) {
    if (before[key] !== after[key]) lines.push(`${label}: ${after[key] ? "qo‘shiladi" : "qo‘shilmaydi"}`);
  }
  return lines;
}

/**
 * Human-readable list of what changed between two versions (no JSON). Always non-empty when anything
 * differs; falls back to "Ma’lumotlar o‘zgargan" when the kind-specific comparison finds nothing to name.
 */
export function describeChanges(
  kind: BlueprintKind,
  before: Snapshot,
  after: Snapshot,
  meta: BuilderMeta | undefined,
  names: NameLookup = (id) => (id ? `#${id}` : "—"),
): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`Nomi: ${quote(before.name)} → ${quote(after.name)}`);
  if ((before.description ?? "") !== (after.description ?? "")) lines.push("Tavsif o‘zgargan");
  if (!same(before.data, after.data)) {
    let details: string[] = [];
    try {
      const a = before.data as never;
      const b = after.data as never;
      if (kind === "role") details = roleChanges(a, b, meta);
      else if (kind === "form") details = formChanges(a, b, meta);
      else if (kind === "task") details = taskChanges(a, b, meta, names);
      else if (kind === "process") details = processChanges(a, b, meta, names);
      else if (kind === "document") details = documentChanges(a, b, meta);
    } catch {
      details = [];
    }
    lines.push(...(details.length ? details : ["Ma’lumotlar o‘zgargan"]));
  }
  return lines;
}
