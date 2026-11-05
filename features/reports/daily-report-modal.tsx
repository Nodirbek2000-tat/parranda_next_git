"use client";

import { api } from "@/lib/api";
import { collect, nonNegativeInt, nonNegativeNumber, notFutureDate, toNumber, useForm } from "@/lib/form";
import { formatDate, formatNumber, todayIso } from "@/lib/format";
import type { DailyReport, DailyReportCreatePayload, HouseholdBatch, HouseholdShort } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirmedAction } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { householdLabel } from "../options";

interface DailyReportModalProps {
  household: HouseholdShort;
  /** Batches currently in the household (for attributing deaths). */
  batches: readonly HouseholdBatch[];
  /** ADMIN must send `household`; for OWNER the server forces the own household. */
  sendHousehold: boolean;
  onClose: () => void;
  onDone: (report: DailyReport) => void;
}

export function DailyReportModal({ household, batches, sendHousehold, onClose, onDone }: DailyReportModalProps) {
  const toast = useToast();
  const confirmAction = useConfirmedAction();
  const form = useForm({
    date: todayIso(),
    meat_kg: "",
    feed_kg: "",
    deaths: "0",
    avg_weight_g: "",
    batch: "",
    note: "",
  });

  const deaths = toNumber(form.values.deaths) ?? 0;
  const totalBirds = batches.reduce((sum, item) => sum + item.count, 0);

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["date", notFutureDate(values.date)],
        ["feed_kg", nonNegativeNumber(values.feed_kg)],
        [
          "deaths",
          nonNegativeInt(values.deaths) ??
            ((toNumber(values.deaths) ?? 0) > totalBirds ? `Xonadonda ${formatNumber(totalBirds)} ta parranda bor` : undefined),
        ],
        ["meat_kg", nonNegativeNumber(values.meat_kg, true)],
        ["avg_weight_g", nonNegativeNumber(values.avg_weight_g, true)],
      ]),
    (values) => {
      const payload: DailyReportCreatePayload = {
        date: values.date,
        feed_kg: toNumber(values.feed_kg) ?? 0,
        deaths: toNumber(values.deaths) ?? 0,
      };
      const meat = toNumber(values.meat_kg);
      const weight = toNumber(values.avg_weight_g);
      if (meat !== undefined) payload.meat_kg = meat;
      if (weight !== undefined) payload.avg_weight_g = weight;
      if (values.note.trim()) payload.note = values.note.trim();
      if (values.batch && (payload.deaths ?? 0) > 0) payload.batch = Number(values.batch);
      if (sendHousehold) payload.household = household.id;

      return confirmAction(
        {
          title: "Hisobotni tasdiqlang",
          confirmLabel: "Saqlash",
          message: (
            <div className="flex flex-col gap-3">
              <p className="text-muted">Kunlik hisobot saqlangandan so‘ng o‘zgartirib bo‘lmaydi.</p>
              <Summary
                items={[
                  ["Xonadon", householdLabel(household)],
                  ["Sana", formatDate(payload.date)],
                  ["Go‘sht", payload.meat_kg !== undefined ? `${formatNumber(payload.meat_kg)} kg` : "—"],
                  ...(payload.avg_weight_g !== undefined
                    ? ([["O‘rtacha vazn", `${formatNumber(payload.avg_weight_g)} g`]] as const)
                    : []),
                  ["Yem", `${formatNumber(payload.feed_kg)} kg`],
                  ["Nobud", `${formatNumber(payload.deaths)} dona`],
                ]}
              />
              {(payload.deaths ?? 0) > 0 && (
                <Alert tone="warning">Nobud bo‘lgan parrandalar xonadon hisobidan avtomatik chiqariladi.</Alert>
              )}
            </div>
          ),
        },
        () => api.post<DailyReport>("/daily-reports", payload),
      );
    },
    (report) => {
      if (!report) return;
      toast.success(`${formatDate(report.date)} uchun hisobot saqlandi`);
      onDone(report);
    },
  );

  return (
    <Modal
      title="Kunlik hisobot"
      description={householdLabel(household)}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Davom etish
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sana" required className="sm:col-span-2" {...form.field("date")}>
          <Input {...form.control("date")} type="date" max={todayIso()} />
        </Field>
        {/* Meat is the main output; optional because a growing flock has days without meat output. */}
        <Field label="Go‘sht (kg)" hint="Bugun olingan go‘sht; bo‘lmasa bo‘sh qoldiring" {...form.field("meat_kg")}>
          <Input {...form.control("meat_kg")} type="number" inputMode="decimal" min={0} step="0.1" />
        </Field>
        <Field label="O‘rtacha vazn (g)" {...form.field("avg_weight_g")}>
          <Input {...form.control("avg_weight_g")} type="number" inputMode="decimal" min={0} step="1" />
        </Field>
        <Field label="Yem sarfi (kg)" required {...form.field("feed_kg")}>
          <Input {...form.control("feed_kg")} type="number" inputMode="decimal" min={0} step="0.1" />
        </Field>
        <Field label="Nobud bo‘lgan (dona)" {...form.field("deaths")}>
          <Input {...form.control("deaths")} type="number" inputMode="numeric" min={0} step={1} />
        </Field>
        {deaths > 0 && batches.length > 1 && (
          <Field
            label="Partiya (nobud uchun)"
            hint="Tanlanmasa — eng ko‘p parrandali partiya"
            className="sm:col-span-2"
            {...form.field("batch")}
          >
            <Select {...form.control("batch")}>
              <option value="">Avtomatik</option>
              {batches.map((item) => (
                <option key={item.batch_id} value={item.batch_id}>
                  {item.batch_code} · {formatNumber(item.count)} dona
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
