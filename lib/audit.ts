/** Uzbek labels of the audit log (docs/API_CONTRACT_V2.md 2.2) and value formatting for the diff view. */

import {
  CATEGORY_LABELS,
  formatDate,
  formatDateTime,
  formatNumber,
  MOVEMENT_TYPE_LABELS,
  POULTRY_TYPE_LABELS,
  ROLE_LABELS,
  STOCK_TYPE_LABELS,
} from "./format";
import type { AuditAction, AuditModule, AuditObjectType, AuditSource, JsonValue } from "./types";

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  auth: "Tizimga kirish",
  users: "Foydalanuvchilar",
  telegram: "Telegram",
  households: "Xonadonlar",
  batches: "Partiyalar",
  movements: "Parranda harakatlari",
  daily_reports: "Kunlik hisobotlar",
  products: "Mahsulotlar",
  stock: "Ombor operatsiyalari",
  orders: "Buyurtmalar",
  logistics: "Logistika",
  fleet: "Transport va haydovchilar",
  vet: "Veterinariya",
  inventory: "Inventarizatsiya",
  files: "Fayllar",
  settings: "Sozlamalar",
  notifications: "Bildirishnomalar",
  reports: "Hisobotlar",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login_success: "Muvaffaqiyatli kirish",
  login_failure: "Kirish rad etildi",
  password_change: "Parol almashtirildi",
  create: "Yaratildi",
  update: "O‘zgartirildi",
  password_reset: "Parol tiklandi",
  link: "Telegram bog‘landi",
  unlink: "Telegram uzildi",
  status_change: "Holat o‘zgartirildi",
  approve: "Tasdiqlandi",
  logout: "Tizimdan chiqish",
  sessions_revoked: "Sessiyalar yakunlandi",
  upload: "Fayl yuklandi",
  retry: "Qayta yuborildi",
  export: "Eksport",
};

export const AUDIT_SOURCE_LABELS: Record<AuditSource, string> = {
  API: "Web App / API",
  BOT: "Telegram bot",
  ADMIN: "Django admin",
};

export const AUDIT_OBJECT_LABELS: Record<AuditObjectType, string> = {
  User: "Foydalanuvchi",
  Household: "Xonadon",
  PoultryBatch: "Partiya",
  PoultryMovement: "Parranda harakati",
  DailyReport: "Kunlik hisobot",
  Product: "Mahsulot",
  StockTransaction: "Ombor operatsiyasi",
  Order: "Buyurtma",
  LogisticsTask: "Logistika topshirig‘i",
  Vehicle: "Transport vositasi",
  Driver: "Haydovchi",
  VetVisit: "Veterinariya tekshiruvi",
  Vaccination: "Emlash",
  DiseaseRecord: "Kasallik qaydi",
  Treatment: "Davolash",
  VetRequest: "Veterinarga murojaat",
  InventoryCount: "Inventarizatsiya",
  Attachment: "Fayl",
  SystemSettings: "Kompaniya sozlamalari",
  NotificationSetting: "Bildirishnoma sozlamasi",
  Notification: "Bildirishnoma",
  Report: "Hisobot",
};

/** Detail page of the object, when the Web App has one. */
export function auditObjectHref(objectType: string, objectId: number | null): string | null {
  if (objectId === null) return null;
  if (objectType === "Household") return `/households/${objectId}`;
  if (objectType === "PoultryBatch") return `/batches/${objectId}`;
  if (objectType === "Product") return `/warehouse/${objectId}`;
  if (objectType === "Order") return `/orders/${objectId}`;
  if (objectType === "LogisticsTask") return `/logistics/${objectId}`;
  if (objectType === "VetVisit") return `/vet/visits/${objectId}`;
  if (objectType === "InventoryCount") return `/warehouse/inventory/${objectId}`;
  return null;
}

