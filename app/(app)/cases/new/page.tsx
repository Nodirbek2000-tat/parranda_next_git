"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { DocumentUpload, GpsButton, LivePhotos, type Coords, type UploadedDoc, type UploadedPhoto } from "@/components/media";
import { useToast } from "@/components/toast";
import { Alert, Button, Card, Field, Input, LinkButton, Loadable, PageHeader, Select, Textarea } from "@/components/ui";
import { api, ApiError, errorMessage, listOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney, fmtNumber } from "@/lib/format";
import type { CaseDetail, Package } from "@/lib/types";
import { REGION, SAMARQAND_DISTRICTS } from "@/lib/districts";
import { useApi } from "@/lib/use-api";

const TEXT_FIELDS = [
  { key: "owner_full_name", label: "Xonadon egasi (F.I.Sh.)", required: true, autoComplete: "name" },
  { key: "owner_phone", label: "Telefon", required: true, autoComplete: "tel", placeholder: "+998 90 123 45 67" },
  { key: "name", label: "Xonadon nomi", required: false, placeholder: "Bo‘sh qolsa, egasining ismi olinadi" },
  { key: "region", label: "Viloyat", required: true },
  { key: "district", label: "Tuman", required: true },
  { key: "mfy", label: "MFY", required: true },
  { key: "address", label: "Manzil (ko‘cha, uy)", required: true },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]["key"];

export default function NewCasePage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const packages = useApi<Package[] | { results?: Package[] }>("/packages");
  const [values, setValues] = useState<Record<TextKey, string>>({ owner_full_name: "", owner_phone: "", name: "", region: REGION, district: "", mfy: "", address: "" });
  const [packageId, setPackageId] = useState<number | null>(null);
  const [conclusion, setConclusion] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    for (const field of TEXT_FIELDS) if (field.required && !values[field.key].trim()) next[field.key] = "Majburiy maydon";
    if (values.owner_phone && values.owner_phone.replace(/\D/g, "").length < 9) next.owner_phone = "Telefon raqamini to‘liq kiriting";
    if (!packageId) next.package_id = "Paketni tanlang";
    if (!conclusion.trim()) next.conclusion = "Xulosani yozing";
    if (!coords) next.gps = "GPS joylashuvini aniqlang";
    if (!photos.length) next.photo_ids = "Kamida bitta jonli rasm oling";
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError("Maydonlarni to‘ldiring.");
      return;
    }
    setFormError(null);
    const body = {
      ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, values[f.key].trim()])),
      name: values.name.trim() || values.owner_full_name.trim(),
      latitude: coords ? Number(coords.lat.toFixed(6)) : null,
      longitude: coords ? Number(coords.lng.toFixed(6)) : null,
      package_id: packageId,
      conclusion: conclusion.trim(),
      photo_ids: photos.map((p) => p.id),
      document_ids: docs.map((d) => d.id),
    };
    await confirm({
      title: "Xonadonni yuborish",
      message: "Inspeksiya ma’lumotlari saqlanadi va HR tekshiruviga yuboriladi.",
      confirmLabel: "Yuborish",
      onConfirm: async () => {
        try {
          const created = await api.post<CaseDetail>("/cases", body);
          toast.success(`${created.code ?? "Xonadon"} yaratildi`);
          router.replace(created.id ? `/cases/${created.id}` : "/cases");
        } catch (caught) {
          if (caught instanceof ApiError) setErrors(caught.fields);
          setFormError(errorMessage(caught));
          throw caught;
        }
      },
    });
  };

  return (
    <>
      <LinkButton href="/cases" variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-2 mb-2">
        Xonadonlar
      </LinkButton>
      <PageHeader title="Yangi xonadon" subtitle="1-bosqich: inspeksiya" />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} htmlFor={field.key} required={field.required} error={errors[field.key]} className={field.key === "address" ? "sm:col-span-2" : undefined}>
              {field.key === "district" ? (
                <Select
                  id="district"
                  value={values.district}
                  onChange={(e) => setValues((prev) => ({ ...prev, district: e.target.value }))}
                  invalid={!!errors.district}
                >
                  <option value="">— tanlang —</option>
                  {SAMARQAND_DISTRICTS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              ) : (
              <Input
                id={field.key}
                value={values[field.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                invalid={!!errors[field.key]}
                inputMode={field.key === "owner_phone" ? "tel" : undefined}
                autoComplete={"autoComplete" in field ? field.autoComplete : "off"}
                placeholder={"placeholder" in field ? field.placeholder : undefined}
              />
              )}
            </Field>
          ))}
          <Field label="Joylashuv (GPS)" required error={errors.gps ?? errors.latitude ?? errors.longitude} className="sm:col-span-2">
            <GpsButton value={coords} onChange={setCoords} />
          </Field>
        </Card>

        <Card>
          <Field label="Paket" required error={errors.package_id}>
            <Loadable data={packages.data} error={packages.error} reload={packages.reload}>
              {(data) => (
                <div className="grid gap-2 sm:grid-cols-3">
                  {listOf(data).map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setPackageId(pkg.id)}
                      aria-pressed={packageId === pkg.id}
                      className={cn(
                        "rounded-xl border-2 p-3 text-left transition-colors",
                        packageId === pkg.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong",
                      )}
                    >
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {pkg.area_sotix ? `${fmtNumber(pkg.area_sotix)} sotix` : ""}
                        {pkg.capacity_birds ? ` · ${fmtNumber(pkg.capacity_birds)} bosh` : ""}
                      </p>
                      {pkg.price ? <p className="mt-1 text-sm font-medium text-primary">{fmtMoney(pkg.price)}</p> : null}
                    </button>
                  ))}
                </div>
              )}
            </Loadable>
          </Field>
        </Card>

        <Card className="flex flex-col gap-4">
          <Field label="Jonli rasmlar (kamida 1 ta)" required error={errors.photo_ids}>
            <LivePhotos value={photos} onChange={setPhotos} coords={coords} onCoords={setCoords} />
          </Field>
          <Field label="Inspektor xulosasi" htmlFor="conclusion" required error={errors.conclusion}>
            <Textarea id="conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value)} invalid={!!errors.conclusion} placeholder="Joy, sharoit, oila haqida xulosa" />
          </Field>
          <Field label="Hujjatlar (ixtiyoriy)" error={errors.document_ids}>
            <DocumentUpload value={docs} onChange={setDocs} />
          </Field>
        </Card>

        {formError && <Alert>{formError}</Alert>}
        <Button type="submit" icon={<Send className="size-4" aria-hidden />} className="w-full sm:w-auto sm:self-start">
          Saqlash va yuborish
        </Button>
      </form>
    </>
  );
}
