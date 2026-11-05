"use client";

import { api } from "@/lib/api";
import { collect, nonNegativeInt, nonNegativeNumber, notFutureDate, positiveInt, required, toNumber, useForm } from "@/lib/form";
import { entries, POULTRY_TYPE_LABELS, todayIso } from "@/lib/format";
import type { Batch, BatchCreatePayload, PoultryType } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function BatchModal({ onClose, onDone }: { onClose: () => void; onDone: (batch: Batch) => void }) {
  const toast = useToast();
  const form = useForm({
    poultry_type: "LAYER",
    breed: "",
    initial_quantity: "",
    age_days: "1",
    supplier: "",
    arrived_at: todayIso(),
    initial_weight_g: "",
    health_status: "Sog‘lom",
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["breed", required(values.breed)],
        ["initial_quantity", positiveInt(values.initial_quantity)],
        ["age_days", nonNegativeInt(values.age_days)],
        ["supplier", required(values.supplier)],
        ["arrived_at", notFutureDate(values.arrived_at)],
        ["initial_weight_g", nonNegativeNumber(values.initial_weight_g, true)],
      ]),
    (values) => {
      const payload: BatchCreatePayload = {
        poultry_type: values.poultry_type as PoultryType,
        breed: values.breed.trim(),
        initial_quantity: toNumber(values.initial_quantity) ?? 0,
        age_days: toNumber(values.age_days) ?? 0,
        supplier: values.supplier.trim(),
        arrived_at: values.arrived_at,
      };
      const weight = toNumber(values.initial_weight_g);
      if (weight !== undefined) payload.initial_weight_g = weight;
      if (values.health_status.trim()) payload.health_status = values.health_status.trim();
      return api.post<Batch>("/batches", payload);
    },
    (batch) => {
      toast.success(`Partiya ${batch.code} qo‘shildi`);
      onDone(batch);
    },
  );

  return (
    <Modal
      title="Yangi partiya"
      description="Markazga kelgan parranda partiyasini ro‘yxatga oling."
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parranda turi" required {...form.field("poultry_type")}>
          <Select {...form.control("poultry_type")}>
            {entries(POULTRY_TYPE_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zoti" required {...form.field("breed")}>
          <Input {...form.control("breed")} placeholder="Masalan: Lohmann Brown" />
        </Field>
        <Field label="Soni (dona)" required {...form.field("initial_quantity")}>
          <Input {...form.control("initial_quantity")} type="number" inputMode="numeric" min={1} step={1} />
        </Field>
        <Field label="Yoshi (kun)" required {...form.field("age_days")}>
          <Input {...form.control("age_days")} type="number" inputMode="numeric" min={0} step={1} />
        </Field>
        <Field label="Yetkazib beruvchi" required {...form.field("supplier")}>
          <Input {...form.control("supplier")} />
        </Field>
        <Field label="Kelgan sana" required {...form.field("arrived_at")}>
          <Input {...form.control("arrived_at")} type="date" max={todayIso()} />
        </Field>
        <Field label="Boshlang‘ich vazn (g)" {...form.field("initial_weight_g")}>
          <Input {...form.control("initial_weight_g")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <Field label="Sog‘lig‘i holati" {...form.field("health_status")}>
          <Input {...form.control("health_status")} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
