"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ListChecks, Plus, Trash2, X } from "lucide-react";
import type { Blueprint, BuilderMeta, FieldType, FieldValidation, FormField, RoleRef } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EditorShell, editableSource, type EditorContext } from "./editor-shell";
import { focusAt, insertAt, InsertChip, KEY_PATTERN, move, optionLabel, RoleRefChips, slugify } from "./shared";

type Props = {
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
};

const MAX_FIELDS = 60;
const MAX_OPTIONS = 50;
const CHOICE_TYPES: readonly FieldType[] = ["select", "multiselect"];
const NUMERIC_TYPES: readonly FieldType[] = ["number", "computed"];
const OPERATORS = ["+", "-", "*", "/", "(", ")"] as const;

/** Editor-only state per field: stable React key, auto-slug flag, expanded card. */
type EditorField = FormField & { uid: string; autoKey: boolean; open: boolean };
type State = { roles: RoleRef[]; fields: EditorField[] };

let uidSeq = 0;
const nextUid = () => {
  uidSeq += 1;
  return `field-${uidSeq}`;
};

function fromData(raw: Record<string, unknown> | null): State {
  const data = (raw ?? {}) as { roles?: RoleRef[]; fields?: Partial<FormField>[] };
  return {
    roles: [...(data.roles ?? [])],
    fields: (data.fields ?? []).map((field) => ({
      key: field.key ?? "",
      label: field.label ?? "",
      type: field.type ?? "text",
      required: Boolean(field.required),
      help: field.help ?? "",
      options: [...(field.options ?? [])],
      validation: { ...(field.validation ?? {}) },
      formula: field.formula ?? "",
      visible_roles: [...(field.visible_roles ?? [])],
      editable_roles: [...(field.editable_roles ?? [])],
      uid: nextUid(),
      // An existing key is never re-slugged: stored submissions use it.
      autoKey: !field.key,
      open: false,
    })),
  };
}

function validationOf(field: EditorField): FieldValidation {
  const v = field.validation ?? {};
  const isNumber = field.type === "number";
  const isText = field.type === "text";
  return {
    min: isNumber ? (v.min ?? null) : null,
    max: isNumber ? (v.max ?? null) : null,
    min_length: isText ? (v.min_length ?? null) : null,
    max_length: isText ? (v.max_length ?? null) : null,
    pattern: isText ? (v.pattern ?? "").trim() : "",
  };
}

function toData(state: State): Record<string, unknown> {
  return {
    roles: state.roles,
    fields: state.fields.map(
      (field): FormField => ({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.type === "computed" ? false : field.required,
        help: (field.help ?? "").trim(),
        options: CHOICE_TYPES.includes(field.type) ? (field.options ?? []).map((option) => option.trim()) : [],
        validation: validationOf(field),
        formula: field.type === "computed" ? (field.formula ?? "").trim() : "",
        visible_roles: field.visible_roles ?? [],
        editable_roles: field.editable_roles ?? [],
      }),
    ),
  };
}

type FieldError = { message: string; /** shown while typing (format, duplicates), not only after "Saqlash" */ live: boolean };
type FieldErrors = Partial<Record<"label" | "key" | "options" | "validation" | "formula", FieldError>>;

function checkFormula(formula: string, numericKeys: readonly string[], selfKey: string): FieldError | undefined {
  const text = formula.trim();
  if (!text) return { message: "Formulani kiriting", live: false };
  if (/[^a-z0-9_+\-*/().\s]/i.test(text)) {
    return { message: "Faqat sonlar, maydon kalitlari va + - * / ( ) belgilari mumkin", live: true };
  }
  const identifiers: string[] = text.match(/[a-z_][a-z0-9_]*/gi) ?? [];
  if (selfKey && identifiers.includes(selfKey)) return { message: "Formula o‘z maydoniga murojaat qila olmaydi", live: true };
  const unknown = [...new Set(identifiers.filter((id) => !numericKeys.includes(id)))];
  if (unknown.length) return { message: `Noma’lum yoki raqamli bo‘lmagan kalit: ${unknown.join(", ")}`, live: true };
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) return { message: "Qavslar juft emas", live: true };
  return undefined;
}

