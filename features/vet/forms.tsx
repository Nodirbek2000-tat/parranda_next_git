"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { collect, positiveInt, REQUIRED, toNumber, useForm } from "@/lib/form";
import { addDays, formatNumber, formatQuantity, todayIso } from "@/lib/format";
import type {
  Attachment,
  DiseaseRecord,
  DiseaseStatus,
  HealthStatus,
  HouseholdShort,
  Treatment,
  Vaccination,
  VetVisit,
} from "@/lib/types";
import { FileUpload } from "@/components/files/file-upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { householdLabel, useHouseholdBatches } from "../options";
import { HouseholdSelect, SwitchRow, useActiveHouseholds, useProductsOf, useVetOptions, useVetRole } from "./shared";

type Body = Record<string, unknown>;

const HEALTH_OPTIONS: { value: HealthStatus; label: string; className: string }[] = [
  { value: "GOOD", label: "Yaxshi", className: "peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent" },
  { value: "FAIR", label: "Qoniqarli", className: "peer-checked:border-warning peer-checked:bg-warning-soft peer-checked:text-warning-ink" },
  { value: "POOR", label: "Yomon", className: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger" },
  { value: "CRITICAL", label: "Xavfli", className: "peer-checked:border-danger peer-checked:bg-danger peer-checked:text-white" },
];

function textRule(value: string, min: number, max: number, required = true): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required ? REQUIRED : undefined;
  if (trimmed.length < min) return `Kamida ${min} ta belgi kiriting`;
  if (trimmed.length > max) return `Ko‘pi bilan ${max} ta belgi`;
  return undefined;
}

function dateWindow(value: string, pastDays: number, futureDays: number): string | undefined {
  if (!value) return REQUIRED;
  const today = todayIso();
  if (value < addDays(today, -pastDays) || value > addDays(today, futureDays)) return "Sana oralig‘i noto‘g‘ri";
  return undefined;
}

function optionalCount(value: string): string | undefined {
  return value.trim() ? positiveInt(value) : undefined;
}

function optionalQuantity(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const number = toNumber(value);
  if (number === undefined) return "Son kiriting";
  if (number < 0) return "Manfiy bo‘lishi mumkin emas";
  return undefined;
}

function idOrNull(value: string): number | null {
  return value ? Number(value) : null;
}

function FormFooter({ onClose, pending, label, disabled }: { onClose: () => void; pending: boolean; label: string; disabled?: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={pending}>
        Bekor qilish
      </Button>
      <Button type="submit" loading={pending} disabled={disabled}>
        {label}
      </Button>
    </>
  );
}

