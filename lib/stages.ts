/**
 * The 13-stage chain (ARCHITECTURE_V2 §2 + ARCHITECTURE_V2_1 §2), mirrored from the backend `cases/stages.py`.
 * The server is the source of truth for titles/status; this file only adds the form fields
 * each stage's executor fills in. Data keys are sent as `data: {key: value}` on submit.
 */
import type { CaseDetail, CaseStage, Role, StageStatus } from "./types";

export type FieldDef = (
  | { key: string; label: string; type: "int"; required?: boolean; min?: number; suffix?: string }
  | { key: string; label: string; type: "decimal"; required?: boolean; min?: number; digits?: number; suffix?: string; positive?: boolean }
  | { key: string; label: string; type: "text"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "textarea"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "select"; required?: boolean; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "check"; required?: boolean }
) & { /** help text from the server (`help`) */ hint?: string };

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
  /** submit button label (default "Bajarildi") */
  submitLabel?: string;
  /** groups of field keys where at least one value must be filled (stage 13: revenue OR price_per_kg) */
  oneOf?: { keys: string[]; message: string }[];
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

export const OWNER_STAGE = 9;
export const GROWING_STAGE = 10;
export const LAST_STAGE = 13;

const NOTE = { label: "Izoh", required: false };

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
  { number: 2, key: "hr", title: "HR tekshiruvi", executor: "HR", approver: null, days: 2, fields: [], photos: false, documents: true, note: NOTE },
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
  { number: 4, key: "construction", title: "Qurilish", executor: "BUILDER", approver: "ADMIN", days: 14, fields: [], photos: true, documents: false, note: NOTE },
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
    note: NOTE,
  },
  {
    number: 6,
    key: "incubation",
    title: "Inkubatsiya",
    executor: "INCUBATOR",
    approver: "ADMIN",
    days: 21,
    fields: [{ key: "chicks_count", label: "Berilgan jo‘jalar soni", type: "int", required: true, min: 1, suffix: "dona" }],
    photos: true,
    documents: false,
    note: NOTE,
  },
  {
    number: 7,
    key: "logistics",
    title: "Yetkazib berish",
    executor: "LOGISTICS",
    approver: "ADMIN",
    days: 2,
    fields: [
      { key: "delivered_healthy", label: "Sog‘ yetkazilgan jo‘jalar", type: "int", required: true, min: 0, suffix: "dona" },
      { key: "died_in_transit", label: "Yo‘lda nobud bo‘lgan", type: "int", required: true, min: 0, suffix: "dona" },
    ],
    photos: true,
    documents: false,
    note: NOTE,
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
    note: NOTE,
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
    note: NOTE,
  },
  {
    number: 10,
    key: "growing",
    title: "Parvarish",
    executor: "ADMIN",
    approver: null,
    days: 45,
    fields: [],
    photos: false,
    documents: false,
    note: NOTE,
    submitLabel: "Qushxonaga yuborish",
  },
  {
    number: 11,
    key: "pickup",
    title: "Qushxonaga olib borish",
    executor: "LOGISTICS",
    approver: "ADMIN",
    days: 2,
    fields: [{ key: "picked_up_count", label: "Olib ketilgan parrandalar", type: "int", required: true, min: 0, suffix: "dona" }],
    photos: true,
    documents: false,
    note: NOTE,
  },
  {
    number: 12,
    key: "slaughter",
    title: "Qushxona qabuli",
    executor: "SLAUGHTERHOUSE",
    approver: "ADMIN",
    days: 2,
    fields: [
      { key: "received_count", label: "Qabul qilingan parrandalar", type: "int", required: true, min: 0, suffix: "dona" },
      { key: "total_kg", label: "Umumiy vazn", type: "decimal", required: true, digits: 2, positive: true, suffix: "kg" },
    ],
    photos: false,
    documents: false,
    note: NOTE,
  },
  {
    number: 13,
    key: "accounting",
    title: "Buxgalteriya (yakuniy hisob)",
    executor: "ACCOUNTANT",
    approver: "SUPERADMIN",
    days: 3,
    fields: [
      { key: "financing_type", label: "Moliyalashtirish turi", type: "select", required: true, options: FINANCING_OPTIONS },
      { key: "contract_no", label: "Shartnoma raqami", type: "text", required: true },
      { key: "revenue", label: "Sotuv summasi", type: "int", required: false, min: 0, suffix: "so‘m" },
      { key: "price_per_kg", label: "yoki 1 kg narxi", type: "int", required: false, min: 0, suffix: "so‘m" },
    ],
    photos: false,
    documents: false,
    note: NOTE,
    oneOf: [{ keys: ["revenue", "price_per_kg"], message: "Sotuv summasini yoki 1 kg narxini kiriting" }],
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
  const known = stageDef(stage.number);
  // A server chain that differs from ours (e.g. an older 10-stage backend) wins: its fields are used as they are.
  const local: StageDef | undefined =
    known && (!stage.key || stage.key === known.key)
      ? known
      : stage.fields
        ? {
            number: stage.number,
            key: stage.key,
            title: stage.title || `${stage.number}-bosqich`,
            executor: stage.executor_role ?? known?.executor ?? "ADMIN",
            approver: stage.approver_role ?? null,
            days: 0,
            fields: [],
            photos: (stage.min_photos ?? 0) > 0,
            documents: false,
            note: { label: "Izoh", required: false },
          }
        : known;
  if (!local) return undefined;
  if (!Array.isArray(stage.fields)) return local;
  const serverKeys = new Set(stage.fields.map((f) => f.name));
  const base: StageDef = local;
  const fields: FieldDef[] = stage.fields.map((f): FieldDef => ({ ...toField(f), hint: f.help || undefined }));
  function toField(f: NonNullable<CaseStage["fields"]>[number]): FieldDef {
    const own = base.fields.find((l) => l.key === f.name);
    const required = f.required !== false;
    const min = typeof f.min === "number" ? f.min : undefined;
    if (own?.type === "decimal" || f.type === "decimal")
      return own?.type === "decimal"
        ? { ...own, label: f.label, required, digits: f.decimal_places ?? own.digits, min: min ?? own.min }
        : { key: f.name, label: f.label, type: "decimal", required, digits: f.decimal_places ?? 2, min };
    if (f.type === "int")
      return { key: f.name, label: f.label, type: "int", required, min: min ?? (own?.type === "int" ? own.min : undefined), suffix: own?.type === "int" ? own.suffix : undefined };
    if (f.type === "choice" && f.choices?.length) return { key: f.name, label: f.label, type: "select", required, options: f.choices };
    if (own?.type === "select") return { ...own, label: f.label, required };
    if (own?.type === "textarea") return { key: f.name, label: f.label, type: "textarea", required };
    return { key: f.name, label: f.label, type: "text", required };
  }
  const extras = local.fields.filter((l) => l.type === "check" && !serverKeys.has(l.key));
  return {
    ...local,
    title: stage.title || local.title,
    fields: [...fields, ...extras],
    photos: stage.min_photos !== undefined ? stage.min_photos > 0 : local.photos,
    oneOf: local.oneOf?.filter((group) => group.keys.every((key) => serverKeys.has(key))),
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
  if ((def?.type === "int" || def?.type === "decimal") && typeof value !== "object" && text !== "—") {
    const n = Number(value);
    text = `${Number.isFinite(n) ? fmtPlain(n) : text}${def.suffix ? ` ${def.suffix}` : ""}`;
  }
  return { label, value: text };
}

function fmtPlain(n: number): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
}

