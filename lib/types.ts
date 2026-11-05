/**
 * Types for every object in docs/API_CONTRACT.md (section 2 and 3) and V2.
 * Dates are `YYYY-MM-DD` strings, datetimes are ISO 8601 strings.
 *
 * V3 module types live in `lib/types/<module>.ts` (one file per module team) and are
 * re-exported at the end of this file, so `import type { Order } from "@/lib/types"` works.
 */

/** API_CONTRACT_V3 §1.1: five roles; Super Admin = `is_super_admin` (effective role ADMIN). */
export type Role = "ADMIN" | "WAREHOUSE" | "LOGISTICS" | "VET" | "OWNER";
/** Roles an admin creates via `POST /api/users` (OWNER comes with a household). */
export type StaffRole = Exclude<Role, "OWNER">;
export type PoultryType = "LAYER" | "BROILER" | "BREEDER";
export type MovementType = "DISTRIBUTE" | "RETURN" | "DEATH" | "OUT";
export type ProductCategory = "FEED" | "VET_DRUG" | "VACCINE" | "EQUIPMENT" | "OTHER";
export type ProductUnit = "kg" | "dona" | "litr" | "qop";
export type StockType = "IN" | "OUT";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: Role;
  /** "Super Admin" for superusers, otherwise the role label (V3 §2.1). */
  role_display: string;
  is_super_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  telegram_linked: boolean;
  household_id: number | null;
  /** Linked logistics `Driver` (LOGISTICS only). */
  driver_id: number | null;
  date_joined: string;
}

export interface UserRef {
  id: number;
  full_name: string;
}

export interface HouseholdShort {
  id: number;
  code: string;
  name: string;
}

export interface HouseholdOwner {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  telegram_linked: boolean;
  /** `•••4567` (last 4 digits) or null. */
  telegram_id_masked?: string | null;
  is_active: boolean;
}

export interface Household extends HouseholdShort {
  owner: HouseholdOwner;
  phone: string;
  region: string;
  district: string;
  mfy: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  contract_info: string;
  /** TZ §18: seed / test household (shown with a “Demo” badge, excluded on request). */
  is_demo?: boolean;
  bird_count: number;
  created_at: string;
}

export interface HouseholdMapPoint {
  id: number;
  code: string;
  name: string;
  owner_name: string;
  latitude: number;
  longitude: number;
  bird_count: number;
  is_active: boolean;
}

export interface HouseholdBatch {
  batch_id: number;
  batch_code: string;
  poultry_type: PoultryType;
  poultry_type_display: string;
  breed: string;
  count: number;
  /** First DISTRIBUTE of the batch to this household (TZ §5 "Parranda qabul qilingan sana"). */
  first_received_date?: string | null;
}

export interface Batch {
  id: number;
  code: string;
  poultry_type: PoultryType;
  poultry_type_display: string;
  breed: string;
  initial_quantity: number;
  age_days: number;
  supplier: string;
  arrived_at: string;
  initial_weight_g: number | null;
  health_status: string;
  center_stock: number;
  distributed_total: number;
  deaths_total: number;
  created_at: string;
}

export interface Movement {
  id: number;
  op_id: string;
  batch: { id: number; code: string };
  household: HouseholdShort | null;
  type: MovementType;
  type_display: string;
  quantity: number;
  date: string;
  note: string;
  created_by: UserRef;
  created_at: string;
}

export interface DailyReport {
  id: number;
  household: HouseholdShort;
  date: string;
  bird_count: number;
  feed_kg: number;
  eggs: number;
  meat_kg: number | null;
  deaths: number;
  avg_weight_g: number | null;
  note: string;
  created_by: UserRef;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  category_display: string;
  unit: ProductUnit;
  min_stock: number;
  balance: number;
  /** V3 §5.1: promised to active logistics tasks; `available = balance − reserved`. */
  reserved: number;
  available: number;
  /** Earliest expiry of lots with stock left (V3 §5.2). */
  nearest_expiry: string | null;
  is_low: boolean;
  is_active: boolean;
  created_at: string;
}

/** Every stock operation type; ADJUST_* come only from an approved inventory count (V3 §5.3). */
export type StockTransactionType = StockType | "ADJUST_IN" | "ADJUST_OUT";

