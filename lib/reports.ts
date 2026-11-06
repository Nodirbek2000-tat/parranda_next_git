/**
 * Reports (ARCHITECTURE_V2_1 §7): `GET /api/reports/{overview|cases|staff|finance}?date_from=&date_to=` and `&format=xlsx`.
 * The normalisers read the documented fields with tolerant fallbacks; adjust here when API_V2_NOTES fixes the shapes.
 */
import { apiDownload, buildPath, type Query } from "./api";
import { COST_ITEMS } from "./finance";

export type ReportKey = "overview" | "cases" | "staff" | "finance";

export const REPORT_TABS: { key: ReportKey; label: string }[] = [
  { key: "overview", label: "Umumiy" },
  { key: "cases", label: "Xonadonlar" },
  { key: "staff", label: "Xodimlar" },
  { key: "finance", label: "Moliya" },
];

export const reportPath = (key: ReportKey) => `/reports/${key}`;

export function downloadReport(key: ReportKey, filters: { date_from?: string; date_to?: string; district?: string }): Promise<void> {
  const query: Query = { ...filters, format: "xlsx" };
  return apiDownload(buildPath(reportPath(key), query), `hisobot-${key}.xlsx`);
}

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}
export function num(raw: Raw | null | undefined, ...keys: string[]): number | null {
  if (!raw) return null;
  for (const key of keys) {
    const v = raw[key];
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}
function str(raw: Raw | null | undefined, ...keys: string[]): string {
  if (!raw) return "";
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}
function nameOf(value: unknown): string {
  const o = obj(value);
  if (o) return str(o, "full_name", "name", "username");
  return typeof value === "string" ? value : "";
}

/** Rows from a plain array or `{rows|results|items: [...]}`. */
export function rowsOf(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const o = obj(data);
  if (!o) return [];
  for (const key of ["rows", "results", "items", "cases", "users", "staff"]) if (Array.isArray(o[key])) return o[key] as Raw[];
  return [];
}

/** Counts from `{KEY: n}` or `[{status|key, count}]`. */
function counts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (const row of value as Raw[]) {
      const key = str(row, "status", "key", "name");
      const n = num(row, "count", "total", "n");
      if (key && n !== null) out[key] = n;
    }
  } else if (obj(value)) {
    for (const [key, v] of Object.entries(value as Raw)) if (Number.isFinite(Number(v)) && v !== null && typeof v !== "object") out[key] = Number(v);
  }
  return out;
}

/* ---------- overview ---------- */

export interface Money {
  cost: number;
  revenue: number;
  profit: number;
}

export interface Overview {
  perStage: { number: number; title: string; total: number; overdue: number }[];
  cases: { total: number | null; inProgress: number | null; done: number | null; rejected: number | null };
  onTime: number;
  late: number;
  lateOpen: number | null;
  requests: Record<string, number>;
  visits: { done: number; overdue: number; planned: number | null };
  finance: { done: Money | null; inProgress: Money | null; total: Money | null };
}

function money(value: unknown): Money | null {
  const o = obj(value);
  if (!o) return null;
  const cost = num(o, "cost", "total_cost") ?? 0;
  const revenue = num(o, "revenue") ?? 0;
  return { cost, revenue, profit: num(o, "profit") ?? revenue - cost };
}