/** Data keys that are shown elsewhere (finance block) and not in the timeline rows. */
export const HIDDEN_DATA_KEYS = new Set(["finance", "carried_over", "from_case"]);

/** Number stored in an earlier stage's data (for cross-stage limits). */
export function stageValue(detail: CaseDetail, stageNumber: number, key: string): number | null {
  const raw = detail.stages?.find((s) => s.number === stageNumber)?.data?.[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cross-stage rules checked before submit (the server checks them too, ARCHITECTURE_V2_1 §2):
 * stage 7 healthy + died ≤ stage 6 chicks; stage 9 received ≤ stage 7 delivered_healthy.
 */
export function crossCheck(stageNumber: number, data: Record<string, unknown>, detail: CaseDetail): Record<string, string> {
  const errors: Record<string, string> = {};
  if (stageNumber === 7) {
    const chicks = stageValue(detail, 6, "chicks_count");
    const total = Number(data.delivered_healthy ?? 0) + Number(data.died_in_transit ?? 0);
    if (chicks !== null && total > chicks) errors.delivered_healthy = `Sog‘ + nobud (${total}) berilgan jo‘jalardan (${chicks}) oshmasin`;
  }
  if (stageNumber === 9) {
    const healthy = stageValue(detail, 7, "delivered_healthy");
    if (healthy !== null && Number(data.received_count ?? 0) > healthy) errors.received_count = `Sog‘ yetkazilgan jo‘jalardan (${healthy}) oshmasin`;
  }
  return errors;
}

/** Short hint under a field, from earlier stages. */
export function fieldHint(stageNumber: number, key: string, detail: CaseDetail): string | undefined {
  const from = (n: number, k: string, label: string, unit = "dona") => {
    const v = stageValue(detail, n, k);
    return v !== null ? `${label}: ${fmtPlain(v)} ${unit}` : undefined;
  };
  if (stageNumber === 7 && key === "delivered_healthy") return from(6, "chicks_count", "Inkubatsiyada berilgan");
  if (stageNumber === 9 && key === "received_count") return from(7, "delivered_healthy", "Sog‘ yetkazilgan");
  if (stageNumber === 11 && key === "picked_up_count") return from(9, "received_count", "Xonadon qabul qilgan");
  if (stageNumber === 12 && key === "received_count") return from(11, "picked_up_count", "Olib ketilgan");
  if (stageNumber === 13 && key === "price_per_kg") {
    const kg = stageValue(detail, 12, "total_kg");
    return kg !== null ? `Summa = narx × ${fmtPlain(kg)} kg` : undefined;
  }
  return undefined;
}

const DATA_LABELS: Record<string, string> = {
  conclusion: "Xulosa",
  package_id: "Paket",
  latitude: "Kenglik",
  longitude: "Uzunlik",
  issued_items: "Berilgan mahsulotlar",
  amount: "Summa",
};
