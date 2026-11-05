/**
 * Veterinary (API_CONTRACT_V3 §8). OWNED BY THE VET TEAM — extend freely.
 * Status labels and badge tones: `lib/status.ts`.
 */

import type { HouseholdShort, UserRef } from "../types";
import type { ProductRef } from "./common";
import type { Attachment } from "./files";

export type VetVisitStatus = "PLANNED" | "DONE" | "CANCELLED";
export type VaccinationStatus = VetVisitStatus;
export type HealthStatus = "GOOD" | "FAIR" | "POOR" | "CRITICAL";
export type DiseaseStatus = "OPEN" | "TREATMENT" | "RESOLVED";
export type VetRequestStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

export type VetVisitAction = "complete" | "update" | "cancel";
export type VaccinationAction = VetVisitAction;
export type DiseaseAction = "update" | "treat";
export type VetRequestAction = "take" | "plan_visit" | "close";

export interface VetBatchRef {
  id: number;
  code: string;
}

export interface VetVisit {
  id: number;
  code: string;
  household: HouseholdShort;
  batch: VetBatchRef | null;
  vet: UserRef | null;
  planned_date: string;
  purpose: string;
  status: VetVisitStatus;
  status_display: string;
  is_overdue: boolean;
  done_at: string | null;
  birds_checked: number | null;
  health_status: HealthStatus | null;
  health_status_display: string | null;
  findings: string;
  conclusion: string;
  recommendations: string;
  request: { id: number; code: string } | null;
  cancel_reason: string;
  files: Attachment[];
  created_by: UserRef | null;
  created_at: string;
  allowed_actions: VetVisitAction[];
}

export interface Vaccination {
  id: number;
  code: string;
  household: HouseholdShort;
  batch: VetBatchRef | null;
  vet: UserRef | null;
  product: ProductRef | null;
  vaccine_name: string;
  dose: string;
  planned_date: string;
  birds_planned: number | null;
  status: VaccinationStatus;
  status_display: string;
  is_overdue: boolean;
  done_date: string | null;
  birds_vaccinated: number | null;
  quantity_used: number | null;
  result: string;
  note: string;
  stock_op_id: string | null;
  cancel_reason: string;
  files: Attachment[];
  created_by: UserRef | null;
  created_at: string;
  allowed_actions: VaccinationAction[];
}

export interface TreatmentShort {
  id: number;
  code: string;
  drug_name: string;
  dosage: string;
  start_date: string;
  end_date: string | null;
  instructions: string;
  vet: UserRef | null;
  is_active: boolean;
}

export interface DiseaseRecord {
  id: number;
  code: string;
  household: HouseholdShort;
  batch: VetBatchRef | null;
  vet: UserRef | null;
  visit: { id: number; code: string } | null;
  disease_name: string;
  diagnosed_date: string;
  cases: number;
  symptoms: string;
  status: DiseaseStatus;
  status_display: string;
  resolved_date: string | null;
  notes: string;
  deaths_since_diagnosis: number;
  /** Only on `GET /api/vet/diseases/{id}` (null in lists). */
  treatments: TreatmentShort[] | null;
  files: Attachment[];
  created_by: UserRef | null;
  created_at: string;
  allowed_actions: DiseaseAction[];
}

export interface Treatment {
  id: number;
  code: string;
  household: HouseholdShort;
  batch: VetBatchRef | null;
  disease: { id: number; code: string; disease_name: string; status: DiseaseStatus; status_display: string } | null;
  vet: UserRef | null;
  product: ProductRef | null;
  drug_name: string;
  dosage: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  quantity_used: number | null;
  instructions: string;
  stock_op_id: string | null;
  files: Attachment[];
  created_by: UserRef | null;
  created_at: string;
  allowed_actions: "update"[];
}

export interface VetRequest {
  id: number;
  code: string;
  household: HouseholdShort;
  text: string;
  status: VetRequestStatus;
  status_display: string;
  vet: UserRef | null;
  response: string;
  files: Attachment[];
  created_by: UserRef | null;
  created_at: string;
  closed_at: string | null;
  closed_by: UserRef | null;
  allowed_actions: VetRequestAction[];
}

export interface VetVisitShort {
  id: number;
  code: string;
  household: HouseholdShort;
  batch: VetBatchRef | null;
  vet: UserRef | null;
  planned_date: string;
  purpose: string;
  status: VetVisitStatus;
  status_display: string;
  is_overdue: boolean;
  mine: boolean;
}

export interface VaccinationShort {
  id: number;
  code: string;
  household: HouseholdShort;
  vet: UserRef | null;
  vaccine_name: string;
  dose: string;
  planned_date: string;
  birds_planned: number | null;
  status: VaccinationStatus;
  status_display: string;
  is_overdue: boolean;
  mine: boolean;
}

export interface VetRequestShort {
  id: number;
  code: string;
  household: HouseholdShort;
  text: string;
  status: VetRequestStatus;
  status_display: string;
  created_at: string;
}

/** `GET /api/vet/summary` (A, V). */
export interface VetSummary {
  date: string;
  visits: { today: number; planned_7d: number; overdue: number; done_30d: number };
  vaccinations: { due_7d: number; overdue: number; done_30d: number };
  diseases: { open: number; treatment: number; resolved_30d: number };
  requests: { new: number; in_progress: number };
  today_visits: VetVisitShort[];
  overdue_visits: VetVisitShort[];
  due_vaccinations: VaccinationShort[];
  overdue_vaccinations: VaccinationShort[];
  new_requests: VetRequestShort[];
}

/** `GET /api/my/vet` (OWNER). */
export interface MyVet {
  household: HouseholdShort;
  upcoming_visits: VetVisitShort[];
  upcoming_vaccinations: VaccinationShort[];
  recent_conclusions: VetVisit[];
  open_diseases: DiseaseRecord[];
  active_treatments: Treatment[];
  requests: VetRequest[];
}

export interface VetCalendarVisit {
  id: number;
  code: string;
  household: HouseholdShort;
  status: VetVisitStatus;
  vet: UserRef | null;
  is_overdue: boolean;
}

export interface VetCalendarVaccination {
  id: number;
  code: string;
  household: HouseholdShort;
  vaccine_name: string;
  status: VaccinationStatus;
  is_overdue: boolean;
}

export interface VetCalendarDay {
  date: string;
  visits: VetCalendarVisit[];
  vaccinations: VetCalendarVaccination[];
}

/** `vet` block of `GET /api/dashboard/admin` (§10.1). */
export interface VetDashboardCounts {
  visits_today: number;
  visits_planned_7d: number;
  visits_overdue: number;
  vaccinations_due_7d: number;
  vaccinations_overdue: number;
  open_diseases: number;
  new_requests: number;
}

/** `vet` block of `GET /api/dashboard/owner` (§10.2). */
export interface OwnerVetDashboard {
  next_visit: VetVisitShort | null;
  next_vaccination: VaccinationShort | null;
  open_requests: number;
}