function BatchSelect({ householdId, id, value, onChange, invalid }: {
  householdId: number | null;
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const batches = useHouseholdBatches(householdId);
  const rows = batches.data ?? [];
  return (
    <Select id={id} value={value} invalid={invalid} onChange={(event) => onChange(event.target.value)} disabled={!householdId}>
      <option value="">Partiya ko‘rsatilmagan</option>
      {rows.map((row) => (
        <option key={row.batch_id} value={row.batch_id}>
          {row.batch_code} · {row.poultry_type_display} · {formatNumber(row.count)} bosh
        </option>
      ))}
    </Select>
  );
}

function VetSelect({ id, value, onChange, invalid }: { id: string; value: string; onChange: (value: string) => void; invalid?: boolean }) {
  const { vets, loading } = useVetOptions(true);
  return (
    <Select id={id} value={value} invalid={invalid} onChange={(event) => onChange(event.target.value)} disabled={loading}>
      <option value="">Biriktirilmagan (barcha veterinarlarga xabar)</option>
      {vets.map((vet) => (
        <option key={vet.id} value={vet.id}>
          {vet.full_name}
        </option>
      ))}
    </Select>
  );
}

/* ---------------------------------------------------------------- visits */

/** Plan (POST /vet/visits or /vet/requests/{id}/plan-visit) or edit (PATCH, PLANNED only). */
export function VisitFormModal({
  visit,
  household,
  requestId,
  initialPurpose = "",
  onClose,
  onDone,
}: {
  visit?: VetVisit;
  household?: HouseholdShort;
  requestId?: number;
  initialPurpose?: string;
  onClose: () => void;
  onDone: (visit: VetVisit) => void;
}) {
  const toast = useToast();
  const { isAdmin } = useVetRole();
  const fixedHousehold = visit?.household ?? household;
  const form = useForm({
    household: fixedHousehold ? String(fixedHousehold.id) : "",
    planned_date: visit?.planned_date ?? todayIso(),
    purpose: visit?.purpose ?? initialPurpose,
    batch: visit?.batch ? String(visit.batch.id) : "",
    vet: visit?.vet ? String(visit.vet.id) : "",
  });
  const householdId = idOrNull(form.values.household);

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["household", values.household ? undefined : REQUIRED],
        ["planned_date", dateWindow(values.planned_date, 30, 365)],
        ["purpose", textRule(values.purpose, 3, 500)],
      ]),
    (values) => {
      const body: Body = {
        planned_date: values.planned_date,
        purpose: values.purpose.trim(),
        batch: idOrNull(values.batch),
      };
      if (isAdmin) body.vet = idOrNull(values.vet);
      if (visit) return api.patch<VetVisit>(`/vet/visits/${visit.id}`, body);
      if (requestId) return api.post<VetVisit>(`/vet/requests/${requestId}/plan-visit`, body);
      return api.post<VetVisit>("/vet/visits", { ...body, household: Number(values.household) });
    },
    (saved) => {
      toast.success(visit ? `${saved.code} yangilandi` : `${saved.code} rejalashtirildi`);
      onDone(saved);
    },
  );

  return (
    <Modal
      title={visit ? `Tekshiruvni tahrirlash · ${visit.code}` : "Tekshiruv rejalashtirish"}
      description={requestId ? "Murojaat bo‘yicha tekshiruv: murojaat “Ko‘rib chiqilmoqda” holatiga o‘tadi." : undefined}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={<FormFooter onClose={onClose} pending={form.pending} label={visit ? "Saqlash" : "Rejalashtirish"} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Xonadon" required className="sm:col-span-2" {...form.field("household")}>
          {fixedHousehold ? (
            <Input id={form.field("household").htmlFor} value={householdLabel(fixedHousehold)} disabled readOnly />
          ) : (
            <HouseholdSelect
              id={form.field("household").htmlFor}
              value={form.values.household}
              invalid={Boolean(form.errors.household)}
              onChange={(value) => {
                form.set("household", value);
                form.set("batch", "");
              }}
            />
          )}
        </Field>
        <Field label="Reja sanasi" required {...form.field("planned_date")}>
          <Input type="date" {...form.control("planned_date")} min={addDays(todayIso(), -30)} max={addDays(todayIso(), 365)} />
        </Field>
        <Field label="Partiya" hint="Ixtiyoriy" {...form.field("batch")}>
          <BatchSelect
            householdId={householdId}
            id={form.field("batch").htmlFor}
            value={form.values.batch}
            invalid={Boolean(form.errors.batch)}
            onChange={(value) => form.set("batch", value)}
          />
        </Field>
        {isAdmin && (
          <Field label="Veterinar" className="sm:col-span-2" {...form.field("vet")}>
            <VetSelect
              id={form.field("vet").htmlFor}
              value={form.values.vet}
              invalid={Boolean(form.errors.vet)}
              onChange={(value) => form.set("vet", value)}
            />
          </Field>
        )}
        <Field label="Maqsad" required className="sm:col-span-2" {...form.field("purpose")}>
          <Textarea {...form.control("purpose")} rows={2} maxLength={500} placeholder="Masalan: rejali ko‘rik, emlashdan keyingi nazorat" />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/** “Xulosa kiritish” — PLANNED → DONE (VET). */
export function VisitCompleteModal({ visit, onClose, onDone }: { visit: VetVisit; onClose: () => void; onDone: (visit: VetVisit) => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updateBatch, setUpdateBatch] = useState(false);
  const form = useForm({
    health_status: "",
    birds_checked: "",
    findings: "",
    conclusion: "",
    recommendations: "",
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["health_status", values.health_status ? undefined : "Holatni tanlang"],
        ["birds_checked", optionalCount(values.birds_checked)],
        ["findings", textRule(values.findings, 0, 4000, false)],
        ["conclusion", textRule(values.conclusion, 3, 4000)],
        ["recommendations", textRule(values.recommendations, 0, 4000, false)],
      ]),
    (values) =>
      api.post<VetVisit>(`/vet/visits/${visit.id}/complete`, {
        health_status: values.health_status,
        birds_checked: values.birds_checked.trim() ? Number(values.birds_checked) : null,
        findings: values.findings.trim(),
        conclusion: values.conclusion.trim(),
        recommendations: values.recommendations.trim(),
        file_ids: files.map((file) => file.id),
        update_batch_health: Boolean(visit.batch) && updateBatch,
      }),
    (saved) => {
      toast.success(`${saved.code}: xulosa saqlandi`);
      onDone(saved);
    },
  );

  return (
    <Modal
      title="Xulosa kiritish"
      description={`${visit.code} · ${visit.household.name}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Xulosani saqlash" disabled={uploading} />}
    >
      <div className="grid gap-4">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">
            Sog‘liq holati <span className="text-danger">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
            {HEALTH_OPTIONS.map((option) => (
              <label key={option.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="health_status"
                  value={option.value}
                  checked={form.values.health_status === option.value}
                  onChange={() => form.set("health_status", option.value)}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-10 items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-ink transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:border-line-strong ${option.className}`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {form.errors.health_status && <p className="mt-1 text-xs text-danger">{form.errors.health_status}</p>}
        </fieldset>
        <Field label="Tekshirilgan parranda" hint="Ixtiyoriy, bosh" {...form.field("birds_checked")}>
          <Input {...form.control("birds_checked")} inputMode="numeric" />
        </Field>
        <Field label="Aniqlanganlar" {...form.field("findings")}>
          <Textarea {...form.control("findings")} rows={3} maxLength={4000} />
        </Field>
        <Field label="Xulosa" required {...form.field("conclusion")}>
          <Textarea {...form.control("conclusion")} rows={3} maxLength={4000} />
        </Field>
        <Field label="Tavsiyalar" hint="Xonadon egasiga ko‘rinadi" {...form.field("recommendations")}>
          <Textarea {...form.control("recommendations")} rows={3} maxLength={4000} />
        </Field>
        <FileUpload
          purpose="VET_VISIT"
          value={files}
          onChange={setFiles}
          onBusyChange={setUploading}
          error={form.errors.file_ids}
          label="Rasmlar va hujjatlar"
        />
        {visit.batch && (
          <SwitchRow
            checked={updateBatch}
            onChange={setUpdateBatch}
            label={`Partiya ${visit.batch.code} sog‘lig‘i holatini yangilash`}
          />
        )}
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/* ---------------------------------------------------------- vaccinations */

/** Plan one vaccination, a campaign for many households (`household_ids`), or edit a PLANNED one. */
export function VaccinationFormModal({
  vaccination,
  household,
  onClose,
  onDone,
}: {
  vaccination?: Vaccination;
  household?: HouseholdShort;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { isAdmin } = useVetRole();
  const fixedHousehold = vaccination?.household ?? household;
  const [campaign, setCampaign] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const vaccines = useProductsOf(["VACCINE"]);
  const { households } = useActiveHouseholds(!fixedHousehold);
  const form = useForm({
    household: fixedHousehold ? String(fixedHousehold.id) : "",
    planned_date: vaccination?.planned_date ?? addDays(todayIso(), 1),
    product: vaccination?.product ? String(vaccination.product.id) : "",
    vaccine_name: vaccination?.vaccine_name ?? "",
    dose: vaccination?.dose ?? "",
    birds_planned: vaccination?.birds_planned ? String(vaccination.birds_planned) : "",
    batch: vaccination?.batch ? String(vaccination.batch.id) : "",
    vet: vaccination?.vet ? String(vaccination.vet.id) : "",
    note: vaccination?.note ?? "",
  });
  const householdId = idOrNull(form.values.household);
  const filtered = households.filter((item) =>
    `${item.code} ${item.name} ${item.district}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["household", campaign || values.household ? undefined : REQUIRED],
        ["household_ids", campaign && selected.length === 0 ? "Kamida bitta xonadon tanlang" : undefined],
        ["planned_date", dateWindow(values.planned_date, 30, 365)],
        ["vaccine_name", values.vaccine_name.trim() || values.product ? textRule(values.vaccine_name, 0, 200, false) : "Vaksina nomini kiriting yoki mahsulotni tanlang"],
        ["birds_planned", optionalCount(values.birds_planned)],
      ]),
    async (values) => {
      const body: Body = {
        planned_date: values.planned_date,
        product: idOrNull(values.product),
        vaccine_name: values.vaccine_name.trim(),
        dose: values.dose.trim(),
        birds_planned: values.birds_planned.trim() ? Number(values.birds_planned) : null,
        note: values.note.trim(),
      };
      if (isAdmin) body.vet = idOrNull(values.vet);
      if (vaccination) {
        body.batch = idOrNull(values.batch);
        await api.patch<Vaccination>(`/vet/vaccinations/${vaccination.id}`, body);
        return 1;
      }
      if (campaign) {
        const result = await api.post<{ created: Vaccination[] }>("/vet/vaccinations", { ...body, household_ids: selected });
        return result.created.length;
      }
      await api.post<Vaccination>("/vet/vaccinations", {
        ...body,
        household: Number(values.household),
        batch: idOrNull(values.batch),
      });
      return 1;
    },
    (count) => {
      toast.success(vaccination ? "Emlash yangilandi" : count > 1 ? `${count} ta xonadonga emlash rejalashtirildi` : "Emlash rejalashtirildi");
      onDone();
    },
  );

  const toggle = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 200)));

  return (
    <Modal
      title={vaccination ? `Emlashni tahrirlash · ${vaccination.code}` : "Emlash rejalashtirish"}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={<FormFooter onClose={onClose} pending={form.pending} label={vaccination ? "Saqlash" : "Rejalashtirish"} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!fixedHousehold && (
          <div className="sm:col-span-2">
            <SwitchRow checked={campaign} onChange={setCampaign} label="Ommaviy emlash (bir nechta xonadon)" />
          </div>
        )}
        {campaign ? (
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ink">
                Xonadonlar <span className="text-danger">*</span>
              </span>
              <span className="text-xs tabular-nums text-muted">Tanlangan: {selected.length}</span>
            </div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Qidirish: nom, kod, tuman" aria-label="Xonadon qidirish" />
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button type="button" className="text-accent hover:underline" onClick={() => setSelected(filtered.slice(0, 200).map((item) => item.id))}>
                Ro‘yxatdagilarni tanlash
              </button>
              <button type="button" className="text-muted hover:underline" onClick={() => setSelected([])}>
                Tozalash
              </button>
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {filtered.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-subtle">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="size-4 accent-[var(--color-primary)]" />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {item.code} · {formatNumber(item.bird_count)} bosh
                    </span>
                  </label>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Xonadon topilmadi</li>}
            </ul>
            {form.errors.household_ids && <p className="mt-1 text-xs text-danger">{form.errors.household_ids}</p>}
          </div>
        ) : (
          <>
            <Field label="Xonadon" required className="sm:col-span-2" {...form.field("household")}>
              {fixedHousehold ? (
                <Input id={form.field("household").htmlFor} value={householdLabel(fixedHousehold)} disabled readOnly />
              ) : (
                <HouseholdSelect
                  id={form.field("household").htmlFor}
                  value={form.values.household}
                  invalid={Boolean(form.errors.household)}
                  onChange={(value) => {
                    form.set("household", value);
                    form.set("batch", "");
                  }}
                />
              )}
            </Field>
            <Field label="Partiya" hint="Ixtiyoriy" {...form.field("batch")}>
              <BatchSelect
                householdId={householdId}
                id={form.field("batch").htmlFor}
                value={form.values.batch}
                invalid={Boolean(form.errors.batch)}
                onChange={(value) => form.set("batch", value)}
              />
            </Field>
          </>
        )}
        <Field label="Reja sanasi" required {...form.field("planned_date")}>
          <Input type="date" {...form.control("planned_date")} min={addDays(todayIso(), -30)} max={addDays(todayIso(), 365)} />
        </Field>
        <Field label="Vaksina (ombordan)" hint="Tanlansa, o‘tkazilganda ombordan chiqim qilinadi" {...form.field("product")}>
          <Select {...form.control("product")}>
            <option value="">Ombordan emas</option>
            {vaccines.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatQuantity(product.balance, product.unit)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vaksina nomi" hint={form.values.product ? "Bo‘sh qolsa mahsulot nomi olinadi" : undefined} {...form.field("vaccine_name")}>
          <Input {...form.control("vaccine_name")} maxLength={200} placeholder="Masalan: Nyukasl (La Sota)" />
        </Field>
        <Field label="Doza" {...form.field("dose")}>
          <Input {...form.control("dose")} maxLength={100} placeholder="0.5 ml / bosh" />
        </Field>
        <Field label="Rejadagi parranda" hint="Ixtiyoriy, bosh" {...form.field("birds_planned")}>
          <Input {...form.control("birds_planned")} inputMode="numeric" />
        </Field>
        {isAdmin && (
          <Field label="Veterinar" className="sm:col-span-2" {...form.field("vet")}>
            <VetSelect id={form.field("vet").htmlFor} value={form.values.vet} onChange={(value) => form.set("vet", value)} />
          </Field>
        )}
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} maxLength={500} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/** PLANNED → DONE; with a product and quantity the vaccine leaves the warehouse once (V3 §8.2). */
export function VaccinationCompleteModal({ vaccination, onClose, onDone }: { vaccination: Vaccination; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    done_date: todayIso(),
    birds_vaccinated: vaccination.birds_planned ? String(vaccination.birds_planned) : "",
    quantity_used: "",
    result: "",
    note: vaccination.note,
  });
  const product = vaccination.product;

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["done_date", !values.done_date ? REQUIRED : values.done_date > todayIso() ? "Sana kelajakda bo‘lishi mumkin emas" : undefined],
        ["birds_vaccinated", positiveInt(values.birds_vaccinated)],
        ["quantity_used", optionalQuantity(values.quantity_used)],
        ["result", textRule(values.result, 2, 2000)],
      ]),
    (values) =>
      api.post<Vaccination>(`/vet/vaccinations/${vaccination.id}/complete`, {
        done_date: values.done_date,
        birds_vaccinated: Number(values.birds_vaccinated),
        quantity_used: values.quantity_used.trim() ? toNumber(values.quantity_used) : null,
        result: values.result.trim(),
        note: values.note.trim(),
        file_ids: files.map((file) => file.id),
      }),
    (saved) => {
      toast.success(saved.stock_op_id ? `Emlash o‘tkazildi · ombor chiqimi ${saved.stock_op_id}` : "Emlash o‘tkazildi");
      onDone();
    },
  );

  return (
    <Modal
      title="Emlash natijasi"
      description={`${vaccination.code} · ${vaccination.vaccine_name} · ${vaccination.household.name}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Saqlash" disabled={uploading} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="O‘tkazilgan sana" required {...form.field("done_date")}>
          <Input type="date" {...form.control("done_date")} max={todayIso()} min={addDays(vaccination.planned_date, -30)} />
        </Field>
        <Field label="Emlangan parranda" required {...form.field("birds_vaccinated")}>
          <Input {...form.control("birds_vaccinated")} inputMode="numeric" />
        </Field>
        <Field
          label={product ? `Sarflangan vaksina (${product.unit})` : "Sarflangan miqdor"}
          hint={product ? `${product.name}: ombordan chiqim qilinadi` : "Mahsulot tanlanmagan — ombor o‘zgarmaydi"}
          className="sm:col-span-2"
          {...form.field("quantity_used")}
        >
          <Input {...form.control("quantity_used")} inputMode="decimal" />
        </Field>
        <Field label="Natija" required className="sm:col-span-2" {...form.field("result")}>
          <Textarea {...form.control("result")} rows={3} maxLength={2000} placeholder="Masalan: reaksiya kuzatilmadi" />
        </Field>
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} maxLength={500} />
        </Field>
        <div className="sm:col-span-2">
          <FileUpload purpose="VACCINATION" value={files} onChange={setFiles} onBusyChange={setUploading} error={form.errors.file_ids} label="Rasmlar va hujjatlar" />
        </div>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/* ------------------------------------------------------------- diseases */

export function DiseaseFormModal({
  household,
  visit,
  onClose,
  onDone,
}: {
  household?: HouseholdShort;
  visit?: { id: number; code: string; batch: { id: number } | null };
  onClose: () => void;
  onDone: (disease: DiseaseRecord) => void;
}) {
  const toast = useToast();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    household: household ? String(household.id) : "",
    disease_name: "",
    diagnosed_date: todayIso(),
    cases: "",
    symptoms: "",
    batch: visit?.batch ? String(visit.batch.id) : "",
    notes: "",
  });
  const householdId = idOrNull(form.values.household);

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["household", values.household ? undefined : REQUIRED],
        ["disease_name", textRule(values.disease_name, 2, 200)],
        ["diagnosed_date", !values.diagnosed_date ? REQUIRED : values.diagnosed_date > todayIso() ? "Sana kelajakda bo‘lishi mumkin emas" : undefined],
        ["cases", positiveInt(values.cases)],
      ]),
    (values) =>
      api.post<DiseaseRecord>("/vet/diseases", {
        household: Number(values.household),
        disease_name: values.disease_name.trim(),
        diagnosed_date: values.diagnosed_date,
        cases: Number(values.cases),
        symptoms: values.symptoms.trim(),
        batch: idOrNull(values.batch),
        visit: visit?.id ?? null,
        notes: values.notes.trim(),
        file_ids: files.map((file) => file.id),
      }),
    (saved) => {
      toast.success(`${saved.code}: kasallik qayd etildi`);
      onDone(saved);
    },
  );

  return (
    <Modal
      title="Kasallikni qayd etish"
      description={visit ? `Tekshiruv ${visit.code} bo‘yicha` : "O‘lim holatlari bu yerda emas, “Nobud bo‘lish” orqali kiritiladi."}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Qayd etish" disabled={uploading} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Xonadon" required className="sm:col-span-2" {...form.field("household")}>
          {household ? (
            <Input id={form.field("household").htmlFor} value={householdLabel(household)} disabled readOnly />
          ) : (
            <HouseholdSelect
              id={form.field("household").htmlFor}
              value={form.values.household}
              invalid={Boolean(form.errors.household)}
              onChange={(value) => {
                form.set("household", value);
                form.set("batch", "");
              }}
            />
          )}
        </Field>
        <Field label="Kasallik" required {...form.field("disease_name")}>
          <Input {...form.control("disease_name")} maxLength={200} placeholder="Masalan: Nyukasl kasalligi" />
        </Field>
        <Field label="Aniqlangan sana" required {...form.field("diagnosed_date")}>
          <Input type="date" {...form.control("diagnosed_date")} max={todayIso()} />
        </Field>
        <Field label="Holatlar soni" required hint="Kasal parrandalar, bosh" {...form.field("cases")}>
          <Input {...form.control("cases")} inputMode="numeric" />
        </Field>
        <Field label="Partiya" hint="Ixtiyoriy" {...form.field("batch")}>
          <BatchSelect householdId={householdId} id={form.field("batch").htmlFor} value={form.values.batch} onChange={(value) => form.set("batch", value)} />
        </Field>
        <Field label="Belgilar" className="sm:col-span-2" {...form.field("symptoms")}>
          <Textarea {...form.control("symptoms")} rows={2} maxLength={2000} />
        </Field>
        <Field label="Izoh" className="sm:col-span-2" {...form.field("notes")}>
          <Textarea {...form.control("notes")} rows={2} maxLength={2000} />
        </Field>
        <div className="sm:col-span-2">
          <FileUpload purpose="DISEASE" value={files} onChange={setFiles} onBusyChange={setUploading} error={form.errors.file_ids} label="Rasmlar" />
        </div>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

const DISEASE_STATUS_OPTIONS: { value: DiseaseStatus; label: string }[] = [
  { value: "OPEN", label: "Aniqlangan" },
  { value: "TREATMENT", label: "Davolanmoqda" },
  { value: "RESOLVED", label: "Tuzaldi (yakuniy)" },
];

export function DiseaseUpdateModal({ disease, onClose, onDone }: { disease: DiseaseRecord; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const form = useForm({
    status: disease.status as string,
    resolved_date: todayIso(),
    cases: String(disease.cases),
    notes: disease.notes,
  });
  const resolving = form.values.status === "RESOLVED";

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["cases", positiveInt(values.cases)],
        [
          "resolved_date",
          resolving && (!values.resolved_date || values.resolved_date < disease.diagnosed_date || values.resolved_date > todayIso())
            ? "Sana aniqlangan sanadan bugungacha bo‘lsin"
            : undefined,
        ],
      ]),
    (values) => {
      const body: Body = { cases: Number(values.cases), notes: values.notes.trim() };
      if (values.status !== disease.status) body.status = values.status;
      if (resolving) body.resolved_date = values.resolved_date;
      return api.patch<DiseaseRecord>(`/vet/diseases/${disease.id}`, body);
    },
    (saved) => {
      toast.success(`${saved.code} yangilandi`);
      onDone();
    },
  );

  return (
    <Modal
      title={`Kasallik holati · ${disease.code}`}
      description={`${disease.disease_name} · ${disease.household.name}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Saqlash" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Holat" {...form.field("status")}>
          <Select {...form.control("status")}>
            {DISEASE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Holatlar soni" required {...form.field("cases")}>
          <Input {...form.control("cases")} inputMode="numeric" />
        </Field>
        {resolving && (
          <Field label="Tuzalgan sana" required className="sm:col-span-2" {...form.field("resolved_date")}>
            <Input type="date" {...form.control("resolved_date")} min={disease.diagnosed_date} max={todayIso()} />
          </Field>
        )}
        <Field label="Izoh" className="sm:col-span-2" {...form.field("notes")}>
          <Textarea {...form.control("notes")} rows={3} maxLength={2000} />
        </Field>
      </div>
      {resolving && (
        <Alert tone="warning" className="mt-4">
          “Tuzaldi” yakuniy holat: keyin yozuvni o‘zgartirib bo‘lmaydi.
        </Alert>
      )}
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/* ----------------------------------------------------------- treatments */

export function TreatmentFormModal({
  household,
  disease,
  onClose,
  onDone,
}: {
  household?: HouseholdShort;
  disease?: { id: number; code: string; disease_name: string; household: HouseholdShort };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const fixedHousehold = disease?.household ?? household;
  const drugs = useProductsOf(["VET_DRUG", "VACCINE"]);
  const form = useForm({
    household: fixedHousehold ? String(fixedHousehold.id) : "",
    product: "",
    drug_name: "",
    dosage: "",
    start_date: todayIso(),
    end_date: "",
    quantity_used: "",
    instructions: "",
  });
  const product = drugs.find((item) => String(item.id) === form.values.product);

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["household", values.household ? undefined : REQUIRED],
        ["drug_name", values.drug_name.trim() || values.product ? textRule(values.drug_name, 0, 200, false) : "Preparat nomini kiriting yoki mahsulotni tanlang"],
        ["start_date", !values.start_date ? REQUIRED : values.start_date > addDays(todayIso(), 30) ? "Sana oralig‘i noto‘g‘ri" : undefined],
        ["end_date", values.end_date && values.end_date < values.start_date ? "Tugash sanasi boshlanishidan oldin bo‘lmasin" : undefined],
        ["quantity_used", optionalQuantity(values.quantity_used)],
      ]),
    (values) =>
      api.post<Treatment>("/vet/treatments", {
        household: Number(values.household),
        disease: disease?.id ?? null,
        product: idOrNull(values.product),
        drug_name: values.drug_name.trim(),
        dosage: values.dosage.trim(),
        start_date: values.start_date,
        end_date: values.end_date || null,
        quantity_used: values.quantity_used.trim() ? toNumber(values.quantity_used) : null,
        instructions: values.instructions.trim(),
      }),
    (saved) => {
      toast.success(saved.stock_op_id ? `${saved.code} saqlandi · ombor chiqimi ${saved.stock_op_id}` : `${saved.code} saqlandi`);
      onDone();
    },
  );

  return (
    <Modal
      title="Davolash va tavsiya"
      description={disease ? `${disease.code} · ${disease.disease_name}` : "Ko‘rsatmalar xonadon egasiga yuboriladi."}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Saqlash" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Xonadon" required className="sm:col-span-2" {...form.field("household")}>
          {fixedHousehold ? (
            <Input id={form.field("household").htmlFor} value={householdLabel(fixedHousehold)} disabled readOnly />
          ) : (
            <HouseholdSelect id={form.field("household").htmlFor} value={form.values.household} invalid={Boolean(form.errors.household)} onChange={(value) => form.set("household", value)} />
          )}
        </Field>
        <Field label="Preparat (ombordan)" hint="Tanlansa va miqdor kiritilsa, ombordan chiqim qilinadi" {...form.field("product")}>
          <Select {...form.control("product")}>
            <option value="">Ombordan emas</option>
            {drugs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {formatQuantity(item.balance, item.unit)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preparat nomi" hint={product ? "Bo‘sh qolsa mahsulot nomi olinadi" : undefined} {...form.field("drug_name")}>
          <Input {...form.control("drug_name")} maxLength={200} />
        </Field>
        <Field label="Dozasi" {...form.field("dosage")}>
          <Input {...form.control("dosage")} maxLength={200} placeholder="1 ml / 1 litr suv" />
        </Field>
        <Field label={product ? `Sarflangan miqdor (${product.unit})` : "Sarflangan miqdor"} {...form.field("quantity_used")}>
          <Input {...form.control("quantity_used")} inputMode="decimal" disabled={!product} />
        </Field>
        <Field label="Boshlanish" required {...form.field("start_date")}>
          <Input type="date" {...form.control("start_date")} max={addDays(todayIso(), 30)} />
        </Field>
        <Field label="Tugash" hint="Ixtiyoriy" {...form.field("end_date")}>
          <Input type="date" {...form.control("end_date")} min={form.values.start_date || undefined} />
        </Field>
        <Field label="Ko‘rsatmalar (egasi uchun)" className="sm:col-span-2" {...form.field("instructions")}>
          <Textarea {...form.control("instructions")} rows={4} maxLength={4000} placeholder="Masalan: 5 kun davomida ichimlik suviga qo‘shib berilsin" />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

export function TreatmentUpdateModal({ treatment, onClose, onDone }: { treatment: Treatment; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const form = useForm({ end_date: treatment.end_date ?? "", instructions: treatment.instructions });
  const onSubmit = form.handleSubmit(
    (values) =>
      collect([["end_date", values.end_date && values.end_date < treatment.start_date ? "Tugash sanasi boshlanishidan oldin bo‘lmasin" : undefined]]),
    (values) =>
      api.patch<Treatment>(`/vet/treatments/${treatment.id}`, {
        end_date: values.end_date || null,
        instructions: values.instructions.trim(),
      }),
    () => {
      toast.success(`${treatment.code} yangilandi`);
      onDone();
    },
  );
  return (
    <Modal
      title={`Davolash · ${treatment.code}`}
      description={`${treatment.drug_name} · ${treatment.household.name}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={<FormFooter onClose={onClose} pending={form.pending} label="Saqlash" />}
    >
      <div className="grid gap-4">
        <Field label="Tugash sanasi" {...form.field("end_date")}>
          <Input type="date" {...form.control("end_date")} min={treatment.start_date} />
        </Field>
        <Field label="Ko‘rsatmalar" {...form.field("instructions")}>
          <Textarea {...form.control("instructions")} rows={4} maxLength={4000} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