function validateFields(state: State): { byUid: Record<string, FieldErrors>; messages: string[] } {
  const byUid: Record<string, FieldErrors> = {};
  const messages: string[] = [];
  const counts = new Map<string, number>();
  for (const field of state.fields) counts.set(field.key.trim(), (counts.get(field.key.trim()) ?? 0) + 1);

  state.fields.forEach((field, index) => {
    const errors: FieldErrors = {};
    const key = field.key.trim();
    if (!field.label.trim()) errors.label = { message: "Maydon nomini kiriting", live: false };
    if (!key) errors.key = { message: "Kalitni kiriting", live: false };
    else if (!KEY_PATTERN.test(key)) {
      errors.key = { message: "Kichik lotin harfi bilan boshlansin; faqat a–z, 0–9 va _ (40 belgigacha)", live: true };
    } else if ((counts.get(key) ?? 0) > 1) errors.key = { message: "Bu kalit boshqa maydonda ham bor", live: true };

    if (CHOICE_TYPES.includes(field.type)) {
      const options = (field.options ?? []).map((option) => option.trim());
      if (options.length === 0) errors.options = { message: "Kamida bitta variant qo‘shing", live: false };
      else if (options.length > MAX_OPTIONS) errors.options = { message: `Ko‘pi bilan ${MAX_OPTIONS} ta variant`, live: true };
      else if (options.some((option) => !option)) errors.options = { message: "Bo‘sh variant bor", live: false };
      else if (new Set(options).size !== options.length) errors.options = { message: "Variantlar takrorlanmasin", live: true };
    }
    const v = field.validation ?? {};
    if (field.type === "number" && v.min != null && v.max != null && v.min > v.max) {
      errors.validation = { message: "Minimal qiymat maksimaldan katta", live: true };
    }
    if (field.type === "text") {
      if (v.min_length != null && v.max_length != null && v.min_length > v.max_length) {
        errors.validation = { message: "Minimal uzunlik maksimaldan katta", live: true };
      } else if ((v.min_length != null && v.min_length < 0) || (v.max_length != null && v.max_length < 0)) {
        errors.validation = { message: "Uzunlik manfiy bo‘lmasin", live: true };
      } else if (v.pattern?.trim()) {
        try {
          new RegExp(v.pattern);
        } catch {
          errors.validation = { message: "Shablon (regex) noto‘g‘ri", live: true };
        }
      }
    }
    if (field.type === "computed") {
      const numericKeys = state.fields
        .filter((other) => other.uid !== field.uid && NUMERIC_TYPES.includes(other.type))
        .map((other) => other.key.trim());
      const formulaError = checkFormula(field.formula ?? "", numericKeys, key);
      if (formulaError) errors.formula = formulaError;
    }
    if (Object.keys(errors).length) {
      byUid[field.uid] = errors;
      const name = field.label.trim() || key || "nomsiz";
      for (const error of Object.values(errors)) messages.push(`${index + 1}-maydon (${name}): ${error.message}`);
    }
  });
  if (state.fields.length === 0) messages.unshift("Kamida bitta maydon qo‘shing");
  if (state.fields.length > MAX_FIELDS) messages.unshift(`Formada ko‘pi bilan ${MAX_FIELDS} ta maydon bo‘lishi mumkin`);
  return { byUid, messages };
}

function uniqueKey(slug: string, fields: readonly EditorField[], selfUid: string): string {
  const base = slug || "maydon";
  const taken = new Set(fields.filter((field) => field.uid !== selfUid).map((field) => field.key));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base.slice(0, 40 - String(n).length - 1)}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

