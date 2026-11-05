/** Types of API_CONTRACT_V4 (Konstruktor, vazifalar, jarayonlar, dalolatnomalar). Shared by features/builder and
 * features/work — keep in sync with docs/API_CONTRACT_V4.md. */

import type { Role } from "./types";

export type Option<V extends string = string> = { value: V; label: string };

export type BlueprintKind = "role" | "form" | "task" | "process" | "document";
export type BlueprintStatus = "draft" | "test" | "active" | "archived";

/** `"VET"` (system role) or `"profile:7"` (role profile). */
export type RoleRef = string;

export type PermissionAction = "view" | "create" | "edit" | "approve" | "download";
export type PermissionMap = Record<string, PermissionAction[]>;

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "phone"
  | "select"
  | "multiselect"
  | "file"
  | "photo"
  | "geo"
  | "bool"
  | "computed";

export type FieldValidation = {
  min?: number | null;
  max?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  pattern?: string;
};

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: string[];
  validation?: FieldValidation;
  formula?: string;
  visible_roles?: RoleRef[];
  editable_roles?: RoleRef[];
};

export type GeoValue = { lat: number; lng: number };
export type FieldValue = string | number | boolean | string[] | GeoValue | null;
export type FormValues = Record<string, FieldValue>;

export type RoleData = { base_role: Exclude<Role, "OWNER">; permissions: PermissionMap };
export type FormData_ = { roles: RoleRef[]; fields: FormField[] };
export type TaskData = {
  executor: RoleRef;
  approver: RoleRef | "";
  form_id: number | null;
  document_id: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  requires_household: boolean;
  next_condition: "approved" | "submitted";
};
export type ProcessStage = { title: string; task_id: number; notify_roles: RoleRef[]; condition: "approved" | "submitted" };
export type ProcessData = { stages: ProcessStage[] };
export type DocumentData = {
  scope: "task" | "role" | "general";
  role?: Role | "";
  title: string;
  body: string;
  signatures: string[];
  include_photos: boolean;
  include_approvals: boolean;
  include_quantities: boolean;
};

export type BlueprintUsage = {
  users: number;
  tasks: number;
  submissions: number;
  runs: number;
  referenced_by: { id: number; kind: BlueprintKind; name: string }[];
};

export type BlueprintPending = { name: string; description: string; data: Record<string, unknown>; comment: string };

export type BlueprintListItem = {
  id: number;
  kind: BlueprintKind;
  kind_display: string;
  name: string;
  description: string;
  status: BlueprintStatus;
  status_display: string;
  version: number;
  has_pending: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  usage: BlueprintUsage;
};

export type Blueprint<D = Record<string, unknown>> = Omit<BlueprintListItem, "has_pending"> & {
  data: D;
  pending: BlueprintPending | null;
  pending_by_name: string | null;
  pending_at: string | null;
};

export type ConfigVersion = {
  id: number;
  version: number;
  name: string;
  status: string;
  comment: string;
  data: Record<string, unknown>;
  created_by_name: string | null;
  created_at: string;
};

export type BuilderMeta = {
  kinds: Option<BlueprintKind>[];
  statuses: Option<BlueprintStatus>[];
  field_types: Option<FieldType>[];
  modules: Option[];
  actions: Option<PermissionAction>[];
  system_roles: Option<Role>[];
  role_refs: Option<RoleRef>[];
  placeholders: Option[];
  districts: string[];
};

export type UserAccessRow = {
  user_id: number;
  full_name: string;
  username: string;
  role: Role;
  role_display: string;
  profile_id: number | null;
  profile_name: string | null;
  districts: string[];
  household_ids: number[];
  households: { id: number; code: string; name: string }[];
};

export type MeAccess = {
  profile_id: number | null;
  profile_name: string | null;
  permissions: PermissionMap | null;
  districts: string[];
  household_ids: number[];
};

// --- Runtime -------------------------------------------------------------------------------------

export type HouseholdRef = { id: number; code: string; name: string };

export type SubmissionDisplay = { key: string; label: string; type: FieldType; value: string; file_id?: number };

