/**
 * Owner requests (ARCHITECTURE_V2_1 §3). Every endpoint and shape lives here, so adjusting to
 * API_V2_NOTES only touches this file.
 */
import { api, listOf } from "./api";
import type { Photo, PersonRef } from "./types";
import type { BadgeTone } from "@/components/ui";

export type RequestKind = "FEED" | "VET";
export type RequestStatus = "PENDING_LOGISTICS" | "PENDING_ADMIN" | "APPROVED" | "DELIVERED" | "DONE" | "REJECTED";

export interface RequestCan {
  approve: boolean;
  reject: boolean;
  deliver: boolean;
  confirm: boolean;
}

export interface OwnerRequest {
  id: number;
  caseId: number | null;
  caseCode: string;
  caseName: string;
  kind: RequestKind;
  kindLabel: string;
  text: string;
  qtyKg: number | null;
  status: RequestStatus;
  statusLabel: string;
  photos: Photo[];
  createdBy: PersonRef;
  createdAt: string | null;
  logisticsBy: PersonRef;
  logisticsAt: string | null;
  adminBy: PersonRef;
  adminAt: string | null;
  deliveredBy: PersonRef;
  deliveredAt: string | null;
  doneBy: PersonRef;
  doneAt: string | null;
  rejectReason: string;
  rejectedBy: PersonRef;
  delivery: { product: string; qty: number | null; unit: string } | null;
  can: RequestCan;
}

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = { FEED: "Yem", VET: "Veterinar" };

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING_LOGISTICS: "Logistika ko‘rib chiqmoqda",
  PENDING_ADMIN: "Administrator ko‘rib chiqmoqda",
  APPROVED: "Tasdiqlandi",
  DELIVERED: "Yetkazildi",
  DONE: "Yakunlandi",
  REJECTED: "Rad etildi",
};

export const REQUEST_STATUS_TONES: Record<RequestStatus, BadgeTone> = {
  PENDING_LOGISTICS: "amber",
  PENDING_ADMIN: "amber",
  APPROVED: "blue",
  DELIVERED: "blue",
  DONE: "green",
  REJECTED: "red",
};

/** Status tabs on `/requests`. `value` is sent as `?status=`. */
export const REQUEST_TABS: { key: string; label: string; statuses: RequestStatus[] }[] = [
  { key: "pending", label: "Ko‘rib chiqish", statuses: ["PENDING_LOGISTICS", "PENDING_ADMIN"] },
  { key: "approved", label: "Tasdiqlangan", statuses: ["APPROVED"] },
  { key: "delivered", label: "Yetkazilgan", statuses: ["DELIVERED"] },
  { key: "done", label: "Yakunlangan", statuses: ["DONE"] },
  { key: "rejected", label: "Rad etilgan", statuses: ["REJECTED"] },
  { key: "all", label: "Hammasi", statuses: [] },
];

type Raw = Record<string, unknown>;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function caseRef(raw: Raw): { id: number | null; code: string; name: string } {
  const c = raw.case;
  if (c && typeof c === "object") {
    const o = c as Raw;
    return { id: numOrNull(o.id), code: str(o.code), name: str(o.owner_full_name ?? o.name) };
  }
  return { id: numOrNull(raw.case_id ?? c), code: str(raw.case_code), name: str(raw.case_name ?? raw.owner_full_name) };
}

/** Normalises one request from the API (field names per ARCHITECTURE_V2_1 §3, with tolerant fallbacks). */
export function toRequest(raw: Raw): OwnerRequest {
  const kind = (str(raw.kind).toUpperCase() === "VET" ? "VET" : "FEED") as RequestKind;
  const status = (str(raw.status).toUpperCase() || "PENDING_ADMIN") as RequestStatus;
  const ref = caseRef(raw);
  const can = (raw.can ?? {}) as Raw;
  const d = (raw.delivery ?? null) as Raw | null;
  const product = d?.product ?? raw.product;
  return {
    id: Number(raw.id),
    caseId: ref.id,
    caseCode: ref.code,
    caseName: ref.name,
    kind,
    kindLabel: str(raw.kind_display) || REQUEST_KIND_LABELS[kind],
    text: str(raw.text),
    qtyKg: numOrNull(raw.qty_kg),
    status,
    statusLabel: str(raw.status_display) || REQUEST_STATUS_LABELS[status] || status,
    photos: Array.isArray(raw.photos) ? (raw.photos as Photo[]) : [],
    createdBy: raw.created_by as PersonRef,
    createdAt: (raw.created_at as string) ?? null,
    logisticsBy: raw.logistics_by as PersonRef,
    logisticsAt: (raw.logistics_at as string) ?? null,
    adminBy: raw.admin_by as PersonRef,
    adminAt: (raw.admin_at as string) ?? null,
    deliveredBy: (raw.delivered_by ?? d?.by) as PersonRef,
    deliveredAt: ((raw.delivered_at ?? d?.at) as string) ?? null,
    doneBy: raw.done_by as PersonRef,
    doneAt: (raw.done_at as string) ?? null,
    rejectReason: str(raw.reject_reason),
    rejectedBy: raw.rejected_by as PersonRef,
    delivery:
      product !== undefined && product !== null
        ? {
            product: typeof product === "object" ? str((product as Raw).name) : str(raw.product_name ?? d?.product_name ?? `#${product}`),
            qty: numOrNull(d?.qty ?? raw.delivered_qty ?? raw.qty),
            unit: typeof product === "object" ? str((product as Raw).unit) : str(d?.unit ?? raw.unit),
          }
        : null,
    can: { approve: !!can.approve, reject: !!can.reject, deliver: !!can.deliver, confirm: !!can.confirm },
  };
}

export function toRequests(data: unknown): OwnerRequest[] {
  return listOf(data as Raw[] | { results?: Raw[] }).map(toRequest);
}

/** List path + query (`GET /api/requests?status=&kind=&case=&mine=1`). */
export const REQUESTS_PATH = "/requests";
export const requestPath = (id: number | string) => `/requests/${id}`;

export const requestsApi = {
  create(caseId: number, body: { kind: RequestKind; text: string; qty_kg?: number; photo_ids?: number[] }) {
    return api.post<Raw>(`/cases/${caseId}/requests`, body);
  },
  approve(id: number) {
    return api.post<Raw>(`/requests/${id}/approve`, {});
  },
  reject(id: number, reason: string) {
    return api.post<Raw>(`/requests/${id}/reject`, { reason });
  },
  deliver(id: number, body: { product_id: number; qty: number; photo_ids: number[]; note?: string }) {
    return api.post<Raw>(`/requests/${id}/deliver`, body);
  },
  confirm(id: number) {
    return api.post<Raw>(`/requests/${id}/confirm`, {});
  },
};