/** Form blueprint editor (API_CONTRACT_V4 §1.2 kind=form). */
export function FormEditor({ base, meta, onBack, onCreated }: Props) {
  const [state, setState] = useState(() => fromData(editableSource(base).data));
  const { byUid, messages } = validateFields(state);
  const roleRefs = meta.role_refs.filter((ref) => ref.value !== "OWNER");

  const update = (uid: string, patch: Partial<EditorField>) =>
    setState((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.uid === uid ? { ...field, ...patch } : field)),
    }));

  const setLabel = (uid: string, label: string) =>
    setState((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.uid === uid
          ? { ...field, label, key: field.autoKey ? uniqueKey(slugify(label), current.fields, uid) : field.key }
          : field,
      ),
    }));

  const addField = () =>
    setState((current) => ({
      ...current,
      fields: [
        ...current.fields.map((field) => ({ ...field, open: false })),
        {
          key: "",
          label: "",
          type: "text",
          required: false,
          help: "",
          options: [],
          validation: {},
          formula: "",
          visible_roles: [],
          editable_roles: [],
          uid: nextUid(),
          autoKey: true,
          open: true,
        },
      ],
    }));

  const allOpen = state.fields.length > 0 && state.fields.every((field) => field.open);

  return (
    <EditorShell
      kind="form"
      base={base}
      meta={meta}
      data={toData(state)}
      clientErrors={messages}
      onBack={onBack}
      onCreated={onCreated}
    >
      {(context) => (
        <>
          <Card>
            <CardHeader title="Kim to‘ldiradi" description="Hech biri tanlanmasa, barcha xodim rollari to‘ldira oladi." />
            <CardBody>
              <RoleRefChips
                label="Formani to‘ldiruvchi rollar"
                options={roleRefs}
                value={state.roles}
                disabled={context.readOnly}
                onChange={(roles) => setState((current) => ({ ...current, roles }))}
                emptyHint="Barcha xodimlar"
              />
              {context.serverErrors.byKey.roles && <p className="mt-2 text-[13px] text-danger">{context.serverErrors.byKey.roles}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Maydonlar (${state.fields.length})`}
              description="Kalit — maydonning texnik nomi (formulalar va hisobotlarda ishlatiladi). U nomdan avtomatik yasaladi."
              actions={
                state.fields.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setState((current) => ({ ...current, fields: current.fields.map((field) => ({ ...field, open: !allOpen })) }))}
                  >
                    {allOpen ? "Hammasini yig‘ish" : "Hammasini ochish"}
                  </Button>
                )
              }
            />
            {context.serverErrors.byKey.fields && <p className="px-4 pt-2 text-[13px] text-danger sm:px-6">{context.serverErrors.byKey.fields}</p>}
            <div className="mt-4 flex flex-col gap-3 border-t border-line px-4 py-4 sm:px-6">
              {state.fields.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Maydonlar yo‘q"
                  description="Kamida bitta maydon qo‘shing: masalan “Maydon (m²)”, “Rasm”, “Holati”."
                  className="py-6"
                />
              ) : (
                state.fields.map((field, index) => (
                  <FieldCard
                    key={field.uid}
                    field={field}
                    index={index}
                    total={state.fields.length}
                    fields={state.fields}
                    meta={meta}
                    roleRefs={roleRefs}
                    errors={byUid[field.uid] ?? {}}
                    serverError={context.serverErrors.byKey[field.key.trim()]}
                    context={context}
                    onUpdate={(patch) => update(field.uid, patch)}
                    onLabel={(label) => setLabel(field.uid, label)}
                    onMove={(delta) => setState((current) => ({ ...current, fields: move(current.fields, index, delta) }))}
                    onRemove={() =>
                      setState((current) => ({ ...current, fields: current.fields.filter((item) => item.uid !== field.uid) }))
                    }
                  />
                ))
              )}
              {!context.readOnly && (
                <Button
                  variant="secondary"
                  icon={<Plus className="size-4" aria-hidden />}
                  onClick={addField}
                  disabled={state.fields.length >= MAX_FIELDS}
                  className="self-start"
                >
                  Maydon qo‘shish
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
    </EditorShell>
  );
}

function FieldCard({
  field,
  index,
  total,
  fields,
  meta,
  roleRefs,
  errors,
  serverError,
  context,
  onUpdate,
  onLabel,
  onMove,
  onRemove,
}: {
  field: EditorField;
  index: number;
  total: number;
  fields: readonly EditorField[];
  meta: BuilderMeta;
  roleRefs: BuilderMeta["role_refs"];
  errors: FieldErrors;
  serverError?: string;
  context: EditorContext;
  onUpdate: (patch: Partial<EditorField>) => void;
  onLabel: (label: string) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const id = `ff-${field.uid}`;
  const shown = (error?: FieldError) => (error && (error.live || context.submitted) ? error.message : undefined);
  const visibleErrors = Object.values(errors).filter((error) => error.live || context.submitted);
  const hasError = visibleErrors.length > 0 || Boolean(serverError);
  const readOnly = context.readOnly;
  const v = field.validation ?? {};
  const setValidation = (patch: Partial<FieldValidation>) => onUpdate({ validation: { ...v, ...patch } });
  const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));
  const typeLabel = optionLabel(meta.field_types, field.type);
  // Rarely needed settings stay folded; they open by themselves when one of them has an error.
  const [advanced, setAdvanced] = useState(false);
  const showAdvanced = advanced || Boolean(shown(errors.key) || shown(errors.validation));

  return (
    <div className={cn("rounded-lg border bg-surface", hasError ? "border-danger/50" : "border-line")}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate({ open: !field.open })}
          aria-expanded={field.open}
          aria-controls={`${id}-body`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{index + 1}.</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={cn("truncate text-sm font-medium", field.label ? "text-ink" : "text-muted")}>
                {field.label || "Nomsiz maydon"}
                {field.required && field.type !== "computed" && <span className="text-danger"> *</span>}
              </span>
              <Badge>{typeLabel}</Badge>
              {hasError && <Badge tone="danger">Xato</Badge>}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", field.open && "rotate-180")} aria-hidden />
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <IconButton label="Yuqoriga" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="Pastga" disabled={index === total - 1} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="Maydonni o‘chirish" tone="quiet-danger" onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </div>
        )}
      </div>
      {serverError && <p className="px-3 pb-2 text-[13px] text-danger">{serverError}</p>}

      {field.open && (
        <div id={`${id}-body`} className="grid gap-4 border-t border-line px-3 py-4 sm:grid-cols-2">
          <Field label="Nomi" htmlFor={`${id}-label`} required error={shown(errors.label)}>
            <Input
              id={`${id}-label`}
              value={field.label}
              disabled={readOnly}
              invalid={Boolean(shown(errors.label))}
              onChange={(event) => onLabel(event.target.value)}
              placeholder="Masalan: Maydon (m²)"
              autoComplete="off"
            />
          </Field>
          <Field label="Turi" htmlFor={`${id}-type`} required>
            <Select
              id={`${id}-type`}
              value={field.type}
              disabled={readOnly}
              onChange={(event) => onUpdate({ type: event.target.value as FieldType })}
            >
              {meta.field_types.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <label className="flex h-10 items-center gap-2 text-sm text-ink">
              <Switch
                checked={field.type === "computed" ? false : field.required}
                disabled={readOnly || field.type === "computed"}
                onChange={(required) => onUpdate({ required })}
                label="Majburiy"
              />
              Majburiy maydon
            </label>
          </div>

          {CHOICE_TYPES.includes(field.type) && (
            <OptionsEditor
              id={`${id}-options`}
              options={field.options ?? []}
              readOnly={readOnly}
              error={shown(errors.options)}
              onChange={(options) => onUpdate({ options })}
            />
          )}

          {field.type === "computed" && (
            <FormulaInput
              id={`${id}-formula`}
              field={field}
              fields={fields}
              readOnly={readOnly}
              error={shown(errors.formula)}
              onChange={(formula) => onUpdate({ formula })}
            />
          )}

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => setAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              aria-controls={`${id}-advanced`}
              className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
              {showAdvanced ? "Qo‘shimcha sozlamalarni yashirish" : "Qo‘shimcha sozlamalar"}
            </button>
            {!showAdvanced && (
              <p className="mt-1 text-xs text-muted">Kalit, izoh, cheklovlar va kim ko‘rishi — odatda o‘zgartirish shart emas.</p>
            )}
          </div>
          {showAdvanced && (
            <div id={`${id}-advanced`} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <Field
            label="Kalit"
            htmlFor={`${id}-key`}
            required
            error={shown(errors.key)}
            hint={field.autoKey ? "Nomdan avtomatik" : "Faol formada kalitni o‘zgartirmang: eski javoblar shu kalit bilan saqlangan"}
          >
            <Input
              id={`${id}-key`}
              value={field.key}
              disabled={readOnly}
              invalid={Boolean(shown(errors.key))}
              onChange={(event) => onUpdate({ key: event.target.value.toLowerCase(), autoKey: false })}
              className="font-mono"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
            />
          </Field>
          <Field label="Yordamchi matn" htmlFor={`${id}-help`} className="sm:col-span-2">
            <Input
              id={`${id}-help`}
              value={field.help ?? ""}
              disabled={readOnly}
              onChange={(event) => onUpdate({ help: event.target.value })}
              placeholder="To‘ldiruvchiga ko‘rinadigan izoh (ixtiyoriy)"
              autoComplete="off"
            />
          </Field>
          {field.type === "number" && (
            <>
              <Field label="Minimal qiymat" htmlFor={`${id}-min`} error={shown(errors.validation)}>
                <Input
                  id={`${id}-min`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  disabled={readOnly}
                  value={v.min ?? ""}
                  onChange={(event) => setValidation({ min: numberOrNull(event.target.value) })}
                />
              </Field>
              <Field label="Maksimal qiymat" htmlFor={`${id}-max`}>
                <Input
                  id={`${id}-max`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  disabled={readOnly}
                  value={v.max ?? ""}
                  onChange={(event) => setValidation({ max: numberOrNull(event.target.value) })}
                />
              </Field>
            </>
          )}
          {field.type === "text" && (
            <>
              <Field label="Minimal uzunlik" htmlFor={`${id}-minlen`} error={shown(errors.validation)}>
                <Input
                  id={`${id}-minlen`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={readOnly}
                  value={v.min_length ?? ""}
                  onChange={(event) => setValidation({ min_length: numberOrNull(event.target.value) })}
                />
              </Field>
              <Field label="Maksimal uzunlik" htmlFor={`${id}-maxlen`}>
                <Input
                  id={`${id}-maxlen`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={readOnly}
                  value={v.max_length ?? ""}
                  onChange={(event) => setValidation({ max_length: numberOrNull(event.target.value) })}
                />
              </Field>
              <Field
                label="Shablon (regex)"
                htmlFor={`${id}-pattern`}
                className="sm:col-span-2"
                hint="Ixtiyoriy. Masalan: ^[A-Z]{2}\d{4}$"
              >
                <Input
                  id={`${id}-pattern`}
                  value={v.pattern ?? ""}
                  disabled={readOnly}
                  onChange={(event) => setValidation({ pattern: event.target.value })}
                  className="font-mono"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium text-ink">Kim ko‘radi</span>
            <RoleRefChips
              label="Maydonni ko‘radigan rollar"
              options={roleRefs}
              value={field.visible_roles ?? []}
              disabled={readOnly}
              onChange={(visible_roles) => onUpdate({ visible_roles })}
              emptyHint="Formani ko‘radiganlarning hammasi"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium text-ink">Kim tahrirlay oladi</span>
            <RoleRefChips
              label="Maydonni tahrirlay oladigan rollar"
              options={roleRefs}
              value={field.editable_roles ?? []}
              disabled={readOnly || field.type === "computed"}
              onChange={(editable_roles) => onUpdate({ editable_roles })}
              emptyHint={field.type === "computed" ? "Hisoblanadigan maydonni server to‘ldiradi" : "Formani to‘ldiruvchilarning hammasi"}
            />
          </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  id,
  options,
  readOnly,
  error,
  onChange,
}: {
  id: string;
  options: readonly string[];
  readOnly: boolean;
  error?: string;
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    // Several lines pasted at once become several options.
    const items = draft
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    onChange([...options, ...items].slice(0, MAX_OPTIONS));
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-[13px] font-medium text-ink">
        Variantlar <span className="text-danger">*</span>
        <span className="ml-1 font-normal text-muted">
          ({options.length}/{MAX_OPTIONS})
        </span>
      </span>
      {options.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {options.map((option, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{index + 1}.</span>
              <Input
                id={`${id}-${index}`}
                aria-label={`${index + 1}-variant`}
                value={option}
                disabled={readOnly}
                invalid={!option.trim() && Boolean(error)}
                onChange={(event) => onChange(options.map((item, i) => (i === index ? event.target.value : item)))}
                className="h-9"
              />
              {!readOnly && (
                <>
                  <IconButton label="Yuqoriga" disabled={index === 0} onClick={() => onChange(move(options, index, -1))}>
                    <ArrowUp className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton label="Variantni o‘chirish" tone="quiet-danger" onClick={() => onChange(options.filter((_, i) => i !== index))}>
                    <X className="size-4" aria-hidden />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && options.length < MAX_OPTIONS && (
        <div className="flex gap-2">
          <Input
            id={`${id}-new`}
            aria-label="Yangi variant"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Yangi variant (Enter)"
            className="h-9"
          />
          <Button variant="secondary" size="sm" className="h-9" icon={<Plus className="size-3.5" aria-hidden />} onClick={add} disabled={!draft.trim()}>
            Qo‘shish
          </Button>
        </div>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}

function FormulaInput({
  id,
  field,
  fields,
  readOnly,
  error,
  onChange,
}: {
  id: string;
  field: EditorField;
  fields: readonly EditorField[];
  readOnly: boolean;
  error?: string;
  onChange: (formula: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const formula = field.formula ?? "";
  const numeric = fields.filter(
    (other) => other.uid !== field.uid && NUMERIC_TYPES.includes(other.type) && KEY_PATTERN.test(other.key.trim()),
  );
  const insert = (token: string) => {
    const element = ref.current;
    const before = formula.slice(0, element?.selectionStart ?? formula.length);
    const spaced = before && !before.endsWith(" ") ? ` ${token} ` : `${token} `;
    const result = insertAt(element, formula, spaced);
    onChange(result.value);
    focusAt(element, result.cursor);
  };
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <Field
        label="Formula"
        htmlFor={id}
        required
        error={error}
        hint="Sonlar, raqamli maydon kalitlari va + - * / ( ). Natija 2 xonagacha yaxlitlanadi; 0 ga bo‘lish yoki bo‘sh qiymat — natija bo‘sh."
      >
        <Input
          ref={ref}
          id={id}
          value={formula}
          disabled={readOnly}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
          placeholder="area_m2 * 10 / birds"
          className="font-mono"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5">
          {numeric.length === 0 ? (
            <span className="text-xs text-muted">Formulada ishlatish uchun avval “Raqam” turidagi maydon qo‘shing.</span>
          ) : (
            numeric.map((other) => (
              <InsertChip key={other.uid} onClick={() => insert(other.key.trim())} title={other.label}>
                {other.key.trim()}
              </InsertChip>
            ))
          )}
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          {OPERATORS.map((operator) => (
            <InsertChip key={operator} onClick={() => insert(operator)}>
              {operator}
            </InsertChip>
          ))}
        </div>
      )}
    </div>
  );
}
