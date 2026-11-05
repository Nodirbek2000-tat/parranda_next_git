"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Ban, Circle, CircleCheck, CircleDot, CircleX, Trash2, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { ProcessRun } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { canAccess } from "@/lib/nav";
import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary, type SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { PROCESS_STATUS, WORK_TASK_STATUS } from "../work/status";
import { PROCESS_DELETE_HINT, useProcessDelete } from "./use-process-delete";

type Stage = ProcessRun["stages"][number];

const STATE_META: Record<Stage["state"], { label: string; icon: typeof Circle; className: string }> = {
  done: { label: "Bajarildi", icon: CircleCheck, className: "bg-accent text-white" },
  current: { label: "Hozirgi bosqich", icon: CircleDot, className: "bg-info-soft text-info ring-2 ring-info/40" },
  pending: { label: "Kutilmoqda", icon: Circle, className: "bg-ink/5 text-muted" },
  cancelled: { label: "Bekor qilindi", icon: CircleX, className: "bg-danger-soft text-danger" },
};

/** /processes/[id] — stage timeline of a process run (API_CONTRACT_V4 §3.3). */
export function ProcessDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const runDelete = useProcessDelete(() => router.replace("/processes"));
  const run = useApi<ProcessRun>(`/process-runs/${id}`);
  const data = run.data;
  const isAdmin = user.role === "ADMIN";

  if (!data) {
    if (run.error) {
      return (
        <Card>
          {run.error.status === 404 || run.error.status === 403 ? (
            <EmptyState
              icon={Workflow}
              title="Jarayon topilmadi"
              description="Jarayon o‘chirilgan yoki sizda uni ko‘rish huquqi yo‘q."
              action={<LinkButton href={isAdmin ? "/processes" : "/tasks"}>{isAdmin ? "Jarayonlar ro‘yxati" : "Vazifalarim"}</LinkButton>}
            />
          ) : (
            <ErrorState error={run.error} onRetry={run.reload} />
          )}
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const cancel = () => {
    const state = { reason: "" };
    void confirm({
      title: "Jarayonni bekor qilish",
      confirmLabel: "Bekor qilish",
      tone: "danger",
      message: (
        <div className="flex flex-col gap-3">
          <p>
            <strong>{data.code}</strong> “{data.process_name}” to‘xtatiladi, ochiq vazifalari bekor qilinadi. Bu amalni
            qaytarib bo‘lmaydi.
          </p>
          <ReasonInput onChange={(value) => (state.reason = value)} />
        </div>
      ),
      onConfirm: async () => {
        await api.post<ProcessRun>(`/process-runs/${data.id}/cancel`, { reason: state.reason.trim() });
        toast.success("Jarayon bekor qilindi");
      },
    });
  };

  const householdHref = data.household && canAccess(user, `/households/${data.household.id}`) ? `/households/${data.household.id}` : null;
  const doneCount = data.stages.filter((stage) => stage.state === "done").length;
  const info: SummaryItem[] = [
    ["Shablon", `${data.process_name} · v${data.process_version}`],
    [
      "Xonadon",
      data.household ? (
        householdHref ? (
          <Link href={householdHref} className="text-accent hover:underline">
            {data.household.code} — {data.household.name}
          </Link>
        ) : (
          `${data.household.code} — ${data.household.name}`
        )
      ) : (
        "—"
      ),
    ],
    ["Bosqichlar", `${doneCount} / ${data.stages.length} bajarildi`],
    ["Boshladi", `${data.started_by_name ?? "—"} · ${formatDateTime(data.started_at)}`],
    ["Yakunlangan", formatDateTime(data.finished_at)],
  ];

  return (
    <div className="flex flex-col gap-6">
      {run.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={run.error} onRetry={run.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={isAdmin ? [{ label: "Jarayonlar", href: "/processes" }, { label: data.code }] : [{ label: "Vazifalar", href: "/tasks" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.process_name}
            <StatusBadge map={PROCESS_STATUS} status={data.status} label={data.status_display} />
            {data.is_test && <Badge tone="warning">Test</Badge>}
          </span>
        }
        description={[data.code, data.household ? `${data.household.code} ${data.household.name}` : null].filter(Boolean).join(" · ")}
        actions={
          isAdmin ? (
            <>
              {data.status === "RUNNING" && (
                <Button variant="secondary" icon={<Ban className="size-4" aria-hidden />} onClick={cancel}>
                  Bekor qilish
                </Button>
              )}
              {runDelete.canDelete && (
                <Button
                  variant="danger"
                  icon={<Trash2 className="size-4" aria-hidden />}
                  disabled={data.status === "RUNNING"}
                  title={data.status === "RUNNING" ? PROCESS_DELETE_HINT : undefined}
                  onClick={() => runDelete.deleteRun(data)}
                >
                  O‘chirish
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Card>
          <CardHeader title="Bosqichlar" description="Har bosqich vazifasi sharti bajarilgach keyingisi avtomatik boshlanadi" />
          <CardBody>
            <ol className="flex flex-col">
              {data.stages.map((stage, index) => (
                <StageItem key={stage.index} stage={stage} last={index === data.stages.length - 1} />
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ma’lumot" />
          <CardBody>
            <Summary items={info} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StageItem({ stage, last }: { stage: Stage; last: boolean }) {
  const meta = STATE_META[stage.state] ?? STATE_META.pending;
  const Icon = meta.icon;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0" aria-current={stage.state === "current" ? "step" : undefined}>
      {!last && (
        <span
          aria-hidden
          className={cn("absolute left-4 top-9 bottom-1 w-px -translate-x-1/2", stage.state === "done" ? "bg-accent/60" : "bg-line")}
        />
      )}
      <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full", meta.className)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-sm font-medium", stage.state === "pending" ? "text-muted" : "text-ink")}>
            {stage.index + 1}. {stage.title}
          </span>
          <span className="text-xs text-muted">{meta.label}</span>
        </p>
        {stage.task ? (
          <Link
            href={`/tasks/${stage.task.id}`}
            className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="font-medium tabular-nums text-ink">{stage.task.code}</span>
            <StatusBadge map={WORK_TASK_STATUS} status={stage.task.status} label={stage.task.status_display} />
          </Link>
        ) : (
          stage.state !== "pending" && <p className="mt-1 text-[13px] text-muted">Vazifa yaratilmagan</p>
        )}
      </div>
    </li>
  );
}

function ReasonInput({ onChange }: { onChange: (value: string) => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <Field label="Sabab (ixtiyoriy)" htmlFor={id}>
      <Textarea
        id={id}
        value={value}
        maxLength={1000}
        onChange={(event) => {
          setValue(event.target.value);
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}
