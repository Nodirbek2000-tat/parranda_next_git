/** Notification engine V3 (API_CONTRACT_V3 §9). */

import type { Role, StaffRole, UserRef } from "../types";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

/** Bell item: `GET /api/my/notifications`. */
export interface MyNotification {
  id: number;
  event: string;
  event_display: string;
  title: string;
  body: string;
  button_path: string;
  related_op: string;
  created_at: string;
  read_at: string | null;
}

export interface UnreadCount {
  count: number;
}

/** Monitor row: `GET /api/notifications` (ADMIN). */
export interface NotificationRow {
  id: number;
  recipient: { id: number; full_name: string; role: Role };
  event: string;
  event_display: string;
  title: string;
  related_op: string;
  status: NotificationStatus;
  status_display: string;
  attempts: number;
  last_error: string;
  telegram_linked: boolean;
  button_path: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
}

export interface NotificationDetail extends NotificationRow {
  text: string;
  body: string;
}

export type NotificationStatusCounts = Record<NotificationStatus, number>;

export interface NotificationStats extends NotificationStatusCounts {
  by_event: (NotificationStatusCounts & { event: string; display: string })[];
}

export interface RetryFailedResult {
  retried: number;
  skipped: number;
}

/** `GET /api/notification-settings` row (registry order). */
export interface NotificationSettingRow {
  event: string;
  display: string;
  description: string;
  enabled: boolean;
  telegram_enabled: boolean;
  default_roles: StaffRole[];
  roles: StaffRole[];
  roles_overridden: boolean;
  contextual: string[];
  contextual_enabled: boolean;
  updated_by: UserRef | null;
  updated_at: string | null;
}

export interface NotificationSettingPatch {
  enabled?: boolean;
  telegram_enabled?: boolean;
  /** `null` resets to the registry default roles. */
  roles?: StaffRole[] | null;
  contextual_enabled?: boolean;
}
