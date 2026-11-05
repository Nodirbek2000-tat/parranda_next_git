/**
 * Logistics (API_CONTRACT_V3 §7). OWNED BY THE LOGISTICS TEAM — extend freely.
 * Status labels and badge tones: `lib/status.ts`.
 */

import type { HouseholdShort, UserRef } from "../types";
import type { ProductRef, StatusLogEntry } from "./common";
import type { Attachment } from "./files";

export type TaskStatus = "NEW" | "ASSIGNED" | "ACCEPTED" | "IN_TRANSIT" | "DELIVERED" | "CONFIRMED" | "CANCELLED";
export type TaskAction = "assign" | "accept" | "start" | "deliver" | "confirm" | "cancel" | "edit";

export interface Vehicle {
  id: number;
  plate_number: string;
  model: string;
  capacity_kg: number | null;
  is_active: boolean;
  note: string;
  active_tasks: number;
  created_at: string;
}

export interface Driver {
  id: number;
  full_name: string;
  phone: string;
  license_no: string;
  user: { id: number; full_name: string; username: string; telegram_linked: boolean } | null;
  is_active: boolean;
  note: string;
  active_tasks: number;
  created_at: string;
}

export interface LogisticsTaskItem {
  id: number;
  product: ProductRef;
  quantity: number;
  reserved_qty: number;
  stock_transaction: { id: number; op_id: string } | null;
  /** IN that brought the goods back (task cancelled in transit). */
  return_transaction: { id: number; op_id: string } | null;
}

export interface TaskHistoryEntry extends StatusLogEntry<TaskStatus> {
  id: number;
  from_status_display: string;
  source: "API" | "BOT";
  latitude: number | null;
  longitude: number | null;
}

export interface LogisticsTask {
  id: number;
  code: string;
  status: TaskStatus;
  status_display: string;
  order: { id: number; code: string } | null;
  household: HouseholdShort;
  delivery: {
    contact_name: string;
    contact_phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  items: LogisticsTaskItem[];
  total_kg: number;
  planned_date: string | null;
  is_overdue: boolean;
  vehicle: Pick<Vehicle, "id" | "plate_number" | "model" | "capacity_kg"> | null;
  driver: Pick<Driver, "id" | "full_name" | "phone"> | null;
  /** Absent in the OWNER view. */
  responsible?: UserRef | null;
  note: string;
  delivery_note: string;
  recipient_name: string;
  received_ok: boolean | null;
  issue_note: string;
  cancel_reason: string;
  proof_files: Attachment[];
  created_by?: UserRef;
  created_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  allowed_actions: TaskAction[];
  /** Detail response only. */
  history?: TaskHistoryEntry[];
}

export interface LogisticsSummary {
  date: string;
  by_status: Record<Exclude<TaskStatus, "CONFIRMED" | "CANCELLED">, number>;
  mine: { active: number; in_transit: number };
  overdue: number;
  delivered_today: number;
  confirmed_today: number;
  awaiting_confirmation: number;
  new_unassigned: number;
  last_30d: {
    created: number;
    delivered: number;
    confirmed: number;
    cancelled: number;
    with_issue: number;
    on_time_pct: number | null;
    avg_lead_time_h: number | null;
  };
}

/** Body of `POST /api/logistics/tasks` (ADMIN). */
export interface TaskCreateBody {
  household: number;
  items: { product: number; quantity: number }[];
  planned_date?: string | null;
  note?: string;
  vehicle?: number | null;
  driver?: number | null;
  responsible?: number | null;
}