export function toOverview(data: unknown): Overview {
  const raw = obj(data) ?? {};
  const stagesRaw = raw.per_stage ?? raw.stages ?? raw.by_stage;
  const perStage = (Array.isArray(stagesRaw) ? (stagesRaw as Raw[]) : []).map((row) => ({
    number: num(row, "number", "stage") ?? 0,
    title: str(row, "title", "stage_title"),
    total: num(row, "total", "count", "active") ?? 0,
    overdue: num(row, "overdue", "late") ?? 0,
  }));
  const casesRaw = obj(raw.cases) ?? obj(raw.case_status) ?? raw;
  const statusCounts = counts(obj(casesRaw)?.by_status ?? raw.by_status);
  const timing = obj(raw.timing) ?? obj(raw.stages_timing) ?? obj(raw.deadlines) ?? raw;
  const reqRaw = raw.requests ?? raw.requests_by_status;
  const requests = counts(obj(reqRaw)?.by_status ?? reqRaw);
  const visitsRaw = obj(raw.visits) ?? {};
  const fin = obj(raw.finance) ?? {};
  return {
    perStage,
    cases: {
      total: num(casesRaw, "total"),
      inProgress: num(casesRaw, "in_progress", "IN_PROGRESS") ?? statusCounts.IN_PROGRESS ?? null,
      done: num(casesRaw, "done", "DONE") ?? statusCounts.DONE ?? null,
      rejected: num(casesRaw, "rejected", "REJECTED") ?? statusCounts.REJECTED ?? null,
    },
    onTime: num(timing, "on_time", "on_time_count", "ontime") ?? 0,
    late: num(timing, "late", "late_count", "late_total") ?? 0,
    lateOpen: num(timing, "late_open", "open_late", "overdue_open"),
    requests,
    visits: {
      done: num(visitsRaw, "done", "DONE") ?? 0,
      overdue: num(visitsRaw, "overdue") ?? 0,
      planned: num(visitsRaw, "planned", "PLANNED"),
    },
    finance: {
      done: money(fin.done ?? fin.DONE),
      inProgress: money(fin.in_progress ?? fin.IN_PROGRESS),
      total: money(fin.total ?? fin.totals),
    },
  };
}

/* ---------- cases ---------- */

export interface CaseRow {
  id: number | null;
  code: string;
  name: string;
  stage: number | null;
  stageTitle: string;
  status: string;
  days: number | null;
  lateStages: number;
  worst: string;
  worstLate: boolean;
  cost: number | null;
  revenue: number | null;
  profit: number | null;
}

export function toCaseRows(data: unknown): CaseRow[] {
  return rowsOf(data).map((row) => {
    const worst = obj(row.worst_delay) ?? obj(row.worst);
    const worstDays = num(worst, "days", "delay_days");
    const worstHours = num(worst, "hours", "delay_hours");
    const worstText = worst
      ? [
          str(worst, "stage_title", "title") || (num(worst, "stage", "stage_number") ? `${num(worst, "stage", "stage_number")}-bosqich` : ""),
          worstDays !== null ? `${fmtCount(worstDays)} kun` : worstHours !== null ? fmtHours(worstHours) : "",
          nameOf(worst.who ?? worst.user ?? worst.actor) || str(worst, "who_name", "role_display"),
        ]
          .filter(Boolean)
          .join(" · ")
      : str(row, "worst_delay");
    const fin = obj(row.finance) ?? row;
    const c = obj(row.case);
    return {
      id: num(row, "id", "case_id") ?? num(c, "id"),
      code: str(row, "code", "case_code") || str(c, "code"),
      name: str(row, "household", "owner_full_name", "name") || nameOf(row.household) || str(c, "owner_full_name", "name"),
      stage: num(row, "current_stage", "stage"),
      stageTitle: str(row, "current_stage_title", "stage_title"),
      status: str(row, "status_display", "status"),
      days: num(row, "days_in_chain", "days"),
      lateStages: num(row, "late_stages", "late_stages_count", "late_count") ?? 0,
      worst: worstText,
      worstLate: !!worst || !!str(row, "worst_delay"),
      cost: num(fin, "total_cost", "cost"),
      revenue: num(fin, "revenue"),
      profit: num(fin, "profit"),
    };
  });
}

/* ---------- staff ---------- */

export interface StaffRow {
  id: number | null;
  name: string;
  role: string;
  submitted: number;
  avgSubmitHours: number | null;
  late: number;
  lateList: string[];
  approvals: number;
  avgDecideHours: number | null;
  requests: number;
  visitsDone: number;
  visitsOverdue: number;
}

