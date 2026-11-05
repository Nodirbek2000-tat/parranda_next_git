"use client";

import { api } from "@/lib/api";
import { collect, notFutureDate, positiveInt, REQUIRED, toNumber, useForm } from "@/lib/form";
import { formatDate, formatNumber, MOVEMENT_TYPE_LABELS, todayIso } from "@/lib/format";
import type { HouseholdShort, Movement, MovementCreatePayload, MovementType } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirmedAction } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { householdLabel, useBatchOptions, useHouseholdBatches, useHouseholdOptions } from "../options";

export const ALL_MOVEMENT_TYPES: readonly MovementType[] = ["DISTRIBUTE", "RETURN", "DEATH", "OUT"];

/** Types that require a household (contract: DISTRIBUTE / RETURN). */
const NEEDS_HOUSEHOLD: ReadonlySet<MovementType> = new Set(["DISTRIBUTE", "RETURN"]);

interface PresetBatch {
  id: number;
  code: string;
  center_stock?: number;
}

interface MovementModalProps {
  /** Fixed batch (batches page, household batch row). */
  batch?: PresetBatch;
  /** Fixed household (household page, owner page). Without `batch`, batches are taken from this household. */
  household?: HouseholdShort;
  types?: readonly MovementType[];
  initialType?: MovementType;
  /** Prefilled note (e.g. the vet visit code `VT-000004`, V3 §8.6). */
  initialNote?: string;
  onClose: () => void;
  onDone: (movement: Movement) => void;
}

