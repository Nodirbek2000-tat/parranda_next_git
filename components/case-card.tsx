import Link from "next/link";
import { ChevronRight, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { deadline } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { CASE_STATUS_LABELS, STAGE_STATUS_LABELS, stageDef } from "@/lib/stages";
import type { CaseStage, CaseStatus, CaseSummary, StageStatus } from "@/lib/types";
import { Badge, type BadgeTone } from "./ui";

export interface CurrentStage {
  number: number;
  title: string;
  status: StageStatus | null;
  dueAt: string | null;
  overdue?: boolean;
  executor: string;
}

/** The case's current stage, from whatever the serializer provides. */
export function currentStage(item: CaseSummary & { stages?: CaseStage[] }): CurrentStage {
  const embedded = item.current ?? item.stage ?? item.stages?.find((s) => s.number === item.current_stage) ?? null;
  const number = item.current_stage ?? embedded?.number ?? 1;
  const def = stageDef(number);
  return {
    number,
    title: item.current_stage_title || embedded?.title || def?.title || `${number}-bosqich`,
    status: item.current_stage_status ?? embedded?.status ?? null,
    dueAt: item.current_due_at ?? item.due_at ?? embedded?.due_at ?? null,
    overdue: item.is_overdue ?? embedded?.is_overdue,
    executor: roleLabel(embedded?.executor_role ?? def?.executor),
  };
}

export const STAGE_TONES: Record<StageStatus, BadgeTone> = {
  WAITING: "neutral",
  ACTIVE: "blue",
  SUBMITTED: "amber",
  RETURNED: "red",
  DONE: "green",
};

export const CASE_TONES: Record<CaseStatus, BadgeTone> = { IN_PROGRESS: "blue", DONE: "green", REJECTED: "red" };

export function CaseStatusBadge({ status, label }: { status: CaseStatus; label?: string }) {
  return <Badge tone={CASE_TONES[status] ?? "neutral"}>{label || CASE_STATUS_LABELS[status] || status}</Badge>;
}

export function StageStatusBadge({ status, label }: { status: StageStatus; label?: string }) {
  return <Badge tone={STAGE_TONES[status] ?? "neutral"}>{label || STAGE_STATUS_LABELS[status] || status}</Badge>;
}

export function DeadlineText({ due, overdue, className }: { due: string | null | undefined; overdue?: boolean; className?: string }) {
  const info = deadline(due, overdue);
  if (!info) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px]", info.overdue ? "font-semibold text-danger" : "text-muted", className)}>
      <Clock className="size-3.5 shrink-0" aria-hidden />
      {info.text}
    </span>
  );
}

export function CaseCard({ item }: { item: CaseSummary }) {
  const stage = currentStage(item);
  const info = item.status === "IN_PROGRESS" ? deadline(stage.dueAt, stage.overdue) : null;
  const place = [item.region, item.district, item.mfy].filter(Boolean).join(", ");
  return (
    <Link
      href={`/cases/${item.id}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-4 shadow-card transition-colors hover:border-line-strong",
        info?.overdue ? "border-danger/40" : "border-line",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-accent">{item.code}</span>
          {item.status !== "IN_PROGRESS" ? (
            <CaseStatusBadge status={item.status} label={item.status_display} />
          ) : (
            stage.status && <StageStatusBadge status={stage.status} />
          )}
        </div>
        <p className="mt-0.5 truncate text-[15px] font-semibold text-ink">{item.owner_full_name || item.name || "—"}</p>
        {place && (
          <p className="flex items-center gap-1 truncate text-[13px] text-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {place}
          </p>
        )}
        {item.status === "IN_PROGRESS" && (
          <p className="mt-1.5 text-[13px] text-ink">
            <span className="font-medium">
              {stage.number}. {stage.title}
            </span>
            <span className="text-muted"> · {stage.executor}</span>
          </p>
        )}
        {info && <DeadlineText due={stage.dueAt} overdue={stage.overdue} className="mt-0.5" />}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
