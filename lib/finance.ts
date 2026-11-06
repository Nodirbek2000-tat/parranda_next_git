/**
 * Case finance (ARCHITECTURE_V2_1 §6): `detail.finance`, or the snapshot stored in stage 13 `data.finance`.
 * All amounts are so‘m integers.
 */
import type { CaseDetail } from "./types";

export const COST_ITEMS: { key: string; label: string }[] = [
  { key: "package_cost", label: "Paket (jo‘jaxona)" },
  { key: "chicks_cost", label: "Jo‘jalar" },
  { key: "feed_cost", label: "Yem" },
  { key: "vet_cost", label: "Veterinariya dorilari" },
  { key: "other_cost", label: "Boshqa xarajatlar" },
];

export interface Finance {
  costs: { key: string; label: string; value: number }[];
  totalCost: number;
  revenue: number | null;
  profit: number | null;
  perBirdCost: number | null;
  kg: number | null;
  pricePerKg: number | null;
}

type Raw = Record<string, unknown>;

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

export function toFinance(raw: Raw | null | undefined): Finance | null {
  if (!raw || typeof raw !== "object") return null;
  const costs = COST_ITEMS.map((item) => ({ ...item, value: n(raw[item.key]) ?? 0 }));
  const totalCost = n(raw.total_cost) ?? costs.reduce((sum, c) => sum + c.value, 0);
  const revenue = n(raw.revenue);
  const profit = n(raw.profit) ?? (revenue !== null ? revenue - totalCost : null);
  return {
    costs,
    totalCost,
    revenue,
    profit: revenue === null && n(raw.profit) === null ? null : profit,
    perBirdCost: n(raw.per_bird_cost),
    kg: n(raw.kg ?? raw.total_kg),
    pricePerKg: n(raw.price_per_kg),
  };
}

export function caseFinance(detail: CaseDetail): Finance | null {
  const snapshot = detail.stages?.find((s) => s.number === 13)?.data?.finance as Raw | undefined;
  const live = toFinance(detail.finance ?? undefined);
  const stored = toFinance(snapshot);
  const finance = live ?? stored;
  if (!finance) return null;
  // revenue/profit appear only after stage 13
  if (finance.revenue === null && stored?.revenue !== null && stored?.revenue !== undefined) {
    return { ...finance, revenue: stored.revenue, profit: stored.profit };
  }
  return finance;
}

export function hasAnyCost(finance: Finance | null): finance is Finance {
  return !!finance && (finance.totalCost > 0 || finance.revenue !== null);
}
