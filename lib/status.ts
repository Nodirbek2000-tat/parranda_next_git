/**
 * Status labels and badge tones of every V3 object — the single place (API_CONTRACT_V3 §15.3).
 *
 * Colours: NEW grey · APPROVED/ASSIGNED blue · ACCEPTED/IN_PROGRESS accent · IN_TRANSIT warning ·
 * DELIVERED accent · CONFIRMED/DONE primary · REJECTED/CANCELLED danger. Overdue = danger outline
 * (`OVERDUE_CLASS`). Module teams add new maps here instead of hard-coding labels in pages.
 */

import type { BadgeTone } from "@/components/ui/badge";
import type {
  DiseaseStatus,
  HealthStatus,
  NotificationStatus,
  OrderKind,
  OrderStatus,
  TaskStatus,
  VetRequestStatus,
  VetVisitStatus,
} from "./types";

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  NEW: { label: "Yangi", tone: "neutral" },
  APPROVED: { label: "Tasdiqlandi", tone: "info" },
  REJECTED: { label: "Rad etildi", tone: "danger" },
  IN_DELIVERY: { label: "Yetkazilmoqda", tone: "warning" },
  DELIVERED: { label: "Yetkazildi", tone: "success" },
  CONFIRMED: { label: "Qabul qilindi", tone: "primary" },
  CANCELLED: { label: "Bekor qilindi", tone: "danger" },
};

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  PRODUCT_ORDER: "Mahsulot buyurtmasi",
  SUPPLY_REQUEST: "Yem yoki mahsulot talabi",
};

export const TASK_STATUS: Record<TaskStatus, StatusMeta> = {
  NEW: { label: "Yangi", tone: "neutral" },
  ASSIGNED: { label: "Biriktirildi", tone: "info" },
  ACCEPTED: { label: "Ishga olindi", tone: "success" },
  IN_TRANSIT: { label: "Yo‘lda", tone: "warning" },
  DELIVERED: { label: "Yetkazildi", tone: "success" },
  CONFIRMED: { label: "Tasdiqlandi", tone: "primary" },
  CANCELLED: { label: "Bekor qilindi", tone: "danger" },
};

export const VET_VISIT_STATUS: Record<VetVisitStatus, StatusMeta> = {
  PLANNED: { label: "Rejalashtirilgan", tone: "info" },
  DONE: { label: "O‘tkazildi", tone: "primary" },
  CANCELLED: { label: "Bekor qilindi", tone: "danger" },
};

export const HEALTH_STATUS: Record<HealthStatus, StatusMeta> = {
  GOOD: { label: "Yaxshi", tone: "success" },
  FAIR: { label: "Qoniqarli", tone: "warning" },
  POOR: { label: "Yomon", tone: "danger" },
  CRITICAL: { label: "Xavfli", tone: "danger" },
};

export const DISEASE_STATUS: Record<DiseaseStatus, StatusMeta> = {
  OPEN: { label: "Aniqlangan", tone: "danger" },
  TREATMENT: { label: "Davolanmoqda", tone: "warning" },
  RESOLVED: { label: "Tuzaldi", tone: "primary" },
};

export const VET_REQUEST_STATUS: Record<VetRequestStatus, StatusMeta> = {
  NEW: { label: "Yangi", tone: "neutral" },
  IN_PROGRESS: { label: "Ko‘rib chiqilmoqda", tone: "success" },
  CLOSED: { label: "Yopildi", tone: "primary" },
};

export const NOTIFICATION_STATUS: Record<NotificationStatus, StatusMeta> = {
  PENDING: { label: "Navbatda", tone: "warning" },
  SENT: { label: "Yuborildi", tone: "success" },
  FAILED: { label: "Yuborilmadi", tone: "danger" },
  SKIPPED: { label: "Telegramga yuborilmaydi", tone: "neutral" },
};

/** Extra classes for an overdue badge / card (danger outline). */
export const OVERDUE_CLASS = "ring-1 ring-inset ring-danger/60";

/** Metadata for a status value; unknown values fall back to a neutral badge with the raw text. */
export function statusMeta<S extends string>(map: Record<S, StatusMeta>, status: string): StatusMeta {
  return (map as Record<string, StatusMeta>)[status] ?? { label: status, tone: "neutral" };
}

/* ---------- Warehouse V3 (§5.2 lots, §5.3 inventory) ---------- */

export const LOT_STATUS: Record<import("./types").LotStatus, StatusMeta> = {
  OK: { label: "Yaroqli", tone: "success" },
  EXPIRING: { label: "Muddati yaqin", tone: "warning" },
  EXPIRED: { label: "Muddati o‘tgan", tone: "danger" },
  EMPTY: { label: "Tugagan", tone: "neutral" },
};

export const INVENTORY_STATUS: Record<import("./types").InventoryStatus, StatusMeta> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  APPROVED: { label: "Tasdiqlangan", tone: "primary" },
  CANCELLED: { label: "Bekor qilingan", tone: "danger" },
};
