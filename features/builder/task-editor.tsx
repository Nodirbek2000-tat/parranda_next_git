"use client";

import { useState } from "react";
import type { Blueprint, BuilderMeta, DocumentData, TaskData } from "@/lib/builder-types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EditorShell, editableSource } from "./editor-shell";
import { CONDITION_LABELS, STATUS_LABELS, useBlueprintDetails, useBlueprintOptions } from "./shared";

type Props = {
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
};

function fromData(raw: Record<string, unknown> | null): TaskData {
  const data = (raw ?? {}) as Partial<TaskData>;
  return {
    executor: data.executor ?? "",
    approver: data.approver ?? "",
    form_id: data.form_id ?? null,
    document_id: data.document_id ?? null,
    duration_days: data.duration_days ?? null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    requires_household: data.requires_household ?? true,
    next_condition: data.next_condition ?? "approved",
  };
}

function validate(data: TaskData): string[] {
  const errors: string[] = [];
  if (!data.executor) errors.push("Ijrochini tanlang");
  if (data.duration_days !== null && (!Number.isInteger(data.duration_days) || data.duration_days < 0)) {
    errors.push("Muddat butun musbat son bo‘lsin");
  }
  if (data.start_date && data.end_date && data.start_date > data.end_date) errors.push("Boshlanish sanasi tugash sanasidan keyin");
  return errors;
}

function statusSuffix(status: keyof typeof STATUS_LABELS): string {
  return status === "active" ? "" : ` (${STATUS_LABELS[status].toLowerCase()})`;
}

/** Task template editor (API_CONTRACT_V4 §1.2 kind=task). */
export function TaskEditor({ base, meta, onBack, onCreated }: Props) {
  const [data, setData] = useState(() => fromData(editableSource(base).data));
  const set = <K extends keyof TaskData>(key: K, value: TaskData[K]) => setData((current) => ({ ...current, [key]: value }));
  const forms = useBlueprintOptions("form");
  const documents = useBlueprintOptions("document");
  const formOptions = (forms.data?.results ?? []).filter((item) => item.status !== "archived" || item.id === data.form_id);
  const documentCandidates = (documents.data?.results ?? []).filter((item) => item.status !== "archived" || item.id === data.document_id);
  // The list has no `data`: load the candidates to keep only scope "task".
  const documentDetails = useBlueprintDetails<DocumentData>(documentCandidates.map((item) => item.id));
  const documentOptions = documentDetails.data
    ? documentCandidates.filter(
        (item) => item.id === data.document_id || documentDetails.data?.find((detail) => detail.id === item.id)?.data.scope === "task",
      )
    : documentCandidates;
  const errors = validate(data);
  const roleRefs = meta.role_refs;

  return (
    <EditorShell kind="task" base={base} meta={meta} data={{ ...data }} clientErrors={errors} onBack={onBack} onCreated={onCreated}>
      {({ serverErrors, submitted, readOnly }) => {
        const err = (key: keyof TaskData, local?: string) => serverErrors.byKey[key] ?? (submitted ? local : undefined);
        return (
          <>
            <Card>
              <CardHeader title="Kim bajaradi va tasdiqlaydi" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Ijrochi" htmlFor="task-executor" required error={err("executor", data.executor ? undefined : "Ijrochini tanlang")}>
                  <Select id="task-executor" value={data.executor} disabled={readOnly} onChange={(event) => set("executor", event.target.value)}>
                    <option value="">Tanlang</option>
                    {roleRefs.map((ref) => (
                      <option key={ref.value} value={ref.value}>
                        {ref.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Tasdiqlovchi"
                  htmlFor="task-approver"
                  error={err("approver")}
                  hint={data.approver ? undefined : "Topshirilishi bilan vazifa bajarilgan hisoblanadi"}
                >
                  <Select id="task-approver" value={data.approver} disabled={readOnly} onChange={(event) => set("approver", event.target.value)}>
                    <option value="">Tasdiqlash shart emas</option>
                    {roleRefs.map((ref) => (
                      <option key={ref.value} value={ref.value}>
                        {ref.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Forma va hujjat" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Forma"
                  htmlFor="task-form"
                  error={err("form_id") ?? forms.error?.message}
                  hint={data.form_id ? undefined : "Formasiz vazifa: ijrochi faqat “Bajarildi” bosadi"}
                >
                  <Select
                    id="task-form"
                    value={data.form_id ?? ""}
                    disabled={readOnly}
                    onChange={(event) => set("form_id", event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Formasiz</option>
                    {formOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {statusSuffix(item.status)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Dalolatnoma shabloni"
                  htmlFor="task-document"
                  error={err("document_id") ?? documents.error?.message}
                  hint={data.document_id ? undefined : "Standart dalolatnoma ko‘rinishi ishlatiladi"}
                >
                  <Select
                    id="task-document"
                    value={data.document_id ?? ""}
                    disabled={readOnly}
                    onChange={(event) => set("document_id", event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Standart</option>
                    {documentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {statusSuffix(item.status)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Muddat va shartlar" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Bajarish muddati (kun)"
                  htmlFor="task-duration"
                  error={err("duration_days")}
                  hint="Tugash sanasi = boshlanish + shu kun (aniq sana berilmasa)"
                >
                  <Input
                    id="task-duration"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    disabled={readOnly}
                    value={data.duration_days ?? ""}
                    onChange={(event) => set("duration_days", event.target.value === "" ? null : Number(event.target.value))}
                  />
                </Field>
                <Field label="Keyingi bosqichga o‘tish" htmlFor="task-next" error={err("next_condition")} hint="Jarayon ichida ishlatilganda">
                  <Select
                    id="task-next"
                    value={data.next_condition}
                    disabled={readOnly}
                    onChange={(event) => set("next_condition", event.target.value as TaskData["next_condition"])}
                  >
                    {(Object.keys(CONDITION_LABELS) as TaskData["next_condition"][]).map((value) => (
                      <option key={value} value={value}>
                        {CONDITION_LABELS[value]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Boshlanish sanasi (ixtiyoriy)" htmlFor="task-start" error={err("start_date")}>
                  <Input
                    id="task-start"
                    type="date"
                    disabled={readOnly}
                    value={data.start_date ?? ""}
                    onChange={(event) => set("start_date", event.target.value || null)}
                  />
                </Field>
                <Field
                  label="Tugash sanasi (ixtiyoriy)"
                  htmlFor="task-end"
                  error={err("end_date", data.start_date && data.end_date && data.start_date > data.end_date ? "Boshlanishdan oldin bo‘lmasin" : undefined)}
                >
                  <Input
                    id="task-end"
                    type="date"
                    disabled={readOnly}
                    value={data.end_date ?? ""}
                    onChange={(event) => set("end_date", event.target.value || null)}
                  />
                </Field>
                <label className="flex items-center gap-3 text-sm text-ink sm:col-span-2">
                  <Switch
                    checked={data.requires_household}
                    disabled={readOnly}
                    onChange={(value) => set("requires_household", value)}
                    label="Xonadon tanlash shart"
                  />
                  Vazifa yaratilganda xonadon tanlash shart
                </label>
              </CardBody>
            </Card>
          </>
        );
      }}
    </EditorShell>
  );
}
