/** Growing period progress (stage 10 ACTIVE), ARCHITECTURE_V2_1 §2/§4. */
import { GROWING_STAGE } from "./stages";
import type { CaseDetail, Growing } from "./types";

const DAY = 86_400_000;

/** `detail.growing` from the API, or derived from stage 10 `activated_at` / `due_at`. */
export function growingOf(detail: CaseDetail): Growing | null {
  if (detail.growing && Number.isFinite(Number(detail.growing.total_days))) {
    return { ...detail.growing, day: Number(detail.growing.day), total_days: Number(detail.growing.total_days) };
  }
  if (detail.status !== "IN_PROGRESS" || detail.current_stage !== GROWING_STAGE) return null;
  const stage = detail.stages?.find((s) => s.number === GROWING_STAGE);
  if (!stage || stage.status !== "ACTIVE" || !stage.activated_at) return null;
  const start = new Date(stage.activated_at).getTime();
  if (Number.isNaN(start)) return null;
  const end = stage.due_at ? new Date(stage.due_at).getTime() : NaN;
  const total = Number.isNaN(end) ? 45 : Math.max(1, Math.round((end - start) / DAY));
  const day = Math.max(1, Math.floor((Date.now() - start) / DAY) + 1);
  return { day, total_days: total, started_at: stage.activated_at, ends_at: stage.due_at ?? null };
}

export function growingText(g: Growing): string {
  return `${g.day}-kun / ${g.total_days}`;
}
