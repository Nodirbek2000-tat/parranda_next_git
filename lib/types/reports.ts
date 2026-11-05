/** Report export (API_CONTRACT_V3 §11). OWNED BY THE REPORTS TEAM — extend freely. */

export type ReportFormat = "xlsx" | "pdf" | "json";
export type ReportFilter = "date_from" | "date_to" | "region" | "district" | "household" | "poultry_type";
export type ReportColumnType = "text" | "int" | "decimal" | "percent" | "date" | "datetime" | "bool";

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  formats: ReportFormat[];
  filters: ReportFilter[];
  max_days: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
  decimals?: number;
}

export type ReportCell = string | number | boolean | null;

export interface ReportPreview {
  key: string;
  title: string;
  period: { date_from: string; date_to: string; days: number };
  filters: Partial<Record<Exclude<ReportFilter, "date_from" | "date_to">, string | number | null>>;
  generated_at: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  totals: Record<string, ReportCell>;
  summary: { label: string; value: string }[];
  row_count: number;
  truncated: boolean;
}

/** `GET /api/households/regions` (A/W/V). */
export interface RegionOption {
  region: string;
  districts: string[];
}

/* ---------- Dashboard V3 additions (API_CONTRACT_V3 §10.1; reports/dashboard team) ---------- */

export type ProblemReasonCode = "NO_REPORT" | "HIGH_MORTALITY" | "OVERDUE_VACCINATION" | "OPEN_DISEASE";

export interface ProblemHousehold {
  household: { id: number; code: string; name: string };
  district: string;
  reasons: { code: ProblemReasonCode; label: string; value: number }[];
}

/**
 * Additive keys of `GET /api/dashboard/admin`. Every block is optional: a module that is not
 * installed / migrated yet simply does not send its block (the page then hides that card).
 */
export interface AdminDashboardV3 {
  orders?: { new: number; approved_without_task: number; in_delivery: number; awaiting_confirmation: number };
  logistics?: {
    new: number;
    assigned: number;
    accepted: number;
    in_transit: number;
    delivered: number;
    overdue: number;
    delivered_today: number;
  };
  vet?: {
    visits_today: number;
    visits_planned_7d: number;
    visits_overdue: number;
    vaccinations_due_7d: number;
    vaccinations_overdue: number;
    open_diseases: number;
    new_requests: number;
  };
  problem_households?: { count: number; items: ProblemHousehold[] };
  expiring_lots?: { count: number; items: import("./warehouse").StockLot[] };
}
