"use client";

import { useAllPages, useApi } from "@/lib/use-api";
import type { Batch, Household, HouseholdBatch, Product } from "@/lib/types";

// Select boxes load every page (the contract caps one page at 200 rows), so
// records beyond the first page can always be chosen.

export function useHouseholdOptions(enabled = true) {
  return useAllPages<Household>(enabled ? "/households" : null);
}

export function useBatchOptions(enabled = true) {
  return useAllPages<Batch>(enabled ? "/batches" : null);
}

/** Active products for stock operations; `activeOnly: false` for history filters. */
export function useProductOptions({ enabled = true, activeOnly = true }: { enabled?: boolean; activeOnly?: boolean } = {}) {
  return useAllPages<Product>(enabled ? "/products" : null, { is_active: activeOnly ? true : undefined });
}

/** Birds per batch currently in a household (only count > 0). */
export function useHouseholdBatches(householdId: number | null) {
  return useApi<HouseholdBatch[]>(householdId ? `/households/${householdId}/batches` : null);
}

export function householdLabel(household: { code: string; name: string }): string {
  return `${household.code} — ${household.name}`;
}
