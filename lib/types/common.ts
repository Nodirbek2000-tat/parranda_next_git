/** Shared V3 shapes (API_CONTRACT_V3). Owned by the scaffold; module teams import, never redefine. */

import type { ProductCategory, ProductUnit, UserRef } from "../types";

/** `{id, name, unit, category}` product reference inside order / task / vet objects. */
export interface ProductRef {
  id: number;
  name: string;
  unit: ProductUnit;
  category: ProductCategory;
}

/** One row of a status history timeline (orders, logistics tasks). */
export interface StatusLogEntry<S extends string = string> {
  from_status: S | "";
  to_status: S;
  to_status_display: string;
  actor: UserRef | { id: null; full_name: string };
  note: string;
  created_at: string;
}
