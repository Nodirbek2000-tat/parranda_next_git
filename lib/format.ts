import type {
  MovementType,
  PoultryType,
  ProductCategory,
  ProductUnit,
  Role,
  StockType,
} from "./types";

const TIME_ZONE = "Asia/Tashkent";
const NBSP = " ";

/* ---------- Numbers ---------- */

/**
 * 1500 -> "1 500", 310.5 -> "310.5" (space thousands separator, "." decimals as in the
 * bot and docs/API_CONTRACT_V2.md 6.2). Trailing zeros are dropped; see formatFixed().
 */
export function formatNumber(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const fixed = Number(value.toFixed(maxFractionDigits));
  return groupDigits(Math.abs(fixed).toString(), fixed < 0);
}

/** Fixed number of decimals, as the API rounds each metric: 81 -> "81.0", 0.11 -> "0.110". */
export function formatFixed(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const text = Math.abs(value).toFixed(digits);
  // -0.0 is shown as 0.0
  const negative = value < 0 && Number(text) !== 0;
  return groupDigits(text, negative);
}

function groupDigits(text: string, negative: boolean): string {
  const [intPart, fracPart] = text.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negative ? "−" : ""}${grouped}${fracPart ? `.${fracPart}` : ""}`;
}

export function formatQuantity(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  return `${formatNumber(value)}${NBSP}${unit}`;
}

/** 81.3 -> "81.3%" (always one decimal, the API precision of every *_pct metric). */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatFixed(value, digits)}%`;
}

/** Large numbers on chart axes (Uzbek words): 1 200 -> "1 200", 12 500 -> "12.5 ming", 2 000 000 -> "2 mln". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)}${NBSP}mln`;
  if (abs >= 10_000) return `${formatNumber(value / 1_000, 1)}${NBSP}ming`;
  return formatNumber(value, 2);
}

/* ---------- Phones ---------- */

/** "+998901110012" -> "+998 90 111 00 12" (other formats are returned unchanged). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/[\s()-]/g, "");
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

/** `tel:` URI of a phone number (digits and a leading +), or null when there is nothing to call. */
export function phoneHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}

/* ---------- Dates ---------- */

/** "2026-11-04" -> "04.11.2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

const dateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO datetime -> "04.11.2026 10:00" in Asia/Tashkent. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(dateTimeParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Tashkent as `YYYY-MM-DD` (for date inputs and defaults). */
export function todayIso(): string {
  return isoDateFormatter.format(new Date());
}

/** "2026-11-04" -> "04.11" for compact chart axes. */
export function formatDayMonth(value: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[2]}.${match[1]}` : value;
}

/** Days between two `YYYY-MM-DD` dates (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** `YYYY-MM-DD` + n days (calendar arithmetic, no time zone involved). */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday-based weekday index (0 = Dushanba … 6 = Yakshanba). */
export function weekdayIndex(value: string): number {
  return (new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;

/** "06.09.2026 – 05.10.2026" */
export function formatRange(from: string | null | undefined, to: string | null | undefined): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/* ---------- Labels ---------- */

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  WAREHOUSE: "Omborchi",
  LOGISTICS: "Logistika xodimi",
  VET: "Veterinar",
  OWNER: "Xonadon egasi",
};

/** Label shown for a user: "Super Admin" for superusers (V3 §2.1). */
export function userRoleLabel(user: { role: Role; is_super_admin?: boolean }): string {
  return user.is_super_admin ? "Super Admin" : ROLE_LABELS[user.role];
}

/** `26.5 soat` (logistics lead time); `—` for null. */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 1)} soat`;
}

/** `12.4 KB`, `3.1 MB` (file sizes). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

export const POULTRY_TYPE_LABELS: Record<PoultryType, string> = {
  BROILER: "Go‘sht yo‘nalishi",
  BREEDER: "Naslli",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  DISTRIBUTE: "Xonadonga tarqatish",
  RETURN: "Xonadondan qaytarish",
  DEATH: "Nobud bo‘lish",
  OUT: "Sotish / boshqa chiqim",
};

/** Short verbs for buttons. */
export const MOVEMENT_ACTION_LABELS: Record<MovementType, string> = {
  DISTRIBUTE: "Tarqatish",
  RETURN: "Qaytarish",
  DEATH: "Nobud",
  OUT: "Chiqim",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  FEED: "Yem",
  VET_DRUG: "Veterinariya preparati",
  VACCINE: "Vaksina",
  EQUIPMENT: "Jihoz",
  OTHER: "Boshqa",
};

export const STOCK_TYPE_LABELS: Record<StockType, string> = {
  IN: "Kirim",
  OUT: "Chiqim",
};

export const UNITS: readonly ProductUnit[] = ["kg", "dona", "litr", "qop"];

export function entries<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

/** Initials for avatars: "Bobur Aliyev" -> "BA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Coordinates are stored with 6 decimals. */
export function roundCoord(value: number): number {
  return Number(value.toFixed(6));
}
