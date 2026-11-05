"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Workflow } from "lucide-react";
import type { Blueprint, BuilderMeta, ProcessStage } from "@/lib/builder-types";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { EditorShell, editableSource } from "./editor-shell";
import { CONDITION_LABELS, move, RoleRefChips, STATUS_LABELS, useBlueprintOptions } from "./shared";

type Props = {
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
};

const MAX_STAGES = 30;

type EditorStage = Omit<ProcessStage, "task_id"> & { task_id: number | null; uid: string };

let stageSeq = 0;
const nextUid = () => {
  stageSeq += 1;
  return `stage-${stageSeq}`;
};

function fromData(raw: Record<string, unknown> | null): EditorStage[] {
  const data = (raw ?? {}) as { stages?: Partial<ProcessStage>[] };
  return (data.stages ?? []).map((stage) => ({
    title: stage.title ?? "",
    task_id: stage.task_id ?? null,
    notify_roles: [...(stage.notify_roles ?? [])],
    condition: stage.condition ?? "approved",
    uid: nextUid(),
  }));
}

function validate(stages: readonly EditorStage[]): string[] {
  const errors: string[] = [];
  if (stages.length === 0) errors.push("Kamida bitta bosqich qo‘shing");
  if (stages.length > MAX_STAGES) errors.push(`Ko‘pi bilan ${MAX_STAGES} ta bosqich`);
  stages.forEach((stage, index) => {
    if (!stage.title.trim()) errors.push(`${index + 1}-bosqich: nomini kiriting`);
    if (!stage.task_id) errors.push(`${index + 1}-bosqich: vazifa shablonini tanlang`);
  });
  return errors;
}

/** Process editor (API_CONTRACT_V4 §1.2 kind=process): ordered stages, each one task template. */
export function ProcessEditor({ base, meta, onBack, onCreated }: Props) {
  const [stages, setStages] = useState(() => fromData(editableSource(base).data));
  const tasks = useBlueprintOptions("task");
  const errors = validate(stages);
  const apiData = {
    stages: stages.map(({ title, task_id, notify_roles, condition }) => ({ title: title.trim(), task_id, notify_roles, condition })),
  };

  const update = (uid: string, patch: Partial<EditorStage>) =>
    setStages((current) => current.map((stage) => (stage.uid === uid ? { ...stage, ...patch } : stage)));

  return (
    <EditorShell kind="process" base={base} meta={meta} data={apiData} clientErrors={errors} onBack={onBack} onCreated={onCreated}>
      {({ serverErrors, submitted, readOnly }) => (
        <Card>
          <CardHeader
            title={`Bosqichlar (${stages.length})`}
            description="Har bosqich bitta vazifa yaratadi. Vazifa sharti bajarilganda (tasdiqlangan yoki topshirilgan) keyingi bosqich boshlanadi."
          />
          {serverErrors.byKey.stages && <p className="px-4 pt-2 text-[13px] text-danger sm:px-6">{serverErrors.byKey.stages}</p>}
          <div className="mt-4 flex flex-col gap-3 border-t border-line px-4 py-4 sm:px-6">
            {stages.length === 0 && (
              <EmptyState
                icon={Workflow}
                title="Bosqichlar yo‘q"
                description="Masalan: Xonadon tasdiqlandi → Qurilish → Ombor → Inkubatsiya → Logistika → Veterinar → Qushxona → Buxgalteriya."
                className="py-6"
              />
            )}
            {stages.map((stage, index) => {
              const taskOptions = (tasks.data?.results ?? []).filter((item) => item.status !== "archived" || item.id === stage.task_id);
              return (
                <section key={stage.uid} aria-label={`${index + 1}-bosqich`} className="rounded-lg border border-line">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs tabular-nums text-accent">
                        {index + 1}
                      </span>
                      {stage.title || "Nomsiz bosqich"}
                    </span>
                    {!readOnly && (
                      <span className="flex items-center">
                        <IconButton label="Yuqoriga" disabled={index === 0} onClick={() => setStages((current) => move(current, index, -1))}>
                          <ArrowUp className="size-4" aria-hidden />
                        </IconButton>
                        <IconButton
                          label="Pastga"
                          disabled={index === stages.length - 1}
                          onClick={() => setStages((current) => move(current, index, 1))}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </IconButton>
                        <IconButton
                          label="Bosqichni o‘chirish"
                          tone="quiet-danger"
                          onClick={() => setStages((current) => current.filter((item) => item.uid !== stage.uid))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4 px-3 py-3 sm:grid-cols-2">
                    <Field
                      label="Bosqich nomi"
                      htmlFor={`${stage.uid}-title`}
                      required
                      error={submitted && !stage.title.trim() ? "Nomini kiriting" : undefined}
                    >
                      <Input
                        id={`${stage.uid}-title`}
                        value={stage.title}
                        disabled={readOnly}
                        onChange={(event) => update(stage.uid, { title: event.target.value })}
                        placeholder="Masalan: Qurilish"
                        autoComplete="off"
                      />
                    </Field>
                    <Field
                      label="Vazifa shabloni"
                      htmlFor={`${stage.uid}-task`}
                      required
                      error={submitted && !stage.task_id ? "Tanlang" : tasks.error?.message}
                    >
                      <Select
                        id={`${stage.uid}-task`}
                        value={stage.task_id ?? ""}
                        disabled={readOnly}
                        onChange={(event) => update(stage.uid, { task_id: event.target.value ? Number(event.target.value) : null })}
                      >
                        <option value="">Tanlang</option>
                        {taskOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                            {item.status === "active" ? "" : ` (${STATUS_LABELS[item.status].toLowerCase()})`}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Keyingi bosqichga o‘tish" htmlFor={`${stage.uid}-condition`}>
                      <Select
                        id={`${stage.uid}-condition`}
                        value={stage.condition}
                        disabled={readOnly}
                        onChange={(event) => update(stage.uid, { condition: event.target.value as ProcessStage["condition"] })}
                      >
                        {(Object.keys(CONDITION_LABELS) as ProcessStage["condition"][]).map((value) => (
                          <option key={value} value={value}>
                            Vazifa {CONDITION_LABELS[value].toLowerCase()}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-[13px] font-medium text-ink">Bosqich boshlanganda xabar oladi</span>
                      <RoleRefChips
                        label="Xabar oladigan rollar"
                        options={meta.role_refs}
                        value={stage.notify_roles}
                        disabled={readOnly}
                        onChange={(notify_roles) => update(stage.uid, { notify_roles })}
                        emptyHint="Faqat vazifa ijrochisi xabar oladi"
                      />
                    </div>
                  </div>
                </section>
              );
            })}
            {!readOnly && (
              <Button
                variant="secondary"
                className="self-start"
                icon={<Plus className="size-4" aria-hidden />}
                disabled={stages.length >= MAX_STAGES}
                onClick={() =>
                  setStages((current) => [...current, { title: "", task_id: null, notify_roles: [], condition: "approved", uid: nextUid() }])
                }
              >
                Bosqich qo‘shish
              </Button>
            )}
          </div>
        </Card>
      )}
    </EditorShell>
  );
}
