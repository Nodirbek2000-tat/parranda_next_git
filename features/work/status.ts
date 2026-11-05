/** Status labels and badge tones of V4 runtime objects (vazifalar, jarayonlar, dalolatnomalar). */

import type { ActKind, ProcessRunStatus, TaskStatus } from "@/lib/builder-types";
import type { StatusMeta } from "@/lib/status";

export const WORK_TASK_STATUS: Record<TaskStatus, StatusMeta> = {
  OPEN: { label: "Bajarilmoqda", tone: "info" },
  SUBMITTED: { label: "Tasdiq kutilmoqda", tone: "warning" },
  RETURNED: { label: "Qaytarildi", tone: "danger" },
  APPROVED: { label: "Tasdiqlandi", tone: "primary" },
  CANCELLED: { label: "Bekor qilindi", tone: "neutral" },
};

export const PROCESS_STATUS: Record<ProcessRunStatus, StatusMeta> = {
  RUNNING: { label: "Jarayonda", tone: "info" },
  DONE: { label: "Yakunlandi", tone: "primary" },
  CANCELLED: { label: "Bekor qilindi", tone: "danger" },
};

export const ACT_KIND_LABELS: Record<ActKind, string> = {
  role: "Rol bo‘yicha",
  general: "Umumiy",
  task: "Vazifa bo‘yicha",
};
