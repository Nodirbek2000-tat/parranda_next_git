"use client";

import { useState, type FormEvent } from "react";
import { CheckCheck } from "lucide-react";
import { api, ApiError, errorMessage, listOf } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import type { StageDef } from "@/lib/stages";
import type { CaseDetail, CaseStage, Package, PackageItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useConfirm } from "./confirm";
import { DocumentUpload, LivePhotos, type Coords, type UploadedDoc, type UploadedPhoto } from "./media";
import { useToast } from "./toast";
import { Alert, Button, Field, Input, Select, Textarea } from "./ui";

type Values = Record<string, string | boolean>;

function initialValues(def: StageDef, stage: CaseStage): Values {
  const data = stage.data ?? {};
  const values: Values = {};
  for (const field of def.fields) {
    const raw = data[field.key];
    if (field.type === "check") values[field.key] = raw === true;
    else values[field.key] = raw === undefined || raw === null ? "" : String(raw);
  }
  return values;
}

function itemName(item: PackageItem): string {
  if (item.product_name) return item.product_name;
  if (item.product && typeof item.product === "object") return item.product.name;
  return `#${item.product_id ?? item.product}`;
}

function itemUnit(item: PackageItem): string {
  if (item.unit) return item.unit;
  if (item.product && typeof item.product === "object") return item.product.unit ?? "";
  return "";
}

