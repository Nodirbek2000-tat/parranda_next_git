/** Warehouse V3 (API_CONTRACT_V3 §5): lots + expiry, inventory count. */

import type { ProductRef } from "./common";
import type { UserRef } from "../types";

export type LotStatus = "EMPTY" | "EXPIRED" | "EXPIRING" | "OK";

/** `GET /api/stock-lots`, `GET /api/products/{id}/lots` (§5.2). */
export interface StockLot {
  id: number;
  product: ProductRef;
  lot_no: string;
  expiry_date: string | null;
  received_qty: number;
  remaining_qty: number;
  received_at: string;
  in_transaction: { id: number; op_id: string };
  days_to_expiry: number | null;
  status: LotStatus;
  status_display: string;
}

/** `lots[]` of a stock operation (§5.2): IN → its own lot, OUT/ADJUST_OUT → lots consumed. */
export interface StockTransactionLot {
  lot_id: number;
  lot_no: string;
  expiry_date: string | null;
  quantity: number;
}

/** `reference` of a stock operation (§5.4); `path` is null when the viewer has no page for it. */
export interface StockReference {
  type: "logistics_task" | "vaccination" | "treatment" | "inventory";
  id: number;
  code: string;
  path: string | null;
}

export type InventoryStatus = "DRAFT" | "APPROVED" | "CANCELLED";
export type InventoryAction = "count" | "approve" | "cancel";

/** `GET /api/inventory-counts` row (§5.3). */
export interface InventoryCountShort {
  id: number;
  code: string;
  status: InventoryStatus;
  status_display: string;
  note: string;
  lines_total: number;
  lines_counted: number;
  lines_with_difference: number;
  created_by: UserRef | null;
  created_at: string;
  approved_at: string | null;
}

export interface InventoryCountLine {
  id: number;
  product: ProductRef;
  /** Balance snapshot when the count was created. */
  expected_qty: number;
  /** Live balance (stock may move during the count). */
  current_balance: number;
  reserved: number;
  counted_qty: number | null;
  balance_at_approval: number | null;
  difference: number | null;
  adjustment: { id: number; op_id: string; type: "ADJUST_IN" | "ADJUST_OUT" } | null;
  counted_at: string | null;
}

export interface InventoryCount {
  id: number;
  code: string;
  status: InventoryStatus;
  status_display: string;
  note: string;
  created_by: UserRef | null;
  created_at: string;
  approved_by: UserRef | null;
  approved_at: string | null;
  cancelled_by: UserRef | null;
  cancelled_at: string | null;
  cancel_reason: string;
  allowed_actions: InventoryAction[];
  lines: InventoryCountLine[];
}

export interface InventoryCreatePayload {
  note?: string;
  category?: string | null;
  product_ids?: number[] | null;
}
