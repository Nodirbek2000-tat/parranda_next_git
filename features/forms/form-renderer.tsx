"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Calculator, Camera, CircleAlert, ImagePlus, LoaderCircle, LocateFixed, Lock, Paperclip, X } from "lucide-react";
import { isAbortError, toApiError } from "@/lib/api";
import type { FormField, FormValues, SubmissionDisplay } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { ACCEPT_ATTRIBUTE, MSG_IMAGE_ONLY, uploadFile, validateFile } from "@/lib/files";
import { formatNumber, roundCoord } from "@/lib/format";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { FileChip } from "./file-chip";
import {
  buildPayload,
  computedValues,
  displayValue,
  fileMetaFromDisplay,
  initialDraft,
  isEditable,
  validateDraft,
  type Draft,
  type DraftValue,
  type FieldErrorMap,
  type FileMeta,
  type RoleSubject,
} from "./form-utils";

/* ---------- Controller ---------- */

export interface FormFill {
  fields: readonly FormField[];
  user: RoleSubject;
  draft: Draft;
  files: FileMeta;
  errors: FieldErrorMap;
  computed: Record<string, number | null>;
  /** An upload is running: keep the submit button disabled. */
  busy: boolean;
  set: (key: string, value: DraftValue) => void;
  addFile: (id: number, meta: { name: string; content_type?: string }) => void;
  setUploading: (key: string, uploading: boolean) => void;
  setErrors: (errors: FieldErrorMap) => void;
  /** Runs the client checks; returns the payload, or null (errors are shown next to the fields). */
  validate: () => FormValues | null;
}

/**
 * State of a form being filled. `data` / `display` pre-fill it (a RETURNED task re-opens with the latest
 * submission). Remount the owner (React `key`) to start over with other initial data.
 */
