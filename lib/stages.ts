/**
 * The 10-stage chain (ARCHITECTURE_V2 §2), mirrored from the backend `cases/stages.py`.
 * The server is the source of truth for titles/status; this file only adds the form fields
 * each stage's executor fills in. Data keys are sent as `data: {key: value}` on submit.
 */
import type { CaseStage, Role, StageStatus } from "./types";

export type FieldDef =
  | { key: string; label: string; type: "int"; required?: boolean; min?: number; suffix?: string }
  | { key: string; label: string; type: "text"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "textarea"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "select"; required?: boolean; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "check"; required?: boolean };

export interface StageDef {
  number: number;
  key: string;
  title: string;
  executor: Role;
  approver: Role | null;
  days: number;
  fields: FieldDef[];
  /** at least one live photo required */
  photos: boolean;
  /** optional documents */
  documents: boolean;
  /** label of the note field; null = no separate note */
  note: { label: string; required: boolean } | null;
}

export const HEALTH_OPTIONS = [
  { value: "good", label: "Yaxshi" },
  { value: "normal", label: "O‘rtacha" },
  { value: "bad", label: "Yomon" },
];

export const FINANCING_OPTIONS = [
  { value: "grant", label: "Grant (bepul)" },
  { value: "credit", label: "Kredit" },
  { value: "installment", label: "Bo‘lib to‘lash" },
  { value: "own", label: "O‘z mablag‘i" },
];

export const STAGES: StageDef[] = [
  {
    number: 1,
    key: "inspection",
    title: "Inspeksiya",
    executor: "INSPECTOR",
    approver: null,
    days: 2,
    fields: [{ key: "conclusion", label: "Inspektor xulosasi", type: "textarea", required: true }],
    photos: true,
    documents: true,
    note: null,
  },
  {
    number: 2,
    key: "hr",
    title: "HR tekshiruvi",
    executor: "HR",
    approver: null,
    days: 2,
    fields: [],
    photos: false,
    documents: true,
    note: { label: "Izoh", required: false },
  },
  {
    number: 3,
    key: "director",
    title: "Direktor qarori",
    executor: "DIRECTOR",
    approver: null,
    days: 2,
    fields: [],
    photos: false,
    documents: false,
    note: { label: "Qaror (izoh)", required: false },
  },
  {
    number: 4,
    key: "construction",
    title: "Qurilish",
    executor: "BUILDER",
    approver: "ADMIN",
    days: 14,
    fields: [],
    photos: true,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 5,
    key: "warehouse",
    title: "Ombordan berish",
    executor: "WAREHOUSE",
    approver: "ADMIN",
    days: 2,
    fields: [{ key: "issued", label: "Paket mahsulotlari to‘liq berildi", type: "check", required: true }],
    photos: false,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 6,
    key: "incubation",
    title: "Inkubatsiya",
    executor: "INCUBATOR",
    approver: "ADMIN",
    days: 21,
    fields: [{ key: "chicks_count", label: "Jo‘jalar soni", type: "int", required: true, min: 1, suffix: "dona" }],
    photos: true,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 7,
    key: "logistics",
    title: "Yetkazib berish",
    executor: "LOGISTICS",
    approver: "ADMIN",
    days: 2,
    fields: [],
    photos: true,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 8,
    key: "vet",
    title: "Veterinar ko‘rigi",
    executor: "VET",
    approver: "ADMIN",
    days: 2,
    fields: [{ key: "health", label: "Sog‘lig‘i", type: "select", required: true, options: HEALTH_OPTIONS }],
    photos: true,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 9,
    key: "acceptance",
    title: "Parrandani qabul qilish",
    executor: "OWNER",
    approver: "ADMIN",
    days: 2,
    fields: [{ key: "received_count", label: "Qabul qilingan jo‘jalar soni", type: "int", required: true, min: 0, suffix: "dona" }],
    photos: true,
    documents: false,
    note: { label: "Izoh", required: false },
  },
  {
    number: 10,
    key: "accounting",
    title: "Buxgalteriya",
    executor: "ACCOUNTANT",
    approver: "SUPERADMIN",
    days: 3,
    fields: [
      { key: "financing_type", label: "Moliyalashtirish turi", type: "select", required: true, options: FINANCING_OPTIONS },
      { key: "amount", label: "Summa", type: "int", required: true, min: 0, suffix: "so‘m" },
      { key: "contract_no", label: "Shartnoma raqami", type: "text", required: true },
    ],
    photos: false,
    documents: false,
    note: { label: "Izoh", required: false },
  },
];

export function stageDef(number: number): StageDef | undefined {
  return STAGES.find((stage) => stage.number === number);
}

/**
 * The stage's form config: the backend's `fields` / `min_photos` win when the API sends them
 * (so `cases/stages.py` stays the single source); local extras (stage 5 confirmation tick) are kept.
 */
export function resolveStageDef(stage: CaseStage): StageDef | undefined {
  const local = stageDef(stage.number);
  if (!local) return undefined;
  if (!Array.isArray(stage.fields)) return local;
  const serverKeys = new Set(stage.fields.map((f) => f.name));
  const fields: FieldDef[] = stage.fields.map((f): FieldDef => {
    const own = local.fields.find((l) => l.key === f.name);
    const required = f.required !== false;
    if (f.type === "int") return { key: f.name, label: f.label, type: "int", required, min: own?.type === "int" ? own.min : undefined, suffix: own?.type === "int" ? own.suffix : undefined };
    if (f.type === "choice" && f.choices?.length) return { key: f.name, label: f.label, type: "select", required, options: f.choices };
    if (own?.type === "select") return { ...own, label: f.label, required };
    if (own?.type === "textarea") return { key: f.name, label: f.label, type: "textarea", required };
    return { key: f.name, label: f.label, type: "text", required };
  });
  const extras = local.fields.filter((l) => l.type === "check" && !serverKeys.has(l.key));
  return {
    ...local,
    title: stage.title || local.title,
    fields: [...fields, ...extras],
    photos: stage.min_photos !== undefined ? stage.min_photos > 0 : local.photos,
  };
}

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  WAITING: "Kutilmoqda",
  ACTIVE: "Bajarilmoqda",
  SUBMITTED: "Tasdiq kutilmoqda",
  RETURNED: "Qaytarilgan",
  DONE: "Bajarildi",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "Jarayonda",
  DONE: "Yakunlangan",
  REJECTED: "Rad etilgan",
};

/** Human label for a stored data value (select options are shown by label). */
export function dataLabel(stageNumber: number, key: string, value: unknown): { label: string; value: string } {
  const def = stageDef(stageNumber)?.fields.find((field) => field.key === key);
  const label = def?.label ?? DATA_LABELS[key] ?? key;
  let text: string;
  if (typeof value === "boolean") text = value ? "Ha" : "Yo‘q";
  else if (value === null || value === undefined || value === "") text = "—";
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  if (def?.type === "select") text = def.options.find((option) => option.value === value)?.label ?? text;
  if (def?.type === "int" && typeof value !== "object" && text !== "—") {
    const n = Number(value);
    text = `${Number.isFinite(n) ? n.toLocaleString("ru-RU").replace(/,/g, " ") : text}${def.suffix ? ` ${def.suffix}` : ""}`;
  }
  return { label, value: text };
}

const DATA_LABELS: Record<string, string> = {
  conclusion: "Xulosa",
  package_id: "Paket",
  latitude: "Kenglik",
  longitude: "Uzunlik",
  issued_items: "Berilgan mahsulotlar",
};
