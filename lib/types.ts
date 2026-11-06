/** API shapes (ARCHITECTURE_V2 §3–4). Optional fields are read defensively. */

export type Role =
  | "SUPERADMIN"
  | "ADMIN"
  | "INSPECTOR"
  | "HR"
  | "DIRECTOR"
  | "BUILDER"
  | "WAREHOUSE"
  | "INCUBATOR"
  | "LOGISTICS"
  | "VET"
  | "OWNER"
  | "ACCOUNTANT"
  | "SLAUGHTERHOUSE";

export interface Me {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  role_display?: string;
  is_superadmin?: boolean;
  must_change_password: boolean;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: Me;
}

/** A person reference: the API may send an id, a name or a small object. */
export type PersonRef = string | number | null | undefined | { id?: number; full_name?: string; username?: string; role?: string };

export interface StaffUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  role_display?: string;
  phone?: string;
  is_active: boolean;
  telegram_id?: number | string | null;
  telegram_linked?: boolean;
  must_change_password?: boolean;
  last_login?: string | null;
  temp_password?: string;
}

export type StageStatus = "WAITING" | "ACTIVE" | "SUBMITTED" | "RETURNED" | "DONE";
export type CaseStatus = "IN_PROGRESS" | "DONE" | "REJECTED";

export interface Photo {
  id: number;
  stage?: number;
  stage_number?: number;
  taken_at?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  live?: boolean;
  url?: string;
  uploaded_by?: PersonRef;
}

export interface CaseDocument {
  id: number;
  stage?: number;
  stage_number?: number;
  original_name?: string;
  url?: string;
  uploaded_by?: PersonRef;
}

export interface StageEvent {
  id?: number;
  stage_number?: number;
  stage?: number;
  action: string;
  action_display?: string;
  actor?: PersonRef;
  actor_name?: string;
  note?: string;
  created_at: string;
}

export interface CaseStage {
  id?: number;
  number: number;
  key: string;
  title?: string;
  status: StageStatus;
  status_display?: string;
  executor_role?: Role;
  approver_role?: Role | null;
  /** Field config from the backend chain (`cases/stages.py`). */
  fields?: {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    choices?: { value: string; label: string }[];
    min?: number | null;
    decimal_places?: number | null;
    help?: string;
  }[];
  min_photos?: number;
  data?: Record<string, unknown> | null;
  note?: string;
  activated_at?: string | null;
  due_at?: string | null;
  is_overdue?: boolean;
  submitted_by?: PersonRef;
  submitted_by_name?: string;
  submitted_at?: string | null;
  decided_by?: PersonRef;
  decided_by_name?: string;
  decided_at?: string | null;
  return_reason?: string;
  photos?: Photo[];
  documents?: CaseDocument[];
  events?: StageEvent[];
}

export interface PackageRef {
  id: number;
  name: string;
  area_sotix?: number | string;
  capacity_birds?: number;
  price?: number | string;
}

export interface CaseSummary {
  id: number;
  code: string;
  name?: string;
  owner_full_name?: string;
  owner_phone?: string;
  region?: string;
  district?: string;
  mfy?: string;
  address?: string;
  status: CaseStatus;
  status_display?: string;
  current_stage: number;
  current_stage_title?: string;
  current_stage_status?: StageStatus;
  current_due_at?: string | null;
  due_at?: string | null;
  is_overdue?: boolean;
  package?: PackageRef | number | null;
  package_name?: string;
  created_at?: string;
  /** Some list serializers embed the current stage. */
  stage?: CaseStage | null;
  current?: CaseStage | null;
}

/** A user brief `{id, full_name, role, role_display}`. */
export interface UserBrief {
  id: number;
  full_name?: string;
  username?: string;
  role?: Role | string;
  role_display?: string;
}

/** Growing period (stage 10 ACTIVE), ARCHITECTURE_V2_1 §4. */
export interface Growing {
  day: number;
  total_days: number;
  started_at?: string | null;
  ends_at?: string | null;
}

export interface CaseDetail extends CaseSummary {
  latitude?: number | string | null;
  longitude?: number | string | null;
  owner_user?: PersonRef;
  created_by?: PersonRef;
  done_at?: string | null;
  reject_reason?: string;
  conclusion?: string;
  stages: CaseStage[];
  photos?: Photo[];
  documents?: CaseDocument[];
  events?: StageEvent[];
  can?: {
    submit?: boolean;
    approve?: boolean;
    return?: boolean;
    reject?: boolean;
    owner_account?: boolean;
    assign_vet?: boolean;
    request?: boolean;
  };
  /* v2.1 additions (read defensively; see lib/requests.ts, lib/visits.ts, lib/finance.ts) */
  vet_user?: UserBrief | null;
  growing?: Growing | null;
  requests?: unknown[];
  visits?: unknown[];
  finance?: Record<string, unknown> | null;
}

export interface Product {
  id: number;
  name: string;
  unit: string;
  category: string;
  category_display?: string;
  price?: number | string;
  balance: number | string;
  min_stock?: number | string;
  is_demo?: boolean;
  is_low?: boolean;
}

export interface StockMove {
  id: number;
  product?: number | { id: number; name: string; unit?: string };
  product_name?: string;
  unit?: string;
  type: "IN" | "OUT";
  qty: number | string;
  balance_after?: number | string;
  case?: number | { id: number; code: string } | null;
  case_code?: string;
  note?: string;
  created_by?: PersonRef;
  created_by_name?: string;
  created_at: string;
}

export interface PackageItem {
  id?: number;
  product?: number | { id: number; name: string; unit?: string };
  product_id?: number;
  product_name?: string;
  unit?: string;
  qty: number | string;
}

export interface Package {
  id: number;
  name: string;
  area_sotix?: number | string;
  capacity_birds?: number;
  price?: number | string;
  description?: string;
  is_demo?: boolean;
  items?: PackageItem[];
}

export interface AuditRow {
  id: number;
  actor?: PersonRef;
  actor_name?: string;
  action: string;
  object_type?: string;
  object_id?: string | number;
  before?: unknown;
  after?: unknown;
  created_at: string;
}

export type Paged<T> = T[] | { count?: number; next?: string | null; previous?: string | null; results?: T[] };