export function useFormFill(
  fields: readonly FormField[],
  user: RoleSubject,
  initial?: { data?: FormValues | null; display?: readonly SubmissionDisplay[] },
): FormFill {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields, initial?.data));
  const [files, setFiles] = useState<FileMeta>(() => fileMetaFromDisplay(initial?.display));
  const [errors, setErrorsState] = useState<FieldErrorMap>({});
  const [uploads, setUploads] = useState<Record<string, boolean>>({});

  const set = useCallback((key: string, value: DraftValue) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrorsState((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const addFile = useCallback((id: number, meta: { name: string; content_type?: string }) => {
    setFiles((current) => ({ ...current, [id]: meta }));
  }, []);

  const setUploading = useCallback((key: string, uploading: boolean) => {
    setUploads((current) => (Boolean(current[key]) === uploading ? current : { ...current, [key]: uploading }));
  }, []);

  const computed = useMemo(() => computedValues(fields, draft), [fields, draft]);

  const validate = () => {
    const found = validateDraft(fields, draft, user);
    setErrorsState(found);
    if (Object.keys(found).length > 0) return null;
    return buildPayload(fields, draft, user);
  };

  return {
    fields,
    user,
    draft,
    files,
    errors,
    computed,
    busy: Object.values(uploads).some(Boolean),
    set,
    addFile,
    setUploading,
    setErrors: setErrorsState,
    validate,
  };
}

/* ---------- Renderer ---------- */

/**
 * Renders a builder form (FormField[]) for filling: every V4 field type, required markers, help text,
 * client + server errors per field, read-only fields for roles outside `editable_roles`, live computed
 * values. Pair with `useFormFill`.
 */
export function FormRenderer({ form, disabled = false }: { form: FormFill; disabled?: boolean }) {
  const prefix = useId();
  const firstError = form.fields.find((field) => form.errors[field.key])?.key;

  // Scroll the first invalid field into view after a failed submit.
  useEffect(() => {
    if (!firstError) return;
    document.getElementById(`${prefix}-${firstError}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [firstError, prefix]);

  if (form.fields.length === 0) {
    return <p className="text-sm text-muted">Formada to‘ldiriladigan maydon yo‘q.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {form.fields.map((field) => (
        <FieldControl key={field.key} field={field} form={form} id={`${prefix}-${field.key}`} disabled={disabled} />
      ))}
    </div>
  );
}

function FieldShell({
  field,
  id,
  error,
  readOnly,
  group = false,
  children,
}: {
  field: FormField;
  id: string;
  error?: string;
  readOnly: boolean;
  group?: boolean;
  children: ReactNode;
}) {
  const LabelTag = group ? "span" : "label";
  return (
    <div
      id={id}
      role={group ? "group" : undefined}
      aria-labelledby={group ? `${id}-label` : undefined}
      className="flex min-w-0 scroll-mt-24 flex-col gap-1.5"
    >
      <LabelTag
        id={`${id}-label`}
        htmlFor={group ? undefined : `${id}-input`}
        className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-ink"
      >
        <span>
          {field.label}
          {field.required && !readOnly && (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          )}
        </span>
        {readOnly && field.type !== "computed" && (
          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted">
            <Lock className="size-3" aria-hidden />
            Faqat ko‘rish
          </span>
        )}
      </LabelTag>
      {children}
      {error ? (
        <p id={`${id}-input-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : field.help ? (
        <p className="text-[13px] text-muted">{field.help}</p>
      ) : null}
    </div>
  );
}

function FieldControl({ field, form, id, disabled }: { field: FormField; form: FormFill; id: string; disabled: boolean }) {
  const editable = isEditable(field, form.user);
  const value = form.draft[field.key];
  const error = form.errors[field.key];
  const inputId = `${id}-input`;
  const invalid = Boolean(error);
  const set = (next: DraftValue) => form.set(field.key, next);
  const group = editable && ["multiselect", "bool", "geo", "file", "photo"].includes(field.type);

  if (field.type === "computed") {
    const result = form.computed[field.key] ?? null;
    return (
      <FieldShell field={field} id={id} error={error} readOnly>
        <div
          id={inputId}
          aria-live="polite"
          className="flex h-10 items-center gap-2 rounded-lg border border-line bg-subtle px-3 text-sm tabular-nums text-ink"
        >
          <Calculator className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="font-medium">{result === null ? "—" : formatNumber(result)}</span>
          <span className="ml-auto text-xs text-muted">avtomatik</span>
        </div>
      </FieldShell>
    );
  }

  if (!editable) {
    const numberId = typeof value === "number" ? value : null;
    return (
      <FieldShell field={field} id={id} readOnly>
        {(field.type === "file" || field.type === "photo") && numberId !== null ? (
          <FileChip id={numberId} name={form.files[numberId]?.name ?? `Fayl #${numberId}`} photo={field.type === "photo"} />
        ) : (
          <p id={inputId} className="min-h-10 rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink">
            {displayValue(field, value, form.files)}
          </p>
        )}
      </FieldShell>
    );
  }

  let control: ReactNode;
  switch (field.type) {
    case "number":
      control = (
        <Input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(event) => set(event.target.value.replace(/[^\d.,-]/g, ""))}
          invalid={invalid}
          disabled={disabled}
          placeholder={
            field.validation?.min != null || field.validation?.max != null
              ? [field.validation?.min, field.validation?.max].map((item) => (item == null ? "…" : String(item))).join(" – ")
              : undefined
          }
        />
      );
      break;
    case "date":
      control = (
        <Input
          id={inputId}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => set(event.target.value)}
          invalid={invalid}
          disabled={disabled}
        />
      );
      break;
    case "time":
      control = (
        <Input
          id={inputId}
          type="time"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => set(event.target.value)}
          invalid={invalid}
          disabled={disabled}
        />
      );
      break;
    case "phone":
      control = <PhoneInput id={inputId} value={typeof value === "string" ? value : ""} onChange={set} invalid={invalid} disabled={disabled} />;
      break;
    case "select":
      control = (
        <Select
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => set(event.target.value)}
          invalid={invalid}
          disabled={disabled}
        >
          <option value="">Tanlang</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      );
      break;
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      control = (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  checked ? "border-accent bg-accent-soft text-primary" : "border-line bg-surface text-ink hover:border-line-strong",
                  invalid && !checked && "border-danger/60",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-accent)]"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    set(
                      event.target.checked
                        ? (field.options ?? []).filter((item) => item === option || selected.includes(item))
                        : selected.filter((item) => item !== option),
                    )
                  }
                />
                {option}
              </label>
            );
          })}
        </div>
      );
      break;
    }
    case "bool":
      control = <BoolToggle value={typeof value === "boolean" ? value : null} onChange={set} invalid={invalid} disabled={disabled} label={field.label} />;
      break;
    case "geo":
      control = (
        <GeoInput
          id={inputId}
          value={value && typeof value === "object" && !Array.isArray(value) ? value : { lat: "", lng: "" }}
          onChange={set}
          invalid={invalid}
          disabled={disabled}
        />
      );
      break;
    case "file":
    case "photo":
      control = (
        <FileValueInput
          id={inputId}
          fieldKey={field.key}
          photo={field.type === "photo"}
          value={typeof value === "number" ? value : null}
          form={form}
          invalid={invalid}
          disabled={disabled}
        />
      );
      break;
    default:
      control =
        (field.validation?.max_length ?? 0) > 200 ? (
          <Textarea
            id={inputId}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value)}
            invalid={invalid}
            disabled={disabled}
            maxLength={field.validation?.max_length ?? undefined}
          />
        ) : (
          <Input
            id={inputId}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value)}
            invalid={invalid}
            disabled={disabled}
            maxLength={field.validation?.max_length ?? undefined}
          />
        );
  }

  return (
    <FieldShell field={field} id={id} error={error} readOnly={false} group={group}>
      {control}
    </FieldShell>
  );
}

