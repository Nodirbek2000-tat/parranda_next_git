/** Company settings singleton (API_CONTRACT_V3 §3) and global search (§12). */

import type { UserRef } from "../types";

export interface SystemSettings {
  company_name: string;
  short_name: string;
  phone: string;
  address: string;
  vaccination_reminder_days: number;
  expiry_reminder_days: number;
  mortality_alert_threshold_pct: number;
  problem_report_days: number;
  low_stock_alert_enabled: boolean;
  delivery_proof_required: boolean;
  reminder_hour: number;
  last_reminders_date: string | null;
  updated_at: string;
  updated_by: UserRef | null;
}

export type SystemSettingsPatch = Partial<Omit<SystemSettings, "last_reminders_date" | "updated_at" | "updated_by">>;

/** `GET /api/search?q=` (V3 §12). */
export interface SearchItem {
  id: number;
  title: string;
  subtitle: string;
  path: string;
}

export interface SearchResult {
  q: string;
  groups: { type: string; label: string; items: SearchItem[] }[];
}
