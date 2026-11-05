"use client";

import { useApi } from "./use-api";
import type { SystemSettings } from "./types";

/**
 * Company settings singleton (`GET /api/settings`, any role, V3 §3) — company name for the shell
 * and report headers, `delivery_proof_required` for the deliver form, reminder/threshold values.
 * Returns `undefined` until loaded (callers keep their defaults meanwhile).
 */
export function useCompanySettings(): SystemSettings | undefined {
  return useApi<SystemSettings>("/settings").data;
}