export function MovementModal({
  batch,
  household,
  types = ALL_MOVEMENT_TYPES,
  initialType,
  initialNote = "",
  onClose,
  onDone,
}: MovementModalProps) {
  const toast = useToast();
  const confirmAction = useConfirmedAction();
  const form = useForm({
    type: initialType ?? types[0],
    batch: batch ? String(batch.id) : "",
    household: household ? String(household.id) : "",
    quantity: "",
    date: todayIso(),
    note: initialNote,
  });

  const type = form.values.type as MovementType;
  const householdOptions = useHouseholdOptions(!household);
  const householdId = household?.id ?? (form.values.household ? Number(form.values.household) : null);
  const householdBatches = useHouseholdBatches(householdId);
  const batchId = form.values.batch ? Number(form.values.batch) : null;

  const needsHousehold = NEEDS_HOUSEHOLD.has(type);
  // DISTRIBUTE and centre operations take birds from the centre stock, the rest from the household.
  const fromHousehold = householdId !== null && type !== "DISTRIBUTE";
  const centerBatches = useBatchOptions(!batch && !fromHousehold);
  const centerChoices = (centerBatches.data?.results ?? []).filter((item) => item.center_stock > 0);
  const householdChoicesForBatch = householdBatches.data ?? [];

  // Birds available for this operation (contract validation rules).
  let available: number | undefined;
  if (fromHousehold) {
    if (householdBatches.data && batchId) {
      available = householdBatches.data.find((item) => item.batch_id === batchId)?.count ?? 0;
    }
  } else if (batch?.center_stock !== undefined) {
    available = batch.center_stock;
  } else if (batchId) {
    available = centerBatches.data?.results.find((item) => item.id === batchId)?.center_stock;
  }

  const householdChoices = (householdOptions.data?.results ?? []).filter(
    (item) => type !== "DISTRIBUTE" || item.is_active,
  );
  const selectedHousehold =
    household ?? householdOptions.data?.results.find((item) => item.id === householdId) ?? null;
  const selectedBatchCode =
    batch?.code ??
    (fromHousehold
      ? householdChoicesForBatch.find((item) => item.batch_id === batchId)?.batch_code
      : centerBatches.data?.results.find((item) => item.id === batchId)?.code) ??
    "";

  const onSubmit = form.handleSubmit(
    (values) => {
      const quantityError = positiveInt(values.quantity);
      const quantity = toNumber(values.quantity) ?? 0;
      return collect([
        ["batch", values.batch ? undefined : REQUIRED],
        ["household", needsHousehold && !values.household ? "Xonadonni tanlang" : undefined],
        [
          "quantity",
          quantityError ??
            (available !== undefined && quantity > available
              ? `Yetarli parranda yo‘q. Mavjud: ${formatNumber(available)}`
              : undefined),
        ],
        ["date", notFutureDate(values.date)],
      ]);
    },
    (values) => {
      const payload: MovementCreatePayload = {
        batch: Number(values.batch),
        type,
        quantity: toNumber(values.quantity) ?? 0,
        date: values.date,
      };
      if (values.household) payload.household = Number(values.household);
      if (values.note.trim()) payload.note = values.note.trim();
      return confirmAction(
        {
          title: "Amalni tasdiqlang",
          tone: type === "DEATH" || type === "OUT" ? "danger" : "primary",
          confirmLabel: "Tasdiqlash",
          message: (
            <div className="flex flex-col gap-3">
              <p className="text-muted">Operatsiya saqlangandan so‘ng o‘zgartirib bo‘lmaydi.</p>
              <Summary
                items={[
                  ["Amal", MOVEMENT_TYPE_LABELS[type]],
                  ["Partiya", selectedBatchCode || "—"],
                  ["Xonadon", selectedHousehold ? householdLabel(selectedHousehold) : "Markaz"],
                  ["Miqdori", `${formatNumber(payload.quantity)} dona`],
                  ["Sana", formatDate(values.date)],
                ]}
              />
            </div>
          ),
        },
        () => api.post<Movement>("/movements", payload),
      );
    },
    (movement) => {
      if (!movement) return;
      toast.success(`${movement.type_display} qayd etildi · ${movement.op_id}`);
      onDone(movement);
    },
  );

  return (
    <Modal
      title={types.length === 1 ? MOVEMENT_TYPE_LABELS[types[0]] : "Parranda harakati"}
      description={batch ? `Partiya ${batch.code}` : household ? householdLabel(household) : undefined}
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
        {types.length > 1 && (
          <Field label="Amal turi" required className="sm:col-span-2" {...form.field("type")}>
            <Select
              {...form.control("type")}
              onChange={(event) => {
                form.set("type", event.target.value);
                // The batch list depends on the type (centre vs household stock).
                if (!batch) form.set("batch", "");
              }}
            >
              {types.map((value) => (
                <option key={value} value={value}>
                  {MOVEMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!batch && (
          <Field label="Partiya" required className="sm:col-span-2" {...form.field("batch")}>
            <Select
              {...form.control("batch")}
              disabled={fromHousehold ? !householdBatches.data : !centerBatches.data}
            >
              <option value="">Tanlang</option>
              {fromHousehold
                ? householdChoicesForBatch.map((item) => (
                    <option key={item.batch_id} value={item.batch_id}>
                      {item.batch_code} · {item.poultry_type_display} · {formatNumber(item.count)} dona
                    </option>
                  ))
                : centerChoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.poultry_type_display} · markazda {formatNumber(item.center_stock)} dona
                    </option>
                  ))}
            </Select>
          </Field>
        )}

        {!household && (
          <Field
            label="Xonadon"
            required={needsHousehold}
            className="sm:col-span-2"
            hint={needsHousehold ? undefined : "Bo‘sh qoldirilsa, markazdagi parrandadan hisoblanadi"}
            {...form.field("household")}
          >
            <Select {...form.control("household")} disabled={householdOptions.loading && !householdOptions.data}>
              <option value="">{needsHousehold ? "Tanlang" : "Markaz (xonadonsiz)"}</option>
              {householdChoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {householdLabel(item)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Miqdori (dona)"
          required
          hint={available !== undefined ? `Mavjud: ${formatNumber(available)} dona` : undefined}
          {...form.field("quantity")}
        >
          <Input {...form.control("quantity")} type="number" inputMode="numeric" min={1} step={1} />
        </Field>
        <Field label="Sana" required {...form.field("date")}>
          <Input {...form.control("date")} type="date" max={todayIso()} />
        </Field>
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} />
        </Field>
      </div>
      {householdOptions.error && <Alert className="mt-4">{householdOptions.error.message}</Alert>}
      {householdBatches.error && <Alert className="mt-4">{householdBatches.error.message}</Alert>}
      {centerBatches.error && <Alert className="mt-4">{centerBatches.error.message}</Alert>}
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
