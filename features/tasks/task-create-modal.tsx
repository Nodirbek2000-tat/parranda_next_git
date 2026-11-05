"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { api, toApiError, type FieldErrors } from "@/lib/api";
import type { Blueprint, HouseholdRef, Task, TaskData } from "@/lib/builder-types";
import { formatDate, todayIso } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Role } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useUsableBlueprints } from "../work/blueprints";
import { HouseholdPicker, UserPicker, type UserOption } from "../work/pickers";

const SYSTEM_ROLES: readonly Role[] = ["ADMIN", "WAREHOUSE", "LOGISTICS", "VET", "OWNER"];

/** “Yangi vazifa” (ADMIN, API_CONTRACT_V4 §3.2): template, household, optional assignee, dates, note. */
export function TaskCreateModal({ onClose, household: initialHousehold = null }: { onClose: () => void; household?: HouseholdRef | null }) {
  const router = useRouter();
  const toast = useToast();
  const prefix = useId();
  const templates = useUsableBlueprints("task");

  const [templateId, setTemplateId] = useState("");
  const [household, setHousehold] = useState<HouseholdRef | null>(initialHousehold);
  const [assignee, setAssignee] = useState<UserOption | null>(null);
  const [startsOn, setStartsOn] = useState(todayIso());
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Template details (executor, household requirement, duration); optional — the server decides anyway.
  const detail = useApi<Blueprint<TaskData>>(templateId ? `/builder/blueprints/${templateId}` : null);
  const data = detail.data && String(detail.data.id) === templateId ? detail.data.data : null;
  const executorRole = data && SYSTEM_ROLES.includes(data.executor as Role) ? (data.executor as Role) : "";
  const selected = templates.items.find((item) => String(item.id) === templateId);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!templateId) found.template_id = "Shablonni tanlang.";
    if (data?.requires_household && !household) found.household_id = "Bu vazifa uchun xonadonni tanlang.";
    if (startsOn && dueOn && dueOn < startsOn) found.due_on = "Muddat boshlanish sanasidan oldin bo‘lmasin.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const task = await api.post<Task>("/tasks", {
        template_id: Number(templateId),
        household_id: household?.id ?? null,
        assigned_to_id: assignee?.id ?? null,
        starts_on: startsOn || null,
        due_on: dueOn || null,
        note: note.trim(),
      });
      toast.success(`Vazifa yaratildi: ${task.code}`);
      onClose();
      router.push(`/tasks/${task.id}`);
    } catch (caught) {
      const failure = toApiError(caught);
      setErrors(failure.fields);
      const known = ["template_id", "household_id", "assigned_to_id", "starts_on", "due_on", "note"];
      const unknown = Object.keys(failure.fields).filter((key) => !known.includes(key));
      setFormError(Object.keys(failure.fields).length === 0 || unknown.length > 0 ? failure.message : null);
      setPending(false);
    }
  };

  const noTemplates = !templates.loading && !templates.error && templates.items.length === 0;

  return (
    <Modal
      title="Yangi vazifa"
      description="Faol shablon asosida vazifa yarating. Ijrochilarga bildirishnoma yuboriladi."
      onClose={onClose}
      onSubmit={submit}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending} disabled={!!templates.error || noTemplates}>
            Yaratish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {templates.error ? (
          <Alert tone={templates.error.status === 403 ? "warning" : "danger"}>
            {templates.error.status === 403
              ? "Vazifa shablonlarini ko‘rishga ruxsatingiz yo‘q. Shablonlar Super Admin tomonidan Konstruktorda sozlanadi."
              : templates.error.message}
          </Alert>
        ) : noTemplates ? (
          <Alert tone="info">Faol vazifa shablonlari yo‘q. Super Admin Konstruktorda shablon yaratib, uni faollashtirishi kerak.</Alert>
        ) : null}

        <Field label="Shablon" htmlFor={`${prefix}-template`} required error={errors.template_id}>
          <Select
            id={`${prefix}-template`}
            value={templateId}
            invalid={Boolean(errors.template_id)}
            disabled={templates.loading || !!templates.error}
            onChange={(event) => {
              setTemplateId(event.target.value);
              clearError("template_id");
            }}
          >
            <option value="">{templates.loading ? "Yuklanmoqda…" : "Shablonni tanlang"}</option>
            {templates.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.status === "test" ? " (test)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {selected && (data || selected.description) && (
          <div className="rounded-lg border border-line bg-subtle px-3 py-2.5 text-[13px] text-muted">
            {selected.description && <p className="text-ink">{selected.description}</p>}
            {data && (
              <p className="mt-1">
                Muddat: {data.duration_days ? `${data.duration_days} kun` : "belgilanmagan"}
                {data.start_date || data.end_date ? ` · Oyna: ${formatDate(data.start_date)} – ${formatDate(data.end_date)}` : ""}
                {data.requires_household ? " · Xonadon majburiy" : ""}
              </p>
            )}
            {selected.status === "test" && <p className="mt-1 text-warning-ink">Test shablon: vazifa test sifatida yaratiladi.</p>}
          </div>
        )}

        <Field
          label="Xonadon"
          htmlFor={`${prefix}-household`}
          required={Boolean(data?.requires_household)}
          error={errors.household_id}
        >
          <HouseholdPicker
            id={`${prefix}-household`}
            value={household}
            invalid={Boolean(errors.household_id)}
            onChange={(value) => {
              setHousehold(value);
              clearError("household_id");
            }}
          />
        </Field>

        <Field
          label="Mas’ul xodim"
          htmlFor={`${prefix}-assignee`}
          error={errors.assigned_to_id}
          hint="Ixtiyoriy. Tanlanmasa, ijrochi roldagi barcha xodimlar ko‘radi."
        >
          <UserPicker
            id={`${prefix}-assignee`}
            role={executorRole === "OWNER" ? "" : executorRole}
            value={assignee}
            invalid={Boolean(errors.assigned_to_id)}
            onChange={(value) => {
              setAssignee(value);
              clearError("assigned_to_id");
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Boshlanish" htmlFor={`${prefix}-starts`} error={errors.starts_on}>
            <Input
              id={`${prefix}-starts`}
              type="date"
              value={startsOn}
              invalid={Boolean(errors.starts_on)}
              onChange={(event) => {
                setStartsOn(event.target.value);
                clearError("starts_on");
              }}
            />
          </Field>
          <Field label="Muddat" htmlFor={`${prefix}-due`} error={errors.due_on} hint={dueOn ? undefined : "Shablondan"}>
            <Input
              id={`${prefix}-due`}
              type="date"
              value={dueOn}
              min={startsOn || undefined}
              invalid={Boolean(errors.due_on)}
              onChange={(event) => {
                setDueOn(event.target.value);
                clearError("due_on");
              }}
            />
          </Field>
        </div>

        <Field label="Izoh" htmlFor={`${prefix}-note`} error={errors.note}>
          <Textarea
            id={`${prefix}-note`}
            value={note}
            maxLength={1000}
            invalid={Boolean(errors.note)}
            onChange={(event) => {
              setNote(event.target.value);
              clearError("note");
            }}
          />
        </Field>

        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}
