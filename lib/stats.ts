/**
 * Presentation rules for the statistics of docs/API_CONTRACT_V2.md (section 1.2 and 6.2).
 * The numbers themselves are computed by the backend; this file only says how to show them.
 */

import { addDays, diffDays, formatFixed, formatNumber, formatPercent, todayIso } from "./format";
import type { Kpi, KpiKey, PoultryType } from "./types";

/** Direction table of 1.2: is a rise good news? */
export type KpiDirection = "up" | "down" | "neutral";

export interface KpiMeta {
  label: string;
  /** Unit written after the value ("" for percentages, which carry "%"). */
  unit: string;
  /**
   * Decimals SHOWN (one display precision per unit): kg sums 1 decimal without trailing zeros
   * (`trim`), bird averages whole birds, percentages 1 fixed decimal, kg/bird/day 3 fixed decimals.
   * The API precision stays available in tooltips and the screen-reader tables.
   */
  digits: number;
  /** Drop trailing zeros ("5 082.5", "0") instead of fixed decimals ("0.110"). */
  trim?: boolean;
  direction: KpiDirection;
  percent?: boolean;
  /** One-line definition shown as a hint (formula in plain words). */
  hint: string;
}

export const KPI_META: Record<KpiKey, KpiMeta> = {
  birds_end: {
    label: "Parranda soni",
    unit: "dona",
    digits: 0,
    direction: "neutral",
    hint: "Davr oxiridagi parranda soni (harakatlardan qayta hisoblanadi)",
  },
  birds_avg: {
    label: "O‘rtacha parranda",
    unit: "dona",
    digits: 0,
    direction: "neutral",
    hint: "Davrdagi har kun oxiridagi parranda sonining o‘rtachasi",
  },
  eggs: { label: "Tuxum", unit: "dona", digits: 0, direction: "up", hint: "Kunlik hisobotlardagi tuxumlar yig‘indisi" },
  feed_kg: {
    label: "Yem sarfi",
    unit: "kg",
    digits: 1,
    trim: true,
    direction: "neutral",
    hint: "Xonadonlar kunlik hisobotlarida yozgan yem sarfi (ombordan chiqim emas)",
  },
  deaths: {
    label: "Nobud",
    unit: "dona",
    digits: 0,
    direction: "down",
    hint: "Xonadonlardagi nobud bo‘lish harakatlari (markazdagi nobud alohida ko‘rsatiladi)",
  },
  distributed: {
    label: "Tarqatilgan",
    unit: "dona",
    digits: 0,
    direction: "neutral",
    hint: "Xonadonlarga tarqatilgan parranda (yalpi)",
  },
  returned: {
    label: "Qaytarilgan",
    unit: "dona",
    digits: 0,
    direction: "neutral",
    hint: "Xonadonlardan qaytarilgan parranda",
  },
  reports: { label: "Hisobotlar", unit: "ta", digits: 0, direction: "up", hint: "Kiritilgan kunlik hisobotlar soni" },
  laying_rate_pct: {
    label: "Tuxumdorlik",
    unit: "",
    digits: 1,
    percent: true,
    direction: "up",
    hint: "Tuxum ÷ tuxum yo‘nalishidagi parranda, faqat hisobot kiritilgan kunlar",
  },
  feed_per_egg_g: {
    label: "Yem / tuxum",
    unit: "g",
    digits: 1,
    direction: "down",
    hint: "Tuxum yo‘nalishidagi parrandaga to‘g‘ri keladigan yem (g) ÷ tuxum",
  },
  feed_per_bird_day_kg: {
    label: "Yem / parranda / kun",
    unit: "kg",
    digits: 3,
    direction: "neutral",
    hint: "Yem ÷ parranda-kun, hisobot kiritilgan kunlar bo‘yicha",
  },
  mortality_pct: {
    label: "O‘lim darajasi",
    unit: "",
    digits: 1,
    percent: true,
    direction: "down",
    hint: "Xonadonlar bo‘yicha: xonadonlardagi nobud ÷ davrdagi o‘rtacha parranda soni (markaz kirmaydi)",
  },
  report_discipline_pct: {
    label: "Hisobot intizomi",
    unit: "",
    digits: 1,
    percent: true,
    direction: "up",
    hint:
      "Kiritilgan hisobotlar ÷ kutilgan hisobot kunlari (faol, parrandasi bor xonadon). Bugun hali tugamagan: " +
      "bugungi hisobot kiritilgandagina hisobga olinadi",
  },
};

/** Value with the metric's own precision and unit: "81.3%", "135.7 g", "61 200 dona". */
export function formatKpiValue(key: KpiKey, value: number | null | undefined, withUnit = true): string {
  const meta = KPI_META[key];
  if (value === null || value === undefined) return "—";
  if (meta.percent) return formatPercent(value, meta.digits);
  const text = meta.digits === 0 || meta.trim ? formatNumber(value, meta.digits) : formatFixed(value, meta.digits);
  return withUnit && meta.unit ? `${text} ${meta.unit}` : text;
}

export type DeltaTone = "good" | "bad" | "neutral";

export interface DeltaView {
  /** "▲ 5.5%", "▼ 2.3 p.p.", "0.0%" or "—" */
  text: string;
  tone: DeltaTone;
  /** Words for screen readers and the tooltip: "o‘sish", "kamayish", "o‘zgarishsiz". */
  words: string;
  trend: "up" | "down" | "flat" | "none";
}