/** Stage 5: the package's items to be issued. */
function PackageItems({ detail }: { detail: CaseDetail }) {
  const embedded = detail.package && typeof detail.package === "object" ? (detail.package as Package) : null;
  const packageId = embedded?.id ?? (typeof detail.package === "number" ? detail.package : null);
  // GET /api/packages is readable by everyone (there is no GET /packages/{id} in §4).
  const list = useApi<Package[] | { results?: Package[] }>(embedded?.items || packageId === null ? null : "/packages");
  const found = list.data ? listOf(list.data).find((p) => p.id === packageId) : undefined;
  const items = embedded?.items ?? found?.items;
  if (!items) return null;
  return (
    <div className="rounded-xl border border-line bg-subtle p-3">
      <p className="mb-2 text-[13px] font-medium">Beriladigan mahsulotlar ({embedded?.name ?? found?.name ?? detail.package_name})</p>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item, index) => (
          <li key={item.id ?? index} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{itemName(item)}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {fmtNumber(item.qty)} {itemUnit(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Submit form ("Bajarildi") for the current stage's executor. */
export function StageForm({ detail, stage, def }: { detail: CaseDetail; stage: CaseStage; def: StageDef }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [values, setValues] = useState<Values>(() => initialValues(def, stage));
  // HR and Director stages are decisions: their "done" is the approval itself.
  const isDecision = def.key === "hr" || def.key === "director";
  const actionLabel = isDecision ? "Tasdiqlash" : "Bajarildi";
  const [note, setNote] = useState(stage.status === "RETURNED" ? (stage.note ?? "") : "");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: string, value: string | boolean) => setValues((prev) => ({ ...prev, [key]: value }));

  const validate = (): Record<string, unknown> | null => {
    const next: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    for (const field of def.fields) {
      const value = values[field.key];
      if (field.type === "check") {
        if (field.required && value !== true) next[field.key] = "Belgilang";
        data[field.key] = value === true;
        continue;
      }
      const text = String(value ?? "").trim();
      if (!text) {
        if (field.required) next[field.key] = "Majburiy maydon";
        continue;
      }
      if (field.type === "int") {
        const n = Number(text.replace(/\s/g, ""));
        if (!Number.isInteger(n)) next[field.key] = "Butun son kiriting";
        else if (field.min !== undefined && n < field.min) next[field.key] = `Kamida ${field.min}`;
        else data[field.key] = n;
      } else data[field.key] = text;
    }
    if (def.note?.required && !note.trim()) next.note = "Majburiy maydon";
    // photos kept from an earlier submit (before a return) still count
    const kept = stage.photos?.length ?? 0;
    const minPhotos = Math.max(stage.min_photos ?? (def.photos ? 1 : 0), def.photos ? 1 : 0);
    if (def.photos && photos.length + kept < minPhotos) next.photos = "Kamida bitta jonli rasm oling";
    setErrors(next);
    return Object.keys(next).length ? null : data;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const data = validate();
    if (!data) {
      setFormError("Maydonlarni to‘ldiring.");
      return;
    }
    await confirm({
      title: isDecision ? "Tasdiqlash" : "Bosqichni topshirish",
      message: isDecision
        ? `«${stage.title || def.title}» tasdiqlanadi va keyingi bosqich ochiladi.`
        : def.approver
          ? `«${stage.title || def.title}» bajarildi deb belgilanadi va tasdiqlashga yuboriladi.`
          : `«${stage.title || def.title}» bajarildi deb belgilanadi va keyingi bosqich ochiladi.`,
      confirmLabel: actionLabel,
      onConfirm: async () => {
        try {
          await api.post(`/cases/${detail.id}/stages/${stage.number}/submit`, {
            data,
            note: note.trim(),
            photo_ids: photos.map((p) => p.id),
            document_ids: docs.map((d) => d.id),
          });
        } catch (caught) {
          if (caught instanceof ApiError) {
            const fields = { ...caught.fields };
            if (fields.photo_ids) fields.photos = fields.photo_ids;
            setErrors(fields);
          }
          throw caught;
        }
        toast.success("Bosqich topshirildi");
      },
    }).catch((caught: unknown) => setFormError(errorMessage(caught)));
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {def.number === 5 && <PackageItems detail={detail} />}
      {def.fields.map((field) => {
        const id = `f-${field.key}`;
        const error = errors[field.key];
        if (field.type === "check") {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-sm">
                <input type="checkbox" checked={values[field.key] === true} onChange={(e) => set(field.key, e.target.checked)} className="size-5 accent-[#2f6b3f]" />
                {field.label}
              </label>
              {error && <p className="text-[13px] text-danger">{error}</p>}
            </div>
          );
        }
        return (
          <Field key={field.key} label={field.label} htmlFor={id} required={field.required} error={error}>
            {field.type === "select" ? (
              <Select id={id} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} invalid={!!error}>
                <option value="">— tanlang —</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea id={id} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} invalid={!!error} />
            ) : (
              <div className="relative">
                <Input
                  id={id}
                  inputMode={field.type === "int" ? "numeric" : undefined}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => set(field.key, field.type === "int" ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
                  invalid={!!error}
                  className={field.type === "int" && field.suffix ? "pr-14" : undefined}
                />
                {field.type === "int" && field.suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{field.suffix}</span>}
              </div>
            )}
          </Field>
        );
      })}
      {def.photos && (
        <Field
          label="Jonli rasmlar (kamida 1 ta)"
          required={!(stage.photos?.length)}
          hint={stage.photos?.length ? `Avval yuklangan ${stage.photos.length} ta rasm saqlanadi.` : undefined}
          error={errors.photos}
        >
          <LivePhotos value={photos} onChange={setPhotos} coords={coords} onCoords={setCoords} />
        </Field>
      )}
      {def.documents && (
        <Field label="Hujjatlar (ixtiyoriy)" error={errors.document_ids}>
          <DocumentUpload value={docs} onChange={setDocs} />
        </Field>
      )}
      {def.note && (
        <Field label={def.note.label} htmlFor="stage-note" required={def.note.required} error={errors.note}>
          <Textarea id="stage-note" value={note} onChange={(e) => setNote(e.target.value)} invalid={!!errors.note} />
        </Field>
      )}
      {formError && <Alert>{formError}</Alert>}
      <Button type="submit" icon={<CheckCheck className="size-4" aria-hidden />} className="w-full sm:w-auto sm:self-start">
        {actionLabel}
      </Button>
    </form>
  );
}