/* ---------- Phone ---------- */

/** "901234567" → "90 123 45 67" */
function groupPhone(digits: string): string {
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center overflow-hidden rounded-lg border bg-surface text-sm transition-colors",
        "focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent/30",
        invalid ? "border-danger" : "border-line hover:border-line-strong",
        disabled && "bg-subtle text-muted",
      )}
    >
      <span className="flex h-full items-center border-r border-line bg-subtle px-3 tabular-nums text-muted">+998</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        disabled={disabled}
        value={groupPhone(value)}
        onChange={(event) => {
          let digits = event.target.value.replace(/\D/g, "");
          if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
          onChange(digits.slice(0, 9));
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 tabular-nums text-ink outline-none placeholder:text-muted/70"
      />
    </div>
  );
}

/* ---------- Bool ---------- */

function BoolToggle({
  value,
  onChange,
  invalid,
  disabled,
  label,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  invalid: boolean;
  disabled: boolean;
  label: string;
}) {
  const option = (answer: boolean, text: string) => {
    const active = value === answer;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={disabled}
        onClick={() => onChange(answer)}
        className={cn(
          "h-10 flex-1 rounded-md px-4 text-sm font-medium transition-colors sm:flex-none sm:min-w-24",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed",
          active ? (answer ? "bg-accent text-white" : "bg-primary text-white") : "text-muted hover:text-ink",
        )}
      >
        {text}
      </button>
    );
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full gap-1 rounded-lg border bg-surface p-1 sm:w-fit",
        invalid ? "border-danger" : "border-line",
      )}
    >
      {option(true, "Ha")}
      {option(false, "Yo‘q")}
    </div>
  );
}

/* ---------- Geo ---------- */