export function toStaffRows(data: unknown): StaffRow[] {
  return rowsOf(data).map((row) => {
    const user = obj(row.user);
    const lateRaw = row.late_items ?? row.late_list ?? row.late_stages ?? (Array.isArray(row.late) ? row.late : null);
    const lateList = Array.isArray(lateRaw)
      ? (lateRaw as unknown[]).map((item) => {
          const o = obj(item);
          if (!o) return String(item);
          const code = str(o, "case_code", "code") || str(obj(o.case), "code");
          const stage = str(o, "stage_title", "title") || (num(o, "stage", "stage_number") ? `${num(o, "stage", "stage_number")}-bosqich` : "");
          const d = num(o, "days", "late_days");
          const h = num(o, "hours", "late_hours");
          return [code, stage, d !== null ? `${fmtCount(d)} kun` : h !== null ? fmtHours(h) : ""].filter(Boolean).join(" · ");
        })
      : [];
    return {
      id: num(row, "id", "user_id") ?? num(user, "id"),
      name: str(row, "full_name", "name", "username") || nameOf(user),
      role: str(row, "role_display") || str(user, "role_display") || str(row, "role") || str(user, "role"),
      submitted: num(row, "stages_submitted", "submitted") ?? 0,
      avgSubmitHours: num(row, "avg_submit_hours", "avg_hours_to_submit", "avg_submit"),
      late: num(row, "late_count", "late") ?? lateList.length,
      lateList,
      approvals: num(row, "approvals", "approvals_given", "decided") ?? 0,
      avgDecideHours: num(row, "avg_decide_hours", "avg_hours_to_decide", "avg_approve_hours"),
      requests: num(row, "requests_handled", "requests") ?? 0,
      visitsDone: num(row, "visits_done") ?? 0,
      visitsOverdue: num(row, "visits_overdue") ?? 0,
    };
  });
}

/* ---------- finance ---------- */

export interface FinanceRow {
  id: number | null;
  code: string;
  name: string;
  items: Record<string, number>;
  totalCost: number;
  revenue: number | null;
  profit: number | null;
}

export interface FinanceReport {
  rows: FinanceRow[];
  totals: { items: Record<string, number>; totalCost: number; revenue: number; profit: number };
}

export function toFinanceReport(data: unknown): FinanceReport {
  const rows: FinanceRow[] = rowsOf(data).map((row) => {
    const fin = obj(row.finance) ?? row;
    const c = obj(row.case);
    const items: Record<string, number> = {};
    for (const item of COST_ITEMS) items[item.key] = num(fin, item.key) ?? 0;
    const totalCost = num(fin, "total_cost") ?? Object.values(items).reduce((a, b) => a + b, 0);
    const revenue = num(fin, "revenue");
    return {
      id: num(row, "id", "case_id") ?? num(c, "id"),
      code: str(row, "code", "case_code") || str(c, "code"),
      name: str(row, "household", "owner_full_name", "name") || str(c, "owner_full_name", "name"),
      items,
      totalCost,
      revenue,
      profit: num(fin, "profit") ?? (revenue !== null ? revenue - totalCost : null),
    };
  });
  const t = obj(obj(data)?.totals) ?? obj(obj(data)?.total);
  const items: Record<string, number> = {};
  for (const item of COST_ITEMS) items[item.key] = num(t, item.key) ?? rows.reduce((sum, r) => sum + r.items[item.key], 0);
  const totalCost = num(t, "total_cost", "cost") ?? rows.reduce((sum, r) => sum + r.totalCost, 0);
  const revenue = num(t, "revenue") ?? rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
  return { rows, totals: { items, totalCost, revenue, profit: num(t, "profit") ?? revenue - totalCost } };
}

/* ---------- formatting ---------- */

function fmtCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/** 5 -> "5 soat", 30 -> "1 kun 6 soat" */
export function fmtHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} daqiqa`;
  if (hours < 24) return `${Math.round(hours)} soat`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest ? `${days} kun ${rest} soat` : `${days} kun`;
}