/** Readable names of snapshot keys (2.3); unknown keys are shown as they are. */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  username: "Login",
  first_name: "Ism",
  last_name: "Familiya",
  phone: "Telefon",
  role: "Rol",
  is_active: "Faol",
  must_change_password: "Parolni almashtirish shart",
  telegram_id: "Telegram ID",
  method: "Usul",
  reason: "Sabab",
  code: "Kod",
  name: "Nomi",
  owner_id: "Egasi (ID)",
  region: "Viloyat",
  district: "Tuman",
  mfy: "MFY",
  address: "Manzil",
  latitude: "Kenglik",
  longitude: "Uzunlik",
  contract_info: "Shartnoma",
  poultry_type: "Parranda turi",
  breed: "Zoti",
  initial_quantity: "Boshlang‘ich soni",
  age_days: "Yoshi (kun)",
  supplier: "Yetkazib beruvchi",
  arrived_at: "Kelgan sana",
  initial_weight_g: "Boshlang‘ich vazn (g)",
  health_status: "Sog‘lig‘i holati",
  op_id: "Operatsiya ID",
  batch_id: "Partiya (ID)",
  batch_code: "Partiya",
  household_id: "Xonadon (ID)",
  household_code: "Xonadon",
  type: "Turi",
  quantity: "Miqdori",
  date: "Sana",
  note: "Izoh",
  bird_count: "Parranda soni",
  feed_kg: "Yem (kg)",
  meat_kg: "Go‘sht (kg)",
  deaths: "Nobud",
  avg_weight_g: "O‘rtacha vazn (g)",
  death_op_id: "Nobud operatsiyasi",
  category: "Toifa",
  unit: "Birlik",
  min_stock: "Minimal zaxira",
  product_id: "Mahsulot (ID)",
  product_name: "Mahsulot",
  balance_before: "Qoldiq (oldin)",
  balance_after: "Qoldiq (keyin)",
  document_no: "Hujjat",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Uzbek words for the enum codes stored in snapshots (2.2, 2.3). */
const AUDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  role: ROLE_LABELS,
  poultry_type: POULTRY_TYPE_LABELS,
  category: CATEGORY_LABELS,
  method: { password: "Login va parol", telegram: "Telegram" },
  reason: {
    bad_credentials: "Login yoki parol noto‘g‘ri",
    blocked: "Hisob bloklangan",
    telegram_invalid: "Telegram ma’lumoti yaroqsiz",
    telegram_not_linked: "Telegram bog‘lanmagan",
    relinked: "Boshqa hisobga bog‘landi",
  },
};

/** `type` means a movement type on movements and IN / OUT on stock operations. */
const TYPE_LABELS: Record<string, string> = { ...MOVEMENT_TYPE_LABELS, ...STOCK_TYPE_LABELS };

/** Identifiers and coordinates are shown digit for digit (no thousands separator). */
function isIdentifierKey(key: string): boolean {
  return key === "id" || key.endsWith("_id") || key === "latitude" || key === "longitude" || key === "phone";
}

/**
 * Text of one before/after value: null → "—", booleans in words, dates as DD.MM.YYYY,
 * enum codes in Uzbek, quantities with the space thousands separator.
 */
export function formatAuditValue(value: JsonValue | undefined, key = ""): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ha" : "Yo‘q";
  if (typeof value === "number") return isIdentifierKey(key) ? String(value) : formatNumber(value, 6);
  if (typeof value === "string") {
    const labels = key === "type" ? TYPE_LABELS : AUDIT_VALUE_LABELS[key];
    if (labels?.[value]) return labels[value];
    if (ISO_DATE.test(value)) return formatDate(value);
    if (ISO_DATETIME.test(value)) return formatDateTime(value);
    return value;
  }
  return JSON.stringify(value);
}

export interface DiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

/** Union of the keys of `before` and `after`, `after` order first. */
export function auditDiff(
  before: Record<string, JsonValue> | null,
  after: Record<string, JsonValue> | null,
): DiffRow[] {
  const keys = [...new Set([...Object.keys(after ?? {}), ...Object.keys(before ?? {})])];
  return keys.map((key) => {
    const old = before ? formatAuditValue(before[key], key) : "—";
    const next = after ? formatAuditValue(after[key], key) : "—";
    return { key, label: AUDIT_FIELD_LABELS[key] ?? key, before: old, after: next, changed: old !== next };
  });
}