export type Submission = {
  id: number;
  code: string;
  form_id: number;
  form_name: string;
  form_version: number;
  fields: FormField[];
  data: FormValues;
  display: SubmissionDisplay[];
  household: HouseholdRef | null;
  task_id: number | null;
  is_test: boolean;
  submitted_by_name: string | null;
  created_at: string;
};

export type RuntimeForm = {
  id: number;
  name: string;
  description: string;
  status: BlueprintStatus;
  version: number;
  fields: FormField[];
};

export type TaskStatus = "OPEN" | "SUBMITTED" | "RETURNED" | "APPROVED" | "CANCELLED";

export type Task = {
  id: number;
  code: string;
  title: string;
  template_id: number;
  template_version: number;
  status: TaskStatus;
  status_display: string;
  executor: RoleRef;
  executor_display: string;
  approver: RoleRef | "";
  approver_display: string;
  assigned_to: { id: number; full_name: string } | null;
  household: HouseholdRef | null;
  process_run: { id: number; code: string; stage_index: number; stage_title: string } | null;
  starts_on: string;
  due_on: string | null;
  overdue: boolean;
  form: { id: number; name: string; fields: FormField[] } | null;
  submission: Submission | null;
  decision_note: string;
  submitted_by_name: string | null;
  submitted_at: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  can_submit: boolean;
  can_approve: boolean;
  can_cancel: boolean;
  is_test: boolean;
  created_at: string;
};

export type TaskCounts = { mine_open: number; to_approve: number };

export type ProcessRunStatus = "RUNNING" | "DONE" | "CANCELLED";

export type ProcessRun = {
  id: number;
  code: string;
  process_id: number;
  process_name: string;
  process_version: number;
  household: HouseholdRef | null;
  status: ProcessRunStatus;
  status_display: string;
  current_index: number;
  is_test: boolean;
  stages: {
    index: number;
    title: string;
    state: "done" | "current" | "pending" | "cancelled";
    task: { id: number; code: string; status: TaskStatus; status_display: string } | null;
  }[];
  started_by_name: string | null;
  started_at: string;
  finished_at: string | null;
};

// --- Dalolatnomalar ------------------------------------------------------------------------------

export type ActKind = "role" | "general" | "task";

export type ActSnapshot = {
  code: string;
  title: string;
  kind: ActKind;
  role: Role | null;
  role_display: string | null;
  company: string;
  date: string;
  period: string;
  household: { code: string; name: string; owner: string; district: string; address: string } | null;
  responsible: string;
  body: string;
  summary: { label: string; value: string }[];
  sections: { title: string; columns: string[]; rows: string[][] }[];
  tasks: { code: string; title: string; household: string; approved_at: string; values: { label: string; value: string }[] }[];
  photos: { file_id: number; label: string }[];
  approvals: { label: string; name: string; at: string }[];
  signatures: string[];
};

export type Act = {
  id: number;
  code: string;
  kind: ActKind;
  kind_display: string;
  role: Role | null;
  role_display: string | null;
  user: { id: number; full_name: string } | null;
  household: HouseholdRef | null;
  task_id: number | null;
  date_from: string | null;
  date_to: string | null;
  created_by_name: string | null;
  created_at: string;
  snapshot?: ActSnapshot;
};

// --- Me’yorlar (API_CONTRACT_V4 §5) ---------------------------------------------------------------

/** `GET /api/feed-norms` row. `product` is written as an id; read as an id or a `{id, name}` reference. */
export type FeedNorm = {
  id: number;
  poultry_type: import("./types").PoultryType;
  poultry_type_display?: string;
  day_from: number;
  day_to: number;
  grams_per_bird_day: number;
  product: number | { id: number; name: string } | null;
  product_name?: string | null;
  note: string;
};

export type FeedNormPayload = {
  poultry_type: import("./types").PoultryType;
  day_from: number;
  day_to: number;
  grams_per_bird_day: number;
  product: number | null;
  note: string;
};

/** `GET /api/construction-options` row. */
export type ConstructionOption = {
  id: number;
  name: string;
  description: string;
  unit: string;
  price: number | null;
  is_active: boolean;
};

export type ConstructionOptionPayload = Omit<ConstructionOption, "id">;
