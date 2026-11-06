/**
 * Vet visits and vet assignment (ARCHITECTURE_V2_1 §4). All endpoints and shapes live here.
 */
import { api, listOf } from "./api";
import { HEALTH_OPTIONS } from "./stages";
import type { Photo, PersonRef } from "./types";
import type { BadgeTone } from "@/components/ui";

export type VisitStatus = "PLANNED" | "DONE" | "CANCELLED";
export type VisitKind = "ROUTINE" | "REQUEST";

export interface VisitDrug {
  product: string;
  unit: string;
  qty: number | null;
}

export interface Visit {
  id: number;
  caseId: number | null;
  caseCode: string;
  caseName: string;
  vet: PersonRef;
  kind: VisitKind;
  kindLabel: string;
  requestId: number | null;
  plannedDate: string | null;
  status: VisitStatus;
  statusLabel: string;
  overdue: boolean;
  doneAt: string | null;
  chicksCount: number | null;
  health: string;
  healthLabel: string;
  note: string;
  cancelReason: string;
  photos: Photo[];
  drugs: VisitDrug[];
  can: { complete: boolean | null; cancel: boolean | null };
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = { PLANNED: "Rejalashtirilgan", DONE: "Bajarildi", CANCELLED: "Bekor qilingan" };
export const VISIT_KIND_LABELS: Record<VisitKind, string> = { ROUTINE: "Haftalik ko‘rik", REQUEST: "Chaqiruv bo‘yicha" };

export function visitTone(visit: Visit): BadgeTone {
  if (visit.status === "DONE") return "green";
  if (visit.status === "CANCELLED") return "neutral";
  return visit.overdue ? "red" : "blue";
}

type Raw = Record<string, unknown>;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "YYYY-MM-DD" (or ISO) before today = overdue, when the API does not say. */
function pastDate(value: string | null): boolean {
  if (!value) return false;
  const day = value.slice(0, 10);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return day < today;
}

export function toVisit(raw: Raw): Visit {
  const status = (str(raw.status).toUpperCase() || "PLANNED") as VisitStatus;
  const kind = (str(raw.kind).toUpperCase() === "REQUEST" ? "REQUEST" : "ROUTINE") as VisitKind;
  const c = raw.case;
  const co = c && typeof c === "object" ? (c as Raw) : null;
  const planned = (raw.planned_date as string) ?? null;
  const health = str(raw.health);
  const can = raw.can && typeof raw.can === "object" ? (raw.can as Raw) : null;
  const req = raw.request;
  return {
    id: Number(raw.id),
    caseId: numOrNull(co ? co.id : (raw.case_id ?? c)),
    caseCode: str(co ? co.code : raw.case_code),
    caseName: str(co ? (co.owner_full_name ?? co.name) : (raw.case_name ?? raw.owner_full_name)),
    vet: (raw.vet ?? raw.vet_user) as PersonRef,
    kind,
    kindLabel: str(raw.kind_display) || VISIT_KIND_LABELS[kind],
    requestId: numOrNull(req && typeof req === "object" ? (req as Raw).id : req),
    plannedDate: planned,
    status,
    statusLabel: str(raw.status_display) || VISIT_STATUS_LABELS[status] || status,
    overdue: status === "PLANNED" && (typeof raw.is_overdue === "boolean" ? raw.is_overdue : pastDate(planned)),
    doneAt: (raw.done_at as string) ?? null,
    chicksCount: numOrNull(raw.chicks_count),
    health,
    healthLabel: str(raw.health_display) || HEALTH_OPTIONS.find((o) => o.value === health)?.label || health,
    note: str(raw.note),
    cancelReason: str(raw.cancel_reason),
    photos: Array.isArray(raw.photos) ? (raw.photos as Photo[]) : [],
    drugs: Array.isArray(raw.drugs)
      ? (raw.drugs as Raw[]).map((d) => {
          const p = d.product;
          return {
            product: p && typeof p === "object" ? str((p as Raw).name) : str(d.product_name ?? `#${d.product_id ?? p}`),
            unit: p && typeof p === "object" ? str((p as Raw).unit) : str(d.unit),
            qty: numOrNull(d.qty),
          };
        })
      : [],
    can: { complete: can ? !!can.complete : null, cancel: can ? !!can.cancel : null },
  };
}

export function toVisits(data: unknown): Visit[] {
  return listOf(data as Raw[] | { results?: Raw[] }).map(toVisit);
}

/** `GET /api/visits?status=&case=&mine=1` */
export const VISITS_PATH = "/visits";
export const visitPath = (id: number | string) => `/visits/${id}`;

export interface CompleteVisitBody {
  chicks_count: number;
  health: string;
  note: string;
  photo_ids: number[];
  drugs: { product_id: number; qty: number }[];
}

export const visitsApi = {
  complete(id: number, body: CompleteVisitBody) {
    return api.post<Raw>(`/visits/${id}/complete`, body);
  },
  cancel(id: number, reason: string) {
    return api.post<Raw>(`/visits/${id}/cancel`, { reason });
  },
  /** ADMIN: `POST /api/cases/{id}/assign-vet {vet_id}` */
  assignVet(caseId: number, vetId: number) {
    return api.post<Raw>(`/cases/${caseId}/assign-vet`, { vet_id: vetId });
  },
};

/** Active vets for the picker (ADMIN may list users). */
export const VETS_QUERY = { role: "VET" } as const;
