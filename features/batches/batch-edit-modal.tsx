"use client";

import { api } from "@/lib/api";
import { collect, useForm } from "@/lib/form";
import type { Batch, BatchUpdatePayload } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

function lengthRule(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Maydonni to‘ldiring";
  if (trimmed.length > max) return `Ko‘pi bilan ${max} ta belgi`;
  return undefined;
}

/**
 * PATCH /api/batches/{id} (contract V2 section 4): only `health_status` and
 * `supplier` may change; only changed fields are sent (no-op → no request).
 */
export function BatchEditModal({ batch, onClose, onDone }: { batch: Batch; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const form = useForm({ health_status: batch.health_status, supplier: batch.supplier });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["health_status", lengthRule(values.health_status, 120)],
        ["supplier", lengthRule(values.supplier, 200)],
      ]),
    async (values) => {
      const payload: BatchUpdatePayload = {};
      if (values.health_status.trim() !== batch.health_status) payload.health_status = values.health_status.trim();
      if (values.supplier.trim() !== batch.supplier) payload.supplier = values.supplier.trim();
      if (Object.keys(payload).length === 0) return null;
      return api.patch<Batch>(`/batches/${batch.id}`, payload);
    },
    (updated) => {
      toast.success(updated ? `Partiya ${updated.code} yangilandi` : "O‘zgartirish kiritilmadi");
      onDone();
    },
  );

  return (
    <Modal
      title="Partiyani tahrirlash"
      description={`${batch.code}: faqat sog‘lig‘i holati va yetkazib beruvchi o‘zgartiriladi.`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
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
      <div className="grid gap-4">
        <Field label="Sog‘lig‘i holati" required {...form.field("health_status")}>
          <Input {...form.control("health_status")} maxLength={120} />
        </Field>
        <Field label="Yetkazib beruvchi" required {...form.field("supplier")}>
          <Input {...form.control("supplier")} maxLength={200} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
