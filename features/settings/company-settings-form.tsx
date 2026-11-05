"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { collect, required, useForm } from "@/lib/form";
import { formatDate, formatDateTime } from "@/lib/format";
import type { SystemSettings, SystemSettingsPatch } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type TextKey =
  | "company_name"
  | "short_name"
  | "phone"
  | "address"
  | "vaccination_reminder_days"
  | "expiry_reminder_days"
  | "mortality_alert_threshold_pct"
  | "problem_report_days"
  | "reminder_hour";

const INT_RANGES: Partial<Record<TextKey, [number, number]>> = {
  vaccination_reminder_days: [0, 30],
  expiry_reminder_days: [0, 365],
  problem_report_days: [1, 30],
  reminder_hour: [0, 23],
};

function toValues(settings: SystemSettings): Record<TextKey, string> {
  return {
    company_name: settings.company_name,
    short_name: settings.short_name,
    phone: settings.phone,
    address: settings.address,
    vaccination_reminder_days: String(settings.vaccination_reminder_days),
    expiry_reminder_days: String(settings.expiry_reminder_days),
    mortality_alert_threshold_pct: String(settings.mortality_alert_threshold_pct),
    problem_report_days: String(settings.problem_report_days),
    reminder_hour: String(settings.reminder_hour),
  };
}

function intError(value: string, [low, high]: [number, number]): string | undefined {
  const number = Number(value.trim());
  if (!value.trim() || !Number.isInteger(number) || number < low || number > high) {
    return `${low} dan ${high} gacha butun son kiriting.`;
  }
  return undefined;
}

function pctError(value: string): string | undefined {
  const number = Number(value.replace(",", ".").trim());
  if (!value.trim() || !Number.isFinite(number) || number < 0 || number > 100 || !/^\d+([.,]\d)?$/.test(value.trim())) {
    return "0 dan 100 gacha son kiriting (verguldan keyin 1 ta raqam).";
  }
  return undefined;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Kompaniya tab of /settings: `PATCH /api/settings` with the changed fields only (Super Admin). */
export function CompanySettingsForm({ settings }: { settings: SystemSettings }) {
  const toast = useToast();
  const form = useForm(toValues(settings));
  const [lowStock, setLowStock] = useState(settings.low_stock_alert_enabled);
  const [proofRequired, setProofRequired] = useState(settings.delivery_proof_required);
  const initial = toValues(settings);

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["company_name", required(values.company_name) ?? (values.company_name.trim().length < 2 ? "Kamida 2 ta belgi kiriting." : undefined)],
        ["short_name", required(values.short_name)],
        ...(Object.entries(INT_RANGES) as [TextKey, [number, number]][]).map(
          ([key, range]) => [key, intError(values[key], range)] as [string, string | undefined],
        ),
        ["mortality_alert_threshold_pct", pctError(values.mortality_alert_threshold_pct)],
      ]),
    (values) => {
      const patch: SystemSettingsPatch = {};
      for (const key of Object.keys(values) as TextKey[]) {
        if (values[key] === initial[key]) continue;
        if (key in INT_RANGES) (patch as Record<string, number>)[key] = Number(values[key].trim());
        else if (key === "mortality_alert_threshold_pct") patch[key] = Number(values[key].replace(",", ".").trim());
        else (patch as Record<string, string>)[key] = values[key].trim();
      }
      if (lowStock !== settings.low_stock_alert_enabled) patch.low_stock_alert_enabled = lowStock;
      if (proofRequired !== settings.delivery_proof_required) patch.delivery_proof_required = proofRequired;
      return api.patch<SystemSettings>("/settings", patch);
    },
    () => toast.success("Sozlamalar saqlandi"),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Kompaniya" description="Hisobot sarlavhalari va ilova qobig‘ida ko‘rinadi" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Kompaniya nomi" required className="sm:col-span-2" {...form.field("company_name")}>
            <Input {...form.control("company_name")} maxLength={200} />
          </Field>
          <Field label="Qisqa nomi" required hint="Masalan: NNP" {...form.field("short_name")}>
            <Input {...form.control("short_name")} maxLength={20} />
          </Field>
          <Field label="Telefon" {...form.field("phone")}>
            <Input {...form.control("phone")} type="tel" inputMode="tel" placeholder="+998901234567" maxLength={32} />
          </Field>
          <Field label="Manzil" className="sm:col-span-2" {...form.field("address")}>
            <Input {...form.control("address")} maxLength={255} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Eslatmalar va chegaralar" description="Veterinariya, ombor va muammoli xonadonlar qoidalari" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Emlash eslatmasi, kun oldin" hint="0–30" {...form.field("vaccination_reminder_days")}>
            <Input {...form.control("vaccination_reminder_days")} inputMode="numeric" />
          </Field>
          <Field label="Yaroqlilik eslatmasi, kun oldin" hint="0–365" {...form.field("expiry_reminder_days")}>
            <Input {...form.control("expiry_reminder_days")} inputMode="numeric" />
          </Field>
          <Field label="Eslatmalar yuboriladigan soat" {...form.field("reminder_hour")}>
            <Select {...form.control("reminder_hour")}>
              {HOURS.map((hour) => (
                <option key={hour} value={String(hour)}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Yuqori o‘lim chegarasi, %" hint="7 kunlik o‘lim shundan oshsa — muammoli" {...form.field("mortality_alert_threshold_pct")}>
            <Input {...form.control("mortality_alert_threshold_pct")} inputMode="decimal" />
          </Field>
          <Field label="Hisobotsiz kunlar chegarasi" hint="1–30 kun" {...form.field("problem_report_days")}>
            <Input {...form.control("problem_report_days")} inputMode="numeric" />
          </Field>
        </CardBody>
        <div className="flex flex-col divide-y divide-line border-t border-line">
          <SwitchRow
            title="Kam qoldiq ogohlantirishlari"
            description="Qoldiq kamayganda va minimal zaxiraga yetganda xabar yuboriladi"
            checked={lowStock}
            onChange={setLowStock}
          />
          <SwitchRow
            title="Yetkazib berish dalili majburiy"
            description="Haydovchi “Yetkazdim” deyishdan oldin rasm yoki imzo biriktiradi"
            checked={proofRequired}
            onChange={setProofRequired}
          />
        </div>
      </Card>

      {form.formError && <Alert>{form.formError}</Alert>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          {settings.updated_by
            ? `Oxirgi o‘zgarish: ${formatDateTime(settings.updated_at)} · ${settings.updated_by.full_name}`
            : "Standart qiymatlar"}
          {settings.last_reminders_date && ` · Eslatmalar oxirgi marta: ${formatDate(settings.last_reminders_date)}`}
        </p>
        <Button type="submit" loading={form.pending} icon={<Save className="size-4" aria-hidden />}>
          Saqlash
        </Button>
      </div>
    </form>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