export interface StockTransaction {
  id: number;
  op_id: string;
  product: { id: number; name: string; unit: ProductUnit };
  type: StockTransactionType;
  type_display: string;
  quantity: number;
  /** `null` for owners (central balance is not exposed). */
  balance_after: number | null;
  household: HouseholdShort | null;
  document_no: string;
  note: string;
  /** Owners get `{id: null, full_name: "NNP"}`. */
  created_by: UserRef | { id: null; full_name: string };
  created_at: string;
  /** V3 §5.2 / §5.4. */
  lots?: import("./types/warehouse").StockTransactionLot[];
  /** TZ §7: attached documents. */
  files?: import("./types/files").Attachment[];
  reference?: import("./types/warehouse").StockReference | null;
}

export interface LowStockItem {
  id: number;
  name: string;
  balance: number;
  min_stock: number;
  unit: ProductUnit;
}

export interface ProductionPoint {
  date: string;
  eggs: number;
  feed_kg: number;
  meat_kg?: number;
}

export interface AdminDashboard {
  households_total: number;
  households_active: number;
  birds_in_households: number;
  birds_in_center: number;
  distributed_30d: number;
  /** Households + center (total); the split below. /stats "Nobud" = households only. */
  deaths_30d: number;
  deaths_30d_households: number;
  deaths_30d_center: number;
  feed_stock_kg: number;
  feed_used_today: number;
  eggs_today: number;
  reports_today: number;
  households_without_report_today: HouseholdShort[];
  low_stock: LowStockItem[];
  recent_movements: Movement[];
  production_14d: ProductionPoint[];
  /** TZ §4: households + center. */
  birds_total?: number;
  /** TZ §4: meat (kg) in today's reports. */
  meat_today?: number;
  /** TZ §4: monthly dynamics, 12 months, oldest first. */
  production_12m?: ProductionMonth[];
  warehouse_summary?: WarehouseSummary;
}

export interface ProductionMonth {
  /** YYYY-MM */
  month: string;
  eggs: number;
  meat_kg: number;
  feed_kg: number;
  reports: number;
}

export interface WarehouseSummary {
  active_products: number;
  low_stock: number;
  out_of_stock: number;
  with_reservation: number;
}

export interface OwnerDashboard {
  household: Household;
  bird_count: number;
  today_report: DailyReport | null;
  eggs_7d: number;
  feed_7d: number;
  meat_7d?: number;
  deaths_7d: number;
  deaths_30d: number;
  batches: HouseholdBatch[];
  recent_reports: DailyReport[];
  received_products: StockTransaction[];
}

/* ---------- Auth ---------- */

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface DetailResponse {
  detail: string;
}

/* ---------- Request payloads ---------- */

export interface UserCreatePayload {
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: StaffRole;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_active?: boolean;
}

export interface UserCreateResponse {
  user: User;
  temp_password: string;
}

export interface TempPasswordResponse {
  temp_password: string;
}

export interface HouseholdCreatePayload {
  name: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_username: string;
  phone: string;
  region: string;
  district: string;
  mfy: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contract_info?: string;
}

export interface HouseholdCreateResponse {
  household: Household;
  temp_password: string;
}

export type HouseholdUpdatePayload = Partial<
  Pick<
    Household,
    | "name"
    | "phone"
    | "region"
    | "district"
    | "mfy"
    | "address"
    | "latitude"
    | "longitude"
    | "is_active"
    | "contract_info"
    | "is_demo"
  >
>;

export interface BatchCreatePayload {
  poultry_type: PoultryType;
  breed: string;
  initial_quantity: number;
  age_days: number;
  supplier: string;
  arrived_at: string;
  initial_weight_g?: number;
  health_status?: string;
}

export interface MovementCreatePayload {
  batch: number;
  household?: number;
  type: MovementType;
  quantity: number;
  date?: string;
  note?: string;
}

export interface DailyReportCreatePayload {
  date?: string;
  feed_kg: number;
  eggs: number;
  meat_kg?: number;
  deaths?: number;
  avg_weight_g?: number;
  note?: string;
  batch?: number;
  household?: number;
}

