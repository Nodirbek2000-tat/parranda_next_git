/**
 * Orders (API_CONTRACT_V3 §6). OWNED BY THE ORDERS TEAM — extend freely.
 * Status labels and badge tones: `lib/status.ts`.
 */

import type { HouseholdShort, ProductCategory, ProductUnit, UserRef } from "../types";
import type { ProductRef, StatusLogEntry } from "./common";

export type OrderKind = "PRODUCT_ORDER" | "SUPPLY_REQUEST";
export type OrderStatus = "NEW" | "APPROVED" | "REJECTED" | "IN_DELIVERY" | "DELIVERED" | "CONFIRMED" | "CANCELLED";
export type OrderAction = "approve" | "reject" | "cancel" | "create_task" | "confirm_receipt";

export interface OrderItem {
  id: number;
  product: ProductRef;
  requested_qty: number;
  approved_qty: number | null;
  note: string;
}

export interface Order {
  id: number;
  code: string;
  kind: OrderKind;
  kind_display: string;
  household: HouseholdShort;
  status: OrderStatus;
  status_display: string;
  note: string;
  desired_date: string | null;
  items: OrderItem[];
  created_by: UserRef;
  created_at: string;
  decided_by: UserRef | null;
  decided_at: string | null;
  decision_note: string;
  cancel_reason: string;
  task: { id: number; code: string; status: string; status_display: string } | null;
  allowed_actions: OrderAction[];
  /** Detail response only. */
  history?: StatusLogEntry<OrderStatus>[];
}

/** `GET /api/catalog/products` row (V3 §5.5): balances are not exposed to owners. */
export interface CatalogProduct {
  id: number;
  name: string;
  category: ProductCategory;
  category_display: string;
  unit: ProductUnit;
  in_stock: boolean;
}

/** Optional task fields of approve / create-task (validated by the logistics service). */
export interface OrderTaskPayload {
  planned_date?: string | null;
  vehicle?: number | null;
  driver?: number | null;
  responsible?: number | null;
  note?: string;
}

export interface OrderApprovePayload {
  items: { id: number; approved_qty: number }[];
  decision_note?: string;
  create_task: boolean;
  task?: OrderTaskPayload | null;
}

/** `GET /api/dashboard/admin` → `pending_orders[]` (V3 §10.1). */
export interface PendingOrder {
  id: number;
  code: string;
  household: HouseholdShort;
  kind_display: string;
  items_count: number;
  created_at: string;
}

export interface OrderCreatePayload {
  kind: OrderKind;
  items: { product: number; quantity: number; note?: string }[];
  note?: string;
  desired_date?: string | null;
  /** ADMIN only (OWNER: forced to own household). */
  household?: number;
}