/** Delta chip of 6.2: arrow + value; colour by direction table, never colour alone. */
export function describeDelta(kpi: Pick<Kpi, "delta" | "delta_unit">, direction: KpiDirection): DeltaView {
  const { delta, delta_unit: unit } = kpi;
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return { text: "—", tone: "neutral", words: "taqqoslab bo‘lmaydi", trend: "none" };
  }
  const suffix = unit === "pp" ? " p.p." : "%";
  const magnitude = formatFixed(Math.abs(delta), 1);
  if (Number(magnitude) === 0) {
    return { text: `0.0${suffix}`, tone: "neutral", words: "o‘zgarishsiz", trend: "flat" };
  }
  const up = delta > 0;
  const tone: DeltaTone = direction === "neutral" ? "neutral" : (direction === "up") === up ? "good" : "bad";
  return {
    text: `${up ? "▲" : "▼"} ${magnitude}${suffix}`,
    tone,
    words: up ? "o‘sish" : "kamayish",
    trend: up ? "up" : "down",
  };
}

/* ---------- Mortality tone (no alarm fatigue) ---------- */

/** Same default as `mortality_threshold` of /api/stats/overview (“Yuqori o‘lim”). */
export const DEFAULT_MORTALITY_THRESHOLD = 5;

/**
 * Death cards are red only when the mortality rate is above the /stats “Yuqori o‘lim” threshold,
 * amber above half of it; a healthy flock with a few deaths stays neutral.
 */
export function mortalityTone(
  mortalityPct: number | null | undefined,
  threshold = DEFAULT_MORTALITY_THRESHOLD,
): "default" | "warning" | "danger" {
  if (mortalityPct === null || mortalityPct === undefined) return "default";
  if (mortalityPct > threshold) return "danger";
  if (mortalityPct > threshold / 2) return "warning";
  return "default";
}

/* ---------- Categorical colours (6.2) ---------- */

/**
 * LAYER / BROILER as in contract 6.2. BREEDER was #12372A (contrast 2.05 : 1 against LAYER, the two
 * greens were indistinguishable in the donut); a light blue keeps ≥ 3 : 1 against LAYER and a
 * different hue from BROILER (safe for red-green colour blindness).
 */
export const POULTRY_COLORS: Record<PoultryType, string> = {
  LAYER: "#2F6B3F",
  BROILER: "#E8B04A",
  BREEDER: "#9DBFDC",
};

export const CHART_COLORS = {
  primary: "#12372A",
  accent: "#2F6B3F",
  /** Light tint for a second green series next to `primary` (contrast 5.9 : 1). */
  accentLight: "#8DB89A",
  warning: "#E8B04A",
  danger: "#B42318",
  other: "#5E7A69",
  grid: "#E6EBE4",
  axis: "#5E7A69",
  /** Light tint of the track behind rings and meters. */
  track: "#E6EFE7",
} as const;

/* ---------- Periods (1.1, 8.1, 6.2 PeriodPicker) ---------- */

export const MAX_PERIOD_DAYS = 366;
export const MIN_PERIOD_DATE = "2000-01-01";

export interface PeriodPreset {
  /** Number of days, or 0 for "server default / whole life". */
  days: number;
  label: string;
}

export const DEFAULT_PRESETS: readonly PeriodPreset[] = [
  { days: 7, label: "7 kun" },
  { days: 30, label: "30 kun" },
  { days: 90, label: "90 kun" },
  { days: 365, label: "1 yil" },
];

export interface PeriodQuery {
  date_from?: string;
  date_to?: string;
}

/** Inclusive range for the last `days` days ending today (Tashkent). */
export function presetRange(days: number, today = todayIso()): { date_from: string; date_to: string } {
  return { date_from: addDays(today, -(days - 1)), date_to: today };
}

/** Which preset (days) a query matches, `null` for a custom range, 0 for "no params". */
export function activePreset(query: PeriodQuery, presets: readonly PeriodPreset[], today = todayIso()): number | null {
  if (!query.date_from && !query.date_to) return 0;
  if (!query.date_from || query.date_to !== today) return null;
  const days = diffDays(query.date_from, today) + 1;
  return presets.some((preset) => preset.days === days) ? days : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Same checks and messages as the API (8.1), so the request is not sent when it would fail. */
export function validateRange(
  dateFrom: string,
  dateTo: string,
  today = todayIso(),
): { date_from?: string; date_to?: string; range?: string } {
  const errors: { date_from?: string; date_to?: string; range?: string } = {};
  if (!isIsoDate(dateFrom)) errors.date_from = "Sana noto‘g‘ri formatda (YYYY-MM-DD).";
  if (!isIsoDate(dateTo)) errors.date_to = "Sana noto‘g‘ri formatda (YYYY-MM-DD).";
  if (errors.date_from || errors.date_to) return errors;
  if (dateTo > today) errors.date_to = "Sana kelajakda bo‘lishi mumkin emas";
  if (dateFrom > dateTo) errors.date_from = "Boshlanish sanasi tugash sanasidan keyin bo‘lishi mumkin emas.";
  else if (dateFrom < MIN_PERIOD_DATE) errors.date_from = "Sana 01.01.2000 dan oldin bo‘lishi mumkin emas.";
  else if (diffDays(dateFrom, dateTo) + 1 > MAX_PERIOD_DAYS) errors.range = "Davr 366 kundan oshmasligi kerak.";
  return errors;
}

/** Read a period from URL search params; invalid values are dropped (the API would reject them). */
export function readPeriod(params: URLSearchParams | { get: (key: string) => string | null }): PeriodQuery {
  const from = params.get("date_from") ?? "";
  const to = params.get("date_to") ?? "";
  return {
    date_from: isIsoDate(from) ? from : undefined,
    date_to: isIsoDate(to) ? to : undefined,
  };
}