export interface ProductCreatePayload {
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  min_stock: number;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload & { is_active: boolean }>;

export interface StockTransactionCreatePayload {
  product: number;
  type: StockType;
  quantity: number;
  household?: number;
  document_no: string;
  note?: string;
  /** IN only (V3 §5.2). */
  lot_no?: string;
  expiry_date?: string;
  /** OUT only: consume this lot first. */
  lot?: number;
  /** TZ §7: uploaded STOCK_DOCUMENT files (waybill / invoice scans). */
  file_ids?: number[];
}

export interface BatchUpdatePayload {
  health_status?: string;
  supplier?: string;
}

/* ---------- Statistics (docs/API_CONTRACT_V2.md, section 1) ---------- */

export type DeltaUnit = "%" | "pp";

/** KPI with comparison to the previous period of the same length (1.2). */
export interface Kpi {
  value: number | null;
  previous: number | null;
  delta: number | null;
  delta_unit: DeltaUnit;
}

export type KpiKey =
  | "birds_end"
  | "birds_avg"
  | "eggs"
  | "feed_kg"
  | "deaths"
  | "distributed"
  | "returned"
  | "reports"
  | "laying_rate_pct"
  | "feed_per_egg_g"
  | "feed_per_bird_day_kg"
  | "mortality_pct"
  | "report_discipline_pct";

export type KpiSet = Record<KpiKey, Kpi>;

export interface StatsPeriod {
  date_from: string;
  date_to: string;
  days: number;
  previous_from?: string;
  previous_to?: string;
}

export interface OverviewSeriesPoint {
  date: string;
  birds: number;
  layer_birds: number;
  eggs: number;
  feed_kg: number;
  /** Σ meat_kg of the day's reports (broilers). */
  meat_kg?: number;
  deaths: number;
  distributed: number;
  returned: number;
  /** All report rows of the day (inactive / birdless households too). */
  reports: number;
  /** Households due that day that reported (plotted against expected_reports). */
  reported_expected: number;
  /** Households due that day (today: due so far). */
  expected_reports: number;
  laying_rate_pct: number | null;
}

export interface PoultryTypeStat {
  poultry_type: PoultryType;
  poultry_type_display: string;
  households?: number;
  birds_end: number;
  birds_avg: number;
  deaths: number;
  distributed?: number;
  mortality_pct: number | null;
}

export interface DistrictStat {
  region: string;
  district: string;
  households: number;
  households_active: number;
  birds_end: number;
  eggs: number;
  feed_kg: number;
  deaths: number;
  reports: number;
  laying_rate_pct: number | null;
  mortality_pct: number | null;
  report_discipline_pct: number | null;
}

export interface RankedHousehold {
  household: HouseholdShort;
  district: string;
  is_active: boolean;
  laying_rate_pct: number | null;
  eggs: number;
  reports: number;
  layer_birds_avg: number | null;
}

export interface HighMortalityItem {
  household: HouseholdShort;
  district: string;
  is_active: boolean;
  birds_avg: number;
  deaths: number;
  mortality_pct: number | null;
}

export interface OverviewStats {
  period: StatsPeriod;
  generated_at: string;
  /** Echo of the dashboard filters (region, district, poultry_type). */
  filters?: { region?: string; district?: string; poultry_type?: PoultryType };
  /** Meat output of the period (TZ §4). */
  meat?: { total_kg: number; previous_total_kg: number; avg_weight_g: number | null };
  households: { total: number; active: number; with_birds: number; reporting: number };
  kpis: KpiSet;
  center: { birds_end: number; deaths: number; out: number };
  series: OverviewSeriesPoint[];
  by_poultry_type: PoultryTypeStat[];
  by_district: DistrictStat[];
  top_households: RankedHousehold[];
  bottom_households: RankedHousehold[];
  high_mortality: { threshold_pct: number; count: number; items: HighMortalityItem[] };
}

export interface HouseholdSeriesPoint {
  date: string;
  birds: number;
  layer_birds: number;
  eggs: number;
  feed_kg: number;
  deaths: number;
  distributed: number;
  returned: number;
  reported: boolean;
  expected: boolean;
  /** Today, due and not reported yet (not a missing day). */
  pending: boolean;
  laying_rate_pct: number | null;
}

export interface HouseholdStats {
  household: HouseholdShort & { is_active: boolean; region: string; district: string };
  period: StatsPeriod;
  generated_at: string;
  kpis: KpiSet;
  discipline: { expected: number; reported: number; missing: number };
  missing_days: string[];
  series: HouseholdSeriesPoint[];
  by_poultry_type: PoultryTypeStat[];
  batches: HouseholdBatch[];
}

export interface BatchStats {
  batch: Batch;
  generated_at: string;
  period: StatsPeriod;
  age: { age_days_at_arrival: number; days_since_arrival: number; age_days_today: number };
  totals: {
    initial_quantity: number;
    center_stock: number;
    in_households: number;
    alive: number;
    distributed: number;
    returned: number;
    deaths_total: number;
    deaths_center: number;
    deaths_households: number;
    out_total: number;
    out_center: number;
    out_households: number;
    households_now: number;
    mortality_pct: number | null;
  };
  households: {
    household: HouseholdShort;
    is_active: boolean;
    count_now: number;
    distributed: number;
    returned: number;
    deaths: number;
    out: number;
    mortality_pct: number | null;
  }[];
  series: {
    date: string;
    center_stock: number;
    in_households: number;
    distributed: number;
    returned: number;
    deaths: number;
    out: number;
  }[];
}

export interface ProductStats {
  product: Product;
  period: StatsPeriod;
  generated_at: string;
  totals: {
    opening_balance: number;
    in_qty: number;
    in_count: number;
    out_qty: number;
    out_count: number;
    net: number;
    adjust_in_qty?: number;
    adjust_out_qty?: number;
    closing_balance: number;
  };
  avg_daily_out: number;
  days_of_cover: number | null;
  stockout_date: string | null;
  series: { date: string; in_qty: number; out_qty: number; adjust_qty?: number; balance: number }[];
  top_consumers: { household: HouseholdShort; quantity: number; share_pct: number | null; transactions: number }[];
  out_unassigned_qty: number;
}

export interface WarehouseStatsItem {
  id: number;
  name: string;
  category: ProductCategory;
  category_display: string;
  unit: ProductUnit;
  balance: number;
  min_stock: number;
  is_low: boolean;
  is_active: boolean;
  in_qty: number;
  out_qty: number;
  avg_daily_out: number;
  days_of_cover: number | null;
  stockout_date: string | null;
}

export interface WarehouseStats {
  period: StatsPeriod;
  generated_at: string;
  products: { total: number; active: number; low: number };
  feed: {
    balance_kg: number;
    in_kg: number;
    out_kg: number;
    avg_daily_out_kg: number;
    days_of_cover: number | null;
    stockout_date: string | null;
  };
  series: { date: string; in_count: number; out_count: number; feed_in_kg: number; feed_out_kg: number }[];
  by_category: {
    category: ProductCategory;
    category_display: string;
    unit: ProductUnit;
    products: number;
    balance: number;
    in_qty: number;
    out_qty: number;
    avg_daily_out: number;
    days_of_cover: number | null;
  }[];
  items: WarehouseStatsItem[];
  low_stock: {
    id: number;
    name: string;
    unit: ProductUnit;
    balance: number;
    min_stock: number;
    avg_daily_out: number;
    days_of_cover: number | null;
    stockout_date: string | null;
  }[];
  top_consumers: { household: HouseholdShort; feed_kg: number; share_pct: number | null; transactions: number }[];
}

/* ---------- Audit log (section 2) ---------- */

export type AuditModule =
  | "auth"
  | "users"
  | "telegram"
  | "households"
  | "batches"
  | "movements"
  | "daily_reports"
  | "products"
  | "stock"
  | "orders"
  | "logistics"
  | "fleet"
  | "vet"
  | "inventory"
  | "files"
  | "settings"
  | "notifications"
  | "reports";

export type AuditAction =
  | "login_success"
  | "login_failure"
  | "password_change"
  | "create"
  | "update"
  | "password_reset"
  | "link"
  | "unlink"
  | "status_change"
  | "approve"
  | "logout"
  | "sessions_revoked"
  | "upload"
  | "retry"
  | "export";

export type AuditSource = "API" | "BOT" | "ADMIN";

export type AuditObjectType =
  | "User"
  | "Household"
  | "PoultryBatch"
  | "PoultryMovement"
  | "DailyReport"
  | "Product"
  | "StockTransaction"
  | "Order"
  | "LogisticsTask"
  | "Vehicle"
  | "Driver"
  | "VetVisit"
  | "Vaccination"
  | "DiseaseRecord"
  | "Treatment"
  | "VetRequest"
  | "InventoryCount"
  | "Attachment"
  | "SystemSettings"
  | "NotificationSetting"
  | "Notification"
  | "Report";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AuditLog {
  id: number;
  op_id: string;
  actor: UserRef | null;
  actor_name: string;
  role: Role | "";
  source: AuditSource;
  module: AuditModule;
  module_display: string;
  action: AuditAction;
  action_display: string;
  object_type: AuditObjectType | string;
  object_id: number | null;
  object_repr: string;
  before: Record<string, JsonValue> | null;
  after: Record<string, JsonValue> | null;
  ip: string | null;
  /** TZ §14: the household / product the row belongs to. */
  household_ref?: number | null;
  product_ref?: number | null;
  /** TZ §14 "Operatsiya holati". */
  status?: "SUCCESS" | "FAILED";
  status_display?: string;
  created_at: string;
}

/* ---------- V3 modules (API_CONTRACT_V3) ---------- */
export * from "./types/common";
export * from "./types/files";
export * from "./types/notifications";
export * from "./types/settings";
export * from "./types/orders";
export * from "./types/logistics";
export * from "./types/veterinary";
export * from "./types/reports";
export * from "./types/warehouse";