function GeoInput({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: { lat: string; lng: string };
  onChange: (value: { lat: string; lng: string }) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Qurilmangiz joylashuvni aniqlay olmaydi. Koordinatalarni qo‘lda kiriting.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          lat: String(roundCoord(position.coords.latitude)),
          lng: String(roundCoord(position.coords.longitude)),
        });
      },
      (failure) => {
        setLocating(false);
        setGeoError(
          failure.code === failure.PERMISSION_DENIED
            ? "Joylashuvga ruxsat berilmadi. Ruxsat bering yoki koordinatalarni qo‘lda kiriting."
            : "Joylashuvni aniqlab bo‘lmadi. Qayta urinib ko‘ring yoki qo‘lda kiriting.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const clean = (text: string) => text.replace(/[^\d.,-]/g, "").replace(",", ".");

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        className="w-full sm:w-fit"
        icon={<LocateFixed className="size-4" aria-hidden />}
        loading={locating}
        disabled={disabled}
        onClick={locate}
      >
        Joylashuvni olish
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-lat`} className="text-xs text-muted">
            Kenglik (lat)
          </label>
          <Input
            id={`${id}-lat`}
            inputMode="decimal"
            placeholder="40.998"
            value={value.lat}
            invalid={invalid}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, lat: clean(event.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-lng`} className="text-xs text-muted">
            Uzunlik (lng)
          </label>
          <Input
            id={`${id}-lng`}
            inputMode="decimal"
            placeholder="71.237"
            value={value.lng}
            invalid={invalid}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, lng: clean(event.target.value) })}
          />
        </div>
      </div>
      {geoError && <p className="text-[13px] text-warning-ink">{geoError}</p>}
    </div>
  );
}

/* ---------- File / photo ---------- */

function FileValueInput({
  id,
  fieldKey,
  photo,
  value,
  form,
  invalid,
  disabled,
}: {
  id: string;
  fieldKey: string;
  photo: boolean;
  value: number | null;
  form: FormFill;
  invalid: boolean;
  disabled: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { set, addFile, setUploading } = form;

  useEffect(() => () => controller.current?.abort(), []);

  const start = (file: File | undefined) => {
    if (!file) return;
    const invalidFile = validateFile(file, "FORM_FILE") ?? (photo && !/\.(jpe?g|png|webp)$/i.test(file.name) ? MSG_IMAGE_ONLY : null);
    if (invalidFile) {
      setUploadError(invalidFile);
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setUploadError(null);
    setProgress(0);
    setUploading(fieldKey, true);
    uploadFile(file, "FORM_FILE", { signal: current.signal, onProgress: setProgress })
      .then((attachment) => {
        addFile(attachment.id, { name: attachment.name, content_type: attachment.content_type });
        set(fieldKey, attachment.id);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        const failure = toApiError(caught);
        setUploadError(failure.fields.file ?? failure.fields.purpose ?? failure.message);
      })
      .finally(() => {
        if (controller.current === current) controller.current = null;
        setProgress(null);
        setUploading(fieldKey, false);
      });
  };

  const cancel = () => {
    controller.current?.abort();
  };

  const name = value !== null ? (form.files[value]?.name ?? `Fayl #${value}`) : "";

  return (
    <div className="flex flex-col gap-2">
      {value !== null ? (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-1.5">
          <div className="min-w-0 flex-1">
            <FileChip id={value} name={name} photo={photo} />
          </div>
          <IconButton label={`${name}: olib tashlash`} tone="quiet-danger" disabled={disabled} onClick={() => set(fieldKey, null)}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ) : progress !== null ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
            role="progressbar"
            aria-label="Fayl yuklanmoqda"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
          </span>
          <span className="w-9 text-right text-xs tabular-nums text-muted">{progress}%</span>
          <IconButton label="Yuklashni to‘xtatish" onClick={cancel}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border border-dashed px-3 py-3 sm:flex-row sm:items-center",
            invalid ? "border-danger bg-danger-soft/40" : "border-line-strong bg-subtle",
          )}
        >
          {photo && (
            <Button
              variant="accent"
              size="sm"
              icon={<Camera className="size-4" aria-hidden />}
              disabled={disabled}
              onClick={() => cameraInput.current?.click()}
            >
              Suratga olish
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={photo ? <ImagePlus className="size-4" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            {photo ? "Galereyadan tanlash" : "Fayl tanlash"}
          </Button>
          <span className="text-xs text-muted">
            {photo ? "JPG, PNG yoki WEBP · 10 MB gacha" : "JPG, PNG, WEBP yoki PDF · 10 MB gacha"}
          </span>
        </div>
      )}
      <input
        ref={fileInput}
        id={id}
        type="file"
        accept={photo ? "image/*" : ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          start(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {photo && (
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          onChange={(event) => {
            start(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      )}
      {uploadError && (
        <p className="flex items-start gap-1.5 text-[13px] text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {uploadError}
        </p>
      )}
    </div>
  );
}
