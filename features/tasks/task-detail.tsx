"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Ban, Check, CircleCheck, FileSignature, ListTodo, Send, Undo2 } from "lucide-react";
import { api, apiDownload, toApiError } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { Act, Task } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { canAccess } from "@/lib/nav";
import { useApi } from "@/lib/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Summary, type SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { FormRenderer, useFormFill } from "../forms/form-renderer";
import { serverFieldErrors, type RoleSubject } from "../forms/form-utils";
import { SubmissionView } from "../forms/submission-view";
import { WORK_TASK_STATUS } from "../work/status";

/** Downloads the PDF of a new task act (`POST /api/acts {kind: "task"}`, then `/api/acts/{id}/pdf`). */
export function useTaskActDownload() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (taskId: number) => {
    setBusy(true);
    try {
      const act = await api.post<Act>("/acts", { kind: "task", task_id: taskId });
      const name = await apiDownload(`/acts/${act.id}/pdf`, undefined, `${act.code}.pdf`);
      toast.success(`Dalolatnoma yuklab olindi: ${name}`);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** /tasks/[id] — task card, form filling, approval (API_CONTRACT_V4 §3.2). */
export function TaskDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();
  const task = useApi<Task>(`/tasks/${id}`);
  const actDownload = useTaskActDownload();
  const [decision, setDecision] = useState<"approve" | "return" | null>(null);

  const data = task.data;
  if (!data) {
    if (task.error) {
      return (
        <Card>
          {task.error.status === 404 || task.error.status === 403 ? (
            <EmptyState
              icon={ListTodo}
              title="Vazifa topilmadi"
              description="Vazifa o‘chirilgan yoki sizda uni ko‘rish huquqi yo‘q."
              action={<LinkButton href="/tasks">Vazifalar ro‘yxati</LinkButton>}
            />
          ) : (
            <ErrorState error={task.error} onRetry={task.reload} />
          )}
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const cancel = () => {
    const state = { note: "" };
    void confirm({
      title: "Vazifani bekor qilish",
      confirmLabel: "Bekor qilish",
      tone: "danger",
      message: (
        <div className="flex flex-col gap-3">
          <p>
            <strong>{data.code}</strong> “{data.title}” bekor qilinadi. Ijrochi uni boshqa topshira olmaydi.
          </p>
          <NoteInput label="Sabab (ixtiyoriy)" onChange={(value) => (state.note = value)} />
        </div>
      ),
      onConfirm: async () => {
        await api.post<Task>(`/tasks/${data.id}/cancel`, { note: state.note.trim() });
        toast.success("Vazifa bekor qilindi");
      },
    });
  };

  const householdHref = data.household && canAccess(user, `/households/${data.household.id}`) ? `/households/${data.household.id}` : null;
  const runHref = data.process_run ? `/processes/${data.process_run.id}` : null;

  const info: SummaryItem[] = [
    ["Ijrochi", data.assigned_to ? `${data.assigned_to.full_name} (${data.executor_display})` : data.executor_display],
    ["Tasdiqlovchi", data.approver ? data.approver_display : "Tasdiqlash shart emas"],
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
    ...(data.process_run && runHref
      ? ([
          [
            "Jarayon",
            <Link key="run" href={runHref} className="text-accent hover:underline">
              {data.process_run.code} · {data.process_run.stage_index + 1}-bosqich: {data.process_run.stage_title}
            </Link>,
          ],
        ] as SummaryItem[])
      : []),
    ["Boshlanish", formatDate(data.starts_on)],
    [
      "Muddat",
      <span key="due" className={cn("tabular-nums", data.overdue && "text-danger")}>
        {formatDate(data.due_on)}
        {data.overdue ? " · muddati o‘tgan" : ""}
      </span>,
    ],
    ...(data.submitted_at
      ? ([["Topshirildi", `${data.submitted_by_name ?? "—"} · ${formatDateTime(data.submitted_at)}`]] as SummaryItem[])
      : []),
    ...(data.decided_at
      ? ([["Qaror", `${data.decided_by_name ?? "—"} · ${formatDateTime(data.decided_at)}`]] as SummaryItem[])
      : []),
    ["Yaratilgan", formatDateTime(data.created_at)],
  ];

  const prefill = data.submission && (data.status === "RETURNED" || data.status === "OPEN") ? data.submission : null;

  return (
    <div className="flex flex-col gap-6">
      {task.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={task.error} onRetry={task.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={[{ label: "Vazifalar", href: "/tasks" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.title}
            <StatusBadge map={WORK_TASK_STATUS} status={data.status} label={data.status_display} overdue={data.overdue} />
            {data.is_test && <Badge tone="warning">Test</Badge>}
          </span>
        }
        description={[data.code, data.household ? `${data.household.code} ${data.household.name}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            {data.can_approve && (
              <>
                <Button icon={<Check className="size-4" aria-hidden />} onClick={() => setDecision("approve")}>
                  Tasdiqlash
                </Button>
                <Button variant="secondary" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => setDecision("return")}>
                  Qaytarish
                </Button>
              </>
            )}
            {data.status === "APPROVED" && (
              <Button
                variant="secondary"
                icon={<FileSignature className="size-4" aria-hidden />}
                loading={actDownload.busy}
                onClick={() => void actDownload.run(data.id)}
              >
                Dalolatnoma
              </Button>
            )}
            {data.can_cancel && (
              <Button variant="secondary" icon={<Ban className="size-4" aria-hidden />} onClick={cancel}>
                Bekor qilish
              </Button>
            )}
          </>
        }
      />

      {data.status === "RETURNED" && (
        <Alert tone="warning">
          <p className="font-medium">Vazifa qayta ishlash uchun qaytarildi</p>
          {data.decision_note && <p className="mt-0.5 whitespace-pre-line">{data.decision_note}</p>}
          {data.decided_by_name && <p className="mt-1 text-xs opacity-80">{data.decided_by_name} · {formatDateTime(data.decided_at)}</p>}
        </Alert>
      )}
      {data.status !== "RETURNED" && data.decision_note && (
        <Alert tone="info">
          <span className="font-medium">Izoh: </span>
          <span className="whitespace-pre-line">{data.decision_note}</span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {data.can_submit ? (
            <TaskFillCard
              key={`${data.id}-${data.status}-${data.submission?.id ?? 0}`}
              task={data}
              user={user}
              prefill={prefill}
            />
          ) : data.submission ? (
            <Card>
              <CardHeader title={data.form?.name ?? data.submission.form_name} description="Topshirilgan ma’lumotlar" />
              <CardBody>
                <SubmissionView submission={data.submission} />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={ListTodo}
                title={data.status === "APPROVED" ? "Vazifa bajarildi" : "Hali topshirilmagan"}
                description={
                  data.status === "CANCELLED"
                    ? "Vazifa bekor qilingan."
                    : data.form
                      ? "Ijrochi formani to‘ldirib topshirgach, ma’lumotlar shu yerda ko‘rinadi."
                      : data.status === "APPROVED"
                        ? undefined
                        : "Ijrochi “Bajarildi” deb belgilashi kutilmoqda."
                }
              />
            </Card>
          )}
        </div>
        <Card className="lg:order-2">
          <CardHeader title="Ma’lumot" />
          <CardBody>
            <Summary items={info} />
          </CardBody>
        </Card>
      </div>

      {decision && <DecisionModal task={data} mode={decision} onClose={() => setDecision(null)} />}
    </div>
  );
}

function NoteInput({ label, onChange }: { label: string; onChange: (value: string) => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <Field label={label} htmlFor={id}>
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

/** Form filling + “Topshirish” (or “Bajarildi” for a task without a form). */
function TaskFillCard({ task, user, prefill }: { task: Task; user: RoleSubject; prefill: Task["submission"] }) {
  const toast = useToast();
  const fields = task.form?.fields ?? [];
  const form = useFormFill(fields, user, { data: prefill?.data, display: prefill?.display });
  const [pending, setPending] = useState(false);
  const [general, setGeneral] = useState<string | null>(null);

  const submit = async () => {
    setGeneral(null);
    let payload = {};
    if (task.form) {
      const data = form.validate();
      if (!data) {
        setGeneral("Belgilangan maydonlarni to‘g‘rilang.");
        return;
      }
      payload = { data };
    }
    setPending(true);
    try {
      const result = await api.post<Task>(`/tasks/${task.id}/submit`, payload);
      toast.success(result.status === "APPROVED" ? "Vazifa bajarildi" : "Vazifa tasdiqlashga yuborildi");
    } catch (caught) {
      const failure = toApiError(caught);
      if (failure.status === 400) {
        const parsed = serverFieldErrors(failure, fields.map((field) => field.key));
        form.setErrors(parsed.fields);
        setGeneral(parsed.general ?? (Object.keys(parsed.fields).length > 0 ? "Belgilangan maydonlarni to‘g‘rilang." : null));
      } else {
        setGeneral(failure.message);
      }
    } finally {
      setPending(false);
    }
  };

  const submitLabel = task.approver ? "Topshirish" : "Bajarildi";

  if (!task.form) {
    return (
      <Card>
        <CardHeader title="Bajarish" description="Bu vazifada to‘ldiriladigan forma yo‘q." />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Ishni bajargach “{submitLabel}” tugmasini bosing.
            {task.approver ? ` Vazifa ${task.approver_display} tasdig‘iga yuboriladi.` : ""}
          </p>
          {general && <Alert>{general}</Alert>}
          <Button className="w-full sm:w-fit" loading={pending} icon={<CircleCheck className="size-4" aria-hidden />} onClick={submit}>
            {submitLabel}
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={task.form.name}
        description={task.status === "RETURNED" ? "Oldingi javoblar to‘ldirilgan — kerakli joylarni tuzating." : "Formani to‘ldiring va topshiring."}
      />
      <CardBody className="flex flex-col gap-5">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-5"
        >
          <FormRenderer form={form} disabled={pending} />
          {general && <Alert>{general}</Alert>}
          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted">
              {task.approver ? `Topshirilgach ${task.approver_display} tasdiqlaydi.` : "Topshirilgach vazifa bajarilgan hisoblanadi."}
            </p>
            <Button type="submit" loading={pending} disabled={form.busy} icon={<Send className="size-4" aria-hidden />}>
              {form.busy ? "Fayl yuklanmoqda…" : submitLabel}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** “Tasdiqlash” (note optional) / “Qaytarish” (note required). */
function DecisionModal({ task, mode, onClose }: { task: Task; mode: "approve" | "return"; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const approve = mode === "approve";

  return (
    <Modal
      title={approve ? "Vazifani tasdiqlash" : "Vazifani qaytarish"}
      description={`${task.code} · ${task.title}`}
      onClose={onClose}
      busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!approve && !note.trim()) {
          setError("Qaytarish sababini yozing.");
          return;
        }
        setPending(true);
        setFormError(null);
        try {
          await api.post<Task>(`/tasks/${task.id}/${approve ? "approve" : "return"}`, { note: note.trim() });
          toast.success(approve ? "Vazifa tasdiqlandi" : "Vazifa ijrochiga qaytarildi");
          onClose();
        } catch (caught) {
          const failure = toApiError(caught);
          if (failure.fields.note) setError(failure.fields.note);
          else setFormError(failure.message);
          setPending(false);
        }
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" variant={approve ? "primary" : "danger"} loading={pending}>
            {approve ? "Tasdiqlash" : "Qaytarish"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">
          {approve
            ? "Topshirilgan ma’lumotlar qabul qilinadi. Jarayon bo‘lsa, keyingi bosqich boshlanadi."
            : "Vazifa ijrochiga qayta ishlash uchun qaytariladi. Sababni aniq yozing."}
        </p>
        <Field label={approve ? "Izoh (ixtiyoriy)" : "Sabab"} htmlFor={id} required={!approve} error={error ?? undefined}>
          <Textarea
            id={id}
            value={note}
            maxLength={1000}
            invalid={Boolean(error)}
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
            }}
          />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}
